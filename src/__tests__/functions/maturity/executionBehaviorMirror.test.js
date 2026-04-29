/**
 * Issue #208 — paridade ESM↔CommonJS do executionBehaviorEngine.
 *
 * Garante que `functions/maturity/executionBehaviorMirror` (CJS) produz output
 * deterministicamente igual ao `src/utils/executionBehaviorEngine` (ESM) para
 * as mesmas entradas — pré-requisito para usar o mirror server-side em
 * recomputeMaturity sem divergir do que o cliente vê.
 */

import { describe, it, expect } from 'vitest';
import {
  detectExecutionEvents as esmDetect,
  EVENT_TYPES as ESM_TYPES,
} from '../../../utils/executionBehaviorEngine.js';
import {
  detectExecutionEvents as cjsDetect,
  EVENT_TYPES as CJS_TYPES,
} from '../../../../functions/maturity/executionBehaviorMirror.js';

const SEM1_TRADES = [
  { id: 'T1', ticker: 'WINM26', side: 'LONG', qty: 2,
    entryTime: '2026-04-20T10:00:00Z', exitTime: '2026-04-20T10:30:00Z' },
  { id: 'T2', ticker: 'WINM26', side: 'SHORT', qty: 1,
    entryTime: '2026-04-22T10:55:00Z', exitTime: '2026-04-22T11:00:52Z' },
  { id: 'T3', ticker: 'WINM26', side: 'SHORT', qty: 1,
    entryTime: '2026-04-22T11:07:52Z', exitTime: '2026-04-22T11:15:00Z' },
];

const SEM1_ORDERS = [
  { externalOrderId: 'NLGC...111', instrument: 'WINM26', side: 'BUY',
    type: 'MARKET', status: 'FILLED', quantity: 2, filledPrice: 100000,
    submittedAt: '2026-04-20T10:00:00Z', filledAt: '2026-04-20T10:00:01Z',
    isStopOrder: false, correlatedTradeId: 'T1' },
  { externalOrderId: 'NLGC...439492', instrument: 'WINM26', side: 'SELL',
    type: 'STOP', status: 'CANCELLED', quantity: 1, stopPrice: 99500,
    submittedAt: '2026-04-20T10:00:30Z', cancelledAt: '2026-04-20T10:30:00Z',
    isStopOrder: true, correlatedTradeId: 'T1' },
  { externalOrderId: 'NLGC...297106', instrument: 'WINM26', side: 'SELL',
    type: 'LIMIT', status: 'CANCELLED', quantity: 1, price: null,
    submittedAt: '2026-04-22T10:36:00Z', cancelledAt: '2026-04-22T10:36:30Z',
    isStopOrder: false, correlatedTradeId: 'T2' },
  { externalOrderId: 'NLGC...359605', instrument: 'WINM26', side: 'SELL',
    type: 'MARKET', status: 'FILLED', quantity: 1, filledPrice: 99800,
    submittedAt: '2026-04-22T10:55:00Z', filledAt: '2026-04-22T10:55:01Z',
    isStopOrder: false, correlatedTradeId: 'T2' },
  { externalOrderId: 'NLGC...t2stop', instrument: 'WINM26', side: 'BUY',
    type: 'STOP', status: 'FILLED', quantity: 1, stopPrice: 99900,
    submittedAt: '2026-04-22T10:55:30Z', filledAt: '2026-04-22T11:00:52Z',
    isStopOrder: true, correlatedTradeId: 'T2' },
  { externalOrderId: 'NLGC...t3entry', instrument: 'WINM26', side: 'SELL',
    type: 'MARKET', status: 'FILLED', quantity: 1, filledPrice: 99700,
    submittedAt: '2026-04-22T11:07:52Z', filledAt: '2026-04-22T11:07:53Z',
    isStopOrder: false, correlatedTradeId: 'T3' },
];

const STOP_TAMPERING_TRADE = { id: 'TT', ticker: 'WINM26', side: 'LONG', qty: 1,
  entryTime: '2026-04-22T10:00:00Z', exitTime: '2026-04-22T10:30:00Z' };
const STOP_TAMPERING_ORDERS = [
  { externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
    status: 'CANCELLED', quantity: 1, stopPrice: 99500,
    submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:05:00Z',
    isStopOrder: true, correlatedTradeId: 'TT' },
  { externalOrderId: 'S2', instrument: 'WINM26', side: 'SELL', type: 'STOP',
    status: 'FILLED', quantity: 1, stopPrice: 99300,
    submittedAt: '2026-04-22T10:05:30Z', filledAt: '2026-04-22T10:30:00Z',
    isStopOrder: true, correlatedTradeId: 'TT' },
];

const CHASE_TRADE = { id: 'TC', ticker: 'WINM26', side: 'LONG', qty: 1,
  entryTime: '2026-04-22T10:30:00Z', exitTime: '2026-04-22T10:45:00Z' };
const CHASE_ORDERS = [
  { externalOrderId: 'C1', instrument: 'WINM26', side: 'BUY', type: 'LIMIT',
    status: 'CANCELLED', quantity: 1, price: 100000,
    submittedAt: '2026-04-22T10:25:00Z', cancelledAt: '2026-04-22T10:28:00Z',
    isStopOrder: false, correlatedTradeId: 'TC' },
  { externalOrderId: 'E1', instrument: 'WINM26', side: 'BUY', type: 'LIMIT',
    status: 'FILLED', quantity: 1, price: 100050, filledPrice: 100050,
    submittedAt: '2026-04-22T10:30:00Z', filledAt: '2026-04-22T10:30:01Z',
    isStopOrder: false, correlatedTradeId: 'TC' },
];

describe('executionBehaviorMirror — paridade ESM↔CommonJS', () => {
  it('EVENT_TYPES export é idêntico', () => {
    expect(CJS_TYPES).toEqual(ESM_TYPES);
  });

  it('SEM1 fixture: ESM e CJS produzem mesmos eventos', () => {
    const esm = esmDetect({ trades: SEM1_TRADES, orders: SEM1_ORDERS });
    const cjs = cjsDetect({ trades: SEM1_TRADES, orders: SEM1_ORDERS });
    expect(cjs).toEqual(esm);
    expect(cjs.length).toBe(3);
  });

  it('STOP_TAMPERING: paridade exata', () => {
    const esm = esmDetect({ trades: [STOP_TAMPERING_TRADE], orders: STOP_TAMPERING_ORDERS });
    const cjs = cjsDetect({ trades: [STOP_TAMPERING_TRADE], orders: STOP_TAMPERING_ORDERS });
    expect(cjs).toEqual(esm);
    expect(cjs[0].type).toBe('STOP_TAMPERING');
  });

  it('CHASE_REENTRY: paridade exata', () => {
    const esm = esmDetect({ trades: [CHASE_TRADE], orders: CHASE_ORDERS });
    const cjs = cjsDetect({ trades: [CHASE_TRADE], orders: CHASE_ORDERS });
    expect(cjs).toEqual(esm);
    const chase = cjs.find(e => e.type === 'CHASE_REENTRY');
    expect(chase).toBeDefined();
    expect(chase.evidence.worseBy).toBe(50);
  });

  it('input vazio: ambos retornam []', () => {
    expect(cjsDetect({ trades: [], orders: [] })).toEqual([]);
    expect(cjsDetect({})).toEqual([]);
    expect(cjsDetect()).toEqual([]);
  });

  it('config customizado: paridade preservada (rapidReentryWindowMs reduzido)', () => {
    const cfg = { rapidReentryWindowMs: 5 * 60 * 1000 }; // 5min em vez de 10
    const esm = esmDetect({ trades: SEM1_TRADES, orders: SEM1_ORDERS, config: cfg });
    const cjs = cjsDetect({ trades: SEM1_TRADES, orders: SEM1_ORDERS, config: cfg });
    expect(cjs).toEqual(esm);
    // T3 reentrou 7min após T2 stop → fora da janela de 5min, não detecta
    const rapid = cjs.filter(e => e.type === 'RAPID_REENTRY_POST_STOP');
    expect(rapid).toHaveLength(0);
  });
});
