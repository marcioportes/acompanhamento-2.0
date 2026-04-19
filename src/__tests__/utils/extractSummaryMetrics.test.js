/**
 * extractSummaryMetrics.test.js
 * @description Testes do helper computeExtractSummaryMetrics —
 *   agrega tradesCount, winCount e winRate do recorte visível no extrato.
 *   Convenção (alinhada com src/utils/calculations.js): result > 0 = win.
 */

import { describe, it, expect } from 'vitest';
import { computeExtractSummaryMetrics } from '../../utils/extractSummaryMetrics';

describe('computeExtractSummaryMetrics', () => {
  it('rows vazio → zeros', () => {
    expect(computeExtractSummaryMetrics([])).toEqual({
      tradesCount: 0,
      winCount: 0,
      winRate: 0,
    });
  });

  it('input não-array (undefined/null) → zeros seguros', () => {
    expect(computeExtractSummaryMetrics(undefined)).toEqual({
      tradesCount: 0,
      winCount: 0,
      winRate: 0,
    });
    expect(computeExtractSummaryMetrics(null)).toEqual({
      tradesCount: 0,
      winCount: 0,
      winRate: 0,
    });
  });

  it('todos wins → winRate 100', () => {
    const rows = [{ result: 10 }, { result: 20 }, { result: 1 }];
    const m = computeExtractSummaryMetrics(rows);
    expect(m.tradesCount).toBe(3);
    expect(m.winCount).toBe(3);
    expect(m.winRate).toBe(100);
  });

  it('mistura wins/losses → contagem correta', () => {
    const rows = [
      { result: 100 },
      { result: -50 },
      { result: 25 },
      { result: -10 },
    ];
    const m = computeExtractSummaryMetrics(rows);
    expect(m.tradesCount).toBe(4);
    expect(m.winCount).toBe(2);
    expect(m.winRate).toBe(50);
  });

  it('result === 0 NÃO conta como win (convenção result > 0)', () => {
    const rows = [{ result: 0 }, { result: 0 }, { result: 10 }];
    const m = computeExtractSummaryMetrics(rows);
    expect(m.tradesCount).toBe(3);
    expect(m.winCount).toBe(1);
    expect(m.winRate).toBeCloseTo(33.333, 2);
  });

  it('todos losses → winRate 0', () => {
    const rows = [{ result: -10 }, { result: -20 }];
    const m = computeExtractSummaryMetrics(rows);
    expect(m.winRate).toBe(0);
  });

  it('result em string numérica → coerção segura', () => {
    const rows = [{ result: '100' }, { result: '-50' }, { result: 'abc' }];
    const m = computeExtractSummaryMetrics(rows);
    expect(m.tradesCount).toBe(3);
    expect(m.winCount).toBe(1); // só '100' > 0; 'abc' → NaN
  });
});
