/**
 * useCycleConsistency — issue #235 F2.1
 *
 * Cobertura:
 *  C1 — sem trades / inputs ausentes → metrics null, loading=false
 *  C2 — happy path: trades + plan + cycle válidos com Selic mockada
 *  C3 — plan sem rrTarget → cvNormalized.insufficientReason='no_target_rr'
 *  C4 — plan sem pl inicial → sharpe.insufficientReason='no_pl_start'
 *  C5 — getSelicForDateFn rejeita → error capturado, loading=false, síncronas preservadas (#385)
 *  C6 — re-render com trades atualizados → recomputa
 *  C7 — unmount durante async → não setState pós-unmount (sem warning)
 *
 * Issue #387 B1 — deps por valor (identidade nova a cada snapshot do Firestore não
 * pode reentrar no efeito; só mudança de conteúdo relevante recomputa):
 *  C8  — array `trades` novo, conteúdo idêntico → NÃO recomputa
 *  C9  — objeto `plan` novo, rrTarget/pl idênticos → NÃO recomputa
 *  C10 — campo do trade que nenhum helper lê (escrita de CF) → NÃO recomputa
 *  C11 — `result` alterado → recomputa
 *  C12 — `mepPrice` alterado (campo lido só por computeAvgExcursion) → recomputa
 *  C13 — janela do ciclo alterada → recomputa
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCycleConsistency } from '../../hooks/useCycleConsistency';

// --- Fixtures ----------------------------------------------------------------

const CYCLE_START = '2026-02-01';
const CYCLE_END = '2026-02-28';

const mkTrade = (date, result, overrides = {}) => ({
  date,
  status: 'CLOSED',
  result,
  side: 'LONG',
  entry: 100,
  mepPrice: 102,
  menPrice: 99,
  ...overrides,
});

// 6 dias distintos com trade — supera default minDays=5 dos helpers
const happyTrades = [
  mkTrade('2026-02-02', 100),
  mkTrade('2026-02-05', -50),
  mkTrade('2026-02-09', 200),
  mkTrade('2026-02-13', -80),
  mkTrade('2026-02-17', 150),
  mkTrade('2026-02-21', -30),
];

const happyPlan = {
  pl: 10000,
  rrTarget: 2,
};

// Refs estáveis para evitar loop em useEffect (deps por referência)
const EMPTY_TRADES = [];
const PLAN_NO_RR = { pl: 10000 };
const PLAN_NO_PL = { rrTarget: 2 };

const mockSelicFn = vi.fn(async () => ({
  rateDaily: 0.0006,
  source: 'BCB',
  dateUsed: '2026-02-02',
  isCarryForward: false,
  isFallback: false,
}));

// --- Tests -------------------------------------------------------------------

describe('useCycleConsistency', () => {
  beforeEach(() => {
    mockSelicFn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C1 ------------------------------------------------------------------------
  it('C1 — sem trades retorna metrics null e loading=false', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: EMPTY_TRADES,
        plan: happyPlan,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.sharpe).not.toBeNull();
    expect(result.current.sharpe.insufficientReason).toBe('min_days');
    expect(result.current.cvNormalized).not.toBeNull();
    expect(result.current.cvNormalized.insufficientReason).toBe('min_days');
    expect(result.current.avgExcursion).not.toBeNull();
    expect(result.current.avgExcursion.insufficientReason).toBe('no_trades');
  });

  it('C1b — inputs ausentes (sem cycleStart) retorna shape null/null/null', () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: happyPlan,
        cycleStart: null,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.sharpe).toBeNull();
    expect(result.current.cvNormalized).toBeNull();
    expect(result.current.avgExcursion).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockSelicFn).not.toHaveBeenCalled();
  });

  // C2 ------------------------------------------------------------------------
  it('C2 — happy path: 3 métricas populadas, loading=false, error=null', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: happyPlan,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();

    expect(result.current.sharpe).toMatchObject({
      source: 'BCB',
      fallbackUsed: false,
      daysWithTrade: 6,
    });
    expect(typeof result.current.sharpe.value).toBe('number');
    expect(Number.isFinite(result.current.sharpe.value)).toBe(true);

    expect(result.current.cvNormalized).toMatchObject({ daysWithTrade: 6 });
    expect(typeof result.current.cvNormalized.value).toBe('number');
    expect(typeof result.current.cvNormalized.cvObs).toBe('number');
    expect(typeof result.current.cvNormalized.cvExp).toBe('number');

    expect(result.current.avgExcursion).toMatchObject({
      totalTrades: 6,
      tradesWithData: 6,
      coverage: 1,
      coverageBelowThreshold: false,
    });
    expect(result.current.avgExcursion.avgMEP).toBeCloseTo(2, 5);
    expect(result.current.avgExcursion.avgMEN).toBeCloseTo(-1, 5);

    expect(mockSelicFn).toHaveBeenCalledTimes(6);
  });

  // C3 ------------------------------------------------------------------------
  it('C3 — plan sem rrTarget: cvNormalized=no_target_rr, sharpe e avgExcursion ok', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: PLAN_NO_RR,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.cvNormalized.insufficientReason).toBe('no_target_rr');
    expect(result.current.cvNormalized.value).toBeNull();
    expect(typeof result.current.sharpe.value).toBe('number');
    expect(result.current.avgExcursion.tradesWithData).toBe(6);
  });

  // C4 ------------------------------------------------------------------------
  it('C4 — plan sem pl inicial: sharpe.insufficientReason=no_pl_start, demais ok', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: PLAN_NO_PL,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.sharpe.value).toBeNull();
    expect(result.current.sharpe.insufficientReason).toBe('no_pl_start');
    expect(typeof result.current.cvNormalized.value).toBe('number');
    expect(result.current.avgExcursion.tradesWithData).toBe(6);
    // Sharpe nem chamou Selic (curto-circuito no_pl_start)
    expect(mockSelicFn).not.toHaveBeenCalled();
  });

  // C5 ------------------------------------------------------------------------
  it('C5 — getSelicForDateFn rejeita: error capturado, loading=false', async () => {
    const errFn = vi.fn(async () => {
      throw new Error('selic boom');
    });
    const opts = { getSelicForDateFn: errFn };

    const { result } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: happyPlan,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('selic boom');
    expect(result.current.sharpe).toBeNull();
    // #385 — CV e MEP/MEN são puros, síncronos e não dependem de Selic: SOBREVIVEM à
    // falha do Sharpe. Antes eram zerados junto, e o card apagava três métricas boas
    // por causa de uma. `error` passou a significar "esta métrica não veio", não
    // "não há nada a mostrar".
    expect(result.current.cvNormalized).not.toBeNull();
    expect(result.current.avgExcursion).not.toBeNull();
  });

  // C6 ------------------------------------------------------------------------
  it('C6 — re-render com trades atualizados recomputa', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender } = renderHook(
      (props) => useCycleConsistency(props),
      {
        initialProps: {
          trades: happyTrades,
          plan: happyPlan,
          cycleStart: CYCLE_START,
          cycleEnd: CYCLE_END,
          opts,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.avgExcursion.totalTrades).toBe(6);

    const moreTrades = [...happyTrades, mkTrade('2026-02-25', 50)];
    rerender({
      trades: moreTrades,
      plan: happyPlan,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
      opts,
    });

    await waitFor(() => {
      expect(result.current.avgExcursion?.totalTrades).toBe(7);
    });
    expect(result.current.cvNormalized.daysWithTrade).toBe(7);
  });

  // C7 ------------------------------------------------------------------------
  it('C7 — unmount durante async não dispara setState pós-unmount', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let resolveSelic;
    const slowSelicFn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSelic = resolve;
        })
    );

    const opts = { getSelicForDateFn: slowSelicFn };
    const { unmount } = renderHook(() =>
      useCycleConsistency({
        trades: happyTrades,
        plan: happyPlan,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        opts,
      })
    );

    // Aguarda a promessa lenta começar (helper computeCycleSharpe chama getSelicFn)
    await waitFor(() => {
      expect(slowSelicFn).toHaveBeenCalled();
    });

    unmount();

    // Resolve depois do unmount — não deve disparar setState
    await act(async () => {
      resolveSelic({
        rateDaily: 0.0006,
        source: 'BCB',
        dateUsed: '2026-02-02',
        isCarryForward: false,
        isFallback: false,
      });
      await Promise.resolve();
    });

    // Nenhum erro/warning de "setState on unmounted component" deve ter sido logado
    const setStateWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0] ?? '').includes('unmounted')
    );
    expect(setStateWarning).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  // C8..C13 — issue #387 B1 -----------------------------------------------------
  // Helper: monta o hook no estado estável (loading=false, 6 lookups de Selic feitos)
  // e devolve `rerender` + um snapshot das referências de estado. Um recálculo troca
  // essas referências e chama a Selic de novo; a ausência das duas coisas é a prova
  // de que o efeito não reentrou.
  const renderSettled = async (opts) => {
    const baseProps = {
      trades: happyTrades,
      plan: happyPlan,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
      opts,
    };
    const { result, rerender } = renderHook((props) => useCycleConsistency(props), {
      initialProps: baseProps,
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockSelicFn).toHaveBeenCalledTimes(6);
    return { result, rerender, baseProps, before: { ...result.current } };
  };

  it('C8 — array trades de identidade nova com conteúdo idêntico NÃO recomputa', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps, before } = await renderSettled(opts);

    // Mesmo conteúdo, tudo novo: array novo + cada trade clonado (é o que o snapshot
    // do Firestore entrega a cada escrita da cascata de CFs).
    rerender({ ...baseProps, trades: happyTrades.map((t) => ({ ...t })) });

    expect(result.current.loading).toBe(false);
    expect(mockSelicFn).toHaveBeenCalledTimes(6);
    expect(result.current.sharpe).toBe(before.sharpe);
    expect(result.current.cvNormalized).toBe(before.cvNormalized);
    expect(result.current.avgExcursion).toBe(before.avgExcursion);
  });

  it('C9 — objeto plan de identidade nova com rrTarget/pl idênticos NÃO recomputa', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps, before } = await renderSettled(opts);

    rerender({ ...baseProps, plan: { ...happyPlan } });

    expect(result.current.loading).toBe(false);
    expect(mockSelicFn).toHaveBeenCalledTimes(6);
    expect(result.current.cvNormalized).toBe(before.cvNormalized);
    expect(result.current.sharpe).toBe(before.sharpe);
  });

  it('C10 — campo do trade que nenhum helper lê (escrita de CF) NÃO recomputa', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps, before } = await renderSettled(opts);

    // Simula a cascata: CF grava score comportamental, flags e timestamp no trade.
    // `status` entra aqui de propósito — os helpers deixaram de filtrar por ele
    // (trade é monolítico desde a criação), então não faz parte da assinatura.
    rerender({
      ...baseProps,
      trades: happyTrades.map((t, i) => ({
        ...t,
        status: 'REVIEWED',
        behaviorScore: 7 + i,
        updatedAt: '2026-08-24T12:00:00Z',
      })),
    });

    expect(result.current.loading).toBe(false);
    expect(mockSelicFn).toHaveBeenCalledTimes(6);
    expect(result.current.sharpe).toBe(before.sharpe);
    expect(result.current.cvNormalized).toBe(before.cvNormalized);
    expect(result.current.avgExcursion).toBe(before.avgExcursion);
  });

  it('C11 — result alterado recomputa e atualiza a métrica', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps, before } = await renderSettled(opts);
    const cvObsBefore = before.cvNormalized.cvObs;

    const changed = happyTrades.map((t, i) => (i === 0 ? { ...t, result: 900 } : t));
    rerender({ ...baseProps, trades: changed });

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockSelicFn).toHaveBeenCalledTimes(12);
    expect(result.current.cvNormalized.cvObs).not.toBeCloseTo(cvObsBefore, 6);
  });

  it('C12 — mepPrice alterado recomputa MEP/MEN', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps, before } = await renderSettled(opts);
    expect(before.avgExcursion.avgMEP).toBeCloseTo(2, 5);

    const changed = happyTrades.map((t) => ({ ...t, mepPrice: 108 }));
    rerender({ ...baseProps, trades: changed });

    await waitFor(() => {
      expect(result.current.avgExcursion.avgMEP).toBeCloseTo(8, 5);
    });
    expect(result.current.loading).toBe(false);
  });

  it('C13 — mudança de cycleStart/cycleEnd recomputa', async () => {
    const opts = { getSelicForDateFn: mockSelicFn };
    const { result, rerender, baseProps } = await renderSettled(opts);

    rerender({ ...baseProps, cycleEnd: '2026-02-14' });

    await waitFor(() => {
      expect(result.current.avgExcursion.totalTrades).toBe(4);
    });
    expect(result.current.loading).toBe(false);
  });
});
