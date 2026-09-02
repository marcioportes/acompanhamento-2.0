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

  // #416 C1 — a TAXA é de violação que alimenta gate (`feedsGates`, via GATE_CODES), a
  // PENALIDADE por dimensão é de tudo que pesa no score (`feedsScore`). Dois planos, dois
  // flags. É o que o mapa de pesos aprovado sempre descreveu: TILT "entra na rule-violation
  // rate"; EARLY_EXIT/LATE_EXIT/HESITATION são só "penalidade E+F".
  describe('#416 C1 — taxa por feedsGates, penalidade por feedsScore', () => {
    const bothEngines = [['ESM', esm], ['CJS', cjs]];

    for (const [nome, agg] of bothEngines) {
      it(`[${nome}] só HESITATION (não-gate): taxa 0, mas penaliza E`, () => {
        const r = agg([trade('T1', [fam('HESITATION', 'MEDIUM')])]);
        expect(r.ruleViolationRate).toBe(0);
        expect(r.violationTrades).toBe(0);
        expect(r.byDimension.E).toBe(16); // penalidade intacta: feedsScore não mudou
      });

      it(`[${nome}] TILT (gate) conta na taxa`, () => {
        const r = agg([trade('T1', [fam('TILT', 'HIGH')])]);
        expect(r.ruleViolationRate).toBe(1);
        expect(r.gateCounts.tiltRevenge).toBe(1);
      });

      it(`[${nome}] TILT + EARLY_EXIT no mesmo trade conta UMA violação (taxa é por trade)`, () => {
        const r = agg([trade('T1', [fam('TILT', 'HIGH'), fam('EARLY_EXIT', 'HIGH')])]);
        expect(r.violationTrades).toBe(1);
        expect(r.ruleViolationRate).toBe(1);
        expect(r.byDimension.F).toBe(8); // EARLY_EXIT segue penalizando F (teto LOW, #101)
      });

      it(`[${nome}] UNPROTECTED_SIZE MEDIUM segue fora — guard do #394 preservado`, () => {
        const r = agg([trade('T1', [fam('UNPROTECTED_SIZE', 'MEDIUM')])]);
        expect(r.ruleViolationRate).toBe(0);
        expect(r.byDimension.O).toBe(16);
      });

      it(`[${nome}] código em mentorClearedViolations segue fora`, () => {
        const r = agg([trade('T1', [fam('TILT', 'HIGH')], ['TILT:T1'])]);
        expect(r.ruleViolationRate).toBe(0);
        expect(r.gateCounts.tiltRevenge).toBe(0);
      });
    }

    // Fixture de regressão: números conferidos contra o código anterior ao C1 — só a taxa
    // muda (0.75 → 0.25); dimensões, bônus, net e gateCounts ficam idênticos.
    const fixtureMista = [
      trade('T1', [fam('TILT', 'HIGH')]),                                          // gate
      trade('T2', [fam('EARLY_EXIT', 'HIGH'), fam('HESITATION', 'MEDIUM')]),        // só score
      trade('T3', [fam('GREED_CLUSTER', 'MEDIUM'), fam('UNPROTECTED_SIZE', 'MEDIUM')]), // score + #394
      trade('T4', [fam('CLEAN_EXECUTION', null, 'positive')]),                     // limpo
    ];

    it('penalidade/bônus/net/gateCounts não se mexem; só a taxa cai', () => {
      const r = esm(fixtureMista);
      expect(r.byDimension).toEqual({ E: 12, F: 6, O: 4 });
      expect(r.bonusByDimension).toEqual({ E: 2, F: 0, O: 0 });
      expect(r.netByDimension).toEqual({ E: -10, F: -6, O: -4 });
      expect(r.gateCounts).toEqual({ tampering: 0, chase: 0, sizing: 0, tiltRevenge: 1 });
      expect(r.ruleViolationRate).toBe(0.25); // era 0.75 antes do C1: só T1 alimenta gate
    });

    it('paridade ESM≡CJS na fixture mista (espelho não apodreceu)', () => {
      expect(cjs(fixtureMista)).toEqual(esm(fixtureMista));
      expect(cjs(fixtureMista).ruleViolationRate).toBe(esm(fixtureMista).ruleViolationRate);
    });
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
