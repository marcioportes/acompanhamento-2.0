/**
 * orderCrossCheck.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes para métricas de cross-check comportamental.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCrossCheckMetrics,
  calculateHoldTimeMetrics,
  detectAveragingDown,
} from '../../utils/orderCrossCheck';

// ============================================
// FIXTURES
// ============================================

const makeOrder = (overrides = {}) => ({
  instrument: 'ESH6',
  side: 'BUY',
  quantity: 1,
  orderType: 'MARKET',
  status: 'FILLED',
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
// calculateHoldTimeMetrics
// ============================================
describe('calculateHoldTimeMetrics', () => {
  it('calcula hold time correto para wins e losses', () => {
    const trades = [
      makeTrade({ entryTime: '2026-03-15T10:00:00Z', exitTime: '2026-03-15T10:03:00Z', result: 100 }), // 3 min win
      makeTrade({ entryTime: '2026-03-15T11:00:00Z', exitTime: '2026-03-15T11:02:00Z', result: 50 }),  // 2 min win
      makeTrade({ entryTime: '2026-03-15T12:00:00Z', exitTime: '2026-03-15T12:45:00Z', result: -200 }), // 45 min loss
    ];
    const result = calculateHoldTimeMetrics(trades);
    expect(result.avgHoldTimeWin).toBe(2.5); // (3+2)/2
    expect(result.avgHoldTimeLoss).toBe(45);
    expect(result.holdTimeAsymmetry).toBe(18); // 45/2.5
  });

  it('assimetria alta = red flag (caso real: 47min loss vs 3min win)', () => {
    const trades = [
      makeTrade({ entryTime: '2026-03-15T10:00:00Z', exitTime: '2026-03-15T10:03:00Z', result: 100 }),
      makeTrade({ entryTime: '2026-03-15T11:00:00Z', exitTime: '2026-03-15T11:47:00Z', result: -300 }),
    ];
    const result = calculateHoldTimeMetrics(trades);
    expect(result.holdTimeAsymmetry).toBeGreaterThan(3.0); // >3 = red flag
  });

  it('retorna zeros para trades sem timestamps', () => {
    const trades = [makeTrade({ entryTime: null, exitTime: null })];
    const result = calculateHoldTimeMetrics(trades);
    expect(result.avgHoldTimeWin).toBe(0);
    expect(result.avgHoldTimeLoss).toBe(0);
    expect(result.holdTimeAsymmetry).toBe(0);
  });

  it('retorna zeros para array vazio', () => {
    const result = calculateHoldTimeMetrics([]);
    expect(result.avgHoldTimeWin).toBe(0);
    expect(result.holdTimeAsymmetry).toBe(0);
  });

  it('ignora breakeven trades (result=0)', () => {
    const trades = [
      makeTrade({ entryTime: '2026-03-15T10:00:00Z', exitTime: '2026-03-15T10:10:00Z', result: 0 }),
      makeTrade({ entryTime: '2026-03-15T11:00:00Z', exitTime: '2026-03-15T11:05:00Z', result: 100 }),
    ];
    const result = calculateHoldTimeMetrics(trades);
    expect(result.avgHoldTimeWin).toBe(5); // apenas o win
  });
});

// ============================================
// detectAveragingDown
// ============================================
describe('detectAveragingDown', () => {
  it('detecta averaging: 3 BUY ESH6 em 10 minutos', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:03:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:08:00Z' }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBeGreaterThan(0);
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].instrument).toBe('ESH6');
    expect(result.instances[0].orderCount).toBe(3);
  });

  it('não detecta averaging: direções diferentes', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'SELL', filledAt: '2026-03-15T10:03:00Z' }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBe(0);
  });

  it('não detecta averaging: instrumentos diferentes', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'NQH6', side: 'BUY', filledAt: '2026-03-15T10:03:00Z' }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBe(0);
  });

  it('não detecta averaging: intervalo > 30min', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:45:00Z' }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBe(0);
  });

  it('ignora stop orders no cálculo', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:01:00Z', isStopOrder: true }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBe(0);
  });

  it('ignora ordens não FILLED', () => {
    const orders = [
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:00:00Z' }),
      makeOrder({ instrument: 'ESH6', side: 'BUY', filledAt: '2026-03-15T10:01:00Z', status: 'CANCELLED' }),
    ];
    const result = detectAveragingDown(orders);
    expect(result.count).toBe(0);
  });
});

// ============================================
// calculateCrossCheckMetrics
// ============================================
describe('calculateCrossCheckMetrics', () => {
  it('calcula todas as métricas com dados do caso real', () => {
    // Simular caso: 80+ ordens, zero stops
    const orders = [];
    for (let i = 0; i < 80; i++) {
      orders.push(makeOrder({
        orderType: 'MARKET',
        isStopOrder: false,
        status: 'FILLED',
      }));
    }

    const trades = [];
    for (let i = 0; i < 40; i++) {
      trades.push(makeTrade({
        id: `trade${i}`,
        entryTime: '2026-03-15T10:00:00Z',
        exitTime: '2026-03-15T10:03:00Z',
        result: i < 30 ? 100 : -200, // 75% win rate
      }));
    }

    const correlations = orders.slice(0, 40).map((_, i) => ({
      tradeId: `trade${i}`,
      matchType: 'exact',
    }));
    // 40 ghost orders
    const ghostCorrelations = orders.slice(40).map(() => ({
      tradeId: null,
      matchType: 'ghost',
    }));

    const result = calculateCrossCheckMetrics(orders, trades, [...correlations, ...ghostCorrelations]);

    expect(result.stopOrderRate).toBe(0); // zero stops
    expect(result.marketOrderPct).toBe(1); // 100% market
    expect(result.ghostOrderCount).toBe(40);
    expect(result.orderToTradeRatio).toBe(2); // 80/40
  });

  it('stopOrderRate correto com mix de ordens', () => {
    const orders = [
      makeOrder({ isStopOrder: false }),
      makeOrder({ isStopOrder: false }),
      makeOrder({ isStopOrder: true }),
    ];
    const result = calculateCrossCheckMetrics(orders, [], []);
    expect(result.stopOrderRate).toBeCloseTo(0.333, 2);
  });

  it('modifyRate correto', () => {
    const orders = [
      makeOrder({ status: 'FILLED' }),
      makeOrder({ status: 'MODIFIED' }),
      makeOrder({ status: 'FILLED' }),
    ];
    const result = calculateCrossCheckMetrics(orders, [], []);
    expect(result.modifyRate).toBeCloseTo(0.333, 2);
  });

  it('cancelRate correto', () => {
    const orders = [
      makeOrder({ status: 'FILLED' }),
      makeOrder({ status: 'CANCELLED' }),
    ];
    const result = calculateCrossCheckMetrics(orders, [], []);
    expect(result.cancelRate).toBe(0.5);
  });
});
