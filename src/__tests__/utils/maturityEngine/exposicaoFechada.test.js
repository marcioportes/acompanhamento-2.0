/**
 * #394 — exposição que o aluno fechou não trava progressão.
 *
 * O #375 alargou `UNPROTECTED_SIZE`: antes só disparava com falta de cobertura em
 * quantidade (sempre grave); depois passou a disparar em qualquer intervalo nu acima de
 * 20s. MEDIUM significa que houve uma janela e o aluno RECOLOCOU proteção.
 *
 * Quem consumia o sinal não olhava severidade — então um stop colocado 30 segundos depois
 * da entrada, comportamento rotineiro de quem monta bracket na mão, travava a progressão
 * exatamente como nunca ter colocado stop. Marcio, 23/08: "ninguém tá passando... e estou
 * perdendo aluno."
 */
import { describe, it, expect } from 'vitest';
import { aggregateBehaviorWeights } from '../../../utils/maturityEngine/behaviorWeights';

const trade = (id, familias) => ({
  id, mentorClearedViolations: [],
  behaviorProfile: { families: familias },
});
const fam = (code, severity, valence = 'negative') => ({ canonicalCode: code, severity, valence });

describe('#394 — exposição fechada pelo aluno', () => {
  it('UNPROTECTED_SIZE MEDIUM não conta como violação', () => {
    const r = aggregateBehaviorWeights([trade('t1', [fam('UNPROTECTED_SIZE', 'MEDIUM')])]);
    expect(r.violationTrades).toBe(0);
    expect(r.ruleViolationRate).toBe(0);
  });

  it('UNPROTECTED_SIZE HIGH continua contando — nunca protegeu ou ficou nu até o fim', () => {
    const r = aggregateBehaviorWeights([trade('t1', [fam('UNPROTECTED_SIZE', 'HIGH')])]);
    expect(r.violationTrades).toBe(1);
    expect(r.ruleViolationRate).toBe(1);
  });

  it('outros padrões de gate seguem intocados — não é mudança de política de severidade', () => {
    for (const [code, sev] of [['SUB_SIZING', 'LOW'], ['LOSS_CHASING', 'MEDIUM'], ['TILT', 'HIGH']]) {
      const r = aggregateBehaviorWeights([trade('t1', [fam(code, sev)])]);
      expect(r.violationTrades).toBe(1);
    }
    // #416 C1 — IMPULSE_CLUSTER e EARLY_EXIT saíram da TAXA por `feedsGates: false`, não por
    // severidade: a penalidade por dimensão continua inteira. O guard do #394 segue sendo o
    // único corte por severidade.
    for (const [code, sev] of [['IMPULSE_CLUSTER', 'LOW'], ['EARLY_EXIT', 'LOW']]) {
      const r = aggregateBehaviorWeights([trade('t1', [fam(code, sev)])]);
      expect(r.violationTrades).toBe(0);
      expect(r.byDimension.E).toBeGreaterThan(0);
    }
  });

  it('trade com exposição fechada E outro padrão de gate continua sendo violação pelo outro', () => {
    // companheiro tem que alimentar gate (#416 C1); com EARLY_EXIT a taxa hoje é 0.
    const r = aggregateBehaviorWeights([
      trade('t1', [fam('UNPROTECTED_SIZE', 'MEDIUM'), fam('TILT', 'HIGH')]),
    ]);
    expect(r.violationTrades).toBe(1);
  });

  it('a taxa cai quando a exposição fechada sai da conta', () => {
    const trades = [
      trade('t1', [fam('UNPROTECTED_SIZE', 'MEDIUM')]),
      trade('t2', [fam('UNPROTECTED_SIZE', 'MEDIUM')]),
      trade('t3', [fam('TILT', 'HIGH')]),
      trade('t4', [fam('CLEAN_EXECUTION', 'NONE', 'positive')]),
    ];
    const r = aggregateBehaviorWeights(trades);
    expect(r.violationTrades).toBe(1);          // só o TILT
    expect(r.ruleViolationRate).toBe(0.25);     // 1 de 4, não 3 de 4
  });
});
