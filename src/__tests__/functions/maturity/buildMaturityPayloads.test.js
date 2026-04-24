import { describe, it, expect } from 'vitest';
import { buildMaturityPayloads } from '../../../../functions/maturity/recomputeMaturity';

const SERVER_TS = { __sentinel: 'serverTimestamp' };
const AS_OF_TS = { __sentinel: 'timestamp' };

function baseInput(overrides = {}) {
  return {
    trades: [
      { id: 't1', date: '2026-04-23', result: 100, planId: 'p1', notes: 'good entry note', stopLoss: 99 },
      { id: 't2', date: '2026-04-22', result: -50, planId: 'p1', notes: 'bad entry note', stopLoss: 99 },
      { id: 't3', date: '2026-04-21', result: 80, planId: 'p1', notes: 'another entry', stopLoss: 50 },
      { id: 't4', date: '2026-04-20', result: -30, planId: 'p1', notes: 'fourth entry', stopLoss: 60 },
      { id: 't5', date: '2026-04-19', result: 120, planId: 'p1', notes: 'fifth entry', stopLoss: 100 },
    ],
    plans: [{ id: 'p1', initialBalance: 10000 }],
    now: new Date('2026-04-23T15:00:00Z'),
    stageCurrent: 3,
    baselineStage: 2,
    baseline: { emotional: 50, financial: 50, operational: 50 },
    emotionalAnalysis: { periodScore: 60, tiltCount: 0, revengeCount: 0 },
    complianceRate: 80,
    stats: { winRate: 60, payoffRatio: 2.0, expectancy: 25, avgWin: 100, avgLoss: 50 },
    evLeakage: null,
    payoff: { ratio: 2.0 },
    consistencyCV: { cv: 1.0 },
    maxDrawdown: { maxDDPercent: 1.5 },
    advancedMetricsPresent: false,
    complianceRate100: 80,
    lastTradeId: 't1',
    serverTimestamp: SERVER_TS,
    asOfTimestamp: AS_OF_TS,
    ...overrides,
  };
}

describe('buildMaturityPayloads', () => {
  it('happy path stage 3, 50 trades, todos shapes presentes → payloads válidos', () => {
    const trades = Array.from({ length: 50 }, (_, i) => ({
      id: `t${i}`,
      date: `2026-04-${String((i % 23) + 1).padStart(2, '0')}`,
      result: i % 2 === 0 ? 100 : -50,
      planId: 'p1',
      notes: 'an entry note here',
      stopLoss: 99,
    }));
    const r = buildMaturityPayloads(baseInput({ trades, stageCurrent: 3, lastTradeId: 't0' }));

    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.currentDoc.currentStage).toBe(3);
    expect(r.currentDoc.baselineStage).toBe(2);
    expect(r.currentDoc.lastTradeId).toBe('t0');
    expect(r.currentDoc.stageHistory).toEqual([]);
    expect(r.currentDoc.aiNarrative).toBe(null);
    expect(r.currentDoc.computedAt).toBe(SERVER_TS);
    expect(r.currentDoc.asOf).toBe(AS_OF_TS);
    expect(r.currentDoc.engineVersion).toBeTruthy();
    expect(typeof r.currentDoc.dimensionScores.composite).toBe('number');
  });

  it('mastery (stage 5) → mastery flag → proposedTransition.proposed=STAY', () => {
    // Stage 5 exige scores muito altos — senão o gatilho composite < base-5 dispara regressão.
    const r = buildMaturityPayloads(baseInput({
      stageCurrent: 5,
      baseline: { emotional: 85, financial: 85, operational: 80 },
      emotionalAnalysis: { periodScore: 95, tiltCount: 0, revengeCount: 0 },
      complianceRate: 100,
      stats: { winRate: 70, payoffRatio: 3.0, expectancy: 100, avgWin: 300, avgLoss: 100 },
      payoff: { ratio: 3.0 },
      consistencyCV: { cv: 0.3 },
      maxDrawdown: { maxDDPercent: 1.0 },
    }));
    expect(r.valid).toBe(true);
    expect(r.currentDoc.signalRegression.detected).toBe(false);
    expect(r.currentDoc.proposedTransition.proposed).toBe('STAY');
    expect(r.currentDoc.proposedTransition.nextStage).toBe(5);
    expect(r.currentDoc.currentStage).toBe(5);
    // Mastery hack: gatesMet/gatesTotal forçados no computeMaturity (não no snapshot)
    // O snapshot persiste gatesMet=0, gatesTotal=0 (catalog vazio para stage 5).
    expect(r.currentDoc.gatesTotal).toBe(0);
  });

  it('regressão detectada (composite muito baixo no stage 4) → DOWN_DETECTED', () => {
    const trades = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`,
      date: `2026-04-${String((i % 23) + 1).padStart(2, '0')}`,
      result: -100,
      planId: 'p1',
      hasRedFlags: true,
      redFlags: [{ type: 'NO_STOP' }],
    }));
    const r = buildMaturityPayloads(baseInput({
      trades,
      stageCurrent: 4,
      baseline: { emotional: 80, financial: 80, operational: 80 },
      emotionalAnalysis: { periodScore: 20, tiltCount: 5, revengeCount: 5 },
      complianceRate: 10,
      stats: { winRate: 10, payoffRatio: 0.3, expectancy: -50, avgWin: 10, avgLoss: 100 },
      payoff: { ratio: 0.3 },
      consistencyCV: { cv: 2.0 },
      maxDrawdown: { maxDDPercent: 30 },
    }));

    expect(r.valid).toBe(true);
    expect(r.currentDoc.signalRegression.detected).toBe(true);
    expect(r.currentDoc.proposedTransition.proposed).toBe('DOWN_DETECTED');
    expect(r.currentDoc.currentStage).toBe(4);
  });

  it('schema inválido (composite forçado fora de [0,100]) → valid=false, errors populados', () => {
    const r = buildMaturityPayloads(baseInput());
    expect(r.valid).toBe(true);

    const broken = {
      ...r.currentDoc,
      dimensionScores: { ...r.currentDoc.dimensionScores, composite: 150 },
    };
    const { validateCurrentDoc } = require('../../../../functions/maturity/maturityDocSchema');
    const v = validateCurrentDoc(broken);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('dimensionScores.composite'))).toBe(true);
  });

  it('historyDoc.date no formato YYYY-MM-DD reflete now', () => {
    const r = buildMaturityPayloads(baseInput({ now: new Date('2026-12-01T03:00:00Z') }));
    expect(r.historyDoc.date).toBe('2026-12-01');
    expect(/^\d{4}-\d{2}-\d{2}$/.test(r.historyDoc.date)).toBe(true);
  });

  it('historyDoc.tradesInDay conta apenas trades do dia de now', () => {
    const trades = [
      { id: 't1', date: '2026-04-23', result: 10, planId: 'p1' },
      { id: 't2', date: '2026-04-23', result: 20, planId: 'p1' },
      { id: 't3', date: '2026-04-22', result: -10, planId: 'p1' },
      { id: 't4', date: '22/04/2026', result: -20, planId: 'p1' },
    ];
    const r = buildMaturityPayloads(baseInput({ trades, now: new Date('2026-04-23T12:00:00Z') }));
    expect(r.historyDoc.tradesInDay).toBe(2);
  });

  it('serverTimestamp ausente → computedAt=null não quebra (tolerado)', () => {
    const r = buildMaturityPayloads(baseInput({ serverTimestamp: undefined, asOfTimestamp: undefined }));
    expect(r.currentDoc.computedAt).toBe(null);
    expect(r.currentDoc.asOf).toBe(null);
    // currentDoc é tolerante a computedAt ausente; historyDoc não → valid=false esperado.
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('computedAt'))).toBe(true);
  });
});
