import { describe, it, expect } from 'vitest';
import { computeMaturity } from '../../../utils/maturityEngine/computeMaturity';
import { makeBaselineScores } from '../../../utils/maturityEngine/fixtures';

describe('computeMaturity', () => {
  it('Stage 1 sem gates, dims=baseline=50 → score ≈ 3 (0 + 0 + 6·50/100)', () => {
    const out = computeMaturity({
      stageCurrent: 1,
      gatesMet: 0,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
      sourceConfidences: { E: 'LOW', F: 'LOW', O: 'LOW' },
    });
    // stageBase=0, gateBoost=0, selfAware=100 (delta zero) → 0 + 0 + 6·100/100 = 6
    expect(out.breakdown.stageBase).toBe(0);
    expect(out.breakdown.gateBoost).toBe(0);
    expect(out.breakdown.selfAware).toBe(100);
    expect(out.score).toBeCloseTo(6, 6);
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBeNull();
  });

  it('Stage 5, gates 8/8, dims = baseline → score 100 (cap via min)', () => {
    const out = computeMaturity({
      stageCurrent: 5,
      gatesMet: 8,
      gatesTotal: 8,
      baseline: makeBaselineScores({ emotional: 80, financial: 80, operational: 80 }),
      currentDims: { emotional: 80, financial: 80, operational: 80 },
      sourceConfidences: { E: 'HIGH', F: 'HIGH', O: 'HIGH' },
    });
    // stageBase=80, gateBoost=14, selfAware=100 → 80 + 14 + 6 = 100 (cap)
    expect(out.breakdown.stageBase).toBe(80);
    expect(out.breakdown.gateBoost).toBe(14);
    expect(out.breakdown.selfAware).toBe(100);
    expect(out.score).toBe(100);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
  });

  it('Stage 3, gates 5/8, dims = baseline → 40 + 8.75 + 6 = 54.75', () => {
    const out = computeMaturity({
      stageCurrent: 3,
      gatesMet: 5,
      gatesTotal: 8,
      baseline: makeBaselineScores({ emotional: 60, financial: 60, operational: 60 }),
      currentDims: { emotional: 60, financial: 60, operational: 60 },
      sourceConfidences: { E: 'MED', F: 'MED', O: 'MED' },
    });
    // stageBase=40, gateBoost=14·5/8=8.75, selfAware=100 → 6
    // M = 40 + 8.75 + 6 = 54.75
    expect(out.breakdown.stageBase).toBe(40);
    expect(out.breakdown.gateBoost).toBeCloseTo(8.75, 6);
    expect(out.score).toBeCloseTo(54.75, 6);
    expect(out.confidence).toBe('MED');
    expect(out.neutralFallback).toBeNull();
  });

  it('gatesTotal=0 → gateBoost=0 + flag gates-pending', () => {
    const out = computeMaturity({
      stageCurrent: 2,
      gatesMet: 0,
      gatesTotal: 0,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
      sourceConfidences: { E: 'HIGH', F: 'HIGH', O: 'HIGH' },
    });
    expect(out.breakdown.gateBoost).toBe(0);
    expect(out.breakdown.stageBase).toBe(20);
    // 20 + 0 + 6 = 26
    expect(out.score).toBeCloseTo(26, 6);
    expect(out.neutralFallback).toBe('maturity:gates-pending');
  });

  it('stageCurrent inválido (6) → fallback para 1 + flag invalid-stage', () => {
    const out = computeMaturity({
      stageCurrent: 6,
      gatesMet: 4,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
      sourceConfidences: { E: 'HIGH', F: 'HIGH', O: 'HIGH' },
    });
    expect(out.breakdown.stageBase).toBe(0);
    expect(out.neutralFallback).toContain('maturity:invalid-stage');

    const out2 = computeMaturity({
      stageCurrent: 'x',
      gatesMet: 4,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
      sourceConfidences: { E: 'HIGH', F: 'HIGH', O: 'HIGH' },
    });
    expect(out2.breakdown.stageBase).toBe(0);
    expect(out2.neutralFallback).toContain('maturity:invalid-stage');
  });

  it('currentDims ausente → usa neutro {50,50,50} + flag dims-unavailable', () => {
    const out = computeMaturity({
      stageCurrent: 3,
      gatesMet: 4,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      // currentDims omitido
      sourceConfidences: { E: 'HIGH', F: 'HIGH', O: 'HIGH' },
    });
    expect(out.breakdown.selfAware).toBe(100); // baseline 50/50/50 == fallback 50/50/50
    expect(out.neutralFallback).toContain('maturity:dims-unavailable');
    // 40 + 14·4/8 + 6 = 40 + 7 + 6 = 53
    expect(out.score).toBeCloseTo(53, 6);
  });

  it('sourceConfidences mistos {E:HIGH, F:MED, O:LOW} → confidence agregada LOW (mínimo)', () => {
    const out = computeMaturity({
      stageCurrent: 3,
      gatesMet: 4,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
      sourceConfidences: { E: 'HIGH', F: 'MED', O: 'LOW' },
    });
    expect(out.confidence).toBe('LOW');
  });

  it('sourceConfidences ausente → confidence default MED', () => {
    const out = computeMaturity({
      stageCurrent: 3,
      gatesMet: 4,
      gatesTotal: 8,
      baseline: makeBaselineScores(),
      currentDims: { emotional: 50, financial: 50, operational: 50 },
    });
    expect(out.confidence).toBe('MED');
  });
});
