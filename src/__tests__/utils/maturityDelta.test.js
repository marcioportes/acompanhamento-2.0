/**
 * maturityDelta.test.js
 * @description Testes da util pure `computeMaturityDelta`
 *              (issue #119 task 16 / Fase E2).
 * @see src/utils/maturityDelta.js
 */

import { describe, it, expect } from 'vitest';
import { computeMaturityDelta } from '../../utils/maturityDelta';

const makeSnapshot = (overrides = {}) => ({
  currentStage: 2,
  dimensionScores: {
    emotional: 50,
    financial: 60,
    operational: 55,
    maturity: 40,
    composite: 52,
  },
  gates: [],
  ...overrides,
});

describe('computeMaturityDelta', () => {
  it('retorna shape default com hasData=false quando current é null', () => {
    const result = computeMaturityDelta(null, null);
    expect(result.hasData).toBe(false);
    expect(result.stageChange).toBeNull();
    expect(result.currentStage).toBeNull();
    expect(result.previousStage).toBeNull();
    expect(result.gateDeltas).toEqual([]);
    expect(result.scoreDeltas).toEqual({
      emotional: null, financial: null, operational: null, maturity: null, composite: null,
    });
  });

  it('retorna hasData=false quando current é null mas previous existe (sem comparativo possível)', () => {
    const prev = makeSnapshot({ currentStage: 1 });
    const result = computeMaturityDelta(null, prev);
    expect(result.hasData).toBe(false);
  });

  it('retorna hasData=true com previous=null (primeira review CLOSED)', () => {
    const curr = makeSnapshot({ currentStage: 2 });
    const result = computeMaturityDelta(curr, null);
    expect(result.hasData).toBe(true);
    expect(result.stageChange).toBeNull();
    expect(result.currentStage).toBe(2);
    expect(result.previousStage).toBeNull();
    // Todos os scoreDeltas null porque não há previous para comparar.
    expect(result.scoreDeltas.emotional).toBeNull();
    expect(result.scoreDeltas.composite).toBeNull();
  });

  it('calcula scoreDeltas por dimensão quando ambos presentes', () => {
    const curr = makeSnapshot({
      dimensionScores: { emotional: 70, financial: 65, operational: 60, maturity: 55, composite: 62 },
    });
    const prev = makeSnapshot({
      dimensionScores: { emotional: 50, financial: 60, operational: 55, maturity: 40, composite: 52 },
    });
    const result = computeMaturityDelta(curr, prev);
    expect(result.scoreDeltas.emotional).toBe(20);
    expect(result.scoreDeltas.financial).toBe(5);
    expect(result.scoreDeltas.operational).toBe(5);
    expect(result.scoreDeltas.maturity).toBe(15);
    expect(result.scoreDeltas.composite).toBe(10);
  });

  it('stageChange=UP quando currentStage > previousStage', () => {
    const curr = makeSnapshot({ currentStage: 3 });
    const prev = makeSnapshot({ currentStage: 2 });
    const result = computeMaturityDelta(curr, prev);
    expect(result.stageChange).toBe('UP');
  });

  it('stageChange=DOWN quando currentStage < previousStage', () => {
    const curr = makeSnapshot({ currentStage: 2 });
    const prev = makeSnapshot({ currentStage: 3 });
    const result = computeMaturityDelta(curr, prev);
    expect(result.stageChange).toBe('DOWN');
  });

  it('stageChange=SAME quando iguais', () => {
    const curr = makeSnapshot({ currentStage: 2 });
    const prev = makeSnapshot({ currentStage: 2 });
    const result = computeMaturityDelta(curr, prev);
    expect(result.stageChange).toBe('SAME');
  });

  it('gate met→met → STAGNANT_MET', () => {
    const curr = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: true, value: 80 }] });
    const prev = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: true, value: 70 }] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas).toHaveLength(1);
    expect(result.gateDeltas[0].change).toBe('STAGNANT_MET');
    expect(result.gateDeltas[0].valueDelta).toBe(10);
  });

  it('gate unmet→met → GAINED', () => {
    const curr = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: true, value: 80 }] });
    const prev = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: false, value: 60 }] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas[0].change).toBe('GAINED');
    expect(result.gateDeltas[0].previousMet).toBe(false);
    expect(result.gateDeltas[0].currentMet).toBe(true);
  });

  it('gate met→unmet → LOST', () => {
    const curr = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: false, value: 40 }] });
    const prev = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: true, value: 80 }] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas[0].change).toBe('LOST');
    expect(result.gateDeltas[0].valueDelta).toBe(-40);
  });

  it('gate unmet→unmet → STAGNANT_UNMET', () => {
    const curr = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: false, value: 50 }] });
    const prev = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: false, value: 45 }] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas[0].change).toBe('STAGNANT_UNMET');
  });

  it('gate presente em previous e ausente em current → REMOVED (troca de stage)', () => {
    const curr = makeSnapshot({ gates: [] });
    const prev = makeSnapshot({ gates: [{ id: 'old-gate', label: 'Old gate', met: true, value: 90 }] });
    const result = computeMaturityDelta(curr, prev);
    const removed = result.gateDeltas.find((g) => g.id === 'old-gate');
    expect(removed).toBeDefined();
    expect(removed.change).toBe('REMOVED');
    expect(removed.currentMet).toBeNull();
    expect(removed.previousValue).toBe(90);
  });

  it('gate presente em current e ausente em previous → NEW', () => {
    const curr = makeSnapshot({ gates: [{ id: 'new-gate', label: 'New gate', met: false, value: 10 }] });
    const prev = makeSnapshot({ gates: [] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas[0].change).toBe('NEW');
    expect(result.gateDeltas[0].previousMet).toBeNull();
  });

  it('gate sem value numérico → valueDelta null', () => {
    const curr = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: true, value: true }] });
    const prev = makeSnapshot({ gates: [{ id: 'g1', label: 'Gate 1', met: false, value: false }] });
    const result = computeMaturityDelta(curr, prev);
    expect(result.gateDeltas[0].valueDelta).toBeNull();
    expect(result.gateDeltas[0].change).toBe('GAINED');
  });

  it('cenário completo: stage UP + gates GAINED + LOST + REMOVED + NEW', () => {
    const prev = makeSnapshot({
      currentStage: 2,
      dimensionScores: { emotional: 50, financial: 60, operational: 55, maturity: 40, composite: 52 },
      gates: [
        { id: 'g-kept-won', label: 'Kept won', met: true, value: 85 },
        { id: 'g-lost-now', label: 'Lost now', met: true, value: 90 },
        { id: 'g-old-stage', label: 'Belongs to old stage', met: true, value: 100 },
      ],
    });
    const curr = makeSnapshot({
      currentStage: 3,
      dimensionScores: { emotional: 70, financial: 75, operational: 65, maturity: 55, composite: 68 },
      gates: [
        { id: 'g-kept-won', label: 'Kept won', met: true, value: 85 },
        { id: 'g-lost-now', label: 'Lost now', met: false, value: 40 },
        { id: 'g-new-stage', label: 'New stage gate', met: false, value: 20 },
      ],
    });
    const result = computeMaturityDelta(curr, prev);
    expect(result.hasData).toBe(true);
    expect(result.stageChange).toBe('UP');
    expect(result.scoreDeltas.composite).toBe(16);
    const changeById = Object.fromEntries(result.gateDeltas.map((g) => [g.id, g.change]));
    expect(changeById['g-kept-won']).toBe('STAGNANT_MET');
    expect(changeById['g-lost-now']).toBe('LOST');
    expect(changeById['g-new-stage']).toBe('NEW');
    expect(changeById['g-old-stage']).toBe('REMOVED');
  });

  it('tolera gates não-array (shape corrompido)', () => {
    const curr = makeSnapshot({ gates: 'not-an-array' });
    const prev = makeSnapshot({ gates: null });
    const result = computeMaturityDelta(curr, prev);
    expect(result.hasData).toBe(true);
    expect(result.gateDeltas).toEqual([]);
  });

  it('retorna hasData=false quando current não é objeto (string)', () => {
    const result = computeMaturityDelta('invalid', null);
    expect(result.hasData).toBe(false);
  });

  it('scoreDeltas só computa para dims com número em ambos', () => {
    const curr = makeSnapshot({
      dimensionScores: { emotional: 70, financial: null, operational: 60, maturity: 55, composite: 62 },
    });
    const prev = makeSnapshot({
      dimensionScores: { emotional: 50, financial: 40, operational: undefined, maturity: 40, composite: 52 },
    });
    const result = computeMaturityDelta(curr, prev);
    expect(result.scoreDeltas.emotional).toBe(20);
    expect(result.scoreDeltas.financial).toBeNull();
    expect(result.scoreDeltas.operational).toBeNull();
    expect(result.scoreDeltas.maturity).toBe(15);
  });
});
