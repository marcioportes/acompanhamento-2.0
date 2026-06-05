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
    expect(r.byDimension.E).toBe(24);
    expect(r.byDimension.F).toBe(16);
    expect(r.byDimension.O).toBe(0);
    expect(r.gateCounts.tiltRevenge).toBe(1); // LOSS_CHASING
    expect(r.ruleViolationRate).toBe(1); // 1 trade com violação / 1 com profile
  });

  it('AVERAGING_DOWN (E+F, HIGH) penaliza as duas dimensões', () => {
    const r = esm([trade('T1', [fam('AVERAGING_DOWN', 'HIGH')])]);
    expect(r.byDimension.E).toBe(24);
    expect(r.byDimension.F).toBe(24);
  });

  it('positivo (CLEAN_EXECUTION) vira bônus, não penalidade; não conta violação', () => {
    const r = esm([trade('T1', [fam('CLEAN_EXECUTION', null, 'positive')])]);
    expect(r.bonusByDimension.E).toBe(8);
    expect(r.byDimension.E).toBe(0);
    expect(r.ruleViolationRate).toBe(0);
    expect(r.netByDimension.E).toBe(8);
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

  // Trava a calibração rate-normalized (Fase D) — guarda contra drift dos números.
  describe('calibração (Fase D) — tabela de impacto do mapa de pesos', () => {
    const win = (n, fams) => Array.from({ length: n }, (_, i) => trade(`T${i}`, fams));
    it('cenários representativos batem a tabela documentada', () => {
      // Limpo: 20 Execução limpa → netE +8
      expect(esm(win(20, [fam('CLEAN_EXECUTION', null, 'positive')])).netByDimension.E).toBe(8);
      // Leve: 2/20 revenge HIGH → netE −2
      expect(esm([...win(2, [fam('LOSS_CHASING', 'HIGH')]), ...win(18, [])]).netByDimension.E).toBe(-2);
      // Moderado: 5/20 sub-sizing MED (E+F) → netE −4, netF −4
      const mod = esm([...win(5, [fam('SUB_SIZING', 'MEDIUM')]), ...win(15, [])]);
      expect(mod.netByDimension.E).toBe(-4);
      expect(mod.netByDimension.F).toBe(-4);
      // 100 trades, 5 revenge HIGH (rate 5%) → netE −1
      expect(esm([...win(5, [fam('LOSS_CHASING', 'HIGH')]), ...win(95, [])]).netByDimension.E).toBe(-1);
    });
  });
});
