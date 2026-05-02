/**
 * computeCVNormalized.test.js — issue #235 F1.2 (CJS mirror)
 *
 * Cobre os mesmos 10 cenários do espelho ESM, consumindo o módulo CJS
 * via createRequire. Assertivas idênticas — qualquer divergência indica
 * drift entre os dois lados do mirror.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  computeCVNormalized,
  groupTradesByDay,
  effectiveWinRate,
  computeCvObserved,
  computeCvExpected,
  resolveWinRate,
} = require('../../cycleConsistency/computeCVNormalized');

// ── Fixtures (cópia do espelho ESM — sincronia sob lock) ───────────────────

const CALIB_TRADES = [
  { date: '02/02/2026', result: -100, status: 'CLOSED' },
  { date: '03/02/2026', result: -100, status: 'CLOSED' },
  { date: '04/02/2026', result: -100, status: 'CLOSED' },
  { date: '05/02/2026', result: +300, status: 'CLOSED' },
  { date: '06/02/2026', result: -100, status: 'CLOSED' },
  { date: '09/02/2026', result: -100, status: 'CLOSED' },
  { date: '10/02/2026', result: +300, status: 'CLOSED' },
  { date: '11/02/2026', result: -100, status: 'CLOSED' },
  { date: '12/02/2026', result: -100, status: 'CLOSED' },
  { date: '13/02/2026', result: +300, status: 'CLOSED' },
];

describe('computeCVNormalized (CJS)', () => {
  it('C1 — janela vazia retorna null com insufficientReason min_days', () => {
    const result = computeCVNormalized([], { rrTarget: 3 }, '2026-02-01', '2026-02-28');
    expect(result.value).toBeNull();
    expect(result.cvObs).toBeNull();
    expect(result.cvExp).toBeNull();
    expect(result.daysWithTrade).toBe(0);
    expect(result.insufficientReason).toBe('min_days');
    expect(result.label).toBe('Insuficiente · ≥5 dias');
  });

  it('C2 — 4 dias com trade (< minDays=5) retorna null min_days', () => {
    const trades = [
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '03/02/2026', result: 200, status: 'CLOSED' },
      { date: '04/02/2026', result: -50, status: 'CLOSED' },
      { date: '05/02/2026', result: 75, status: 'CLOSED' },
    ];
    const result = computeCVNormalized(trades, { rrTarget: 3 }, '2026-02-01', '2026-02-28');
    expect(result.value).toBeNull();
    expect(result.daysWithTrade).toBe(4);
    expect(result.insufficientReason).toBe('min_days');
  });

  it('C3 — plan sem rrTarget retorna null no_target_rr com label apropriado', () => {
    const result = computeCVNormalized(CALIB_TRADES, {}, '2026-02-01', '2026-02-28');
    expect(result.value).toBeNull();
    expect(result.daysWithTrade).toBe(10);
    expect(result.insufficientReason).toBe('no_target_rr');
    expect(result.label).toBe('Plano sem RR alvo definido — definir para ativar métrica');
  });

  it('C4 — calibração spec issue body (7L+3G@3R, 10 dias) → cv_normalized ≈ 1.05 ± 0.05', () => {
    const result = computeCVNormalized(
      CALIB_TRADES,
      { rrTarget: 3 },
      '2026-02-01',
      '2026-02-28'
    );
    expect(result.daysWithTrade).toBe(10);
    expect(result.value).not.toBeNull();
    expect(result.cvObs).toBeCloseTo(9.66, 1);
    expect(result.cvExp).toBeCloseTo(9.165, 2);
    expect(result.value).toBeGreaterThan(1.00);
    expect(result.value).toBeLessThan(1.10);
  });

  it('C5 — plano breakeven (WR efetiva 0.25 / RR 3 → mean_exp 0) retorna null breakeven_plan', () => {
    const trades = [
      { date: '02/02/2026', result: +500, status: 'CLOSED' },
      { date: '02/02/2026', result: +500, status: 'CLOSED' },
      { date: '03/02/2026', result: -50, status: 'CLOSED' },
      { date: '03/02/2026', result: -50, status: 'CLOSED' },
      { date: '04/02/2026', result: -50, status: 'CLOSED' },
      { date: '04/02/2026', result: -50, status: 'CLOSED' },
      { date: '05/02/2026', result: -50, status: 'CLOSED' },
      { date: '06/02/2026', result: -50, status: 'CLOSED' },
    ];
    const result = computeCVNormalized(trades, { rrTarget: 3 }, '2026-02-01', '2026-02-28');
    expect(result.value).toBeNull();
    expect(result.daysWithTrade).toBe(5);
    expect(result.insufficientReason).toBe('breakeven_plan');
    expect(result.label).toBe('Plano com expectância nula — métrica indefinida');
  });

  it('C6 — mean_obs ≈ 0 (P&L diário simétrico) retorna null zero_obs_mean', () => {
    const trades = [
      { date: '02/02/2026', result: +1000, status: 'CLOSED' },
      { date: '03/02/2026', result: -1000, status: 'CLOSED' },
      { date: '04/02/2026', result: +1000, status: 'CLOSED' },
      { date: '05/02/2026', result: -1000, status: 'CLOSED' },
      { date: '06/02/2026', result: +1000, status: 'CLOSED' },
      { date: '09/02/2026', result: -1000, status: 'CLOSED' },
    ];
    const result = computeCVNormalized(trades, { rrTarget: 2 }, '2026-02-01', '2026-02-28');
    expect(result.value).toBeNull();
    expect(result.daysWithTrade).toBe(6);
    expect(result.insufficientReason).toBe('zero_obs_mean');
    expect(result.cvExp).not.toBeNull();
    expect(result.label).toBe('P&L médio diário próximo de zero — CV indefinido');
  });

  it('C7 — happy path: helper usa WR efetiva quando trades suficientes (ignora fallback breakeven)', () => {
    const result = computeCVNormalized(
      CALIB_TRADES,
      { rrTarget: 3 },
      '2026-02-01',
      '2026-02-28'
    );
    expect(result.value).not.toBeNull();
    expect(result.cvExp).toBeCloseTo(9.165, 2);
    expect(result.value).toBeGreaterThan(1.00);
    expect(result.value).toBeLessThan(1.10);
  });

  it('C8 — fallback breakeven 1/(1+RR) quando WR efetiva indefinida (resolveWinRate)', () => {
    expect(resolveWinRate([], 2)).toBeCloseTo(1 / 3, 10);
    expect(resolveWinRate([], 1)).toBeCloseTo(0.5, 10);
    expect(resolveWinRate([], 0)).toBeNull();
    expect(resolveWinRate([], null)).toBeNull();
    expect(resolveWinRate([], undefined)).toBeNull();

    const trades = [
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '02/02/2026', result: -50, status: 'CLOSED' },
      { date: '02/02/2026', result: -50, status: 'CLOSED' },
    ];
    expect(resolveWinRate(trades, 99)).toBe(0.5);
  });

  it('C9 — effectiveWinRate puro: 7L+3G → 0.3', () => {
    expect(effectiveWinRate(CALIB_TRADES)).toBeCloseTo(0.3, 10);
    expect(effectiveWinRate([])).toBeNull();
    expect(effectiveWinRate([{ result: 100, status: 'CLOSED' }])).toBe(1);
    expect(effectiveWinRate([{ result: -100, status: 'CLOSED' }])).toBe(0);
    const mixed = [
      { result: 100, status: 'OPEN' },
      { result: 100, status: 'CLOSED' },
      { result: 'NaN', status: 'CLOSED' },
      { result: -50, status: 'CLOSED' },
    ];
    expect(effectiveWinRate(mixed)).toBeCloseTo(0.5, 10);
  });

  it('C10 — computeCvExpected(0.3, 3): mean=0.20, std≈1.833, cv≈9.165', () => {
    const out = computeCvExpected(0.3, 3);
    expect(out.mean).toBeCloseTo(0.20, 10);
    expect(out.std).toBeCloseTo(Math.sqrt(3.36), 6);
    expect(out.cv).toBeCloseTo(9.165, 2);

    const breakeven = computeCvExpected(0.25, 3);
    expect(breakeven.cv).toBeNull();
    expect(Math.abs(breakeven.mean)).toBeLessThan(1e-9);
  });

  it('helper — computeCvObserved sample N-1, edge cases', () => {
    expect(computeCvObserved([])).toEqual({ cv: null, mean: 0, std: 0 });
    const single = computeCvObserved([100]);
    expect(single.mean).toBe(100);
    expect(single.std).toBe(0);
    expect(single.cv).toBe(0);
    expect(computeCvObserved([0]).cv).toBeNull();
    expect(computeCvObserved([100, -100, 100, -100]).cv).toBeNull();
  });

  it('helper — groupTradesByDay filtra fora-janela e status != CLOSED', () => {
    const trades = [
      { date: '02/02/2026', result: 100, status: 'CLOSED' },
      { date: '03/02/2026', result: 200, status: 'OPEN' },
      { date: '01/01/2026', result: 999, status: 'CLOSED' },
      { date: '05/02/2026', result: 150, status: 'CLOSED' },
      { date: '05/02/2026', result: 50, status: 'CLOSED' },
    ];
    const map = groupTradesByDay(trades, '2026-02-01', '2026-02-28');
    expect(map.size).toBe(2);
    expect(map.get('2026-02-02')).toBe(100);
    expect(map.get('2026-02-05')).toBe(200);
  });
});
