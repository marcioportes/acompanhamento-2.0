/**
 * computeCVNormalized.test.js — issue #235 F1.2 (ESM)
 *
 * Cobre 10 cenários:
 *  C1 — janela vazia → null, min_days
 *  C2 — 4 dias com trade (< minDays=5) → null, min_days
 *  C3 — plan sem rrTarget → null, no_target_rr
 *  C4 — calibração spec issue body: 7L+3G@3R em 10 dias → cv_normalized ≈ 1.05 ±0.05
 *  C5 — plano breakeven (WR efetiva 0.25 / RR 3) → null, breakeven_plan
 *  C6 — mean_obs ≈ 0 (P&L diário simétrico) → null, zero_obs_mean
 *  C7 — happy path: usa WR efetiva quando trades suficientes (ignora fallback)
 *  C8 — fallback breakeven 1/(1+RR) quando WR efetiva indefinida (helper)
 *  C9 — effectiveWinRate puro: 7L+3G → 0.3
 *  C10 — computeCvExpected(0.3, 3): mean=0.20, std≈1.833, cv≈9.17
 */

import { describe, it, expect } from 'vitest';
import {
  computeCVNormalized,
  groupTradesByDay,
  effectiveWinRate,
  computeCvObserved,
  computeCvExpected,
  resolveWinRate,
} from '../../../utils/cycleConsistency/computeCVNormalized.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

// Calibração C4: 10 trades em 10 dias úteis distintos, 7L (-100) + 3G (+300).
// Pattern alternado para aproximar distribuição "realista":
//   PL/dia = [-100,-100,-100,+300,-100,-100,+300,-100,-100,+300]
//   mean_obs = (3·300 + 7·-100) / 10 = 200/10 = 20
//   var_sample = (7·14400 + 3·78400) / 9 = 336000/9 = 37333.33
//   std_obs = 193.218 → cv_obs = 9.66
// Plano {rrTarget: 3} → mean_exp = 0.20, var_exp = 3.36, cv_exp = 9.165
// cv_normalized = 9.66 / 9.165 ≈ 1.054
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

describe('computeCVNormalized (ESM)', () => {
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
    // 8 trades em 5 dias, 2 wins + 6 losses, WR=2/8=0.25.
    // Magnitudes diferentes para evitar mean_obs=0 (queremos breakeven_plan, não zero_obs_mean):
    //   wins=+500 cada, losses=-50 cada.
    //   PL/dia = [+1000, -100, -100, -50, -50] (sum=700, mean=140)
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
    // 6 dias alternando +1000/-1000 → soma 0 → mean_obs 0.
    // WR=3/6=0.5, RR=2 → mean_exp = 0.5·2 - 0.5 = +0.5 (válido, não breakeven).
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
    // CALIB_TRADES: WR efetiva = 3/10 = 0.30 (igual ao spec).
    // Plan: rrTarget=3. Se efetiva for usada (0.30): cv_exp = 9.165 → cv_normalized ≈ 1.054.
    // Se fallback breakeven (1/(1+3) = 0.25) fosse usado: cv_exp diferente → resultado diferente.
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
    // resolveWinRate sem trades + rrTarget=2 → 1/(1+2) = 0.333…
    expect(resolveWinRate([], 2)).toBeCloseTo(1 / 3, 10);
    expect(resolveWinRate([], 1)).toBeCloseTo(0.5, 10);
    expect(resolveWinRate([], 0)).toBeNull();
    expect(resolveWinRate([], null)).toBeNull();
    expect(resolveWinRate([], undefined)).toBeNull();

    // Precedência: trades disponíveis sempre vencem o fallback breakeven.
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
    // Trades não-CLOSED ou result não-numérico são ignorados no denominador.
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

    // Plano breakeven: WR=0.25, RR=3 → mean_exp = 0 → cv null.
    const breakeven = computeCvExpected(0.25, 3);
    expect(breakeven.cv).toBeNull();
    expect(Math.abs(breakeven.mean)).toBeLessThan(1e-9);
  });

  it('helper — computeCvObserved sample N-1, edge cases', () => {
    expect(computeCvObserved([])).toEqual({ cv: null, mean: 0, std: 0 });
    // 1 ponto: std=0, mean=valor, cv=0 quando |mean|>0.
    const single = computeCvObserved([100]);
    expect(single.mean).toBe(100);
    expect(single.std).toBe(0);
    expect(single.cv).toBe(0);
    // 1 ponto em zero: cv null (CV indefinido).
    expect(computeCvObserved([0]).cv).toBeNull();
    // P&L diário simétrico → mean ≈ 0 → cv null.
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
