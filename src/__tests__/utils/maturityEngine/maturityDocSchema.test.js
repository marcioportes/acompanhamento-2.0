import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCurrentDoc,
  validateHistoryDoc,
} from '../../../utils/maturityEngine/maturityDocSchema';
import { evaluateMaturity } from '../../../utils/maturityEngine/evaluateMaturity';
import { ENGINE_VERSION } from '../../../utils/maturityEngine/constants';
import { makeTradeSeries, resetFixtureCounter } from '../../../utils/maturityEngine/fixtures';

const NOW = '2026-04-23';
const PLANS = [{ id: 'plan-default', initialBalance: 10000 }];

beforeEach(() => resetFixtureCounter());

// Constrói um doc `current` válido a partir do output da engine.
// Engine cobre dimensionScores/gates*/proposedTransition/signalRegression/
// windowSize/confidence/sparseSample/engineVersion. Adiciona os campos da Fase B.
function makeValidCurrentDoc(overrides = {}) {
  const trades = makeTradeSeries({
    count: 30,
    startDate: '2026-03-10',
    plPattern: 'mixed',
    notes: 'journal detalhado com análise ampla',
    stopLoss: 95,
  });
  const engineOut = evaluateMaturity({
    trades,
    plans: PLANS,
    now: NOW,
    stageCurrent: 2,
    baseline: { emotional: 50, financial: 50, operational: 50 },
    emotionalAnalysis: { periodScore: 70, tiltCount: 0, revengeCount: 0 },
    complianceRate: 95,
    stats: { expectancy: 15, payoffRatio: 1.5, winRate: 50 },
    evLeakage: { evTheoretical: 15, evReal: 14 },
    payoff: { ratio: 1.5 },
    consistencyCV: { cv: 0.8 },
    maxDrawdown: { maxDDPercent: 8 },
    advancedMetricsPresent: false,
    complianceRate100: 95,
  });
  return {
    currentStage: 2,
    baselineStage: 1,
    stageHistory: [],
    dimensionScores: engineOut.dimensionScores,
    gates: engineOut.gates,
    gatesMet: engineOut.gatesMet,
    gatesTotal: engineOut.gatesTotal,
    gatesRatio: engineOut.gatesRatio,
    proposedTransition: engineOut.proposedTransition,
    signalRegression: engineOut.signalRegression,
    windowSize: engineOut.windowSize,
    confidence: engineOut.confidence,
    sparseSample: engineOut.sparseSample,
    engineVersion: engineOut.engineVersion,
    ...overrides,
  };
}

function makeValidHistoryDoc(overrides = {}) {
  return {
    date: '2026-04-23',
    dimensionScores: {
      emotional: 60,
      financial: 55,
      operational: 70,
      maturity: 40,
      composite: 56,
    },
    currentStage: 2,
    gatesMet: 3,
    gatesTotal: 5,
    confidence: 'MED',
    tradesInDay: 4,
    computedAt: { seconds: 1745000000, nanoseconds: 0 },
    engineVersion: ENGINE_VERSION,
    ...overrides,
  };
}

describe('validateCurrentDoc', () => {
  it('happy path — doc derivado do output real da engine', () => {
    const doc = makeValidCurrentDoc();
    const result = validateCurrentDoc(doc);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('opcionais ausentes (sem aiNarrative, sem computedAt, sem asOf, sem lastTradeId) → valid', () => {
    const doc = makeValidCurrentDoc();
    const result = validateCurrentDoc(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('opcionais explicitamente null → valid', () => {
    const doc = makeValidCurrentDoc({
      lastTradeId: null,
      computedAt: null,
      asOf: null,
      aiNarrative: null,
      aiPatternsDetected: null,
      aiNextStageGuidance: null,
      aiGeneratedAt: null,
      aiTrigger: null,
    });
    const result = validateCurrentDoc(doc);
    expect(result.valid).toBe(true);
  });

  it('currentStage = 6 → invalid', () => {
    const result = validateCurrentDoc(makeValidCurrentDoc({ currentStage: 6 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('currentStage'))).toBe(true);
  });

  it("currentStage = '3' (string) → invalid", () => {
    const result = validateCurrentDoc(makeValidCurrentDoc({ currentStage: '3' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'3'"))).toBe(true);
  });

  it('baselineStage = 0 → invalid', () => {
    const result = validateCurrentDoc(makeValidCurrentDoc({ baselineStage: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('baselineStage'))).toBe(true);
  });

  it('dimensionScores faltando chave (sem composite) → invalid', () => {
    const doc = makeValidCurrentDoc();
    const ds = { ...doc.dimensionScores };
    delete ds.composite;
    const result = validateCurrentDoc({ ...doc, dimensionScores: ds });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('dimensionScores.composite missing');
  });

  it('dimensionScores.emotional fora de [0,100] (150) → invalid', () => {
    const doc = makeValidCurrentDoc();
    const result = validateCurrentDoc({
      ...doc,
      dimensionScores: { ...doc.dimensionScores, emotional: 150 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('dimensionScores.emotional'))).toBe(true);
  });

  it('gatesRatio = 1.5 → invalid; null → valid', () => {
    const invalid = validateCurrentDoc(makeValidCurrentDoc({ gatesRatio: 1.5 }));
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((e) => e.startsWith('gatesRatio'))).toBe(true);

    const nullable = validateCurrentDoc(makeValidCurrentDoc({ gatesRatio: null }));
    expect(nullable.valid).toBe(true);
  });

  it("proposedTransition.proposed = 'XYZ' → invalid", () => {
    const doc = makeValidCurrentDoc();
    const result = validateCurrentDoc({
      ...doc,
      proposedTransition: { ...doc.proposedTransition, proposed: 'XYZ' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('proposedTransition.proposed'))).toBe(true);
  });

  it('signalRegression sem detected → invalid', () => {
    const doc = makeValidCurrentDoc();
    const sr = { ...doc.signalRegression };
    delete sr.detected;
    const result = validateCurrentDoc({ ...doc, signalRegression: sr });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('signalRegression.detected'))).toBe(true);
  });

  it('engineVersion vazio → invalid', () => {
    const result = validateCurrentDoc(makeValidCurrentDoc({ engineVersion: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('engineVersion'))).toBe(true);
  });

  it('múltiplos erros simultâneos → coleta todos', () => {
    const result = validateCurrentDoc(
      makeValidCurrentDoc({
        currentStage: 9,
        baselineStage: 'x',
        gatesRatio: 2,
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('doc não-objeto (null) → invalid com mensagem específica', () => {
    const result = validateCurrentDoc(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('doc must be object');
  });
});

describe('validateHistoryDoc', () => {
  it('happy path → valid', () => {
    const result = validateHistoryDoc(makeValidHistoryDoc());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("date '26-01-15' (BR truncado) → invalid (regex exige YYYY-MM-DD)", () => {
    const result = validateHistoryDoc(makeValidHistoryDoc({ date: '26-01-15' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('date'))).toBe(true);
  });

  it("date '2026-13-01' → valid (regex permissiva, validação semântica fora de escopo)", () => {
    const result = validateHistoryDoc(makeValidHistoryDoc({ date: '2026-13-01' }));
    expect(result.valid).toBe(true);
  });

  it('tradesInDay = -1 → invalid', () => {
    const result = validateHistoryDoc(makeValidHistoryDoc({ tradesInDay: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('tradesInDay'))).toBe(true);
  });

  it('computedAt ausente → invalid', () => {
    const doc = makeValidHistoryDoc();
    delete doc.computedAt;
    const result = validateHistoryDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('computedAt'))).toBe(true);
  });
});
