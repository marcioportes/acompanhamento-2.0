/**
 * orderCorrelation.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes para correlação ordem↔trade.
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

  it('não atribui mesmo trade a múltiplas ordens', () => {
    const orders = [
      makeOrder({ _rowIndex: 1, externalOrderId: 'ORD001', filledAt: '2026-03-15T10:30:00Z' }),
      makeOrder({ _rowIndex: 2, externalOrderId: 'ORD002', filledAt: '2026-03-15T10:30:02Z' }),
    ];
    const trades = [makeTrade({ id: 'trade001' })]; // apenas 1 trade
    const result = correlateOrders(orders, trades);

    const matched = result.correlations.filter(c => c.tradeId != null);
    const uniqueTrades = new Set(matched.map(c => c.tradeId));
    expect(uniqueTrades.size).toBe(matched.length); // cada trade atribuído uma vez
  });

  it('avgConfidence calculado corretamente', () => {
    const orders = [makeOrder()];
    const trades = [makeTrade()];
    const result = correlateOrders(orders, trades);
    expect(result.stats.avgConfidence).toBeGreaterThan(0);
    expect(result.stats.avgConfidence).toBeLessThanOrEqual(1);
  });
});
