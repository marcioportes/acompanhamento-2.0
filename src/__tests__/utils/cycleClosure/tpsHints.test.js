/**
 * tpsHints.test.js — issue #416 (A3)
 *
 * Cada hint dos cards de composição do TPS dispara por PREDICADO SOBRE O DADO,
 * nunca por faixa de pontos. Fator com nota baixa e predicado falso fica sem hint.
 */
import { describe, it, expect } from 'vitest';
import { buildTpsHints, TPS_HINT_TEXTS } from '../../../utils/cycleClosure/tpsHints';

const KEYS = ['pf', 'dd', 'exp', 'consistency', 'rule'];

describe('buildTpsHints — contrato', () => {
  it('retorna as 5 chaves, todas null quando não há dado nenhum', () => {
    const hints = buildTpsHints({});
    expect(Object.keys(hints).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(hints[k]).toBeNull();
  });

  it('tolera input ausente', () => {
    expect(buildTpsHints()).toEqual({ pf: null, dd: null, exp: null, consistency: null, rule: null });
    expect(buildTpsHints(null).pf).toBeNull();
  });
});

describe('buildTpsHints — pf (payoff realizado)', () => {
  // Ciclo real de agosto: PF 1,18, ganho médio 1,10R, perda média 0,93R → payoff 1,18.
  // O card afirmava "ganhos médios menores que perdas" — o oposto da tela anterior.
  it('não gera hint quando o payoff realizado é >= 1 (ciclo de agosto)', () => {
    expect(buildTpsHints({ avgWinR: 1.10, avgLossR: -0.93 }).pf).toBeNull();
  });

  it('gera hint quando o payoff realizado é < 1', () => {
    expect(buildTpsHints({ avgWinR: 0.8, avgLossR: -1.0 }).pf).toBe(TPS_HINT_TEXTS.pf);
  });

  it('payoff exatamente 1 não é defeito', () => {
    expect(buildTpsHints({ avgWinR: 1.0, avgLossR: -1.0 }).pf).toBeNull();
  });

  it('ciclo sem perdedor (avgLossR = 0) não gera hint de payoff', () => {
    expect(buildTpsHints({ avgWinR: 2.0, avgLossR: 0 }).pf).toBeNull();
  });

  it('todos perdedores (avgWinR = 0) gera hint', () => {
    expect(buildTpsHints({ avgWinR: 0, avgLossR: -1.2 }).pf).toBe(TPS_HINT_TEXTS.pf);
  });

  it('entrada ausente/não-finita não gera hint', () => {
    expect(buildTpsHints({ avgWinR: null, avgLossR: -1.0 }).pf).toBeNull();
    expect(buildTpsHints({ avgWinR: 1.0, avgLossR: null }).pf).toBeNull();
    expect(buildTpsHints({ avgWinR: NaN, avgLossR: -1 }).pf).toBeNull();
    expect(buildTpsHints({ avgWinR: 1, avgLossR: Infinity }).pf).toBeNull();
  });
});

describe('buildTpsHints — dd (drawdown vs stop do ciclo)', () => {
  // maxDDPercent é FRAÇÃO decimal; cycleStopPercent é PERCENTUAL. Escalas diferentes.
  it('DD 3,9% com stop de 8,5% não gera hint (3,9 < 6,8)', () => {
    expect(buildTpsHints({ maxDDPercent: -0.039, cycleStopPercent: 8.5 }).dd).toBeNull();
  });

  it('DD 7,0% com stop de 8,5% gera hint (7,0 >= 6,8)', () => {
    expect(buildTpsHints({ maxDDPercent: -0.07, cycleStopPercent: 8.5 }).dd).toBe(TPS_HINT_TEXTS.dd);
  });

  it('borda exata de 80% do stop gera hint', () => {
    expect(buildTpsHints({ maxDDPercent: -0.068, cycleStopPercent: 8.5 }).dd).toBe(TPS_HINT_TEXTS.dd);
  });

  it('DD acima do stop gera hint', () => {
    expect(buildTpsHints({ maxDDPercent: -0.12, cycleStopPercent: 8.5 }).dd).toBe(TPS_HINT_TEXTS.dd);
  });

  it('sinal do drawdown é indiferente (usa módulo)', () => {
    expect(buildTpsHints({ maxDDPercent: 0.07, cycleStopPercent: 8.5 }).dd).toBe(TPS_HINT_TEXTS.dd);
  });

  it('sem stop declarado não há referência — sem hint', () => {
    expect(buildTpsHints({ maxDDPercent: -0.30, cycleStopPercent: null }).dd).toBeNull();
    expect(buildTpsHints({ maxDDPercent: -0.30, cycleStopPercent: 0 }).dd).toBeNull();
    expect(buildTpsHints({ maxDDPercent: -0.30, cycleStopPercent: -5 }).dd).toBeNull();
    expect(buildTpsHints({ maxDDPercent: -0.30, cycleStopPercent: NaN }).dd).toBeNull();
  });

  it('sem drawdown apurado não gera hint', () => {
    expect(buildTpsHints({ maxDDPercent: null, cycleStopPercent: 8.5 }).dd).toBeNull();
  });

  // O cap de normalização do TPS (MAX_ACCEPTABLE_DD = 5%) não participa do predicado.
  it('não usa o cap de 5% do TPS como referência', () => {
    expect(buildTpsHints({ maxDDPercent: -0.055, cycleStopPercent: 20 }).dd).toBeNull();
  });
});

describe('buildTpsHints — exp (expectância)', () => {
  it('expectância positiva abaixo do teto da escala não gera hint', () => {
    expect(buildTpsHints({ expectancy_R: 0.2 }).exp).toBeNull();
    expect(buildTpsHints({ expectancy_R: 0.49 }).exp).toBeNull();
  });

  it('expectância negativa gera hint', () => {
    expect(buildTpsHints({ expectancy_R: -0.1 }).exp).toBe(TPS_HINT_TEXTS.exp);
  });

  it('expectância zerada gera hint', () => {
    expect(buildTpsHints({ expectancy_R: 0 }).exp).toBe(TPS_HINT_TEXTS.exp);
  });

  it('texto do hint não é tautológico com o teto da escala', () => {
    expect(TPS_HINT_TEXTS.exp).not.toMatch(/0,5R/);
  });

  it('sem expectância apurada não gera hint', () => {
    expect(buildTpsHints({ expectancy_R: null }).exp).toBeNull();
  });
});

describe('buildTpsHints — consistency (bandas de cvTheme)', () => {
  it('CV no plano não gera hint', () => {
    expect(buildTpsHints({ cvNormalized: 1.1 }).consistency).toBeNull();
  });

  it('CV errático gera hint', () => {
    expect(buildTpsHints({ cvNormalized: 1.8 }).consistency).toBe(TPS_HINT_TEXTS.consistency);
    expect(buildTpsHints({ cvNormalized: 2.6 }).consistency).toBe(TPS_HINT_TEXTS.consistency);
  });

  it('borda 1,5 ("levemente errático") ainda não gera hint', () => {
    expect(buildTpsHints({ cvNormalized: 1.5 }).consistency).toBeNull();
    expect(buildTpsHints({ cvNormalized: 1.51 }).consistency).toBe(TPS_HINT_TEXTS.consistency);
  });

  it('banda "Suspeito" (< 0,5) é qualidade de dado, não erro do aluno', () => {
    expect(buildTpsHints({ cvNormalized: 0.4 }).consistency).toBeNull();
  });

  it('CV ausente/não-finito não gera hint', () => {
    expect(buildTpsHints({ cvNormalized: null }).consistency).toBeNull();
    expect(buildTpsHints({ cvNormalized: NaN }).consistency).toBeNull();
  });
});

describe('buildTpsHints — rule (violação declarada)', () => {
  it('zero violações declaradas não gera hint', () => {
    expect(buildTpsHints({ violationsCount: 0 }).rule).toBeNull();
  });

  it('pelo menos uma violação declarada gera hint', () => {
    expect(buildTpsHints({ violationsCount: 1 }).rule).toBe(TPS_HINT_TEXTS.rule);
    expect(buildTpsHints({ violationsCount: 9 }).rule).toBe(TPS_HINT_TEXTS.rule);
  });

  it('contagem ausente/não-finita não gera hint', () => {
    expect(buildTpsHints({ violationsCount: null }).rule).toBeNull();
    expect(buildTpsHints({ violationsCount: NaN }).rule).toBeNull();
  });
});

describe('buildTpsHints — nota baixa com predicado falso', () => {
  // Ciclo de agosto: PF 1,18 (pfNorm 0,39) e DD 3,9% (ddNorm 0,22) — os dois cards
  // ficavam abaixo de 50% dos pontos e os dois hints eram falsos.
  it('nenhum dos dois hints da regressão do #416 dispara', () => {
    const hints = buildTpsHints({
      avgWinR: 1.10, avgLossR: -0.93,
      maxDDPercent: -0.039, cycleStopPercent: 8.5,
    });
    expect(hints.pf).toBeNull();
    expect(hints.dd).toBeNull();
  });
});
