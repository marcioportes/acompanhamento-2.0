/**
 * maturityAITrigger.test.js — issue #119 task 14 (Fase D).
 *
 * Cobre `currentTrigger` e `shouldGenerateAI`:
 * cache hit, cache miss, troca de trigger, STAY sem trigger, maturity null.
 */

import { describe, it, expect } from 'vitest';
import { currentTrigger, shouldGenerateAI } from '../../utils/maturityAITrigger';

function base(overrides = {}) {
  return {
    currentStage: 2,
    baselineStage: 1,
    proposedTransition: { proposed: 'STAY', nextStage: 3, blockers: [], confidence: 'HIGH' },
    signalRegression: { detected: false, suggestedStage: null, reasons: [], severity: null },
    aiNarrative: null,
    aiPatternsDetected: null,
    aiNextStageGuidance: null,
    aiTrigger: null,
    ...overrides,
  };
}

describe('currentTrigger', () => {
  it('maturity null → retorna null', () => {
    expect(currentTrigger(null)).toBeNull();
  });

  it('STAY sem regressão → null', () => {
    expect(currentTrigger(base())).toBeNull();
  });

  it('proposedTransition.proposed=UP → "UP"', () => {
    const m = base({
      proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [], confidence: 'HIGH' },
    });
    expect(currentTrigger(m)).toBe('UP');
  });

  it('signalRegression.detected=true precedence sobre UP → "REGRESSION"', () => {
    const m = base({
      proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [], confidence: 'HIGH' },
      signalRegression: { detected: true, suggestedStage: 1, reasons: ['x'], severity: 'HIGH' },
    });
    expect(currentTrigger(m)).toBe('REGRESSION');
  });
});

describe('shouldGenerateAI', () => {
  it('maturity null → false', () => {
    expect(shouldGenerateAI(null)).toBe(false);
  });

  it('sem trigger (STAY) → false', () => {
    expect(shouldGenerateAI(base())).toBe(false);
  });

  it('trigger UP, cache vazio (aiNarrative=null, aiTrigger=null) → true', () => {
    const m = base({
      proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [], confidence: 'HIGH' },
    });
    expect(shouldGenerateAI(m)).toBe(true);
  });

  it('trigger UP, cache hit (aiNarrative presente, aiTrigger=UP) → false', () => {
    const m = base({
      proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [], confidence: 'HIGH' },
      aiNarrative: 'narrativa gerada na rodada anterior',
      aiTrigger: 'UP',
    });
    expect(shouldGenerateAI(m)).toBe(false);
  });

  it('trigger mudou UP→REGRESSION (cache era UP) → true', () => {
    const m = base({
      proposedTransition: { proposed: 'STAY', nextStage: 3, blockers: [], confidence: 'MED' },
      signalRegression: { detected: true, suggestedStage: 1, reasons: ['x'], severity: 'HIGH' },
      aiNarrative: 'narrativa antiga de UP',
      aiTrigger: 'UP',
    });
    expect(shouldGenerateAI(m)).toBe(true);
  });

  it('trigger UP, cache parcial (aiTrigger=UP sem narrativa) → true (fallback depois de erro prévio)', () => {
    const m = base({
      proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [], confidence: 'HIGH' },
      aiNarrative: null,
      aiTrigger: 'UP',
    });
    expect(shouldGenerateAI(m)).toBe(true);
  });
});
