import { describe, it, expect } from 'vitest';
import { computeAnnualizedReturn } from '../../../utils/maturityEngine/helpers';

function buildReturns(n, rValue) {
  return Array.from({ length: n }, () => ({ r: rValue }));
}

describe('computeAnnualizedReturn', () => {
  it('retorna null quando amostra < minDays', () => {
    expect(computeAnnualizedReturn([], { minDays: 60 })).toBeNull();
    expect(computeAnnualizedReturn(buildReturns(59, 0.001), { minDays: 60 })).toBeNull();
    expect(computeAnnualizedReturn(null)).toBeNull();
  });

  it('retorno zero para sequência com r=0', () => {
    const out = computeAnnualizedReturn(buildReturns(60, 0), { minDays: 60 });
    expect(out).toBeCloseTo(0, 10);
  });

  it('calcula CAGR anualizado para r constante positivo', () => {
    const r = 0.001;
    const N = 60;
    const dr = buildReturns(N, r);
    const out = computeAnnualizedReturn(dr, { minDays: 60 });
    // (1+r)^N - 1 = cumulative; anualizado = (1+r)^(252) - 1
    const expected = Math.pow(1 + r, 252) - 1;
    expect(out).toBeCloseTo(expected, 8);
  });

  it('retorna valor negativo para r constante negativo', () => {
    const r = -0.001;
    const N = 60;
    const dr = buildReturns(N, r);
    const out = computeAnnualizedReturn(dr, { minDays: 60 });
    expect(out).toBeLessThan(0);
    const expected = Math.pow(1 + r, 252) - 1;
    expect(out).toBeCloseTo(expected, 8);
  });

  it('retorna fração (não percentual)', () => {
    const r = 0.0005;
    const dr = buildReturns(100, r);
    const out = computeAnnualizedReturn(dr, { minDays: 60 });
    // (1.0005)^252 ≈ 1.134 → anualizado ≈ 0.134 (não 13.4)
    expect(out).toBeGreaterThan(0.1);
    expect(out).toBeLessThan(0.2);
  });
});
