/**
 * orderCorrelation.test.js
 * @version 2.0.0 (v1.49.0 — issue #208 Fase 1)
 * Testes para correlação ordem↔trade. N:1: múltiplas orders por trade.
 */

import { describe, it, expect } from 'vitest';
import {
  correlateOrder,
  correlateOrders,
  correlateCancelledOrders,
  CORRELATION_WINDOW_MS,
} from '../../utils/orderCorrelation';

// ============================================
// FIXTURES
// ============================================

const makeOrder = (overrides = {}) => ({
  _rowIndex: 1,
  externalOrderId: 'ORD001',
  instrument: 'ESH6',
  side: 'BUY',
  quantity: 1,
  orderType: 'MARKET',
  status: 'FILLED',
  filledPrice: 5100.50,
  submittedAt: '2026-03-15T10:30:00Z',
  filledAt: '2026-03-15T10:30:01Z',
  isStopOrder: false,
  ...overrides,
});

const makeTrade = (overrides = {}) => ({
  id: 'trade001',
  ticker: 'ESH6',
  side: 'LONG',
  qty: 1,
  entryTime: '2026-03-15T10:30:00Z',
  exitTime: '2026-03-15T10:35:00Z',
  result: 250,
  ...overrides,
});

// ============================================
// correlateOrder — single
// ============================================
describe('correlateOrder', () => {
  it('match exato: mesmo instrumento, timestamp próximo', () => {
    const order = makeOrder();
    const trades = [makeTrade()];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBe('trade001');
    expect(result.matchType).toBe('exact');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('ghost: instrumento diferente, sem match', () => {
    const order = makeOrder({ instrument: 'NQH6' });
    const trades = [makeTrade({ ticker: 'ESH6' })];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBeNull();
    expect(result.matchType).toBe('ghost');
  });

  it('ghost: timestamp fora da janela', () => {
    const order = makeOrder({ filledAt: '2026-03-15T11:00:00Z' }); // 30 min depois
    const trades = [makeTrade()];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBeNull();
    expect(result.matchType).toBe('ghost');
  });

  it('ghost: sem trades disponíveis', () => {
    const order = makeOrder();
    const result = correlateOrder(order, []);
    expect(result.tradeId).toBeNull();
    expect(result.matchType).toBe('ghost');
  });

  it('ghost: ordem sem timestamp', () => {
    const order = makeOrder({ filledAt: null, submittedAt: null });
    const trades = [makeTrade()];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBeNull();
  });

  it('match com exitTime quando filledAt próximo do exit', () => {
    const order = makeOrder({ filledAt: '2026-03-15T10:35:00Z' }); // próximo do exitTime
    const trades = [makeTrade({ exitTime: '2026-03-15T10:35:01Z' })];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBe('trade001');
  });

  it('melhor match entre múltiplos candidatos', () => {
    const order = makeOrder({ filledAt: '2026-03-15T10:30:05Z' });
    const trades = [
      makeTrade({ id: 'close', entryTime: '2026-03-15T10:28:00Z' }), // 125s
      makeTrade({ id: 'closer', entryTime: '2026-03-15T10:30:03Z' }), // 2s
    ];
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBe('closer');
    expect(result.matchType).toBe('best');
  });

  it('match com quantity diferente reduz confidence', () => {
    const order = makeOrder({ quantity: 5 });
    const trades = [makeTrade({ qty: 1 })]; // 5x diferença
    const result = correlateOrder(order, trades);
    // Deve ainda correlacionar (mesmo instrumento, mesmo timestamp) mas confidence menor
    expect(result.tradeId).toBe('trade001');
    expect(result.confidence).toBeLessThan(1.0);
  });

  it('match com quantity dentro da tolerância 10%', () => {
    const order = makeOrder({ quantity: 11 });
    const trades = [makeTrade({ qty: 10 })]; // 10% diferença
    const result = correlateOrder(order, trades);
    expect(result.tradeId).toBe('trade001');
  });
});

// ============================================
// correlateOrders — batch
// ============================================
describe('correlateOrders', () => {
  it('batch vazio retorna stats zerados', () => {
    const result = correlateOrders([], []);
    expect(result.stats.total).toBe(0);
    expect(result.correlations).toHaveLength(0);
  });

  it('filtra apenas FILLED e PARTIALLY_FILLED', () => {
    const orders = [
      makeOrder({ status: 'FILLED' }),
      makeOrder({ status: 'CANCELLED', _rowIndex: 2, externalOrderId: 'ORD002' }),
      makeOrder({ status: 'PARTIALLY_FILLED', _rowIndex: 3, externalOrderId: 'ORD003' }),
    ];
    const trades = [makeTrade()];
    const result = correlateOrders(orders, trades);
    expect(result.stats.total).toBe(2); // FILLED + PARTIALLY_FILLED
  });

  it('stats corretos com matches e ghosts', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6' }),
      makeOrder({ instrument: 'NQH6', _rowIndex: 2, externalOrderId: 'ORD002' }), // ghost
    ];
    const trades = [makeTrade({ ticker: 'ESH6' })];
    const result = correlateOrders(orders, trades);
    expect(result.stats.matched).toBe(1);
    expect(result.stats.ghost).toBe(1);
    expect(result.stats.total).toBe(2);
  });

  it('N:1 — entry + exit casam com o mesmo trade (bracket OCO sem ghost falso)', () => {
    // Cenário real: trade LONG abre 10:30 (BUY) e fecha 10:35 (SELL). Em 1:1 exclusivo
    // o exit virava ghost. Em N:1 ambos casam com o mesmo tradeId em roles distintas.
    const orders = [
      makeOrder({
        _rowIndex: 1, externalOrderId: 'ORD001',
        side: 'BUY', filledAt: '2026-03-15T10:30:01Z',
      }),
      makeOrder({
        _rowIndex: 2, externalOrderId: 'ORD002',
        side: 'SELL', filledAt: '2026-03-15T10:35:00Z',
      }),
    ];
    const trades = [makeTrade({
      id: 'trade001', side: 'LONG',
      entryTime: '2026-03-15T10:30:00Z', exitTime: '2026-03-15T10:35:00Z',
    })];

    const result = correlateOrders(orders, trades);
    const matched = result.correlations.filter(c => c.tradeId != null);
    expect(matched).toHaveLength(2);
    expect(matched.every(c => c.tradeId === 'trade001')).toBe(true);
    expect(matched.map(c => c.role).sort()).toEqual(['entry', 'exit']);
    expect(result.stats.ghost).toBe(0);
  });

  it('coverage stats: trade com entry+exit conta como full coverage', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'E1', side: 'BUY', filledAt: '2026-03-15T10:30:01Z' }),
      makeOrder({ _rowIndex: 2, externalOrderId: 'X1', side: 'SELL', filledAt: '2026-03-15T10:35:00Z' }),
    ];
    const trades = [makeTrade({
      id: 'trade001', side: 'LONG',
      entryTime: '2026-03-15T10:30:00Z', exitTime: '2026-03-15T10:35:00Z',
    })];
    const result = correlateOrders(orders, trades);
    expect(result.stats.tradesWithFullCoverage).toBe(1);
    expect(result.stats.tradesWithPartialCoverage).toBe(0);
    expect(result.stats.tradesWithoutOrders).toBe(0);
  });

  it('coverage stats: trade só com entry conta como partial', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'E1', side: 'BUY', filledAt: '2026-03-15T10:30:01Z' }),
    ];
    const trades = [makeTrade({
      id: 'trade001', side: 'LONG',
      entryTime: '2026-03-15T10:30:00Z', exitTime: '2026-03-15T10:35:00Z',
    })];
    const result = correlateOrders(orders, trades);
    expect(result.stats.tradesWithFullCoverage).toBe(0);
    expect(result.stats.tradesWithPartialCoverage).toBe(1);
    expect(result.stats.tradesWithoutOrders).toBe(0);
  });

  it('coverage stats: trade sem orders correlacionadas conta como tradesWithoutOrders', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'E1', instrument: 'NQH6', filledAt: '2026-03-15T10:30:01Z' }),
    ];
    const trades = [makeTrade({ id: 'trade001', ticker: 'ESH6' })];
    const result = correlateOrders(orders, trades);
    expect(result.stats.tradesWithoutOrders).toBe(1);
    expect(result.stats.orphanFills).toBe(1);
  });

  it('correlation expõe snapshot do order para inspeção downstream', () => {
    const orders = [makeOrder({
      _rowIndex: 1, externalOrderId: 'E1', side: 'BUY',
      quantity: 2, filledPrice: 5100.5, filledAt: '2026-03-15T10:30:01Z',
    })];
    const trades = [makeTrade({ id: 'trade001', side: 'LONG' })];
    const result = correlateOrders(orders, trades);
    const c = result.correlations[0];
    expect(c.order).toBeDefined();
    expect(c.order.side).toBe('BUY');
    expect(c.order.qty).toBe(2);
    expect(c.order.price).toBe(5100.5);
  });

  it('correlation registra role (entry|exit) usado no match', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'E1', side: 'BUY', filledAt: '2026-03-15T10:30:01Z' }),
      makeOrder({ _rowIndex: 2, externalOrderId: 'X1', side: 'SELL', filledAt: '2026-03-15T10:35:00Z' }),
    ];
    const trades = [makeTrade({
      id: 'trade001', side: 'LONG',
      entryTime: '2026-03-15T10:30:00Z', exitTime: '2026-03-15T10:35:00Z',
    })];
    const result = correlateOrders(orders, trades);
    const byOrder = Object.fromEntries(result.correlations.map(c => [c.externalOrderId, c.role]));
    expect(byOrder.E1).toBe('entry');
    expect(byOrder.X1).toBe('exit');
  });

  it('avgConfidence calculado corretamente', () => {
    const orders = [makeOrder()];
    const trades = [makeTrade()];
    const result = correlateOrders(orders, trades);
    expect(result.stats.avgConfidence).toBeGreaterThan(0);
    expect(result.stats.avgConfidence).toBeLessThanOrEqual(1);
  });
});

// ============================================
// correlateCancelledOrders — issue #208 (cancels precisam de correlatedTradeId
// para o sensor comportamental ver STOP_TAMPERING/HESITATION/CHASE).
// ============================================

describe('correlateCancelledOrders', () => {
  const makeTrade = (over = {}) => ({
    id: 'T1', ticker: 'WINM26', side: 'LONG',
    entryTime: '2026-04-22T10:00:00Z',
    exitTime: '2026-04-22T10:30:00Z',
    ...over,
  });

  it('retorna [] para inputs vazios', () => {
    expect(correlateCancelledOrders([], [])).toEqual([]);
    expect(correlateCancelledOrders(null, null)).toEqual([]);
  });

  it('ignora ordens com status FILLED', () => {
    const orders = [{ externalOrderId: 'O1', status: 'FILLED', instrument: 'WINM26',
      submittedAt: '2026-04-22T10:00:30Z', filledAt: '2026-04-22T10:00:31Z' }];
    expect(correlateCancelledOrders(orders, [makeTrade()])).toEqual([]);
  });

  it('correlaciona cancel cuja vida útil intersecta o trade', () => {
    const orders = [{
      externalOrderId: 'NLGC439492', status: 'CANCELLED', instrument: 'WINM26',
      submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
    }];
    const result = correlateCancelledOrders(orders, [makeTrade()]);
    expect(result).toHaveLength(1);
    expect(result[0].externalOrderId).toBe('NLGC439492');
    expect(result[0].tradeId).toBe('T1');
    expect(result[0].confidence).toBe(0.7);
  });

  it('cancel sem convivência vira tentativa posterior do último trade do dia (#369)', () => {
    // Comportamento anterior: não correlacionava. A ordem montada e desmontada depois do
    // trade é a tentativa que não se converteu — sem vínculo o motor não a enxerga,
    // porque agrupa ordens por trade. Confidence menor: vizinhança é heurística mais
    // fraca que convivência temporal.
    const orders = [{
      externalOrderId: 'O1', status: 'CANCELLED', instrument: 'WINM26',
      submittedAt: '2026-04-22T11:30:00Z', cancelledAt: '2026-04-22T11:35:00Z',
    }];
    const result = correlateCancelledOrders(orders, [makeTrade()]);
    expect(result).toHaveLength(1);
    expect(result[0].tradeId).toBe('T1');
    expect(result[0].confidence).toBe(0.6);
  });

  it('cancel a mais de 2h de qualquer trade não é aderente e fica sem vínculo (#369)', () => {
    const orders = [{
      externalOrderId: 'O1', status: 'CANCELLED', instrument: 'WINM26',
      submittedAt: '2026-04-22T15:00:00Z', cancelledAt: '2026-04-22T15:05:00Z',
    }];
    expect(correlateCancelledOrders(orders, [makeTrade()])).toEqual([]);
  });

  it('cancel de outro dia não correlaciona com trade nenhum', () => {
    const orders = [{
      externalOrderId: 'O1', status: 'CANCELLED', instrument: 'WINM26',
      submittedAt: '2026-04-23T15:00:00Z', cancelledAt: '2026-04-23T15:05:00Z',
    }];
    expect(correlateCancelledOrders(orders, [makeTrade()])).toEqual([]);
  });

  it('cancel com instrument diferente não correlaciona', () => {
    const orders = [{
      externalOrderId: 'O1', status: 'CANCELLED', instrument: 'WDOM26',
      submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
    }];
    expect(correlateCancelledOrders(orders, [makeTrade()])).toEqual([]);
  });

  it('aceita REJECTED e EXPIRED como cancels', () => {
    const orders = [
      { externalOrderId: 'R1', status: 'REJECTED', instrument: 'WINM26',
        submittedAt: '2026-04-22T10:05:00Z', cancelledAt: '2026-04-22T10:05:30Z' },
      { externalOrderId: 'E1', status: 'EXPIRED', instrument: 'WINM26',
        submittedAt: '2026-04-22T10:10:00Z', cancelledAt: '2026-04-22T10:15:00Z' },
    ];
    const result = correlateCancelledOrders(orders, [makeTrade()]);
    expect(result.map(r => r.externalOrderId).sort()).toEqual(['E1', 'R1']);
  });

  it('escolhe trade com maior overlap quando houver mais de um candidato', () => {
    const t1 = makeTrade({ id: 'T1',
      entryTime: '2026-04-22T10:00:00Z', exitTime: '2026-04-22T10:10:00Z' });
    const t2 = makeTrade({ id: 'T2',
      entryTime: '2026-04-22T10:20:00Z', exitTime: '2026-04-22T10:30:00Z' });
    const orders = [{
      externalOrderId: 'O1', status: 'CANCELLED', instrument: 'WINM26',
      submittedAt: '2026-04-22T10:21:00Z', cancelledAt: '2026-04-22T10:29:00Z',
    }];
    const result = correlateCancelledOrders(orders, [t1, t2]);
    expect(result[0].tradeId).toBe('T2');
  });
});

// ============================================
// Issue #296 — correlação wall-clock (offset-neutra)
// Regressão: ordem com horário NAIVE (CSV da corretora) deve casar com trade
// gravado em fuso explícito (ET/BRT) — mesma hora-de-parede, mesma corretora.
// Antes do fix, trade em ET ficava 1h fora da janela de 5min → ghost → "nova".
// ============================================
describe('correlateOrder — wall-clock tz-neutro (#296)', () => {
  const naiveOrder = () => makeOrder({
    instrument: 'MNQM6', side: 'BUY', quantity: 1,
    submittedAt: '2026-05-01T11:30:49',
    filledAt: '2026-05-01T11:30:49',
  });
  const tradeWithTz = (off) => makeTrade({
    id: 'tradeMNQ', ticker: 'MNQM6', side: 'LONG', qty: 1,
    entryTime: `2026-05-01T11:30:49${off}`,
    exitTime: `2026-05-01T11:37:05${off}`,
  });

  it.each([
    ['naive', ''],
    ['BRT -03:00', '-03:00'],
    ['ET -04:00', '-04:00'],
    ['CT -05:00', '-05:00'],
  ])('casa ordem naive com trade gravado em %s', (_label, off) => {
    const result = correlateOrder(naiveOrder(), [tradeWithTz(off)]);
    expect(result.tradeId).toBe('tradeMNQ');
    expect(result.matchType).not.toBe('ghost');
  });

  it('correlateOrders: lote inteiro casa com trades em ET (sem órfãs)', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'O1', instrument: 'MNQM6', side: 'SELL',
        submittedAt: '2026-05-01T11:30:49', filledAt: '2026-05-01T11:30:49' }),
      makeOrder({ _rowIndex: 2, externalOrderId: 'O2', instrument: 'MNQM6', side: 'BUY',
        submittedAt: '2026-05-01T11:37:05', filledAt: '2026-05-01T11:37:05' }),
    ];
    const { correlations } = correlateOrders(orders, [tradeWithTz('-04:00')]);
    expect(correlations.filter(c => c.tradeId).length).toBe(2);
  });
});

// ============================================
// Fill no meio da operação (#351)
// ============================================
describe('correlateOrders — fill no meio da operação (#351)', () => {
  // Caso real: WINV26 18/08/2026, operação de +R$521,00.
  // Compra de 5 na abertura, compra de 3 no meio (aumento de posição),
  // saída de 8 no fechamento. O fill do meio fica a 47min46s da abertura
  // e 28min31s do fechamento — fora da janela de 5min nas DUAS pontas.
  const win = (overrides = {}) => makeOrder({ instrument: 'WINV26', ...overrides });

  const tradeWin = makeTrade({
    id: 'tradeWIN',
    ticker: 'WINV26',
    side: 'LONG',
    qty: 8,
    entryTime: '2026-08-18T13:58:31-03:00',
    exitTime: '2026-08-18T15:14:48-03:00',
  });

  const ordersWin = [
    win({ _rowIndex: 13, externalOrderId: 'B5', side: 'BUY', quantity: 5, filledQuantity: 5,
      filledPrice: 169760, submittedAt: '2026-08-18T13:58:30', filledAt: '2026-08-18T13:58:31' }),
    win({ _rowIndex: 11, externalOrderId: 'B3', side: 'BUY', quantity: 3, filledQuantity: 3,
      filledPrice: 169945, submittedAt: '2026-08-18T13:59:00', filledAt: '2026-08-18T14:46:17' }),
    win({ _rowIndex: 7, externalOrderId: 'S5', side: 'SELL', quantity: 5, filledQuantity: 5,
      filledPrice: 170155, submittedAt: '2026-08-18T13:58:31', filledAt: '2026-08-18T15:14:48' }),
    win({ _rowIndex: 9, externalOrderId: 'S3', side: 'SELL', quantity: 3, filledQuantity: 3,
      filledPrice: 170155, submittedAt: '2026-08-18T14:46:17', filledAt: '2026-08-18T15:14:48' }),
  ];

  it('aumento de posição no meio correlaciona com o trade como entry', () => {
    const { correlations } = correlateOrders(ordersWin, [tradeWin]);
    const meio = correlations.find(c => c.externalOrderId === 'B3');

    expect(meio.tradeId).toBe('tradeWIN');
    expect(meio.role).toBe('entry');
    expect(meio.matchType).toBe('exact');
    expect(meio.details).toContain('dentro da operação');
  });

  it('lote inteiro sem órfãos — orphanFills zera', () => {
    const { correlations, stats } = correlateOrders(ordersWin, [tradeWin]);

    expect(correlations.every(c => c.tradeId === 'tradeWIN')).toBe(true);
    expect(stats.ghost).toBe(0);
    expect(stats.orphanFills).toBe(0);
    expect(stats.tradesWithFullCoverage).toBe(1);
  });

  it('parcial de saída no meio de um LONG correlaciona como exit', () => {
    const parcial = win({ _rowIndex: 20, externalOrderId: 'P1', side: 'SELL', quantity: 2,
      filledQuantity: 2, submittedAt: '2026-08-18T14:30:00', filledAt: '2026-08-18T14:30:00' });

    const { correlations } = correlateOrders([parcial], [tradeWin]);

    expect(correlations[0].tradeId).toBe('tradeWIN');
    expect(correlations[0].role).toBe('exit');
  });

  it('match de ponta vence containment quando ambos se aplicam', () => {
    // Fill 60s após a abertura: está dentro do intervalo E dentro da janela da ponta.
    // Score de ponta = (1 - 60/300)*0.6 + 0.4 = 0.88 > 0.55 → ponta prevalece.
    const naPonta = win({ _rowIndex: 21, externalOrderId: 'E1', side: 'BUY', quantity: 1,
      filledQuantity: 1, submittedAt: '2026-08-18T13:59:31', filledAt: '2026-08-18T13:59:31' });

    const { correlations } = correlateOrders([naPonta], [tradeWin]);

    expect(correlations[0].role).toBe('entry');
    expect(correlations[0].details).toContain('delta: 60s');
    expect(correlations[0].confidence).toBeGreaterThan(0.55);
  });

  it('trade sem exitTime não regride — só pontas, como antes', () => {
    const aberto = makeTrade({
      id: 'tradeAberto', ticker: 'WINV26', side: 'LONG',
      entryTime: '2026-08-18T13:58:31-03:00', exitTime: null,
    });

    const { correlations } = correlateOrders(ordersWin, [aberto]);
    const meio = correlations.find(c => c.externalOrderId === 'B3');

    expect(meio.tradeId).toBeNull();
    expect(meio.matchType).toBe('ghost');
  });

  it('containment não rouba o fill do meio para trade sobreposto — pontas mandam', () => {
    // Guarda de ambiguidade: um trade manual sobreposto do mesmo instrumento não pode
    // capturar o fill do meio e promover a operação a `ambiguous` em categorizeConfirmedOps.
    // O sobreposto contém o fill mas o trade real também — desempate por score de ponta
    // não existe aqui (ambos containment), então basta que o fill não migre de trade
    // quando o trade real é o mais justo.
    const sobreposto = makeTrade({
      id: 'tradeOutro', ticker: 'WINV26', side: 'LONG', qty: 1,
      entryTime: '2026-08-18T14:40:00-03:00', exitTime: '2026-08-18T14:50:00-03:00',
    });

    const { correlations } = correlateOrders(ordersWin, [tradeWin, sobreposto]);
    const meio = correlations.find(c => c.externalOrderId === 'B3');

    // Ambos contêm o fill. O primeiro a pontuar vence (score idêntico, `>` estrito),
    // e a ordem de iteração segue o array de trades — o trade real vem primeiro.
    // O que este teste protege: o fill NÃO fica ghost e as pontas seguem no trade real.
    expect(meio.tradeId).toBe('tradeWIN');
    expect(correlations.find(c => c.externalOrderId === 'B5').tradeId).toBe('tradeWIN');
    expect(correlations.find(c => c.externalOrderId === 'S5').tradeId).toBe('tradeWIN');
  });
});
