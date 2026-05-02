/**
 * executionBehaviorEngine.breakevenHesitation.test.js
 * Issue #229 — STOP_BREAKEVEN_TOO_EARLY + STOP_HESITATION.
 */

import { describe, it, expect } from 'vitest';
import {
  detectExecutionEvents,
  EVENT_TYPES,
  EVENT_SEVERITY,
} from '../../utils/executionBehaviorEngine';

const makeTrade = (overrides = {}) => ({
  id: 'T1',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entry: 100000,
  entryTime: '2026-04-22T10:30:00Z',
  exitTime: '2026-04-22T11:00:00Z',
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  externalOrderId: 'ORD',
  instrument: 'WINM26',
  side: 'BUY',
  type: 'STOP',
  status: 'CANCELLED',
  quantity: 2,
  price: null,
  stopPrice: null,
  filledPrice: null,
  submittedAt: null,
  filledAt: null,
  cancelledAt: null,
  isStopOrder: true,
  correlatedTradeId: 'T1',
  ...overrides,
});

// ============================================
// STOP_BREAKEVEN_TOO_EARLY
// ============================================
describe('detectExecutionEvents — STOP_BREAKEVEN_TOO_EARLY (#229)', () => {
  it('LONG: dispara quando stop reissue chega em entry ±tolerance dentro de 5min', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z',
        cancelledAt: '2026-04-22T10:31:50Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const breakeven = events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY);
    expect(breakeven).toHaveLength(1);
    expect(breakeven[0].severity).toBe(EVENT_SEVERITY.HIGH);
    expect(breakeven[0].evidence.from).toBe(99500);
    expect(breakeven[0].evidence.to).toBe(100002);
    expect(breakeven[0].evidence.entry).toBe(100000);
    expect(breakeven[0].evidence.minutesSinceEntry).toBe(2);
    expect(breakeven[0].source).toBe('literature');
  });

  it('NÃO dispara quando reissue acontece após janela (>5min)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:36:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('NÃO dispara quando stop fica fora da tolerância (LONG, stop muito acima da entry)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100050,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('NÃO dispara quando há apenas 1 stop (não é reissue)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 100002,
        status: 'WORKING',
        submittedAt: '2026-04-22T10:30:30Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('NÃO dispara quando reissue é exatamente o mesmo preço (prev === curr)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 100002,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('respeita tolerance MNQ (0.25) — dentro dispara, fora não', () => {
    const tradeIn = makeTrade({ ticker: 'MNQM6', entry: 25000.00 });
    const ordersIn = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 24985.00,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 25000.25,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const eventsIn = detectExecutionEvents({ trades: [tradeIn], orders: ordersIn });
    expect(eventsIn.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(1);

    const tradeOut = makeTrade({ ticker: 'MNQM6', entry: 25000.00 });
    const ordersOut = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 24985.00,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 25000.50,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const eventsOut = detectExecutionEvents({ trades: [tradeOut], orders: ordersOut });
    expect(eventsOut.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('aplica fallback (max 0.01, 0.05% entry) quando ticker desconhecido', () => {
    const trade = makeTrade({ ticker: 'FOOBAR', entry: 100 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 95,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100.04,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(1);
  });

  it('NÃO dispara quando trade não tem entry', () => {
    const trade = makeTrade({ entry: undefined });
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });

  it('NÃO dispara quando trade não tem entryTime', () => {
    const trade = makeTrade({ entryTime: undefined });
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toHaveLength(0);
  });
});

// ============================================
// STOP_HESITATION
// ============================================
describe('detectExecutionEvents — STOP_HESITATION (#229)', () => {
  it('dispara com 3 stops mesmo preço (≥2 reissues no-op)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99500,
        submittedAt: '2026-04-22T10:35:00Z' }),
      makeOrder({ externalOrderId: 'S3', stopPrice: 99500,
        submittedAt: '2026-04-22T10:40:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const hesitation = events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION);
    expect(hesitation).toHaveLength(1);
    expect(hesitation[0].severity).toBe(EVENT_SEVERITY.LOW);
    expect(hesitation[0].evidence.noOpReissues).toBe(2);
    expect(hesitation[0].evidence.stopCount).toBe(3);
    expect(hesitation[0].source).toBe('heuristic');
  });

  it('NÃO dispara com apenas 2 stops mesmo preço (1 reissue, abaixo do threshold)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99500,
        submittedAt: '2026-04-22T10:35:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION)).toHaveLength(0);
  });

  it('NÃO dispara com 3 stops onde apenas 1 par é no-op', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99500,
        submittedAt: '2026-04-22T10:35:00Z' }),
      makeOrder({ externalOrderId: 'S3', stopPrice: 99800,
        submittedAt: '2026-04-22T10:40:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION)).toHaveLength(0);
  });

  it('considera no-op com delta dentro de tolerance do instrumento', () => {
    const trade = makeTrade();  // WIN tolerance = 5
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99503,
        submittedAt: '2026-04-22T10:35:00Z' }),
      makeOrder({ externalOrderId: 'S3', stopPrice: 99504,
        submittedAt: '2026-04-22T10:40:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION)).toHaveLength(1);
  });

  it('NÃO dispara quando deltas excedem tolerância', () => {
    const trade = makeTrade();  // WIN tolerance = 5
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99520,
        submittedAt: '2026-04-22T10:35:00Z' }),
      makeOrder({ externalOrderId: 'S3', stopPrice: 99540,
        submittedAt: '2026-04-22T10:40:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION)).toHaveLength(0);
  });

  it('detecta 4 stops idênticos (3 reissues no-op) e reporta noOpReissues correto', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 99500,
        submittedAt: '2026-04-22T10:35:00Z' }),
      makeOrder({ externalOrderId: 'S3', stopPrice: 99500,
        submittedAt: '2026-04-22T10:40:00Z' }),
      makeOrder({ externalOrderId: 'S4', stopPrice: 99500,
        submittedAt: '2026-04-22T10:45:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const hesitation = events.filter(e => e.type === EVENT_TYPES.STOP_HESITATION);
    expect(hesitation).toHaveLength(1);
    expect(hesitation[0].evidence.noOpReissues).toBe(3);
  });
});

// ============================================
// WIRING
// ============================================
describe('detectExecutionEvents — wiring #229', () => {
  it('eventos novos coexistem com STOP_TAMPERING (LONG, trail real após breakeven)', () => {
    const trade = makeTrade();
    const orders = [
      makeOrder({ externalOrderId: 'S1', stopPrice: 99500,
        submittedAt: '2026-04-22T10:30:30Z' }),
      makeOrder({ externalOrderId: 'S2', stopPrice: 100002,
        submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const types = new Set(events.map(e => e.type));
    expect(types.has(EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY)).toBe(true);
  });
});
