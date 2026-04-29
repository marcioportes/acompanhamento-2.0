/**
 * executionBehaviorEngine.test.js
 * @version 1.0.0 (v1.49.0 — issue #208 Fase 2)
 * Testes para detectExecutionEvents (5 detectores).
 */

import { describe, it, expect } from 'vitest';
import {
  detectExecutionEvents,
  EVENT_TYPES,
  EVENT_SEVERITY,
} from '../../utils/executionBehaviorEngine';

// ============================================
// FIXTURES
// ============================================

const makeTrade = (overrides = {}) => ({
  id: 'T1',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entryTime: '2026-04-22T10:30:00Z',
  exitTime: '2026-04-22T11:00:00Z',
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  externalOrderId: 'ORD001',
  instrument: 'WINM26',
  side: 'BUY',
  type: 'MARKET',
  status: 'FILLED',
  quantity: 2,
  price: null,
  stopPrice: null,
  filledPrice: 100000,
  submittedAt: '2026-04-22T10:30:00Z',
  filledAt: '2026-04-22T10:30:01Z',
  cancelledAt: null,
  isStopOrder: false,
  correlatedTradeId: 'T1',
  ...overrides,
});

// ============================================
// STOP_TAMPERING
// ============================================
describe('detectExecutionEvents — STOP_TAMPERING', () => {
  it('detecta stop reemitido para mais largo (LONG)', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, type: 'STOP',
        status: 'CANCELLED', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, type: 'STOP',
        status: 'FILLED', stopPrice: 99300,
        submittedAt: '2026-04-22T10:35:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const tampering = events.filter(e => e.type === EVENT_TYPES.STOP_TAMPERING);
    expect(tampering).toHaveLength(1);
    expect(tampering[0].severity).toBe(EVENT_SEVERITY.HIGH);
    expect(tampering[0].evidence.from).toBe(99500);
    expect(tampering[0].evidence.to).toBe(99300);
    expect(tampering[0].evidence.direction).toBe('WIDENED');
    expect(tampering[0].source).toBe('literature');
  });

  it('detecta stop reemitido para mais largo (SHORT — preço sobe)', () => {
    const trade = makeTrade({ side: 'SHORT' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, type: 'STOP',
        status: 'CANCELLED', stopPrice: 100500, side: 'BUY',
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, type: 'STOP',
        status: 'FILLED', stopPrice: 100800, side: 'BUY',
        submittedAt: '2026-04-22T10:35:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const tampering = events.filter(e => e.type === EVENT_TYPES.STOP_TAMPERING);
    expect(tampering).toHaveLength(1);
    expect(tampering[0].evidence.from).toBe(100500);
    expect(tampering[0].evidence.to).toBe(100800);
  });

  it('NÃO detecta tampering quando stop foi APERTADO (trailing legítimo)', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'CANCELLED',
        stopPrice: 99500, submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, status: 'FILLED',
        stopPrice: 99700, submittedAt: '2026-04-22T10:35:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_TAMPERING)).toHaveLength(0);
  });

  it('NÃO detecta tampering com stop único', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_TAMPERING)).toHaveLength(0);
  });
});

// ============================================
// STOP_PARTIAL_SIZING
// ============================================
describe('detectExecutionEvents — STOP_PARTIAL_SIZING', () => {
  it('detecta stop qty=1 com trade qty=2', () => {
    const trade = makeTrade({ qty: 2 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const partial = events.filter(e => e.type === EVENT_TYPES.STOP_PARTIAL_SIZING);
    expect(partial).toHaveLength(1);
    expect(partial[0].severity).toBe(EVENT_SEVERITY.HIGH);
    expect(partial[0].evidence.tradeQty).toBe(2);
    expect(partial[0].evidence.stopQty).toBe(1);
    expect(partial[0].evidence.ratio).toBe(0.5);
  });

  it('NÃO detecta quando stop qty == trade qty', () => {
    const trade = makeTrade({ qty: 2 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        quantity: 2, stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_PARTIAL_SIZING)).toHaveLength(0);
  });

  it('NÃO detecta quando trade não tem stops correlacionados', () => {
    const trade = makeTrade({ qty: 2 });
    const orders = [makeOrder({ externalOrderId: 'E1' })];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_PARTIAL_SIZING)).toHaveLength(0);
  });

  it('soma múltiplos stops parciais', () => {
    const trade = makeTrade({ qty: 4 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500 }),
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const partial = events.filter(e => e.type === EVENT_TYPES.STOP_PARTIAL_SIZING);
    expect(partial).toHaveLength(1);
    expect(partial[0].evidence.stopQty).toBe(2);
    expect(partial[0].evidence.ratio).toBe(0.5);
  });
});

// ============================================
// RAPID_REENTRY_POST_STOP
// ============================================
describe('detectExecutionEvents — RAPID_REENTRY_POST_STOP', () => {
  it('detecta reentrada <10min após stop, mesmo side, mesmo instrument', () => {
    const t1 = makeTrade({ id: 'T1', side: 'SHORT',
      entryTime: '2026-04-22T10:50:00Z', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT',
      entryTime: '2026-04-22T11:07:00Z', exitTime: '2026-04-22T11:15:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        correlatedTradeId: 'T1', filledAt: '2026-04-22T11:00:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    const rapid = events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP);
    expect(rapid).toHaveLength(1);
    expect(rapid[0].tradeId).toBe('T2');
    expect(rapid[0].evidence.prevTradeId).toBe('T1');
    expect(rapid[0].evidence.gapMinutes).toBe(7);
    expect(rapid[0].severity).toBe(EVENT_SEVERITY.MEDIUM);
  });

  it('NÃO detecta quando gap >= 10min', () => {
    const t1 = makeTrade({ id: 'T1', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', entryTime: '2026-04-22T11:15:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        correlatedTradeId: 'T1' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta quando trade prev não fechou por stop', () => {
    const t1 = makeTrade({ id: 'T1', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', entryTime: '2026-04-22T11:05:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'X1', isStopOrder: false, status: 'FILLED',
        correlatedTradeId: 'T1' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta side diferente', () => {
    const t1 = makeTrade({ id: 'T1', side: 'LONG', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT', entryTime: '2026-04-22T11:05:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        correlatedTradeId: 'T1' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta instrument diferente', () => {
    const t1 = makeTrade({ id: 'T1', ticker: 'WINM26', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', ticker: 'WDOM26', entryTime: '2026-04-22T11:05:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        correlatedTradeId: 'T1' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });
});

// ============================================
// HESITATION_PRE_ENTRY
// ============================================
describe('detectExecutionEvents — HESITATION_PRE_ENTRY', () => {
  it('detecta cancel mesmo side seguido de fill <30min', () => {
    const trade = makeTrade({ id: 'T2', side: 'SHORT',
      entryTime: '2026-04-22T10:55:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'SELL', status: 'CANCELLED',
        instrument: 'WINM26', correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T10:36:00Z',
        cancelledAt: '2026-04-22T10:36:30Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'SELL', status: 'FILLED',
        instrument: 'WINM26', correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T10:55:00Z',
        filledAt: '2026-04-22T10:55:01Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const hesit = events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY);
    expect(hesit).toHaveLength(1);
    expect(hesit[0].severity).toBe(EVENT_SEVERITY.LOW);
    expect(hesit[0].source).toBe('heuristic');
    expect(hesit[0].evidence.gapMinutes).toBeGreaterThan(18);
    expect(hesit[0].evidence.gapMinutes).toBeLessThan(20);
  });

  it('NÃO detecta quando gap >= 30min', () => {
    const trade = makeTrade({ id: 'T1', side: 'LONG',
      entryTime: '2026-04-22T11:30:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', status: 'CANCELLED',
        correlatedTradeId: 'T1', cancelledAt: '2026-04-22T10:50:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', status: 'FILLED',
        correlatedTradeId: 'T1', filledAt: '2026-04-22T11:30:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY)).toHaveLength(0);
  });

  it('NÃO detecta sem cancel correspondente', () => {
    const trade = makeTrade();
    const orders = [makeOrder({ externalOrderId: 'E1', status: 'FILLED' })];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY)).toHaveLength(0);
  });
});

// ============================================
// CHASE_REENTRY
// ============================================
describe('detectExecutionEvents — CHASE_REENTRY', () => {
  it('detecta BUY com preço pior após cancel', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', type: 'LIMIT',
        status: 'CANCELLED', price: 100000,
        submittedAt: '2026-04-22T10:25:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', type: 'LIMIT',
        status: 'FILLED', price: 100050, filledPrice: 100050,
        submittedAt: '2026-04-22T10:30:00Z',
        filledAt: '2026-04-22T10:30:01Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const chase = events.filter(e => e.type === EVENT_TYPES.CHASE_REENTRY);
    expect(chase).toHaveLength(1);
    expect(chase[0].evidence.prevPrice).toBe(100000);
    expect(chase[0].evidence.currPrice).toBe(100050);
    expect(chase[0].evidence.worseBy).toBe(50);
  });

  it('NÃO detecta quando preço melhorou (BUY mais barato)', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', status: 'CANCELLED',
        price: 100050, submittedAt: '2026-04-22T10:25:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', status: 'FILLED',
        price: 100000, filledPrice: 100000,
        submittedAt: '2026-04-22T10:30:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.CHASE_REENTRY)).toHaveLength(0);
  });
});

// ============================================
// FIXTURE SEM1 — INTEGRAÇÃO (3 eventos esperados)
// ============================================
describe('detectExecutionEvents — fixture SEM1 (integração)', () => {
  // Dataset real: 3 trades WINM26 em 20-22/04/2026.
  // T1 (LONG 20/04): stop qty=1 com entry qty=2 → STOP_PARTIAL_SIZING
  // T2 (SHORT 22/04): cancel 10:36 → entry 10:55 → HESITATION_PRE_ENTRY
  // T3 (SHORT 22/04): T2 stop 11:00 → T3 entry 11:07 → RAPID_REENTRY_POST_STOP
  const t1 = { id: 'T1', ticker: 'WINM26', side: 'LONG', qty: 2,
    entryTime: '2026-04-20T10:00:00Z', exitTime: '2026-04-20T10:30:00Z' };
  const t2 = { id: 'T2', ticker: 'WINM26', side: 'SHORT', qty: 1,
    entryTime: '2026-04-22T10:55:00Z', exitTime: '2026-04-22T11:00:52Z' };
  const t3 = { id: 'T3', ticker: 'WINM26', side: 'SHORT', qty: 1,
    entryTime: '2026-04-22T11:07:52Z', exitTime: '2026-04-22T11:15:00Z' };

  const orders = [
    // T1 — entry qty=2 + stop qty=1 (partial)
    { externalOrderId: 'NLGC...111', instrument: 'WINM26', side: 'BUY',
      type: 'MARKET', status: 'FILLED', quantity: 2, filledPrice: 100000,
      submittedAt: '2026-04-20T10:00:00Z', filledAt: '2026-04-20T10:00:01Z',
      isStopOrder: false, correlatedTradeId: 'T1' },
    { externalOrderId: 'NLGC...439492', instrument: 'WINM26', side: 'SELL',
      type: 'STOP', status: 'CANCELLED', quantity: 1, stopPrice: 99500,
      submittedAt: '2026-04-20T10:00:30Z', cancelledAt: '2026-04-20T10:30:00Z',
      isStopOrder: true, correlatedTradeId: 'T1' },
    // T2 — cancel 10:36 + entry 10:55 + stop hit 11:00:52.
    // Cancel sem price comparável (limit não casou → entry posterior foi MARKET)
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
    // T3 — entry 11:07:52 (7min após T2 stop)
    { externalOrderId: 'NLGC...t3entry', instrument: 'WINM26', side: 'SELL',
      type: 'MARKET', status: 'FILLED', quantity: 1, filledPrice: 99700,
      submittedAt: '2026-04-22T11:07:52Z', filledAt: '2026-04-22T11:07:53Z',
      isStopOrder: false, correlatedTradeId: 'T3' },
  ];

  it('detecta exatamente 3 eventos esperados', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const types = events.map(e => e.type).sort();
    expect(types).toEqual([
      EVENT_TYPES.HESITATION_PRE_ENTRY,
      EVENT_TYPES.RAPID_REENTRY_POST_STOP,
      EVENT_TYPES.STOP_PARTIAL_SIZING,
    ].sort());
  });

  it('STOP_PARTIAL_SIZING aponta T1 com ratio 0.5', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.STOP_PARTIAL_SIZING);
    expect(e.tradeId).toBe('T1');
    expect(e.evidence.ratio).toBe(0.5);
  });

  it('HESITATION_PRE_ENTRY aponta T2 com gap ~19min', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.HESITATION_PRE_ENTRY);
    expect(e.tradeId).toBe('T2');
    expect(e.evidence.gapMinutes).toBeGreaterThan(18);
    expect(e.evidence.gapMinutes).toBeLessThan(20);
  });

  it('RAPID_REENTRY_POST_STOP aponta T3 com gap 7min', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP);
    expect(e.tradeId).toBe('T3');
    expect(e.evidence.prevTradeId).toBe('T2');
    expect(e.evidence.gapMinutes).toBe(7);
  });
});

// ============================================
// EDGE CASES
// ============================================
describe('detectExecutionEvents — edge cases', () => {
  it('retorna [] com input vazio', () => {
    expect(detectExecutionEvents({ trades: [], orders: [] })).toEqual([]);
    expect(detectExecutionEvents({})).toEqual([]);
  });

  it('retorna [] quando orders não correlacionam com trades', () => {
    const trade = makeTrade({ id: 'T1' });
    const orders = [makeOrder({ correlatedTradeId: 'T999' })];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events).toEqual([]);
  });

  it('eventos retornam ordenados por timestamp', () => {
    const t1 = makeTrade({ id: 'T1', side: 'SHORT',
      entryTime: '2026-04-22T10:50:00Z', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT', qty: 2,
      entryTime: '2026-04-22T11:07:00Z', exitTime: '2026-04-22T11:15:00Z' });
    const orders = [
      // T1 stop hit
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'FILLED',
        correlatedTradeId: 'T1', filledAt: '2026-04-22T11:00:00Z' }),
      // T2 partial sizing
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500, correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T11:08:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      const ta = new Date(events[i - 1].timestamp).getTime();
      const tb = new Date(events[i].timestamp).getTime();
      expect(tb).toBeGreaterThanOrEqual(ta);
    }
  });
});
