import { describe, it, expect, beforeEach } from 'vitest';
import { computeEmotional } from '../../../utils/maturityEngine/computeEmotional';
import { makeTradeSeries, resetFixtureCounter } from '../../../utils/maturityEngine/fixtures';

describe('computeEmotional', () => {
  beforeEach(() => {
    resetFixtureCounter();
  });

  it('janela vazia → score neutro 50, confidence LOW, neutralFallback setado', () => {
    const out = computeEmotional({ trades: [], emotionalAnalysis: { periodScore: 80 } });
    expect(out.score).toBe(50);
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBe('emotional:empty-window');
    expect(out.breakdown.tiltRate).toBe(0);
    expect(out.breakdown.revengeRate).toBe(0);
  });

  it('N ≥ 35, periodScore 80, zero tilt/revenge → score alto (~88), HIGH', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeEmotional({
      trades,
      emotionalAnalysis: { periodScore: 80, tiltCount: 0, revengeCount: 0 },
    });
    // E = 0.60·80 + 0.25·100 + 0.15·100 = 48 + 25 + 15 = 88
    expect(out.score).toBeCloseTo(88, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
    expect(out.breakdown.periodScore).toBe(80);
    expect(out.breakdown.tiltRate).toBe(0);
    expect(out.breakdown.revengeRate).toBe(0);
  });

  it('N ≥ 35, periodScore 40, tilt/revenge no teto → componentes invertidos = 0', () => {
    const trades = makeTradeSeries({ count: 40 });
    // tiltRate = 12/40 = 0.30 (teto); revengeRate = 8/40 = 0.20 (teto)
    const out = computeEmotional({
      trades,
      emotionalAnalysis: { periodScore: 40, tiltCount: 12, revengeCount: 8 },
    });
    // E = 0.60·40 + 0.25·0 + 0.15·0 = 24
    expect(out.score).toBeCloseTo(24, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.breakdown.tiltRate).toBeCloseTo(0.30, 6);
    expect(out.breakdown.revengeRate).toBeCloseTo(0.20, 6);
  });

  it('3 trades, periodScore presente → confidence LOW sem neutralFallback', () => {
    const trades = makeTradeSeries({ count: 3 });
    const out = computeEmotional({
      trades,
      emotionalAnalysis: { periodScore: 60, tiltCount: 0, revengeCount: 0 },
    });
    // E = 0.60·60 + 0.25·100 + 0.15·100 = 36 + 25 + 15 = 76
    expect(out.score).toBeCloseTo(76, 6);
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBeNull();
  });

  it('emotionalAnalysis = {} → periodScore fallback 50, tilt/revenge tratados como 0', () => {
    const trades = makeTradeSeries({ count: 10 });
    const out = computeEmotional({ trades, emotionalAnalysis: {} });
    // periodScore = 50 (neutral), tiltRate=0, revengeRate=0
    // E = 0.60·50 + 0.25·100 + 0.15·100 = 30 + 25 + 15 = 70
    expect(out.score).toBeCloseTo(70, 6);
    expect(out.confidence).toBe('MED'); // 5 ≤ 10 < 35
    expect(out.neutralFallback).toBe('emotional:periodScore');
    expect(out.breakdown.periodScore).toBe(50);
  });

  it('tilt acima do teto (0.50) → clip01 garante componente = 0, score não negativo', () => {
    const trades = makeTradeSeries({ count: 10 });
    const out = computeEmotional({
      trades,
      emotionalAnalysis: { periodScore: 30, tiltCount: 5, revengeCount: 0 },
    });
    // tiltRate = 0.50 → normInverted(0.50, 0, 0.30) = 1 - 1.67 = -0.67 → clip → 0
    // revengeRate = 0 → normInverted(0,0,0.20) = 100
    // E = 0.60·30 + 0.25·0 + 0.15·100 = 18 + 0 + 15 = 33
    expect(out.score).toBeCloseTo(33, 6);
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.breakdown.tiltRate).toBeCloseTo(0.5, 6);
  });

  it('emotionalAnalysis ausente (undefined) + trades → usa neutrals e flag periodScore', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeEmotional({ trades });
    // periodScore=50, tiltCount=0, revengeCount=0
    // E = 30 + 25 + 15 = 70
    expect(out.score).toBeCloseTo(70, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBe('emotional:periodScore');
  });

  it('ausência parcial: só periodScore presente → tilt/revenge = 0, sem flag', () => {
    const trades = makeTradeSeries({ count: 40 });
    const out = computeEmotional({
      trades,
      emotionalAnalysis: { periodScore: 70 },
    });
    // E = 0.60·70 + 25 + 15 = 42 + 40 = 82
    expect(out.score).toBeCloseTo(82, 6);
    expect(out.neutralFallback).toBeNull();
    expect(out.breakdown.tiltRate).toBe(0);
    expect(out.breakdown.revengeRate).toBe(0);
  });
});
