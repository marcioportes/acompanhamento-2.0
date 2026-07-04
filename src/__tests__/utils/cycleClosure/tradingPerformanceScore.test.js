/**
 * tradingPerformanceScore.test.js — issue #259 (1A)
 *
 * Worked example Clear-DT FEV/2026: TPS ≈ 67/100 (ver §11 do draft).
 */

import { describe, it, expect } from 'vitest';
import {
  computeTPS,
  computeWinRateConsistency,
  cvToConsistencyNorm,
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

describe('cvToConsistencyNorm — #337 (CV normalizado → score 0..1)', () => {
  it('value ≤ 1,0 (no plano ou mais suave) → 1,0', () => {
    expect(cvToConsistencyNorm(1.0)).toBe(1);
    expect(cvToConsistencyNorm(0.5)).toBe(1);   // "suspeito" não é punido
    expect(cvToConsistencyNorm(0.0)).toBe(1);
  });
  it('meio da faixa errática → parcial', () => {
    expect(cvToConsistencyNorm(1.5)).toBeCloseTo(0.5, 6);
    expect(cvToConsistencyNorm(1.25)).toBeCloseTo(0.75, 6);
  });
  it('value ≥ 2,0 (muito errático) → 0', () => {
    expect(cvToConsistencyNorm(2.0)).toBe(0);
    expect(cvToConsistencyNorm(3.0)).toBe(0);   // clamp
  });
  it('null/NaN/inválido → null (fator vira missing)', () => {
    expect(cvToConsistencyNorm(null)).toBeNull();
    expect(cvToConsistencyNorm(undefined)).toBeNull();
    expect(cvToConsistencyNorm(NaN)).toBeNull();
    expect(cvToConsistencyNorm('1.0')).toBeNull();
  });
});

describe('computeTPS — renormalização de pesos (#337)', () => {
  it('nada faltando → pesos efetivos = nominais (bit-exato)', () => {
    const tps = computeTPS({
      profitFactor: 3, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: 1, ruleAdherenceRate: 1,
    });
    expect(tps.weights.pf).toBe(TPS_WEIGHTS.profitFactor);
    expect(tps.weights.dd).toBe(TPS_WEIGHTS.drawdown);
    expect(tps.weights.consistency).toBe(TPS_WEIGHTS.consistency);
    expect(tps.score).toBe(100);           // todos os fatores no máximo
  });

  it('consistência ausente → peso 0,15 redistribuído; sem crédito fantasma nem zero injusto', () => {
    const tps = computeTPS({
      profitFactor: 3, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: null, ruleAdherenceRate: 1,
    });
    // demais fatores no máximo → nota 100 mesmo sem consistência (renormaliza sobre 0,85)
    expect(tps.score).toBeCloseTo(100, 6);
    expect(tps.weights.consistency).toBe(0);
    expect(tps.breakdown.consistency).toBe(0);
    expect(tps.missing).toContain('winRateConsistency');
    // peso efetivo do PF sobe de 0,20 → 0,20/0,85
    expect(tps.weights.pf).toBeCloseTo(0.20 / 0.85, 6);
    // soma dos pesos efetivos = 1
    const sumW = Object.values(tps.weights).reduce((s, v) => s + v, 0);
    expect(sumW).toBeCloseTo(1.0, 6);
  });

  it('renormalização mantém breakdown somando = score/100', () => {
    const tps = computeTPS({
      profitFactor: 1.5, maxDDPercent: 0.02, expectancy_R: 0.3,
      winRateConsistency: null, ruleAdherenceRate: 0.8,
    });
    const total = Object.values(tps.breakdown).reduce((s, v) => s + v, 0);
    expect(total * 100).toBeCloseTo(tps.score, 6);
  });

  it('placeholder morto: consistência null não injeta mais 0,70 fixo', () => {
    // Com consistência ruim explícita (0) a nota é MENOR do que quando o fator é ignorado (null).
    const comConsistenciaRuim = computeTPS({
      profitFactor: 3, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: 0, ruleAdherenceRate: 1,
    });
    const semDado = computeTPS({
      profitFactor: 3, maxDDPercent: 0, expectancy_R: 0.5,
      winRateConsistency: null, ruleAdherenceRate: 1,
    });
    expect(comConsistenciaRuim.score).toBeLessThan(semDado.score);
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
