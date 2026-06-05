/**
 * behaviorWeights — agregação de behaviorProfile.families → penalidade/bônus por dimensão
 * + ruleViolationRate (CHUNK-11 Fase 2, #305). Unit + paridade ESM≡CJS.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { aggregateBehaviorWeights as esm } from '../../../utils/maturityEngine/behaviorWeights';

const require = createRequire(import.meta.url);
const { aggregateBehaviorWeights: cjs } = require('../../../../functions/maturity/behaviorWeights.js');

// família sintética; dimensão vem da taxonomia pelo canonicalCode real
const fam = (canonicalCode, severity, valence = 'negative') => ({ canonicalCode, severity, valence });
const trade = (id, families, cleared) => ({ id, behaviorProfile: { families }, ...(cleared ? { mentorClearedViolations: cleared } : {}) });

describe('aggregateBehaviorWeights', () => {
  it('penaliza a(s) dimensão(ões) da taxonomia pela severidade', () => {
    // LOSS_CHASING: E, HIGH(15) · GREED_CLUSTER: F, MEDIUM(8)
    const r = esm([trade('T1', [fam('LOSS_CHASING', 'HIGH'), fam('GREED_CLUSTER', 'MEDIUM')])]);
    expect(r.byDimension.E).toBe(15);
    expect(r.byDimension.F).toBe(8);
    expect(r.byDimension.O).toBe(0);
    expect(r.gateCounts.tiltRevenge).toBe(1); // LOSS_CHASING
    expect(r.ruleViolationRate).toBe(1); // 1 trade com violação / 1 com profile
  });

  it('AVERAGING_DOWN (E+F, HIGH) penaliza as duas dimensões', () => {
    const r = esm([trade('T1', [fam('AVERAGING_DOWN', 'HIGH')])]);
    expect(r.byDimension.E).toBe(15);
    expect(r.byDimension.F).toBe(15);
  });

  it('positivo (CLEAN_EXECUTION) vira bônus, não penalidade; não conta violação', () => {
    const r = esm([trade('T1', [fam('CLEAN_EXECUTION', null, 'positive')])]);
    expect(r.bonusByDimension.E).toBe(3);
    expect(r.byDimension.E).toBe(0);
    expect(r.ruleViolationRate).toBe(0);
    expect(r.netByDimension.E).toBe(3);
  });

  it('cap por dimensão (penalidade não passa de 25)', () => {
    const fams = Array.from({ length: 5 }, () => fam('LOSS_CHASING', 'HIGH')); // 5×15=75 → cap 25
    const r = esm([trade('T1', fams)]);
    expect(r.byDimension.E).toBe(25);
  });

  it('clearing estendido: finding com chave canonicalCode:tradeId não penaliza', () => {
    const r = esm([trade('T1', [fam('LOSS_CHASING', 'HIGH')], ['LOSS_CHASING:T1'])]);
    expect(r.byDimension.E).toBe(0);
    expect(r.ruleViolationRate).toBe(0);
  });

  it('vida nova: trade SEM behaviorProfile é ignorado (não entra no denominador)', () => {
    const r = esm([
      trade('T1', [fam('LOSS_CHASING', 'HIGH')]),
      { id: 'T2' }, // sem profile
    ]);
    expect(r.withProfile).toBe(1);
    expect(r.ruleViolationRate).toBe(1); // 1/1, não 1/2
  });

  it('ruleViolationRate = trades-com-violação / trades-com-profile', () => {
    const r = esm([
      trade('T1', [fam('LOSS_CHASING', 'HIGH')]),       // violação
      trade('T2', [fam('CLEAN_EXECUTION', null, 'positive')]), // limpo
    ]);
    expect(r.withProfile).toBe(2);
    expect(r.violationTrades).toBe(1);
    expect(r.ruleViolationRate).toBe(0.5);
  });

  it('paridade ESM≡CJS sobre fixture mista', () => {
    const trades = [
      trade('T1', [fam('LOSS_CHASING', 'HIGH'), fam('GREED_CLUSTER', 'MEDIUM')]),
      trade('T2', [fam('AVERAGING_DOWN', 'HIGH')], ['AVERAGING_DOWN:T2']),
      trade('T3', [fam('CLEAN_EXECUTION', null, 'positive')]),
      trade('T4', [fam('DIRECTION_FLIP', 'LOW')]),
      { id: 'T5' },
    ];
    expect(cjs(trades)).toEqual(esm(trades));
  });
});
