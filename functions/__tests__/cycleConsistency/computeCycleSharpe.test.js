/**
 * computeCycleSharpe.test.js — issue #235 F1.1 (CJS mirror)
 *
 * Cobre os mesmos 8 cenários do espelho ESM, consumindo o módulo CJS
 * via createRequire. Assertivas idênticas — qualquer divergência indica
 * drift entre os dois lados do mirror.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  computeCycleSharpe,
  groupTradesByDay,
  dailyReturnsFromGroups,
  meanStdSample,
} = require('../../cycleConsistency/computeCycleSharpe');

// ── Fixtures (cópia do espelho ESM — sincronia sob lock) ───────────────────

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

const SELIC_FEV_2026 = 14.75 / 252 / 100;

const fakeSelic = (rate, source = 'BCB-SGS-11') =>
  async () => ({ rateDaily: rate, source, isFallback: source === 'FALLBACK' });

describe('computeCycleSharpe (CJS)', () => {
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
    expect(result.value).toBeGreaterThan(5.36);
    expect(result.value).toBeLessThan(6.36);
  });

  it('C4 — FEV/2026 com rfr=0 → Sharpe ~6.70 (target 6.80 ± 0.5)', async () => {
    const result = await computeCycleSharpe(
      FEV_2026_TRADES,
      '2026-02-01',
      '2026-02-28',
      100000,
      { getSelicForDateFn: fakeSelic(0, 'BCB-SGS-11') }
    );
    expect(result.value).not.toBeNull();
    expect(result.value).toBeGreaterThan(6.30);
    expect(result.value).toBeLessThan(7.30);
  });

  it('C5 — variância zero (mesmo PL todo dia) retorna null zero_variance', async () => {
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
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '03/02/2026', result: 200, status: 'OPEN' },
      { date: '04/02/2026', result: 300, status: 'REVIEWED' },
      { date: '01/01/2026', result: 999, status: 'CLOSED' },
      { date: '01/03/2026', result: 999, status: 'CLOSED' },
      { date: '05/02/2026', result: 150, status: 'CLOSED' },
      { date: '05/02/2026', result: 50,  status: 'CLOSED' },
      { date: 'lixo',       result: 100, status: 'CLOSED' },
      { date: '06/02/2026', result: 'NaN', status: 'CLOSED' },
    ];
    const map = groupTradesByDay(trades, '2026-02-01', '2026-02-28');
    expect(map.size).toBe(2);
    expect(map.get('2026-02-02')).toBe(100);
    expect(map.get('2026-02-05')).toBe(200);
  });

  it('C8 — meanStdSample com 1 item retorna std=0; agregações puras', () => {
    expect(meanStdSample([])).toEqual({ mean: 0, std: 0 });
    expect(meanStdSample([5])).toEqual({ mean: 5, std: 0 });
    const r = meanStdSample([1, 2, 3, 4, 5]);
    expect(r.mean).toBeCloseTo(3, 10);
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
