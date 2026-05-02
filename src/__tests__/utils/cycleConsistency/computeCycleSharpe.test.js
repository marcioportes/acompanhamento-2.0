/**
 * computeCycleSharpe.test.js — issue #235 F1.1 (ESM)
 *
 * Cobre 8 cenários:
 *  C1 — janela vazia → null, min_days
 *  C2 — 4 dias com trade (< minDays=5) → null, min_days
 *  C3 — happy path FEV/2026 com Selic descontada → ~5.86 ± 0.5
 *  C4 — mesmo dataset com rfr=0 → ~6.80 ± 0.5
 *  C5 — variância zero (P&L diário constante) → null, zero_variance
 *  C6 — multi-day fallback parcial → source 'MIXED', fallbackUsed true
 *  C7 — groupTradesByDay filtra fora-janela e status != 'CLOSED'
 *  C8 — meanStdSample edge: 1 item → std=0
 */

import { describe, it, expect } from 'vitest';
import {
  computeCycleSharpe,
  groupTradesByDay,
  dailyReturnsFromGroups,
  meanStdSample,
} from '../../../utils/cycleConsistency/computeCycleSharpe.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

// Dataset FEV/2026: 13 trades em 8 dias úteis distintos, plStart 100k.
// PL por dia: [600, -800, 2000, 200, -500, 1400, 800, -400] (sum=3300, mean=412.5).
// Daily returns: [0.006, -0.008, 0.020, 0.002, -0.005, 0.014, 0.008, -0.004]
// Mean=0.004125 · Std (sample N-1)=0.009775 · Sharpe sem rfr=6.699 · com Selic=5.749.
// Ambos dentro de ±0.5 dos targets do issue body (6.80 / 5.86).
const FEV_2026_TRADES = [
  { date: '02/02/2026', result: 400, status: 'CLOSED' },
  { date: '02/02/2026', result: 200, status: 'CLOSED' },
  { date: '03/02/2026', result: -300, status: 'CLOSED' },
  { date: '03/02/2026', result: -500, status: 'CLOSED' },
  { date: '04/02/2026', result: 800, status: 'CLOSED' },
  { date: '04/02/2026', result: 700, status: 'CLOSED' },
  { date: '04/02/2026', result: 500, status: 'CLOSED' },
  { date: '05/02/2026', result: 200, status: 'CLOSED' },
  { date: '06/02/2026', result: -500, status: 'CLOSED' },
  { date: '09/02/2026', result: 600, status: 'CLOSED' },
  { date: '09/02/2026', result: 800, status: 'CLOSED' },
  { date: '10/02/2026', result: 400, status: 'CLOSED' },
  { date: '10/02/2026', result: 400, status: 'CLOSED' },
  { date: '11/02/2026', result: -400, status: 'CLOSED' },
];

// Selic 14.75% a.a. ÷ 252 d.u. ÷ 100 = 0.0005853174603174603
const SELIC_FEV_2026 = 14.75 / 252 / 100;

const fakeSelic = (rate, source = 'BCB-SGS-11') =>
  async () => ({ rateDaily: rate, source, isFallback: source === 'FALLBACK' });

describe('computeCycleSharpe (ESM)', () => {
  it('C1 — janela vazia retorna null com insufficientReason min_days', async () => {
    const result = await computeCycleSharpe([], '2026-02-01', '2026-02-28', 100000, {
      getSelicForDateFn: fakeSelic(SELIC_FEV_2026),
    });
    expect(result).toEqual({
      value: null,
      daysWithTrade: 0,
      source: 'BCB',
      insufficientReason: 'min_days',
      fallbackUsed: false,
    });
  });

  it('C2 — 4 dias com trade (< minDays=5) retorna null min_days', async () => {
    const trades = [
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '03/02/2026', result: 200, status: 'CLOSED' },
      { date: '04/02/2026', result: -50, status: 'CLOSED' },
      { date: '05/02/2026', result: 75, status: 'CLOSED' },
    ];
    const result = await computeCycleSharpe(trades, '2026-02-01', '2026-02-28', 100000, {
      getSelicForDateFn: fakeSelic(SELIC_FEV_2026),
    });
    expect(result.value).toBeNull();
    expect(result.insufficientReason).toBe('min_days');
    expect(result.daysWithTrade).toBe(4);
    expect(result.fallbackUsed).toBe(false);
  });

  it('C3 — FEV/2026 com Selic descontada → Sharpe ~5.75 (target 5.86 ± 0.5)', async () => {
    const result = await computeCycleSharpe(
      FEV_2026_TRADES,
      '2026-02-01',
      '2026-02-28',
      100000,
      { getSelicForDateFn: fakeSelic(SELIC_FEV_2026) }
    );
    expect(result.daysWithTrade).toBe(8);
    expect(result.source).toBe('BCB');
    expect(result.fallbackUsed).toBe(false);
    expect(result.value).not.toBeNull();
    // Target spec: 5.86 ± 0.5 → [5.36, 6.36]. Calculado 5.749.
    expect(result.value).toBeGreaterThan(5.36);
    expect(result.value).toBeLessThan(6.36);
  });

  it('C4 — FEV/2026 com rfr=0 → Sharpe ~6.70 (target 6.80 ± 0.5), maior que C3', async () => {
    const result = await computeCycleSharpe(
      FEV_2026_TRADES,
      '2026-02-01',
      '2026-02-28',
      100000,
      { getSelicForDateFn: fakeSelic(0, 'BCB-SGS-11') }
    );
    expect(result.value).not.toBeNull();
    // Target spec: 6.80 ± 0.5 → [6.30, 7.30]. Calculado 6.699.
    expect(result.value).toBeGreaterThan(6.30);
    expect(result.value).toBeLessThan(7.30);
  });

  it('C5 — variância zero (mesmo PL todo dia) retorna null zero_variance', async () => {
    // 5 dias com PL idêntico → returns idênticos → std=0.
    const trades = [
      { date: '02/02/2026', result: 500, status: 'CLOSED' },
      { date: '03/02/2026', result: 500, status: 'CLOSED' },
      { date: '04/02/2026', result: 500, status: 'CLOSED' },
      { date: '05/02/2026', result: 500, status: 'CLOSED' },
      { date: '06/02/2026', result: 500, status: 'CLOSED' },
    ];
    const result = await computeCycleSharpe(trades, '2026-02-01', '2026-02-28', 100000, {
      getSelicForDateFn: fakeSelic(SELIC_FEV_2026),
    });
    expect(result.value).toBeNull();
    expect(result.insufficientReason).toBe('zero_variance');
    expect(result.daysWithTrade).toBe(5);
  });

  it('C6 — multi-day fallback parcial → source MIXED, fallbackUsed true', async () => {
    // Mock retorna FALLBACK só em '06/02' e '09/02', BCB nos demais.
    const mixedFn = async (dateIso) => {
      const isFallback = dateIso === '2026-02-06' || dateIso === '2026-02-09';
      return {
        rateDaily: SELIC_FEV_2026,
        source: isFallback ? 'FALLBACK' : 'BCB-SGS-11',
        isFallback,
      };
    };
    const result = await computeCycleSharpe(
      FEV_2026_TRADES,
      '2026-02-01',
      '2026-02-28',
      100000,
      { getSelicForDateFn: mixedFn }
    );
    expect(result.source).toBe('MIXED');
    expect(result.fallbackUsed).toBe(true);
    expect(result.daysWithTrade).toBe(8);
  });

  it('C7 — groupTradesByDay filtra fora-janela e status != CLOSED', () => {
    const trades = [
      { date: '02/02/2026', result: 100, status: 'CLOSED' },           // dentro
      { date: '03/02/2026', result: 200, status: 'OPEN' },             // status errado
      { date: '04/02/2026', result: 300, status: 'REVIEWED' },         // status errado
      { date: '01/01/2026', result: 999, status: 'CLOSED' },           // fora-janela (antes)
      { date: '01/03/2026', result: 999, status: 'CLOSED' },           // fora-janela (depois)
      { date: '05/02/2026', result: 150, status: 'CLOSED' },           // dentro
      { date: '05/02/2026', result: 50,  status: 'CLOSED' },           // dentro (mesmo dia, agrega)
      { date: 'lixo',       result: 100, status: 'CLOSED' },           // date inválida
      { date: '06/02/2026', result: 'NaN', status: 'CLOSED' },         // result não-numérico
    ];
    const map = groupTradesByDay(trades, '2026-02-01', '2026-02-28');
    expect(map.size).toBe(2);
    expect(map.get('2026-02-02')).toBe(100);
    expect(map.get('2026-02-05')).toBe(200); // 150 + 50
  });

  it('C8 — meanStdSample com 1 item retorna std=0; agregações puras', () => {
    expect(meanStdSample([])).toEqual({ mean: 0, std: 0 });
    expect(meanStdSample([5])).toEqual({ mean: 5, std: 0 });
    const r = meanStdSample([1, 2, 3, 4, 5]);
    expect(r.mean).toBeCloseTo(3, 10);
    // std amostral de 1..5 = sqrt(2.5) ≈ 1.5811
    expect(r.std).toBeCloseTo(Math.sqrt(2.5), 10);
  });

  it('helper — dailyReturnsFromGroups produz ordenação asc e divide por plStart', () => {
    const map = new Map([
      ['2026-02-05', 200],
      ['2026-02-02', 600],
      ['2026-02-03', -800],
    ]);
    const out = dailyReturnsFromGroups(map, 100000);
    expect(out).toEqual([
      { dateIso: '2026-02-02', dailyReturn: 0.006 },
      { dateIso: '2026-02-03', dailyReturn: -0.008 },
      { dateIso: '2026-02-05', dailyReturn: 0.002 },
    ]);
  });
});
