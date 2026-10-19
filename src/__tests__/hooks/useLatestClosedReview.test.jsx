/**
 * useLatestClosedReview.test.jsx
 * @description Testes do hook que lê a última review CLOSED do aluno
 *              (issue #164 — E1: SwotAnalysis consome review.swot).
 * @see src/hooks/useLatestClosedReview.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnSnapshot = vi.fn();
const whereCalls = [];
const orderByCalls = [];
const limitCalls = [];

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => {
    whereCalls.push(args);
    return { __type: 'where', args };
  },
  orderBy: (...args) => {
    orderByCalls.push(args);
    return { __type: 'orderBy', args };
  },
  limit: (n) => {
    limitCalls.push(n);
    return { __type: 'limit', n };
  },
  onSnapshot: (q, onNext, onError) => {
    mockOnSnapshot(q, onNext, onError);
    return () => {};
  },
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import useLatestClosedReview, { reviewInCycleWindow } from '../../hooks/useLatestClosedReview';

describe('useLatestClosedReview', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear();
    whereCalls.length = 0;
    orderByCalls.length = 0;
    limitCalls.length = 0;
  });

  it('não dispara listener e retorna review=null, loading=false quando studentId é null', () => {
    const { result } = renderHook(() => useLatestClosedReview(null));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.review).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('inscreve onSnapshot quando studentId é fornecido', () => {
    renderHook(() => useLatestClosedReview('student-1'));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('aplica where(status == CLOSED), orderBy(weekStart desc) e limit(20)', () => {
    renderHook(() => useLatestClosedReview('student-1'));
    const statusWhere = whereCalls.find(args => args[0] === 'status');
    expect(statusWhere).toBeDefined();
    expect(statusWhere[1]).toBe('==');
    expect(statusWhere[2]).toBe('CLOSED');
    const orderBy = orderByCalls.find(args => args[0] === 'weekStart');
    expect(orderBy).toBeDefined();
    expect(orderBy[1]).toBe('desc');
    // v1.1.0: query broader, filtro de planId é client-side (resiliente a planId stale)
    expect(limitCalls).toContain(20);
  });

  it('filtro de planId é aplicado client-side (não via where) para tolerar planId stale', () => {
    renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    // v1.1.0: não adiciona mais where(planId) no servidor — filtro é client-side
    // para aceitar review.planId top-level E review.frozenSnapshot.planContext.planId
    const planIdWhere = whereCalls.find(args => args[0] === 'planId');
    expect(planIdWhere).toBeUndefined();
  });

  it('filtra por planId top-level no client', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ planId: 'plan-other', weekStart: '2026-04-20' }) },
          { id: 'r2', data: () => ({ planId: 'plan-abc',   weekStart: '2026-04-13', swot: { strengths: ['x'] } }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r2');
  });

  it('filtra por frozenSnapshot.planContext.planId quando top-level está stale', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ planId: 'plan-old', frozenSnapshot: { planContext: { planId: 'plan-abc' } }, weekStart: '2026-04-13', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r1');
  });

  const OUT = { startISO: '2026-10-01', endISO: '2026-10-31' };

  it('filtra pela janela do ciclo: vence a mais recente que cruza a janela (#486)', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', null, OUT));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r-nov', data: () => ({ periodStart: '2026-11-02', periodEnd: '2026-11-06', weekStart: '2026-11-02', swot: {} }) },
          { id: 'r-oct', data: () => ({ periodStart: '2026-10-13', periodEnd: '2026-10-17', weekStart: '2026-10-13', swot: { strengths: ['x'] } }) },
          { id: 'r-cross', data: () => ({ periodStart: '2026-09-30', periodEnd: '2026-10-08', weekStart: '2026-09-30', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r-oct');
  });

  it('review do modelo atual (cycleKey null) é achada pelo ciclo selecionado (#486)', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', 'plan-abc', OUT));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ planId: 'plan-abc', cycleKey: null, frozenSnapshot: { planContext: { planId: 'plan-abc', cycleKey: null } }, periodStart: '2026-10-05', periodEnd: '2026-10-16', weekStart: '2026-10-05', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r1');
  });

  it('ignora o cycleKey gravado: review fora da janela não aparece mesmo com chave igual (#486)', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', null, OUT));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ cycleKey: '2026-10', weekStart: '2026-09-14', weekEnd: '2026-09-18', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review).toBeNull();
  });

  it('janela null não filtra ciclo (última review CLOSED) (#289)', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', null, null));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r-latest', data: () => ({ weekStart: '2026-05-04', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r-latest');
  });

  it('recria o listener quando a janela do ciclo muda (#289/#486)', () => {
    const { rerender } = renderHook(({ w }) => useLatestClosedReview('student-1', null, w), {
      initialProps: { w: OUT },
    });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ w: { ...OUT } }); // mesma janela, objeto novo → não recria
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ w: { startISO: '2026-11-01', endISO: '2026-11-30' } });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('popula review com o primeiro doc do snapshot', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          {
            id: '2026-W16-1',
            data: () => ({
              status: 'CLOSED',
              weekStart: '2026-04-13',
              swot: { strengths: ['ok'], weaknesses: [], opportunities: [], threats: [] },
            }),
          },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review).not.toBeNull();
    expect(result.current.review.id).toBe('2026-W16-1');
    expect(result.current.review.swot.strengths).toEqual(['ok']);
  });

  it('retorna review=null quando snapshot está vazio', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({ empty: true, docs: [] });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review).toBeNull();
  });

  it('propaga erro do Firestore', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, , onError] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onError(new Error('permission-denied'));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.review).toBeNull();
  });

  it('recria o listener quando studentId muda', () => {
    const { rerender } = renderHook(({ sid }) => useLatestClosedReview(sid), {
      initialProps: { sid: 'student-1' },
    });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ sid: 'student-2' });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });
});

describe('reviewInCycleWindow (#486)', () => {
  const W = { startISO: '2026-10-01', endISO: '2026-10-31' };

  it('sem janela, toda review pertence', () => {
    expect(reviewInCycleWindow({}, null)).toBe(true);
  });

  it('período dentro da janela pertence', () => {
    expect(reviewInCycleWindow({ periodStart: '2026-10-13', periodEnd: '2026-10-17' }, W)).toBe(true);
  });

  it('período que atravessa a virada pertence aos dois ciclos', () => {
    const r = { periodStart: '2026-09-25', periodEnd: '2026-10-02' };
    expect(reviewInCycleWindow(r, W)).toBe(true);
    expect(reviewInCycleWindow(r, { startISO: '2026-09-01', endISO: '2026-09-30' })).toBe(true);
  });

  it('limites da janela são inclusivos', () => {
    expect(reviewInCycleWindow({ periodStart: '2026-09-24', periodEnd: '2026-10-01' }, W)).toBe(true);
    expect(reviewInCycleWindow({ periodStart: '2026-10-31', periodEnd: '2026-11-05' }, W)).toBe(true);
  });

  it('período inteiro fora da janela não pertence', () => {
    expect(reviewInCycleWindow({ periodStart: '2026-09-22', periodEnd: '2026-09-29' }, W)).toBe(false);
    expect(reviewInCycleWindow({ periodStart: '2026-11-02', periodEnd: '2026-11-06' }, W)).toBe(false);
  });

  it('sem period*, usa weekStart/weekEnd', () => {
    expect(reviewInCycleWindow({ periodStart: null, periodEnd: null, weekStart: '2026-10-06', weekEnd: '2026-10-10' }, W)).toBe(true);
    expect(reviewInCycleWindow({ weekStart: '2026-09-08', weekEnd: '2026-09-12' }, W)).toBe(false);
  });

  it('só data de início → período de um dia', () => {
    expect(reviewInCycleWindow({ weekStart: '2026-10-06' }, W)).toBe(true);
    expect(reviewInCycleWindow({ weekStart: '2026-09-30' }, W)).toBe(false);
  });

  it('sem data válida não pertence a ciclo nenhum', () => {
    expect(reviewInCycleWindow({}, W)).toBe(false);
    expect(reviewInCycleWindow({ weekStart: '13/10/2026' }, W)).toBe(false);
  });
});
