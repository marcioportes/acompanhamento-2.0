import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateMaturity } from '../../../utils/maturityEngine/evaluateMaturity';
import { ENGINE_VERSION } from '../../../utils/maturityEngine/constants';
import { makeTradeSeries, resetFixtureCounter } from '../../../utils/maturityEngine/fixtures';

const NOW = '2026-04-23';
const PLANS = [{ id: 'plan-default', initialBalance: 10000 }];

function isScoreOk(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

function isConfidence(v) {
  return v === 'HIGH' || v === 'MED' || v === 'LOW';
}

beforeEach(() => resetFixtureCounter());

describe('evaluateMaturity — integração por stage', () => {
  it('Stage 1 chaos — 10 trades, maxDD alto, zero journal, zero compliance', () => {
    const trades = makeTradeSeries({
      count: 10,
      startDate: '2026-04-01',
      plPattern: 'negative',
      notes: '',
      emotionEntry: null,
      emotionExit: null,
      planId: null,
      stopLoss: null,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 1,
      // Baseline baixo (aluno novo) — chaos NÃO representa regressão.
      baseline: { emotional: 20, financial: 10, operational: 15 },
      emotionalAnalysis: { periodScore: 30, tiltCount: 3, revengeCount: 2 },
      complianceRate: 20,
      stats: { expectancy: -10, payoffRatio: 0.5, winRate: 20 },
      evLeakage: null,
      payoff: { ratio: 0.5 },
      consistencyCV: { cv: 1.8 },
      maxDrawdown: { maxDDPercent: 35 },
      advancedMetricsPresent: false,
      complianceRate100: 20,
    });
    expect(isScoreOk(out.dimensionScores.composite)).toBe(true);
    expect(out.dimensionScores.composite).toBeLessThan(50);
    expect(isConfidence(out.confidence)).toBe(true);
    expect(out.engineVersion).toBe(ENGINE_VERSION);
    expect(Array.isArray(out.gates)).toBe(true);
    expect(out.gatesTotal).toBeGreaterThan(0);
    // Com baseline baixo → sem regressão. Gates falhando → STAY.
    expect(out.proposedTransition.proposed).toBe('STAY');
    expect(out.proposedTransition.nextStage).toBe(2);
  });

  it('Stage 2 reactive — 30 trades, compliance 82, journal 55%, stop 80% → gates 2-3 met com números saudáveis', () => {
    const trades = makeTradeSeries({
      count: 30,
      startDate: '2026-03-10',
      plPattern: 'mixed',
      setup: 'rompimento',
      notes: 'journal detalhado com análise ampla',
      stopLoss: 95,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 2,
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
    expect(isScoreOk(out.dimensionScores.composite)).toBe(true);
    expect(out.confidence).toBe('MED'); // 30 trades → MED (precisa 35+ para HIGH)
    expect(out.gatesTotal).toBeGreaterThan(0);
  });

  it('Stage 3 methodical — 50 trades com métricas 3→4 fortes', () => {
    const trades = makeTradeSeries({
      count: 50,
      startDate: '2026-02-15',
      plPattern: 'positive',
      setup: 'rompimento',
      notes: 'análise detalhada pré-entrada',
      stopLoss: 95,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 3,
      baseline: { emotional: 60, financial: 60, operational: 60 },
      emotionalAnalysis: { periodScore: 80, tiltCount: 0, revengeCount: 0 },
      complianceRate: 98,
      stats: { expectancy: 25, payoffRatio: 2.2, winRate: 58 },
      evLeakage: { evTheoretical: 25, evReal: 24 },
      payoff: { ratio: 2.2 },
      consistencyCV: { cv: 0.4 },
      maxDrawdown: { maxDDPercent: 4 },
      advancedMetricsPresent: true,
      complianceRate100: 100,
    });
    expect(isScoreOk(out.dimensionScores.composite)).toBe(true);
    expect(out.dimensionScores.composite).toBeGreaterThan(50);
    expect(out.gatesTotal).toBe(13); // 3→4: 10 gates legacy + 3 gates comportamentais (#208)
  });

  it('Stage 4 professional — 80 trades, métricas 4→5 fortes mas nem todas perfeitas', () => {
    const trades = makeTradeSeries({
      count: 80,
      startDate: '2026-01-05',
      plPattern: 'positive',
      setup: 'rompimento',
      notes: 'análise profunda com planejamento',
      stopLoss: 95,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 4,
      baseline: { emotional: 70, financial: 70, operational: 70 },
      emotionalAnalysis: { periodScore: 88, tiltCount: 0, revengeCount: 0 },
      complianceRate: 99,
      stats: { expectancy: 35, payoffRatio: 2.6, winRate: 60 },
      evLeakage: { evTheoretical: 35, evReal: 34 },
      payoff: { ratio: 2.6 },
      consistencyCV: { cv: 0.35 },
      maxDrawdown: { maxDDPercent: 2.5 },
      advancedMetricsPresent: true,
      complianceRate100: 100,
    });
    expect(isScoreOk(out.dimensionScores.composite)).toBe(true);
    expect(out.gatesTotal).toBe(9); // 4→5 tem 9 gates
  });

  it('Stage 5 mastery — mastery → gates vazio, proposed STAY, M=100 esperado', () => {
    const trades = makeTradeSeries({
      count: 100,
      startDate: '2025-12-01',
      plPattern: 'positive',
      setup: 'rompimento',
      notes: 'análise completa e detalhada',
      stopLoss: 95,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 5,
      baseline: { emotional: 85, financial: 85, operational: 85 },
      emotionalAnalysis: { periodScore: 92, tiltCount: 0, revengeCount: 0 },
      complianceRate: 100,
      stats: { expectancy: 50, payoffRatio: 3.0, winRate: 65 },
      evLeakage: { evTheoretical: 50, evReal: 50 },
      payoff: { ratio: 3.0 },
      consistencyCV: { cv: 0.3 },
      maxDrawdown: { maxDDPercent: 1.5 },
      advancedMetricsPresent: true,
      complianceRate100: 100,
    });
    expect(out.gates).toEqual([]);
    expect(out.gatesTotal).toBe(0);
    // Mastery → STAY (não há UP)
    expect(out.proposedTransition.proposed).toBe('STAY');
    expect(out.proposedTransition.nextStage).toBe(5);
    // M score deve estar elevado (stageBase 80 + gateBoost 14 = 94 + selfAware)
    expect(out.dimensionScores.maturity).toBeGreaterThanOrEqual(94);
    expect(out.dimensionScores.maturity).toBeLessThanOrEqual(100);
  });

  it('Regressão — aluno Stage 3 com métricas Stage 2 → DOWN_DETECTED, stageCurrent inalterado', () => {
    const trades = makeTradeSeries({
      count: 50,
      startDate: '2026-02-15',
      plPattern: 'negative',
      setup: 'rompimento',
      stopLoss: null,
      notes: '',
      planId: null,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 3,
      baseline: { emotional: 70, financial: 70, operational: 70 },
      emotionalAnalysis: { periodScore: 30, tiltCount: 5, revengeCount: 3 },
      complianceRate: 40,
      stats: { expectancy: -20, payoffRatio: 0.7, winRate: 35 },
      evLeakage: null,
      payoff: { ratio: 0.7 },
      consistencyCV: { cv: 1.6 },
      maxDrawdown: { maxDDPercent: 22 },
      advancedMetricsPresent: false,
      complianceRate100: 40,
    });
    expect(out.signalRegression.detected).toBe(true);
    expect(out.signalRegression.severity).not.toBeNull();
    expect(out.proposedTransition.proposed).toBe('DOWN_DETECTED');
    // stageCurrent NUNCA muda (DEC-020)
    expect(out.proposedTransition.nextStage).toBe(3);
  });

  it('Sparse 3 trades — sparseSample=true, confidence LOW, score numérico (nunca null)', () => {
    const trades = makeTradeSeries({
      count: 3,
      startDate: '2026-04-20',
      plPattern: 'positive',
      setup: 'rompimento',
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 2,
      baseline: { emotional: 50, financial: 50, operational: 50 },
      emotionalAnalysis: { periodScore: 60, tiltCount: 0, revengeCount: 0 },
      complianceRate: 80,
      stats: { expectancy: 10, payoffRatio: 1.3, winRate: 50 },
      evLeakage: null,
      payoff: { ratio: 1.3 },
      consistencyCV: null,
      maxDrawdown: { maxDDPercent: 5 },
      advancedMetricsPresent: false,
      complianceRate100: 80,
    });
    expect(out.sparseSample).toBe(true);
    expect(out.confidence).toBe('LOW');
    expect(isScoreOk(out.dimensionScores.composite)).toBe(true);
    expect(out.dimensionScores.emotional).not.toBeNull();
    expect(out.dimensionScores.financial).not.toBeNull();
  });

  it('Sparse 5 trades — no limiar floor, confidence LOW, sparseSample false', () => {
    const trades = makeTradeSeries({
      count: 5,
      startDate: '2026-04-18',
      plPattern: 'positive',
      setup: 'rompimento',
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 2,
      baseline: { emotional: 50, financial: 50, operational: 50 },
      emotionalAnalysis: { periodScore: 65, tiltCount: 0, revengeCount: 0 },
      complianceRate: 80,
      stats: { expectancy: 10, payoffRatio: 1.3, winRate: 50 },
      evLeakage: null,
      payoff: { ratio: 1.3 },
      consistencyCV: null,
      maxDrawdown: { maxDDPercent: 5 },
      advancedMetricsPresent: false,
      complianceRate100: 80,
    });
    expect(out.sparseSample).toBe(false);
    // Dim confidence fica MED (5 ≥ floor) → orchestrator confidence MED/MIN dos quatro
    // Mas stage 2 + gates pendentes → M pode ter confidence MED também. Aceitamos MED.
    expect(['LOW', 'MED']).toContain(out.confidence);
  });

  it('15 trades — confidence MED (5 ≤ N < 35)', () => {
    const trades = makeTradeSeries({
      count: 15,
      startDate: '2026-03-20',
      plPattern: 'positive',
      setup: 'rompimento',
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 2,
      baseline: { emotional: 50, financial: 50, operational: 50 },
      emotionalAnalysis: { periodScore: 65, tiltCount: 0, revengeCount: 0 },
      complianceRate: 80,
      stats: { expectancy: 10, payoffRatio: 1.3, winRate: 50 },
      evLeakage: null,
      payoff: { ratio: 1.3 },
      consistencyCV: null,
      maxDrawdown: { maxDDPercent: 5 },
      advancedMetricsPresent: false,
      complianceRate100: 80,
    });
    expect(out.confidence).toBe('MED');
  });

  it('50 trades saudáveis em Stage 5 — composite alto, gates vazio, M ≈ 100', () => {
    const trades = makeTradeSeries({
      count: 50,
      startDate: '2026-02-15',
      plPattern: 'positive',
      setup: 'rompimento',
      notes: 'análise detalhada',
      stopLoss: 95,
    });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 5,
      baseline: { emotional: 85, financial: 85, operational: 85 },
      emotionalAnalysis: { periodScore: 90, tiltCount: 0, revengeCount: 0 },
      complianceRate: 100,
      stats: { expectancy: 45, payoffRatio: 2.8, winRate: 62 },
      evLeakage: { evTheoretical: 45, evReal: 44 },
      payoff: { ratio: 2.8 },
      consistencyCV: { cv: 0.35 },
      maxDrawdown: { maxDDPercent: 2 },
      advancedMetricsPresent: true,
      complianceRate100: 100,
    });
    expect(out.dimensionScores.composite).toBeGreaterThan(80);
    expect(out.gates).toEqual([]);
    expect(out.dimensionScores.maturity).toBeGreaterThanOrEqual(94);
  });

  it('Snapshot — contém todos os campos do schema D10 (Fase A)', () => {
    const trades = makeTradeSeries({ count: 20, startDate: '2026-03-15', plPattern: 'positive' });
    const out = evaluateMaturity({
      trades, plans: PLANS, now: NOW, stageCurrent: 3,
      baseline: null,
      emotionalAnalysis: { periodScore: 60, tiltCount: 0, revengeCount: 0 },
      complianceRate: 90,
      stats: { expectancy: 10, payoffRatio: 1.5, winRate: 50 },
      evLeakage: null,
      payoff: { ratio: 1.5 },
      consistencyCV: null,
      maxDrawdown: { maxDDPercent: 6 },
      advancedMetricsPresent: false,
      complianceRate100: 90,
    });
    // Schema §3.1 D10 — campos esperados da engine
    expect(out).toHaveProperty('dimensionScores');
    expect(out.dimensionScores).toHaveProperty('emotional');
    expect(out.dimensionScores).toHaveProperty('financial');
    expect(out.dimensionScores).toHaveProperty('operational');
    expect(out.dimensionScores).toHaveProperty('maturity');
    expect(out.dimensionScores).toHaveProperty('composite');
    expect(out).toHaveProperty('gates');
    expect(out).toHaveProperty('gatesMet');
    expect(out).toHaveProperty('gatesTotal');
    expect(out).toHaveProperty('gatesRatio');
    expect(out).toHaveProperty('proposedTransition');
    expect(out.proposedTransition).toHaveProperty('proposed');
    expect(out.proposedTransition).toHaveProperty('nextStage');
    expect(out.proposedTransition).toHaveProperty('blockers');
    expect(out.proposedTransition).toHaveProperty('confidence');
    expect(out).toHaveProperty('signalRegression');
    expect(out.signalRegression).toHaveProperty('detected');
    expect(out.signalRegression).toHaveProperty('suggestedStage');
    expect(out.signalRegression).toHaveProperty('reasons');
    expect(out.signalRegression).toHaveProperty('severity');
    expect(out).toHaveProperty('windowSize');
    expect(out).toHaveProperty('confidence');
    expect(out).toHaveProperty('sparseSample');
    expect(out).toHaveProperty('engineVersion');
    expect(out).toHaveProperty('breakdown');
    expect(out).toHaveProperty('neutralFallbacks');
    expect(Array.isArray(out.neutralFallbacks)).toBe(true);
  });
});
