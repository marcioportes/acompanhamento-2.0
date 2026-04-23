import { describe, it, expect } from 'vitest';
import { detectRegressionSignal } from '../../../utils/maturityEngine/detectRegressionSignal';

// STAGE_BASES: 1→0, 2→20, 3→40, 4→60, 5→80.
// Gatilho 1 quer composite < base - 5. Stage 3 → composite < 35.
// Gatilho 2 quer E < bE-15 AND F < bF-15 (ambos baseline defaults 50 → <35).
// Gatilho 3 quer mapMetricsToStage < stageCurrent.

describe('detectRegressionSignal', () => {
  it('tudo saudável no stage 3 → detected false, reasons vazio, severity null', () => {
    const out = detectRegressionSignal({
      composite: 70, stageCurrent: 3, E: 70, F: 72,
      baseline: { emotional: 55, financial: 50 },
      metrics: { winRate: 50, payoff: 1.5, maxDDPercent: 8 },  // mapMetrics → 3
    });
    expect(out.detected).toBe(false);
    expect(out.severity).toBeNull();
    expect(out.reasons).toEqual([]);
    expect(out.suggestedStage).toBeNull();
  });

  it('apenas gatilho 1 (composite < stageBase - 5) → LOW, suggestedStage = stageCurrent - 1', () => {
    const out = detectRegressionSignal({
      composite: 30, stageCurrent: 3, E: 70, F: 72,  // E/F não caem
      baseline: { emotional: 55, financial: 50 },
      metrics: { winRate: 50, payoff: 1.5, maxDDPercent: 8 },  // mapMetrics → 3, não dispara
    });
    expect(out.detected).toBe(true);
    expect(out.severity).toBe('LOW');
    expect(out.reasons).toHaveLength(1);
    expect(out.suggestedStage).toBe(2);
  });

  it('gatilhos 1 + 2 → MED (2 reasons)', () => {
    const out = detectRegressionSignal({
      composite: 30, stageCurrent: 3,
      E: 30, F: 30,  // baseline defaults 50 → 30 < 50-15=35 ✓
      baseline: null,
      metrics: { winRate: 50, payoff: 1.5, maxDDPercent: 8 },  // não dispara
    });
    expect(out.detected).toBe(true);
    expect(out.severity).toBe('MED');
    expect(out.reasons).toHaveLength(2);
  });

  it('3 gatilhos → HIGH', () => {
    const out = detectRegressionSignal({
      composite: 20, stageCurrent: 3,
      E: 25, F: 25,
      baseline: null,
      metrics: { winRate: 20, payoff: 0.5, maxDDPercent: 30 },  // → 1
    });
    expect(out.detected).toBe(true);
    expect(out.severity).toBe('HIGH');
    expect(out.reasons).toHaveLength(3);
    // mapped=1, stageCurrent=3 → min(1, 2) = 1 → max(1, 1) = 1
    expect(out.suggestedStage).toBe(1);
  });

  it('stage 1 com gatilho 3 não dispara (precisa mappedStage < 1 → impossível)', () => {
    // Stage 1: mapMetricsToStage retorna min 1. 1 < 1 é false → nunca dispara.
    // E baseline default 50, E=25 < 35 ✓, F=25 < 35 ✓ → 2 gatilhos (1+2)
    const out = detectRegressionSignal({
      composite: -10, stageCurrent: 1,  // stageBase=0, < -5? sim
      E: 25, F: 25,
      baseline: null,
      metrics: { winRate: 20, payoff: 0.5, maxDDPercent: 50 },
    });
    // Esperamos 2 gatilhos (1 e 2). suggestedStage = max(1, min(1, 0)) = max(1, 0) = 1
    expect(out.detected).toBe(true);
    expect(out.suggestedStage).toBe(1);
  });

  it('baseline ausente usa default 50/50', () => {
    // Com E=40, F=40: 40 < 50-15=35? NÃO → gatilho 2 não dispara.
    const out = detectRegressionSignal({
      composite: 55, stageCurrent: 3, E: 40, F: 40,
      baseline: undefined,
      metrics: { winRate: 50, payoff: 1.5, maxDDPercent: 8 },
    });
    expect(out.detected).toBe(false);
    // Agora com E=30, F=30: 30 < 35 ✓
    const out2 = detectRegressionSignal({
      composite: 55, stageCurrent: 3, E: 30, F: 30,
      baseline: undefined,
      metrics: { winRate: 50, payoff: 1.5, maxDDPercent: 8 },
    });
    expect(out2.detected).toBe(true);
    expect(out2.reasons).toHaveLength(1);
  });

  it('reasons são strings informativas (formato esperado)', () => {
    const out = detectRegressionSignal({
      composite: 20, stageCurrent: 3,
      E: 25, F: 25,
      baseline: { emotional: 55, financial: 55 },
      metrics: { winRate: 20, payoff: 0.5, maxDDPercent: 30 },
    });
    expect(out.reasons[0]).toMatch(/composite 20\.0 < base-stage 35/);
    expect(out.reasons[1]).toMatch(/E 25\.0/);
    expect(out.reasons[2]).toMatch(/métricas mapeiam para stage 1/);
  });
});
