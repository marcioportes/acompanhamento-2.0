import { describe, it, expect, beforeEach } from 'vitest';
import { computeFinancial } from '../../../utils/maturityEngine/computeFinancial';
import { makeTradeSeries, resetFixtureCounter } from '../../../utils/maturityEngine/fixtures';

describe('computeFinancial', () => {
  beforeEach(() => {
    resetFixtureCounter();
  });

  it('janela vazia → score neutro 50, LOW, neutralFallback empty-window', () => {
    const out = computeFinancial({ trades: [] });
    expect(out.score).toBe(50);
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBe('financial:empty-window');
    expect(out.breakdown).toEqual({ eScore: 50, pScore: 50, cvScore: 50, ddScore: 50 });
  });

  it('todas métricas ótimas → score próximo de 100, HIGH', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 10 },
      evLeakage: { evTheoretical: 10, evReal: 10 },
      payoff: { ratio: 3.0 },
      consistencyCV: { cv: 0.3 },
      maxDrawdown: { maxDDPercent: 0 },
    });
    // eScore=100, pScore=100, cvScore=100, ddScore=100 → F = 100
    expect(out.score).toBeCloseTo(100, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
    expect(out.breakdown.eScore).toBe(100);
    expect(out.breakdown.pScore).toBe(100);
    expect(out.breakdown.cvScore).toBe(100);
    expect(out.breakdown.ddScore).toBe(100);
  });

  it('todas métricas péssimas → score próximo de 0, HIGH', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 10 },
      evLeakage: { evTheoretical: 10, evReal: 0 },
      payoff: { ratio: 0.8 },
      consistencyCV: { cv: 2.0 },
      maxDrawdown: { maxDDPercent: 25 },
    });
    // eScore=0, pScore=0, cvScore=0, ddScore=0 → F = 0
    expect(out.score).toBeCloseTo(0, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
  });

  it('evLeakage null, stats.expectancy=0.5 → eScore usa stats (ratio=1 → 100)', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 0.5 },
      evLeakage: null,
      payoff: { ratio: 1.5 },
      consistencyCV: { cv: 1.0 },
      maxDrawdown: { maxDDPercent: 10 },
    });
    // expT=expR=0.5 → ratio=1 → eScore=100
    // pScore = norm(1.5, 0.8, 3.0) = (1.5-0.8)/(3.0-0.8) * 100 ≈ 31.818
    // cvScore = normInverted(1.0, 0.3, 2.0) = (1 - (1.0-0.3)/1.7) * 100 ≈ 58.824
    // ddScore = normInverted(10, 0, 25) = (1 - 10/25) * 100 = 60
    // F = 0.30·100 + 0.25·31.818 + 0.20·58.824 + 0.25·60 ≈ 30 + 7.955 + 11.765 + 15 = 64.72
    expect(out.breakdown.eScore).toBeCloseTo(100, 6);
    expect(out.breakdown.pScore).toBeCloseTo((1.5 - 0.8) / (3.0 - 0.8) * 100, 4);
    expect(out.breakdown.cvScore).toBeCloseTo((1 - (1.0 - 0.3) / (2.0 - 0.3)) * 100, 4);
    expect(out.breakdown.ddScore).toBeCloseTo(60, 6);
    expect(out.neutralFallback).toBeNull();
  });

  it('tudo ausente exceto trades → flags para eScore/pScore/ddScore, cv default sem flag', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({ trades });
    // eScore=50 (flag), pScore=50 (flag), cvScore=normInverted(2.0,0.3,2.0)=0 (no flag),
    // ddScore=50 (flag)
    // F = 0.30·50 + 0.25·50 + 0.20·0 + 0.25·50 = 15 + 12.5 + 0 + 12.5 = 40
    expect(out.breakdown.eScore).toBe(50);
    expect(out.breakdown.pScore).toBe(50);
    expect(out.breakdown.cvScore).toBe(0);
    expect(out.breakdown.ddScore).toBe(50);
    expect(out.score).toBeCloseTo(40, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBe('financial:eScore;financial:pScore;financial:ddScore');
  });

  it('confidence HIGH com 40 trades + todos inputs válidos', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 5 },
      evLeakage: { evTheoretical: 5, evReal: 4 },
      payoff: { ratio: 1.8 },
      consistencyCV: { cv: 0.8 },
      maxDrawdown: { maxDDPercent: 6 },
    });
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
    // Score esperado entre 0 e 100
    expect(out.score).toBeGreaterThan(0);
    expect(out.score).toBeLessThan(100);
  });

  it('N = 10 (entre floor e floor+30) → MED', () => {
    const trades = makeTradeSeries({ count: 10 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 1 },
      evLeakage: { evTheoretical: 1, evReal: 1 },
      payoff: { ratio: 2.0 },
      consistencyCV: { cv: 0.5 },
      maxDrawdown: { maxDDPercent: 5 },
    });
    expect(out.confidence).toBe('MED');
    expect(out.neutralFallback).toBeNull();
  });

  it('N = 3 (< floor) → LOW mesmo com inputs completos', () => {
    const trades = makeTradeSeries({ count: 3 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 1 },
      evLeakage: { evTheoretical: 1, evReal: 1 },
      payoff: { ratio: 2.0 },
      consistencyCV: { cv: 0.5 },
      maxDrawdown: { maxDDPercent: 5 },
    });
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBeNull();
  });

  it('payoff ausente mas stats.payoffRatio presente → pScore usa stats', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeFinancial({
      trades,
      stats: { expectancy: 1, payoffRatio: 2.0 },
      evLeakage: { evTheoretical: 1, evReal: 1 },
      payoff: null,
      consistencyCV: { cv: 0.5 },
      maxDrawdown: { maxDDPercent: 5 },
    });
    // pScore = norm(2.0, 0.8, 3.0) = (2.0-0.8)/(3.0-0.8)*100 ≈ 54.545
    expect(out.breakdown.pScore).toBeCloseTo((2.0 - 0.8) / (3.0 - 0.8) * 100, 4);
    expect(out.neutralFallback).toBeNull();
  });
});
