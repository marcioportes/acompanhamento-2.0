import { describe, it, expect } from 'vitest';
import { computeSharpe } from '../../../utils/maturityEngine/helpers';

function buildReturns(n, rValue) {
  return Array.from({ length: n }, () => ({ r: rValue }));
}

function buildAlternating(n, a, b) {
  return Array.from({ length: n }, (_, i) => ({ r: i % 2 === 0 ? a : b }));
}

describe('computeSharpe', () => {
  it('retorna null quando amostra < minDays', () => {
    expect(computeSharpe([], { minDays: 60 })).toBeNull();
    expect(computeSharpe(buildReturns(59, 0.01), { minDays: 60 })).toBeNull();
    expect(computeSharpe(null)).toBeNull();
  });

  it('retorna null quando std = 0 (retornos constantes)', () => {
    expect(computeSharpe(buildReturns(60, 0.01), { minDays: 60 })).toBeNull();
    expect(computeSharpe(buildReturns(100, 0), { minDays: 60 })).toBeNull();
  });

  it('calcula Sharpe anual para retornos alternados', () => {
    const dr = buildAlternating(60, 0.01, 0.02); // mean=0.015, std_amostral=sqrt((0.000025*60)/59)
    const sharpe = computeSharpe(dr, { periodicity: 'annual', minDays: 60 });
    expect(sharpe).not.toBeNull();
    // std = sqrt(0.00002542...) ≈ 0.005043; sharpe = 0.015/0.005043 * sqrt(252) ≈ 47.22
    const N = 60;
    const mean = 0.015;
    const sumSq = N * 0.000025;
    const std = Math.sqrt(sumSq / (N - 1));
    const expected = (mean / std) * Math.sqrt(252);
    expect(sharpe).toBeCloseTo(expected, 8);
  });

  it('anual é sqrt(12) vezes o mensal para os mesmos retornos', () => {
    const dr = buildAlternating(60, 0.001, 0.003);
    const annual = computeSharpe(dr, { periodicity: 'annual', minDays: 60 });
    const monthly = computeSharpe(dr, { periodicity: 'monthly', minDays: 60 });
    expect(annual).not.toBeNull();
    expect(monthly).not.toBeNull();
    expect(annual / monthly).toBeCloseTo(Math.sqrt(252) / Math.sqrt(21), 8);
  });

  it('lança erro em periodicity desconhecida', () => {
    const dr = buildAlternating(60, 0.01, 0.02);
    expect(() => computeSharpe(dr, { periodicity: 'weekly' })).toThrow(/periodicity/);
  });

  it('respeita minDays customizado', () => {
    const dr = buildAlternating(30, 0.01, 0.02);
    expect(computeSharpe(dr, { minDays: 60 })).toBeNull();
    expect(computeSharpe(dr, { minDays: 30 })).not.toBeNull();
  });
});
