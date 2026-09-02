/**
 * behaviorWeights (espelho CJS) — #416 C1.
 *
 * `ruleViolationRate` é a taxa de trades com violação QUE ALIMENTA GATE (`feedsGates`, via
 * GATE_CODES), não de "toda família negativa". A penalidade por dimensão continua governada
 * por `feedsScore` — uma saída precoce pesa no score e não reprova gate, exatamente como o
 * mapa de pesos aprovado (`docs/dev/behavioral-weight-map.md`) descreve os dois efeitos.
 *
 * Este arquivo guarda o lado functions: o espelho roda dentro da CF de maturidade (INV-03) e
 * a suíte do root não cobre este runner. A paridade ESM≡CJS fica em
 * src/__tests__/functions/maturity/behaviorWeights.test.js.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { aggregateBehaviorWeights } = require('../../maturity/behaviorWeights');
const { GATE_CODES } = require('../../maturity/behavioralTaxonomyMirror');

const fam = (canonicalCode, severity, valence = 'negative') => ({ canonicalCode, severity, valence });
const trade = (id, families, cleared) => ({
  id, behaviorProfile: { families }, ...(cleared ? { mentorClearedViolations: cleared } : {}),
});

describe('aggregateBehaviorWeights (CJS) — taxa por feedsGates', () => {
  it('os 5 códigos do GATE_COUNT_MAP alimentam gate — o corte não pode mutilar gateCounts', () => {
    for (const code of ['STOP_PANIC', 'CHASE_REENTRY', 'SUB_SIZING', 'TILT', 'LOSS_CHASING']) {
      expect(GATE_CODES).toContain(code);
    }
  });

  it('só HESITATION (feedsGates false): taxa 0, mas penaliza E', () => {
    const r = aggregateBehaviorWeights([trade('T1', [fam('HESITATION', 'MEDIUM')])]);
    expect(r.ruleViolationRate).toBe(0);
    expect(r.violationTrades).toBe(0);
    expect(r.byDimension.E).toBe(16);
  });

  it('TILT (feedsGates true) conta na taxa e no gateCount', () => {
    const r = aggregateBehaviorWeights([trade('T1', [fam('TILT', 'HIGH')])]);
    expect(r.ruleViolationRate).toBe(1);
    expect(r.gateCounts.tiltRevenge).toBe(1);
  });

  it('TILT + EARLY_EXIT no mesmo trade conta UMA violação (taxa é por trade)', () => {
    const r = aggregateBehaviorWeights([trade('T1', [fam('TILT', 'HIGH'), fam('EARLY_EXIT', 'HIGH')])]);
    expect(r.violationTrades).toBe(1);
    expect(r.ruleViolationRate).toBe(1);
    expect(r.byDimension.F).toBe(8); // EARLY_EXIT segue penalizando F (teto LOW, #101)
  });

  it('UNPROTECTED_SIZE MEDIUM segue fora da taxa — guard do #394 preservado', () => {
    const r = aggregateBehaviorWeights([trade('T1', [fam('UNPROTECTED_SIZE', 'MEDIUM')])]);
    expect(r.ruleViolationRate).toBe(0);
    expect(r.byDimension.O).toBe(16);
  });

  it('código em mentorClearedViolations segue fora', () => {
    const r = aggregateBehaviorWeights([trade('T1', [fam('TILT', 'HIGH')], ['TILT:T1'])]);
    expect(r.ruleViolationRate).toBe(0);
    expect(r.gateCounts.tiltRevenge).toBe(0);
  });

  it('janela mista: só o trade de gate entra na taxa; dimensões contam tudo', () => {
    const r = aggregateBehaviorWeights([
      trade('T1', [fam('TILT', 'HIGH')]),
      trade('T2', [fam('EARLY_EXIT', 'HIGH'), fam('HESITATION', 'MEDIUM')]),
      trade('T3', [fam('GREED_CLUSTER', 'MEDIUM'), fam('UNPROTECTED_SIZE', 'MEDIUM')]),
      trade('T4', [fam('CLEAN_EXECUTION', null, 'positive')]),
    ]);
    expect(r.ruleViolationRate).toBe(0.25); // era 0.75 antes do C1
    expect(r.byDimension).toEqual({ E: 12, F: 6, O: 4 });
    expect(r.bonusByDimension).toEqual({ E: 2, F: 0, O: 0 });
    expect(r.netByDimension).toEqual({ E: -10, F: -6, O: -4 });
    expect(r.gateCounts).toEqual({ tampering: 0, chase: 0, sizing: 0, tiltRevenge: 1 });
  });
});
