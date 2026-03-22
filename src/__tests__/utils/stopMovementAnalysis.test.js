/**
 * stopMovementAnalysis.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes de análise de movimentação de stop orders.
 */

import { describe, it, expect } from 'vitest';
import { analyzeStopMovements, enrichOperationsWithStopAnalysis } from '../../utils/stopMovementAnalysis';

// ============================================
// FIXTURES
// ============================================

const makeOp = (overrides = {}) => ({
  operationId: 'OP-001',
  instrument: 'WINJ26',
  side: 'SHORT',
  entryOrders: [],
  exitOrders: [],
  stopOrders: [],
  cancelledOrders: [],
  hasStopProtection: false,
  stopExecuted: false,
  stopMovements: [],
  autoObservation: null,
  ...overrides,
});

const makeStopOrder = (overrides = {}) => ({
  externalOrderId: 'STOP-001',
  instrument: 'WINJ26',
  side: 'BUY',
  status: 'CANCELLED',
  isStopOrder: true,
  stopPrice: 178280,
  price: 178430,
  submittedAt: '2026-03-19T10:11:41',
  cancelledAt: '2026-03-19T10:14:15',
  ...overrides,
});

// ============================================
// analyzeStopMovements
// ============================================
describe('analyzeStopMovements', () => {
  it('operação sem stop orders → flag NO_STOP_ORDER', () => {
    const op = makeOp({ stopOrders: [], stopExecuted: false });
    const result = analyzeStopMovements(op);
    expect(result.flags.some(f => f.type === 'NO_STOP_ORDER')).toBe(true);
    expect(result.observation).toContain('Nenhuma ordem de stop');
  });

  it('operação com stop executado (Zeragem) sem stop order explícita → sem flag NO_STOP', () => {
    const op = makeOp({ stopOrders: [], stopExecuted: true });
    const result = analyzeStopMovements(op);
    expect(result.flags.some(f => f.type === 'NO_STOP_ORDER')).toBe(false);
  });

  it('stop cancelado sem reemissão → flag STOP_REMOVED', () => {
    const op = makeOp({
      stopOrders: [makeStopOrder()],
      hasStopProtection: true,
      stopExecuted: false,
    });
    const result = analyzeStopMovements(op);
    expect(result.flags.some(f => f.type === 'STOP_REMOVED')).toBe(true);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].type).toBe('CANCELLED');
    expect(result.movements[0].direction).toBe('REMOVED');
  });

  it('stop cancelado + saída por Zeragem → CANCELLED_BUT_STOPPED, sem STOP_REMOVED', () => {
    const op = makeOp({
      stopOrders: [makeStopOrder()],
      hasStopProtection: true,
      stopExecuted: true,
    });
    const result = analyzeStopMovements(op);
    expect(result.flags.some(f => f.type === 'STOP_REMOVED')).toBe(false);
    expect(result.movements.some(m => m.type === 'CANCELLED_BUT_STOPPED')).toBe(true);
    expect(result.observation).toContain('zeragem');
  });

  it('stop executado (FILLED) → flag STOP_EXECUTED', () => {
    const op = makeOp({
      stopOrders: [makeStopOrder({ status: 'FILLED' })],
      hasStopProtection: true,
    });
    const result = analyzeStopMovements(op);
    expect(result.flags.some(f => f.type === 'STOP_EXECUTED')).toBe(true);
  });

  it('stop WIDENED (SHORT: novo preço mais alto = mais risco)', () => {
    const op = makeOp({
      side: 'SHORT',
      stopOrders: [
        makeStopOrder({ externalOrderId: 'S1', stopPrice: 178280, submittedAt: '2026-03-19T10:11:41' }),
        makeStopOrder({ externalOrderId: 'S2', stopPrice: 178500, submittedAt: '2026-03-19T10:12:00' }),
      ],
      hasStopProtection: true,
      stopExecuted: false,
    });
    const result = analyzeStopMovements(op);
    expect(result.movements.some(m => m.direction === 'WIDENED')).toBe(true);
    expect(result.flags.some(f => f.type === 'STOP_WIDENED')).toBe(true);
  });

  it('stop TIGHTENED (SHORT: novo preço mais baixo = protegendo)', () => {
    const op = makeOp({
      side: 'SHORT',
      stopOrders: [
        makeStopOrder({ externalOrderId: 'S1', stopPrice: 178500, submittedAt: '2026-03-19T10:11:41' }),
        makeStopOrder({ externalOrderId: 'S2', stopPrice: 178200, submittedAt: '2026-03-19T10:12:00' }),
      ],
      hasStopProtection: true,
      stopExecuted: false,
    });
    const result = analyzeStopMovements(op);
    expect(result.movements.some(m => m.direction === 'TIGHTENED')).toBe(true);
    expect(result.flags.some(f => f.type === 'STOP_WIDENED')).toBe(false);
  });

  it('stop WIDENED (LONG: novo preço mais baixo = mais risco)', () => {
    const op = makeOp({
      side: 'LONG',
      stopOrders: [
        makeStopOrder({ externalOrderId: 'S1', side: 'SELL', stopPrice: 178000, submittedAt: '2026-03-19T10:11:41' }),
        makeStopOrder({ externalOrderId: 'S2', side: 'SELL', stopPrice: 177800, submittedAt: '2026-03-19T10:12:00' }),
      ],
      hasStopProtection: true,
      stopExecuted: false,
    });
    const result = analyzeStopMovements(op);
    expect(result.movements.some(m => m.direction === 'WIDENED')).toBe(true);
    expect(result.flags.some(f => f.type === 'STOP_WIDENED')).toBe(true);
  });

  it('stop TIGHTENED (LONG: novo preço mais alto = trailing stop)', () => {
    const op = makeOp({
      side: 'LONG',
      stopOrders: [
        makeStopOrder({ externalOrderId: 'S1', side: 'SELL', stopPrice: 177800, submittedAt: '2026-03-19T10:11:41' }),
        makeStopOrder({ externalOrderId: 'S2', side: 'SELL', stopPrice: 178000, submittedAt: '2026-03-19T10:12:00' }),
      ],
      hasStopProtection: true,
      stopExecuted: false,
    });
    const result = analyzeStopMovements(op);
    expect(result.movements.some(m => m.direction === 'TIGHTENED')).toBe(true);
    expect(result.flags.some(f => f.type === 'STOP_WIDENED')).toBe(false);
  });
});

// ============================================
// enrichOperationsWithStopAnalysis
// ============================================
describe('enrichOperationsWithStopAnalysis', () => {
  it('enriquece operações in-place com stopMovements e flags', () => {
    const ops = [
      makeOp({ stopOrders: [makeStopOrder()], hasStopProtection: true }),
      makeOp({ operationId: 'OP-002' }),
    ];
    enrichOperationsWithStopAnalysis(ops);
    expect(ops[0].stopMovements.length).toBeGreaterThan(0);
    expect(ops[1].stopFlags.some(f => f.type === 'NO_STOP_ORDER')).toBe(true);
  });
});
