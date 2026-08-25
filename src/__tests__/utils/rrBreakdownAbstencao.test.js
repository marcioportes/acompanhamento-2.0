/**
 * #402 — o painel não pode julgar o que o motor se recusou a julgar.
 *
 * `compliance.calculateTradeCompliance` se abstém deliberadamente de avaliar R:R
 * em perda sem alvo declarado ("perder 1R é o risco planejado") e devolve
 * `rrStatus: 'CONFORME'`. `rrBreakdown` recalculava incondicionalmente e o
 * painel imprimia "−1,00x · mínimo 2,00x" em âmbar no MESMO trade. Dois
 * veredictos opostos na mesma tela.
 *
 * Caso real que originou (trade cUG60nG3TOcrC7d2Euwb, 25/08/2026): WINV26 SHORT 5,
 * entrada 174.070, stop informado 174.320 — que é o próprio preço de saída.
 */
import { describe, it, expect } from 'vitest';
import { rrBreakdown } from '../../utils/rrBreakdown';
import { calculateTradeCompliance, shouldEvaluateRR, isRRDeclared } from '../../utils/compliance';

const PLANO = { pl: 30000, riskPerOperation: 0.84, rrTarget: 2 };
const WIN = { tickSize: 5, tickValue: 1 };

/** O trade real do incidente: stop informado coincide com a saída. */
const TRADE_A = {
  side: 'SHORT',
  entry: 174070,
  exit: 174320,
  stopLoss: 174320,
  qty: 5,
  result: -250,
  tickerRule: WIN,
  currency: 'BRL',
};

describe('shouldEvaluateRR / isRRDeclared — o predicado compartilhado', () => {
  it('alvo declarado sempre avalia, ganhando ou perdendo', () => {
    expect(isRRDeclared({ takeProfit: 175000 })).toBe(true);
    expect(shouldEvaluateRR({ takeProfit: 175000, result: -250 })).toBe(true);
    expect(shouldEvaluateRR({ takeProfit: 175000, result: 500 })).toBe(true);
  });

  it('sem alvo declarado, só o ganho é avaliável', () => {
    expect(isRRDeclared({})).toBe(false);
    expect(shouldEvaluateRR({ result: 500 })).toBe(true);
    expect(shouldEvaluateRR({ result: -250 })).toBe(false);
    expect(shouldEvaluateRR({ result: 0 })).toBe(false);
    expect(shouldEvaluateRR({})).toBe(false);
  });

  it('não explode com entrada vazia', () => {
    expect(shouldEvaluateRR(null)).toBe(false);
    expect(isRRDeclared(undefined)).toBe(false);
  });
});

describe('perda com stop respeitado — o painel se cala junto com o motor', () => {
  const r = rrBreakdown(TRADE_A, PLANO);

  it('o dinheiro continua sendo dito — essa parte é medida de verdade', () => {
    expect(r.riskAmount).toBe(250);
    expect(r.riskPercent).toBeCloseTo(0.83, 2);
    expect(r.resultAmount).toBe(-250);
    expect(r.roAmount).toBe(252);
  });

  it('o veredicto contra o alvo não é emitido', () => {
    expect(r.rrEvaluable).toBe(false);
    expect(r.meetsTarget).toBeNull();
    expect(r.meetsTargetVsPlan).toBeNull();
  });

  it('e o motor concorda — nada de NAO_CONFORME', () => {
    const c = calculateTradeCompliance(TRADE_A, PLANO);
    expect(c.compliance.rrStatus).toBe('CONFORME');
    expect(c.rrRatio).toBeNull();
  });

  it('o −1,00x é sinalizado como identidade aritmética, não como medida', () => {
    // risco = |entrada − stop| = |entrada − saída| = a própria perda
    expect(r.riskIsTautological).toBe(true);
    expect(r.rrTaken).toBe(-1);
  });
});

describe('riskIsTautological', () => {
  it('é falso quando o stop está a uma distância real da saída', () => {
    const t = { ...TRADE_A, stopLoss: 174470, result: -250 };
    expect(rrBreakdown(t, PLANO).riskIsTautological).toBe(false);
  });

  it('tolera diferença de um tick — arredondamento de fill não descaracteriza', () => {
    const t = { ...TRADE_A, stopLoss: 174325 }; // 1 tick de 5 pontos
    expect(rrBreakdown(t, PLANO).riskIsTautological).toBe(true);
  });

  it('é falso quando falta stop ou saída', () => {
    expect(rrBreakdown({ ...TRADE_A, stopLoss: null }, PLANO).riskIsTautological).toBe(false);
    expect(rrBreakdown({ ...TRADE_A, exit: null }, PLANO).riskIsTautological).toBe(false);
  });
});

describe('o que continua sendo avaliado', () => {
  it('ganho sem alvo declarado segue avaliável — win que não chegou ao alvo', () => {
    const win = { side: 'LONG', entry: 171842.5, exit: 172147.5, stopLoss: 171595, qty: 10, result: 610, tickerRule: WIN };
    const r = rrBreakdown(win, PLANO);
    expect(r.rrEvaluable).toBe(true);
    expect(r.rrTaken).toBeCloseTo(1.23, 2);
    expect(r.meetsTarget).toBe(false); // 1,23x < 2x — aqui a cobrança é legítima
  });

  it('perda COM alvo declarado é avaliável — o aluno se comprometeu com o alvo', () => {
    const t = { ...TRADE_A, takeProfit: 173570 };
    const r = rrBreakdown(t, PLANO);
    expect(r.rrEvaluable).toBe(true);
    expect(r.meetsTarget).toBe(false);
  });

  it('ganho acima do alvo continua sendo reconhecido', () => {
    const win = { side: 'LONG', entry: 100, exit: 130, stopLoss: 90, qty: 1, result: 600, tickerRule: null };
    const r = rrBreakdown(win, PLANO);
    expect(r.rrEvaluable).toBe(true);
    expect(r.meetsTarget).toBe(true);
  });
});

describe('coerência painel ↔ motor — a invariante que este issue instala', () => {
  /**
   * A invariante é sobre ABSTENÇÃO, não sobre o valor do múltiplo: quando o motor
   * se recusa a julgar R:R, o painel também se recusa. Nunca âmbar no que não foi
   * julgado.
   *
   * NÃO é invariante que os dois números coincidam. Com `takeProfit` declarado o
   * motor calcula o R:R PLANEJADO (|alvo − entrada| / risco) e o painel calcula o
   * REALIZADO em dinheiro (resultado / risco). Uma perda com alvo de 2R declarado
   * dá 2,00x no motor e −1,00x no painel — os dois estão certos, medindo coisas
   * diferentes. Essa ambiguidade de vocabulário é anterior ao #402 e segue como
   * dívida (ver §Follow-up do issue).
   */
  const CASOS = [
    { nome: 'perda com stop respeitado', trade: TRADE_A },
    { nome: 'perda com stop distante', trade: { ...TRADE_A, stopLoss: 174470 } },
    { nome: 'breakeven', trade: { ...TRADE_A, exit: 174070, stopLoss: 173900, result: 0 } },
    { nome: 'sem stop', trade: { ...TRADE_A, stopLoss: null } },
    { nome: 'ganho abaixo do alvo', trade: { side: 'LONG', entry: 171842.5, exit: 172147.5, stopLoss: 171595, qty: 10, result: 610, tickerRule: WIN } },
    { nome: 'perda com alvo declarado', trade: { ...TRADE_A, takeProfit: 173570 } },
  ];

  for (const { nome, trade } of CASOS) {
    it(`${nome}: painel e motor concordam sobre SE há veredicto`, () => {
      const painel = rrBreakdown(trade, PLANO);
      expect(painel.rrEvaluable).toBe(shouldEvaluateRR(trade));
    });

    it(`${nome}: sem veredicto, nada de âmbar`, () => {
      const painel = rrBreakdown(trade, PLANO);
      if (!painel.rrEvaluable) {
        expect(painel.meetsTarget).toBeNull();
        expect(painel.meetsTargetVsPlan).toBeNull();
      }
    });
  }

  it('o caso concreto: o motor diz CONFORME e o painel não reprova', () => {
    const motor = calculateTradeCompliance(TRADE_A, PLANO);
    const painel = rrBreakdown(TRADE_A, PLANO);
    expect(motor.compliance.rrStatus).toBe('CONFORME');
    expect(painel.meetsTarget).not.toBe(false);
  });
});
