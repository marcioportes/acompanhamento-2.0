/**
 * tradingPerformanceScore.test.js — issue #259 (1A)
 *
 * Worked example Clear-DT FEV/2026: TPS ≈ 67/100 (ver §11 do draft).
 */

import { describe, it, expect } from 'vitest';
import {
  computeTPS,
  computeWinRateConsistency,
  TPS_WEIGHTS,
  TPS_MAX_ACCEPTABLE_DD,
} from '../../../utils/cycleClosure/tradingPerformanceScore';

describe('TPS_WEIGHTS — fechado em Q12 (Mark Douglas)', () => {
  it('weights revisados (Rule 20 ↑)', () => {
    expect(TPS_WEIGHTS.profitFactor).toBe(0.20);
    expect(TPS_WEIGHTS.drawdown).toBe(0.25);
    expect(TPS_WEIGHTS.expectancy).toBe(0.20);
    expect(TPS_WEIGHTS.consistency).toBe(0.15);
    expect(TPS_WEIGHTS.rule).toBe(0.20);
  });
  it('soma dos weights = 1.0', () => {
    const total = Object.values(TPS_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 6);
  });
  it('maxAcceptableDD = 5% fixo (Q3)', () => {
    expect(TPS_MAX_ACCEPTABLE_DD).toBe(0.05);
  });
});

describe('computeTPS — Worked example Clear-DT FEV/2026', () => {
  it('TPS aproxima 67/100', () => {
    const tps = computeTPS({
      profitFactor: 2.49,            // worked example §11
      maxDDPercent: 0.028,           // -2.8%
      expectancy_R: 0.277,
      winRateConsistency: 0.70,      // placeholder do draft
      ruleAdherenceRate: 0.889,
    });
    expect(tps.score).toBeGreaterThan(60);
    expect(tps.score).toBeLessThan(75);
    expect(tps.score).toBeCloseTo(67, 0);    // tolerância 1pt
    expect(tps.missing).toEqual([]);
  });

  it('breakdown soma = score/100', () => {
    const tps = computeTPS({
      profitFactor: 2.49,
      maxDDPercent: 0.028,
      expectancy_R: 0.277,
      winRateConsistency: 0.70,
      ruleAdherenceRate: 0.889,
    });
    const total = Object.values(tps.breakdown).reduce((s, v) => s + v, 0);
    expect(total * 100).toBeCloseTo(tps.score, 6);
  });
});

describe('computeTPS — clamp e edges', () => {
  it('PF altíssimo é clamped em 1.0', () => {
    const lower = computeTPS({
      profitFactor: 3, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: 1, ruleAdherenceRate: 1,
    });
    const higher = computeTPS({
      profitFactor: 100, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: 1, ruleAdherenceRate: 1,
    });
    expect(lower.score).toBe(higher.score);   // ambos clampam pf=1.0
  });

  it('DD = 0 → contribuição máxima de DD', () => {
    const tps = computeTPS({
      profitFactor: 0, maxDDPercent: 0, expectancy_R: 0,
      winRateConsistency: 0, ruleAdherenceRate: 0.5,
    });
    expect(tps.breakdown.dd).toBe(TPS_WEIGHTS.drawdown);
  });

  it('DD ≥ cap (5%) → contribuição zero', () => {
    const tps = computeTPS({
      profitFactor: 1, maxDDPercent: 0.10, expectancy_R: 0,
      winRateConsistency: 0, ruleAdherenceRate: 1,
    });
    expect(tps.breakdown.dd).toBe(0);
  });

  it('expectancy ≥ 0.5R → contribuição máxima', () => {
    const tps = computeTPS({
      profitFactor: 1, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: 0, ruleAdherenceRate: 1,
    });
    expect(tps.breakdown.exp).toBe(TPS_WEIGHTS.expectancy);
  });

  it('expectancy negativo → contribuição zero (clamped)', () => {
    const tps = computeTPS({
      profitFactor: 1, maxDDPercent: 0, expectancy_R: -0.5,
      winRateConsistency: 0, ruleAdherenceRate: 1,
    });
    expect(tps.breakdown.exp).toBe(0);
  });
});

describe('computeTPS — missing fields', () => {
  it('PF null → score null', () => {
    const tps = computeTPS({
      profitFactor: null, maxDDPercent: 0.02, expectancy_R: 0.3,
      winRateConsistency: 0.7, ruleAdherenceRate: 0.9,
    });
    expect(tps.score).toBeNull();
    expect(tps.missing).toContain('profitFactor');
  });

  it('Rule null → score null (Mark Douglas: rule é crítico)', () => {
    const tps = computeTPS({
      profitFactor: 2, maxDDPercent: 0.02, expectancy_R: 0.3,
      winRateConsistency: 0.7, ruleAdherenceRate: null,
    });
    expect(tps.score).toBeNull();
    expect(tps.missing).toContain('ruleAdherenceRate');
  });

  it('DD null mas PF e Rule presentes → score válido com DD=0', () => {
    const tps = computeTPS({
      profitFactor: 2, maxDDPercent: null, expectancy_R: 0.3,
      winRateConsistency: 0.7, ruleAdherenceRate: 0.9,
    });
    expect(tps.score).not.toBeNull();
    expect(tps.missing).toContain('maxDDPercent');
    expect(tps.breakdown.dd).toBe(0);
  });

  it('todos os campos null → score null + todos em missing', () => {
    const tps = computeTPS({
      profitFactor: null, maxDDPercent: null, expectancy_R: null,
      winRateConsistency: null, ruleAdherenceRate: null,
    });
    expect(tps.score).toBeNull();
    expect(tps.missing).toHaveLength(5);
  });
});

describe('computeWinRateConsistency', () => {
  it('buckets idênticos (winrate constante) → 1.0', () => {
    expect(computeWinRateConsistency([
      { wins: 6, total: 10 },
      { wins: 6, total: 10 },
      { wins: 6, total: 10 },
    ])).toBe(1);
  });

  it('high variance → menor consistência', () => {
    const high = computeWinRateConsistency([
      { wins: 0, total: 10 },
      { wins: 10, total: 10 },
    ]);
    const low = computeWinRateConsistency([
      { wins: 5, total: 10 },
      { wins: 6, total: 10 },
    ]);
    expect(low).toBeGreaterThan(high);
  });

  it('<2 buckets → null', () => {
    expect(computeWinRateConsistency([])).toBeNull();
    expect(computeWinRateConsistency([{ wins: 5, total: 10 }])).toBeNull();
  });

  it('ignora buckets com total=0', () => {
    expect(computeWinRateConsistency([
      { wins: 5, total: 10 },
      { wins: 0, total: 0 },
      { wins: 6, total: 12 },
    ])).not.toBeNull();
  });
});
