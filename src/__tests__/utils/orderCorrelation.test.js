/**
 * orderCorrelation.test.js
 * @version 2.0.0 (v1.49.0 — issue #208 Fase 1)
 * Testes para correlação ordem↔trade. N:1: múltiplas orders por trade.
 */

import { describe, it, expect } from 'vitest';
import { correlateOrder, correlateOrders, CORRELATION_WINDOW_MS } from '../../utils/orderCorrelation';

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
