/**
 * setupAnalysisV2.test.js — issue #170
 *
 * Testa util puro `analyzeBySetupV2(trades, { setupsMeta, today })`.
 * Retorno por setup: { setup, n, totalPL, wr, ev, payoff, durationWin, durationLoss,
 *   deltaT, contribEV, adherenceRR, sparkline6m }
 *
 * Notas:
 * - Util é PURO: recebe `today` (Date) opcional para determinismo da janela 6m.
 *   Se ausente, usa `new Date()`.
 * - Multi-moeda: valores são somados dentro do mesmo setup independente de currency,
 *   conforme spec (multi-moeda "ignorada por setup" = não particiona, não converte).
 * - Trades sem setup recebem chave "Sem Setup".
 */
import { describe, it, expect } from 'vitest';
import { analyzeBySetupV2 } from '../../utils/setupAnalysisV2';

// Helper: builda trade determinístico mínimo
const mk = (overrides = {}) => ({
  setup: 'A',
  result: 100,
  duration: 10,
  entryTime: '2026-04-15T10:00:00',
  exitTime: '2026-04-15T10:10:00',
  date: '2026-04-15',
  ...overrides,
});

describe('analyzeBySetupV2 — defensivo / entrada vazia', () => {
  it('retorna [] quando trades é null/undefined', () => {
    expect(analyzeBySetupV2(null)).toEqual([]);
    expect(analyzeBySetupV2(undefined)).toEqual([]);
  });

  it('retorna [] quando trades é array vazio', () => {
    expect(analyzeBySetupV2([])).toEqual([]);
  });

  it('retorna [] quando trades não é array', () => {
    expect(analyzeBySetupV2({})).toEqual([]);
    expect(analyzeBySetupV2('trade')).toEqual([]);
  });
});

describe('analyzeBySetupV2 — agrupamento e KPIs básicos', () => {
  it('agrupa trades por setup (trim), trades sem setup viram "Sem Setup"', () => {
    const trades = [
      mk({ setup: ' Breakout ', result: 100 }),
      mk({ setup: 'Breakout', result: 200 }),
      mk({ setup: '', result: -50 }),
      mk({ setup: undefined, result: -30 }),
    ];
    const out = analyzeBySetupV2(trades);
    const breakout = out.find(s => s.setup === 'Breakout');
    const semSetup = out.find(s => s.setup === 'Sem Setup');
    expect(breakout.n).toBe(2);
    expect(breakout.totalPL).toBe(300);
    expect(semSetup.n).toBe(2);
    expect(semSetup.totalPL).toBe(-80);
  });

  it('calcula n, totalPL, wr, ev corretamente', () => {
    const trades = [
      mk({ setup: 'A', result: 300 }),
      mk({ setup: 'A', result: 200 }),
      mk({ setup: 'A', result: -100 }),
      mk({ setup: 'A', result: 0 }),
    ];
    const [a] = analyzeBySetupV2(trades);
    expect(a.setup).toBe('A');
    expect(a.n).toBe(4);
    expect(a.totalPL).toBe(400);
    expect(a.wr).toBeCloseTo(50, 4); // 2 wins / 4 = 50%
    expect(a.ev).toBe(100); // 400/4
  });

  it('payoff = avgWin / |avgLoss|', () => {
    const trades = [
      mk({ setup: 'A', result: 200 }),
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: -50 }),
    ];
    const [a] = analyzeBySetupV2(trades);
    // avgWin=150, avgLoss=-50 → payoff=3
    expect(a.payoff).toBe(3);
  });

  it('payoff = null quando não há wins ou não há losses', () => {
    const onlyWins = [
      mk({ setup: 'W', result: 100 }),
      mk({ setup: 'W', result: 50 }),
    ];
    const onlyLosses = [
      mk({ setup: 'L', result: -100 }),
      mk({ setup: 'L', result: -50 }),
    ];
    expect(analyzeBySetupV2(onlyWins)[0].payoff).toBeNull();
    expect(analyzeBySetupV2(onlyLosses)[0].payoff).toBeNull();
  });
});

describe('analyzeBySetupV2 — ΔT W vs L (duração)', () => {
  it('calcula deltaT = (durationWin - durationLoss) / durationLoss', () => {
    const trades = [
      mk({ setup: 'A', result: 100, duration: 15 }),
      mk({ setup: 'A', result: 50, duration: 25 }), // wins: média 20
      mk({ setup: 'A', result: -50, duration: 5 }),
      mk({ setup: 'A', result: -100, duration: 5 }), // losses: média 5
    ];
    const [a] = analyzeBySetupV2(trades);
    expect(a.durationWin).toBe(20);
    expect(a.durationLoss).toBe(5);
    // (20 - 5) / 5 = 3 → 300%
    expect(a.deltaT).toBe(300);
  });

  it('deltaT = null quando falta wins ou losses', () => {
    const trades = [
      mk({ setup: 'A', result: 100, duration: 10 }),
      mk({ setup: 'A', result: 50, duration: 10 }),
    ];
    expect(analyzeBySetupV2(trades)[0].deltaT).toBeNull();
  });

  it('derivá duration de entryTime/exitTime quando duration está ausente', () => {
    const trades = [
      mk({
        setup: 'A',
        result: 100,
        duration: undefined,
        entryTime: '2026-04-15T10:00:00',
        exitTime: '2026-04-15T10:30:00',
      }),
      mk({ setup: 'A', result: -50, duration: 10 }),
    ];
    const [a] = analyzeBySetupV2(trades);
    expect(a.durationWin).toBe(30);
  });
});

describe('analyzeBySetupV2 — Contribuição ao EV total (contribEV)', () => {
  it('contribEV = (n × EV_setup) / Σ(n × EV) expressa em %', () => {
    const trades = [
      // Setup A: n=2, totalPL=+200, EV=100 → n×EV = 200
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: 100 }),
      // Setup B: n=3, totalPL=-300, EV=-100 → n×EV = -300
      mk({ setup: 'B', result: -100 }),
      mk({ setup: 'B', result: -100 }),
      mk({ setup: 'B', result: -100 }),
    ];
    const out = analyzeBySetupV2(trades);
    const a = out.find(s => s.setup === 'A');
    const b = out.find(s => s.setup === 'B');
    // Σ|n×EV| = 200 + 300 = 500 (denominador usa soma dos totalPL em módulo)
    // contribEV_A = +200/500 = +40%, contribEV_B = -300/500 = -60%
    expect(a.contribEV).toBeCloseTo(40, 4);
    expect(b.contribEV).toBeCloseTo(-60, 4);
  });

  it('contribEV = 0 quando todos setups têm PL zero', () => {
    const trades = [
      mk({ setup: 'A', result: 0 }),
      mk({ setup: 'B', result: 0 }),
    ];
    const out = analyzeBySetupV2(trades);
    expect(out.every(s => s.contribEV === 0)).toBe(true);
  });
});

describe('analyzeBySetupV2 — Ordenação e esporádicos', () => {
  it('cards ordenados por |contribEV| desc (impacto absoluto)', () => {
    const trades = [
      // B é o maior impacto negativo, A é impacto positivo menor
      mk({ setup: 'A', result: 50 }),
      mk({ setup: 'A', result: 50 }),
      mk({ setup: 'A', result: 50 }),
      mk({ setup: 'B', result: -300 }),
      mk({ setup: 'B', result: -300 }),
      mk({ setup: 'B', result: -300 }),
    ];
    const out = analyzeBySetupV2(trades);
    expect(out[0].setup).toBe('B'); // maior |contribEV|
    expect(out[1].setup).toBe('A');
  });

  it('retorna todos os setups; flag isSporadic = n < 3 para permitir grouping no componente', () => {
    const trades = [
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: 100 }), // n=3
      mk({ setup: 'B', result: 100 }),
      mk({ setup: 'B', result: 100 }), // n=2 → esporádico
    ];
    const out = analyzeBySetupV2(trades);
    const a = out.find(s => s.setup === 'A');
    const b = out.find(s => s.setup === 'B');
    expect(a.isSporadic).toBe(false);
    expect(b.isSporadic).toBe(true);
  });
});

describe('analyzeBySetupV2 — Aderência RR (condicional via setupsMeta)', () => {
  it('adherenceRR = null quando setupsMeta ausente', () => {
    const trades = [
      mk({ setup: 'A', result: 100, rr: 2.0 }),
      mk({ setup: 'A', result: 100, rr: 2.2 }),
    ];
    expect(analyzeBySetupV2(trades)[0].adherenceRR).toBeNull();
  });

  it('adherenceRR = null quando setupsMeta existe mas setup não tem targetRR', () => {
    const trades = [
      mk({ setup: 'A', result: 100, rr: 2.0 }),
    ];
    const setupsMeta = [{ name: 'A' /* targetRR ausente */ }];
    expect(analyzeBySetupV2(trades, { setupsMeta })[0].adherenceRR).toBeNull();
  });

  it('adherenceRR conta trades com rr dentro da banda [target*0.8, target*1.2]', () => {
    const trades = [
      mk({ setup: 'A', rr: 2.0 }), // dentro (target=2, banda 1.6-2.4)
      mk({ setup: 'A', rr: 2.3 }), // dentro
      mk({ setup: 'A', rr: 1.0 }), // fora
      mk({ setup: 'A', rr: 2.5 }), // fora
      mk({ setup: 'A', rr: undefined }), // rr ausente → fora
    ];
    const setupsMeta = [{ name: 'A', targetRR: 2.0 }];
    const [a] = analyzeBySetupV2(trades, { setupsMeta });
    expect(a.adherenceRR).toEqual({
      inBand: 2,
      total: 5,
      pct: 40, // 2/5 = 40%
      targetRR: 2.0,
    });
  });
});

describe('analyzeBySetupV2 — Sparkline 6m', () => {
  it('sparkline6m retorna array ordenado de PL acumulado mensal', () => {
    const today = new Date('2026-04-22');
    const trades = [
      // Setup A com trades em meses diferentes
      mk({ setup: 'A', result: 100, date: '2026-04-10' }),
      mk({ setup: 'A', result: 50, date: '2026-03-15' }),
      mk({ setup: 'A', result: -30, date: '2026-02-01' }),
    ];
    const [a] = analyzeBySetupV2(trades, { today });
    // Sparkline 6m: 6 buckets (mais antigo → mais recente), PL acumulado
    expect(a.sparkline6m).toHaveLength(6);
    expect(a.sparkline6m[a.sparkline6m.length - 1]).toBe(120); // -30 + 50 + 100
  });

  it('ignora trades fora da janela 6m', () => {
    const today = new Date('2026-04-22');
    const trades = [
      mk({ setup: 'A', result: 1000, date: '2025-09-01' }), // >6 meses
      mk({ setup: 'A', result: 100, date: '2026-04-10' }),
    ];
    const [a] = analyzeBySetupV2(trades, { today });
    expect(a.sparkline6m[a.sparkline6m.length - 1]).toBe(100); // ignora 2025-09
  });

  it('retorna 6 zeros quando setup não tem trades na janela', () => {
    const today = new Date('2026-04-22');
    const trades = [
      mk({ setup: 'A', result: 100, date: '2020-01-01' }),
    ];
    const [a] = analyzeBySetupV2(trades, { today });
    expect(a.sparkline6m).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('analyzeBySetupV2 — edges', () => {
  it('n=1 retorna KPIs coerentes (deltaT null, payoff null se só win ou só loss)', () => {
    const trades = [mk({ setup: 'S', result: 100 })];
    const [s] = analyzeBySetupV2(trades);
    expect(s.n).toBe(1);
    expect(s.ev).toBe(100);
    expect(s.payoff).toBeNull();
    expect(s.deltaT).toBeNull();
  });

  it('soma trades de moedas diferentes sem particionar (multi-moeda ignorada por setup)', () => {
    const trades = [
      mk({ setup: 'A', result: 100, currency: 'BRL' }),
      mk({ setup: 'A', result: 20, currency: 'USD' }),
    ];
    const [a] = analyzeBySetupV2(trades);
    expect(a.n).toBe(2);
    expect(a.totalPL).toBe(120); // soma crua, sem conversão
  });

  it('trades com result null/undefined contam como 0 no PL mas entram no n', () => {
    const trades = [
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: null }),
      mk({ setup: 'A', result: undefined }),
    ];
    const [a] = analyzeBySetupV2(trades);
    expect(a.n).toBe(3);
    expect(a.totalPL).toBe(100);
  });
});
