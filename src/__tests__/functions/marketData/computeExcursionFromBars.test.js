/**
 * computeExcursionFromBars.test.js — issue #187 Fase 4
 */

import { describe, it, expect } from 'vitest';
import { computeExcursionFromBars } from '../../../../functions/marketData/computeExcursionFromBars';

const bars = [
  { t: 1, h: 100, l: 99 },
  { t: 2, h: 102, l: 100 },
  { t: 3, h: 101, l: 95 },
  { t: 4, h: 105, l: 103 },
  { t: 5, h: 104, l: 102 },
];

describe('computeExcursionFromBars', () => {
  it('LONG: mep = max(highs), men = min(lows)', () => {
    const result = computeExcursionFromBars({ bars, side: 'LONG' });
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(95);
  });

  it('SHORT inverte: mep = min(lows), men = max(highs)', () => {
    const result = computeExcursionFromBars({ bars, side: 'SHORT' });
    expect(result.mepPrice).toBe(95);
    expect(result.menPrice).toBe(105);
  });

  it('retorna null para bars vazias', () => {
    expect(computeExcursionFromBars({ bars: [], side: 'LONG' })).toEqual({ mepPrice: null, menPrice: null });
  });

  it('retorna null para input não-array', () => {
    expect(computeExcursionFromBars({ bars: null, side: 'LONG' })).toEqual({ mepPrice: null, menPrice: null });
  });

  it('retorna null para side inválido', () => {
    expect(computeExcursionFromBars({ bars, side: 'BOTH' })).toEqual({ mepPrice: null, menPrice: null });
  });

  it('ignora bars com h/l null (Yahoo às vezes retorna gaps)', () => {
    const sparse = [
      { t: 1, h: 100, l: 99 },
      { t: 2, h: null, l: null },
      { t: 3, h: 110, l: 90 },
    ];
    const result = computeExcursionFromBars({ bars: sparse, side: 'LONG' });
    expect(result.mepPrice).toBe(110);
    expect(result.menPrice).toBe(90);
  });

  it('retorna null se TODAS as bars têm h/l inválidos', () => {
    const allNull = [{ t: 1, h: null, l: null }, { t: 2, h: 'foo', l: 'bar' }];
    expect(computeExcursionFromBars({ bars: allNull, side: 'LONG' })).toEqual({ mepPrice: null, menPrice: null });
  });
});
