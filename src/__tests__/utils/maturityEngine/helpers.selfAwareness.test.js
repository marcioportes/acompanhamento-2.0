import { describe, it, expect } from 'vitest';
import { computeSelfAwareness } from '../../../utils/maturityEngine/helpers';

describe('computeSelfAwareness', () => {
  it('retorna 100 para match exato das três dimensões', () => {
    const baseline = { emotional: 60, financial: 50, operational: 70 };
    const current = { emotional: 60, financial: 50, operational: 70 };
    expect(computeSelfAwareness(baseline, current)).toBe(100);
  });

  it('retorna 90 para gap uniforme de 10 em todas as dimensões', () => {
    const baseline = { emotional: 60, financial: 50, operational: 70 };
    const current = { emotional: 70, financial: 60, operational: 80 };
    expect(computeSelfAwareness(baseline, current)).toBe(90);
  });

  it('retorna 50 (neutro) quando baseline vazio', () => {
    expect(computeSelfAwareness({}, { emotional: 60 })).toBe(50);
    expect(computeSelfAwareness(null, { emotional: 60 })).toBe(50);
    expect(computeSelfAwareness(undefined, undefined)).toBe(50);
  });

  it('ignora dimensões ausentes no baseline ou current', () => {
    // só emotional é comparável: |60-70|=10 → 90
    const baseline = { emotional: 60 };
    const current = { emotional: 70, financial: 99 };
    expect(computeSelfAwareness(baseline, current)).toBe(90);
  });

  it('clipa no range [0, 100]', () => {
    // gap agregado 100 → score 0
    const baseline = { emotional: 0, financial: 0, operational: 0 };
    const current = { emotional: 100, financial: 100, operational: 100 };
    expect(computeSelfAwareness(baseline, current)).toBe(0);

    // gap > 100 (extrapolação) → clipado em 0
    const baselineBig = { emotional: 0 };
    const currentBig = { emotional: 200 };
    expect(computeSelfAwareness(baselineBig, currentBig)).toBe(0);
  });

  it('ignora valores não-finitos', () => {
    const baseline = { emotional: 60, financial: NaN, operational: 70 };
    const current = { emotional: 60, financial: 50, operational: 70 };
    // só emotional e operational comparam, ambos match → 100
    expect(computeSelfAwareness(baseline, current)).toBe(100);
  });
});
