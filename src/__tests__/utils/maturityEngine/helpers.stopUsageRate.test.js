import { describe, it, expect } from 'vitest';
import { computeStopUsageRate } from '../../../utils/maturityEngine/helpers';

describe('computeStopUsageRate', () => {
  it('janela vazia → 0', () => {
    expect(computeStopUsageRate([])).toBe(0);
    expect(computeStopUsageRate(null)).toBe(0);
  });

  it('todos com stopLoss → 1', () => {
    const trades = [
      { stopLoss: 95 },
      { stopLoss: 90 },
      { stopLoss: 85 },
    ];
    expect(computeStopUsageRate(trades)).toBe(1);
  });

  it('metade com stopLoss → 0.5', () => {
    const trades = [
      { stopLoss: 95 },
      { stopLoss: null },
      { stopLoss: 90 },
      {},
    ];
    expect(computeStopUsageRate(trades)).toBe(0.5);
  });

  it('stopLoss 0 conta como definido (não é null)', () => {
    const trades = [
      { stopLoss: 0 },
      { stopLoss: null },
    ];
    expect(computeStopUsageRate(trades)).toBe(0.5);
  });

  it('undefined explícito não conta como definido', () => {
    const trades = [
      { stopLoss: undefined },
      { stopLoss: 95 },
    ];
    expect(computeStopUsageRate(trades)).toBe(0.5);
  });
});
