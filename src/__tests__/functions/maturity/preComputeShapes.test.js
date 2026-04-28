/**
 * preComputeShapes.test.js — issue #187 Fase 1
 * @description Cobre derivação de advancedMetricsPresent (DEC-AUTO-187-04).
 * Política: nunca retorna false — null ou true. Mínimo 10 trades para avaliar,
 * threshold ≥80% de trades com mepPrice E menPrice não-null.
 */

import { describe, it, expect } from 'vitest';
import {
  preComputeShapes,
  deriveAdvancedMetricsPresent,
  ADVANCED_METRICS_MIN_TRADES,
  ADVANCED_METRICS_MIN_RATIO,
} from '../../../../functions/maturity/preComputeShapes';

const tradeWithExcursion = (idx) => ({
  id: `t${idx}`, result: 100, date: '2026-04-01',
  mepPrice: 100 + idx, menPrice: 90 - idx,
});
const tradeWithoutExcursion = (idx) => ({
  id: `t${idx}`, result: 100, date: '2026-04-01',
  mepPrice: null, menPrice: null,
});

describe('deriveAdvancedMetricsPresent — issue #187 DEC-AUTO-187-04', () => {
  it('retorna null para array vazio (insuficiente)', () => {
    expect(deriveAdvancedMetricsPresent([])).toBe(null);
  });

  it('retorna null para input não-array', () => {
    expect(deriveAdvancedMetricsPresent(null)).toBe(null);
    expect(deriveAdvancedMetricsPresent(undefined)).toBe(null);
  });

  it('retorna null abaixo do mínimo de trades', () => {
    const trades = Array.from({ length: ADVANCED_METRICS_MIN_TRADES - 1 }, (_, i) => tradeWithExcursion(i));
    expect(deriveAdvancedMetricsPresent(trades)).toBe(null);
  });

  it('retorna true com 100% de trades rastreados (≥ mínimo)', () => {
    const trades = Array.from({ length: 12 }, (_, i) => tradeWithExcursion(i));
    expect(deriveAdvancedMetricsPresent(trades)).toBe(true);
  });

  it('retorna true exatamente no threshold (80% — 8/10)', () => {
    const trades = [
      ...Array.from({ length: 8 }, (_, i) => tradeWithExcursion(i)),
      ...Array.from({ length: 2 }, (_, i) => tradeWithoutExcursion(i + 100)),
    ];
    expect(deriveAdvancedMetricsPresent(trades)).toBe(true);
  });

  it('retorna null logo abaixo do threshold (70% — 7/10)', () => {
    const trades = [
      ...Array.from({ length: 7 }, (_, i) => tradeWithExcursion(i)),
      ...Array.from({ length: 3 }, (_, i) => tradeWithoutExcursion(i + 100)),
    ];
    expect(deriveAdvancedMetricsPresent(trades)).toBe(null);
  });

  it('NUNCA retorna false (gate Stage 3→4 opcional/condicional — DEC-AUTO-187-03)', () => {
    // 0% rastreados — ainda assim null, nunca false
    const trades = Array.from({ length: 20 }, (_, i) => tradeWithoutExcursion(i));
    expect(deriveAdvancedMetricsPresent(trades)).toBe(null);
  });

  it('exige AMBOS mepPrice e menPrice não-null para considerar rastreado', () => {
    // 12 trades, todos com só mepPrice → não conta
    const trades = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`, result: 100, date: '2026-04-01',
      mepPrice: 100, menPrice: null,
    }));
    expect(deriveAdvancedMetricsPresent(trades)).toBe(null);
  });

  it('threshold e mínimo expostos como constantes', () => {
    expect(ADVANCED_METRICS_MIN_TRADES).toBe(10);
    expect(ADVANCED_METRICS_MIN_RATIO).toBe(0.8);
  });
});

describe('preComputeShapes — wiring de advancedMetricsPresent', () => {
  it('expõe advancedMetricsPresent no shape de saída', () => {
    const trades = Array.from({ length: 12 }, (_, i) => tradeWithExcursion(i));
    const shape = preComputeShapes({ trades, plans: [] });
    expect(shape).toHaveProperty('advancedMetricsPresent', true);
  });

  it('retorna null em advancedMetricsPresent quando trades estão vazios', () => {
    const shape = preComputeShapes({ trades: [], plans: [] });
    expect(shape.advancedMetricsPresent).toBe(null);
  });

  it('regressão — não quebra outros shapes (stats/payoff/maxDrawdown intactos)', () => {
    const trades = Array.from({ length: 12 }, (_, i) => tradeWithExcursion(i));
    const shape = preComputeShapes({ trades, plans: [{ initialBalance: 1000 }] });
    expect(shape.stats.totalTrades).toBe(12);
    expect(shape.payoff).not.toBe(null);
    expect(shape.maxDrawdown).toHaveProperty('maxDD');
    expect(shape.advancedMetricsPresent).toBe(true);
  });
});
