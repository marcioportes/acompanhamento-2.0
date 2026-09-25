/**
 * orderProtection.test.js — issue #466 (épico #462 F3)
 *
 * Definição única de perna e proteção, stop inicial por perna e stop equivalente.
 * Regras aprovadas pelo Marcio (25/09/2026):
 *   - perna = fill de entrada (ou grupo do mesmo instante), com qtd e preço executado;
 *   - proteção da perna: mesmo ativo, lado oposto, enviada em entrada ± 60s, preço
 *     ENVIADO adverso ao EXECUTADO da perna, não cancelada antes da entrada, origem fora
 *     de Zeragem/Inversão/saída manual;
 *   - stop inicial = a proteção mais antiga pelo instante;
 *   - perna sem stop comprovado (inclusive stop de ganho) → trade sem stop;
 *   - risco = Σ |entrada − stop| × qtd × valor do ponto, gravado como STOP EQUIVALENTE.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  legsOf,
  isProtectionOfLeg,
  legRejectionOf,
  initialStopOfLeg,
  tradeStopFromLegs,
  isPositionProtection,
  LEG_STOP_REASON,
} from '../../utils/orderProtection';
import { mapOperationToTradeData } from '../../utils/orderTradeCreation';
import { calculateTradeCompliance } from '../../utils/compliance';
import { replayPair, chaveDaLinha } from '../helpers/brokerReplay';

const WIN_RULE = { tickSize: 5, tickValue: 1 }; // R$ 0,20 por ponto

const ordem = (id, side, hora, extra = {}) => ({
  externalOrderId: id,
  instrument: 'WINV26',
  side,
  quantity: 5,
  status: 'CANCELLED',
  submittedAt: `2026-09-24T${hora}`,
  origin: 'Estratégia',
  ...extra,
});

const entrada = (id, side, hora, preco, qtd = 5) => ordem(id, side, hora, {
  status: 'FILLED', filledAt: `2026-09-24T${hora}`, filledPrice: preco, limitPrice: preco,
  filledQuantity: qtd, quantity: qtd, origin: 'Gráfico',
});

const operacao = (side, entryOrders, extra = {}) => {
  const qtd = entryOrders.reduce((s, o) => s + o.filledQuantity, 0);
  const medio = entryOrders.reduce((s, o) => s + o.filledPrice * o.filledQuantity, 0) / qtd;
  return {
    instrument: 'WINV26',
    side,
    totalQty: qtd,
    avgEntryPrice: Math.round(medio * 1000) / 1000,
    avgExitPrice: 0,
    entryTime: `${entryOrders[0].filledAt}-03:00`,
    exitTime: '2026-09-24T17:40:14-03:00',
    entryOrders,
    exitOrders: [],
    stopOrders: [],
    cancelledOrders: [],
    ...extra,
  };
};

describe('#466 · 24/09/2026 — o caso do épico, pelo import de verdade', () => {
  const FIX = resolve(__dirname, '../fixtures/broker-replay');
  const r = replayPair(resolve(FIX, '2026-09-24-ordens.csv'), resolve(FIX, '2026-09-24-performance.csv'));
  const op = r.fresh.pares.find(p => chaveDaLinha(p.row) === 'WINV26@2026-09-24T15:52:21').op;

  it('duas pernas: venda 5 a 185.070 e venda 5 a 185.300, em ordem de tempo', () => {
    const legs = legsOf(op).map(l => [l.price, l.qty]);
    expect(legs).toEqual([[185070, 5], [185300, 5]]);
  });

  it('perna 1 protegida a 185.135; perna 2 só tem stop de ganho (185.280) → trade sem stop', () => {
    const t = tradeStopFromLegs(op);
    expect(t.legs[0].stop).toBe(185135);
    expect(t.legs[0].reason).toBe(LEG_STOP_REASON.COMPROVADO);
    expect(t.legs[1].stop).toBeNull();
    expect(t.legs[1].reason).toBe(LEG_STOP_REASON.STOP_DE_GANHO);
    expect(t.stopLoss).toBeNull();
    expect(mapOperationToTradeData(op, 'p').stopLoss).toBeNull();
  });

  it('o stop de 188.720, cancelado 44 min antes da entrada, não é proteção de nada', () => {
    const todas = [...op.stopOrders, ...op.exitOrders, ...op.cancelledOrders];
    const velho = todas.find(o => o.stopPrice === 188720);
    expect(velho).toBeTruthy();
    expect(op.stopOrders).not.toContain(velho);
    for (const leg of legsOf(op)) expect(isProtectionOfLeg(velho, leg, op)).toBe(false);
  });

  it('retomar o lote do staging dá o mesmo stop', () => {
    const retomada = r.resumed.pares.find(p => chaveDaLinha(p.row) === 'WINV26@2026-09-24T15:52:21').op;
    expect(tradeStopFromLegs(retomada).legs.map(l => l.stop)).toEqual([185135, null]);
    expect(mapOperationToTradeData(retomada, 'p').stopLoss).toBeNull();
  });
});

describe('#466 · stop equivalente — risco do trade = soma do risco das pernas', () => {
  // SHORT em duas pernas, as duas com bracket comprovado.
  const op = operacao('SHORT', [
    entrada('E1', 'SELL', '15:52:21', 185070),
    entrada('E2', 'SELL', '16:24:31', 185300),
  ], {
    stopOrders: [
      ordem('S1', 'BUY', '15:52:22', { limitPrice: 185135 }),                          // perna 1: +65 pts
      ordem('S2', 'BUY', '16:24:31', { stopPrice: 185400, isStopOrder: true }),        // perna 2: +100 pts
    ],
  });

  it('cada perna tem o próprio stop', () => {
    const t = tradeStopFromLegs(op, undefined, { pointValue: 0.2 });
    expect(t.legs.map(l => l.stop)).toEqual([185135, 185400]);
    // (65 × 5 + 100 × 5) × 0,20 = R$ 165,00
    expect(t.riskAmount).toBe(165);
  });

  it('o stop equivalente fica acima do médio num SHORT: 185.185 + 82,5 = 185.267,5', () => {
    expect(tradeStopFromLegs(op).stopLoss).toBe(185267.5);
  });

  it('a fórmula do compliance devolve exatamente a soma: R$ 165,00', () => {
    const trade = { ...mapOperationToTradeData(op, 'p', null, WIN_RULE), tickerRule: WIN_RULE };
    const { riskPercent } = calculateTradeCompliance(trade, { pl: 100000, riskPerOperation: 1, rrTarget: 2 });
    expect((riskPercent * 100000) / 100).toBeCloseTo(165, 6);
  });

  it('LONG: o equivalente fica abaixo do médio, e a soma também confere', () => {
    const long = operacao('LONG', [
      entrada('E1', 'BUY', '10:00:00', 190000, 2),
      entrada('E2', 'BUY', '10:05:00', 190100, 3),
    ], {
      stopOrders: [
        ordem('S1', 'SELL', '10:00:01', { stopPrice: 189900, isStopOrder: true, quantity: 2 }), // 100 × 2
        ordem('S2', 'SELL', '10:05:01', { stopPrice: 189950, isStopOrder: true, quantity: 3 }), // 150 × 3
      ],
    });
    const t = tradeStopFromLegs(long, undefined, { pointValue: 0.2 });
    expect(t.riskAmount).toBe(130); // (200 + 450) × 0,20
    const trade = { ...mapOperationToTradeData(long, 'p'), tickerRule: WIN_RULE };
    expect(parseFloat(trade.entry) - trade.stopLoss).toBeCloseTo(650 / 5, 6);
    const { riskPercent } = calculateTradeCompliance(trade, { pl: 100000, riskPerOperation: 1, rrTarget: 2 });
    expect((riskPercent * 100000) / 100).toBeCloseTo(130, 6);
  });

  it('uma perna só: o stop equivalente é o próprio stop', () => {
    const uma = operacao('SHORT', [entrada('E1', 'SELL', '15:52:21', 185070)], {
      stopOrders: [ordem('S1', 'BUY', '15:52:22', { limitPrice: 185135 })],
    });
    expect(tradeStopFromLegs(uma).stopLoss).toBe(185135);
  });
});

describe('#466 · critérios da proteção de uma perna', () => {
  const op = operacao('SHORT', [entrada('E1', 'SELL', '10:00:00', 185000)]);
  const leg = legsOf(op)[0];
  const motivo = (o) => legRejectionOf(o, leg, op);

  it('bracket nascido com a perna, adverso ao executado → proteção', () => {
    expect(isProtectionOfLeg(ordem('S', 'BUY', '10:00:01', { limitPrice: 185150 }), leg, op)).toBe(true);
  });

  it('outro ativo, mesmo lado, zeragem, inversão e saída manual não protegem', () => {
    expect(motivo(ordem('A', 'BUY', '10:00:01', { instrument: 'WINV26C190000', stopPrice: 186000 }))).toBe('OUTRO_ATIVO');
    expect(motivo(ordem('B', 'SELL', '10:00:01', { stopPrice: 186000 }))).toBe('MESMO_LADO');
    expect(motivo(ordem('C', 'BUY', '10:00:01', { origin: 'Zeragem', limitPrice: 185200 }))).toBe('ZERAGEM_OU_INVERSAO');
    expect(motivo(ordem('D', 'BUY', '10:00:01', { origin: 'Inversão', limitPrice: 185200 }))).toBe('ZERAGEM_OU_INVERSAO');
    expect(motivo(ordem('E', 'BUY', '10:00:01', { origin: 'SuperDOM', limitPrice: 185200 }))).toBe('SAIDA_MANUAL');
    // stop colocado à mão no gráfico é stop: tem gatilho.
    expect(motivo(ordem('F', 'BUY', '10:00:01', { origin: 'Gráfico', stopPrice: 185200, isStopOrder: true }))).toBeNull();
  });

  it('fora da janela de ±60s e cancelada antes da entrada não protegem', () => {
    expect(motivo(ordem('G', 'BUY', '10:01:01', { stopPrice: 185200 }))).toBe('FORA_DA_JANELA_DA_PERNA');
    expect(motivo(ordem('H', 'BUY', '09:59:30', { stopPrice: 185200, cancelledAt: '2026-09-24T09:59:50' })))
      .toBe('CANCELADA_ANTES_DA_ENTRADA');
  });

  it('o stop inicial é o mais ANTIGO, qualquer que seja a posição no array', () => {
    const tardio = ordem('S2', 'BUY', '10:00:40', { stopPrice: 185300, isStopOrder: true });
    const cedo = ordem('S1', 'BUY', '10:00:02', { stopPrice: 185100, isStopOrder: true });
    expect(initialStopOfLeg(leg, [tardio, cedo], op).stop).toBe(185100);
    expect(initialStopOfLeg(leg, [cedo, tardio], op).stop).toBe(185100);
  });

  it('stop no empate (breakeven) não é stop comprovado', () => {
    const r = initialStopOfLeg(leg, [ordem('S', 'BUY', '10:00:01', { stopPrice: 185000, isStopOrder: true })], op);
    expect(r.stop).toBeNull();
    expect(r.reason).toBe(LEG_STOP_REASON.STOP_DE_GANHO);
  });

  it('uma ordem de 5 não é o stop de duas pernas de 5 (pernas a menos de 60s)', () => {
    const duas = operacao('LONG', [
      entrada('E1', 'BUY', '12:25:53', 169955),
      entrada('E2', 'BUY', '12:26:16', 169945),
    ], { stopOrders: [ordem('S', 'SELL', '12:26:16', { stopPrice: 169645, isStopOrder: true })] });
    const t = tradeStopFromLegs(duas);
    // a ordem já protege os 5 da perna 1: para a perna 2 sobra zero — parcial.
    expect(t.legs.map(l => l.reason)).toEqual([LEG_STOP_REASON.COMPROVADO, LEG_STOP_REASON.PROTECAO_PARCIAL]);
    expect(t.stopLoss).toBeNull();
  });

  it('stop de 1 contrato numa perna de 2 → proteção parcial, sem stop comprovado', () => {
    const op2 = operacao('SHORT', [entrada('E1', 'SELL', '10:00:00', 185000, 2)]);
    const r = initialStopOfLeg(legsOf(op2)[0], [ordem('S', 'BUY', '10:00:01', { stopPrice: 185200, quantity: 1 })], op2);
    expect(r.reason).toBe(LEG_STOP_REASON.PROTECAO_PARCIAL);
  });

  it('fills no mesmo instante formam uma perna só, com preço médio', () => {
    const op3 = operacao('LONG', [
      entrada('E1', 'BUY', '10:00:00', 100, 1),
      entrada('E2', 'BUY', '10:00:00', 110, 3),
    ]);
    expect(legsOf(op3).map(l => [l.price, l.qty])).toEqual([[107.5, 4]]);
  });
});

describe('#466 · proteção da vida da posição (stopOrders, linha do tempo)', () => {
  const op = operacao('LONG', [entrada('E1', 'BUY', '10:00:00', 190000)], { exitTime: '2026-09-24T11:00:00-03:00' });

  it('reemissão depois da janela e trail do lado do ganho continuam proteção da posição', () => {
    expect(isPositionProtection(ordem('R', 'SELL', '10:20:00', { stopPrice: 189800, isStopOrder: true }), op)).toBe(true);
    expect(isPositionProtection(ordem('T', 'SELL', '10:40:00', { stopPrice: 190100, isStopOrder: true }), op)).toBe(true);
  });

  it('alvo (limite do lado do ganho) e ordem anterior à posição não são', () => {
    expect(isPositionProtection(ordem('A', 'SELL', '10:00:01', { limitPrice: 190300 }), op)).toBe(false);
    expect(isPositionProtection(ordem('V', 'SELL', '09:10:00', { stopPrice: 189000, isStopOrder: true, cancelledAt: '2026-09-24T09:30:00' }), op)).toBe(false);
  });
});
