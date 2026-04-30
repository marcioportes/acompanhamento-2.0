/**
 * Issue #208 — preComputeShapes injeta executionEvents + tradesWithOrderData
 * para evaluateMaturity (Option C, sem persistência nova).
 */

import { describe, it, expect } from 'vitest';
import { preComputeShapes } from '../../../../functions/maturity/preComputeShapes';

const makeTrade = (id, dateOffsetDays = 0) => {
  const baseDate = Date.parse('2026-03-01T10:00:00Z');
  const ts = baseDate + dateOffsetDays * 86400000;
  return {
    id,
    ticker: 'WINM26',
    side: 'LONG',
    qty: 1,
    result: 100,
    date: new Date(ts).toISOString(),
    entryTime: new Date(ts).toISOString(),
    exitTime: new Date(ts + 30 * 60000).toISOString(),
  };
};

describe('preComputeShapes — execution events (Option C)', () => {
  it('sem orders: executionEvents=[] e tradesWithOrderData=0', () => {
    const trades = [makeTrade('T1'), makeTrade('T2', 1)];
    const out = preComputeShapes({ trades, plans: [], now: new Date('2026-04-01') });
    expect(out.executionEvents).toEqual([]);
    expect(out.tradesWithOrderData).toBe(0);
  });

  it('com orders correlacionadas: detecta eventos e conta cobertura', () => {
    const trades = [
      { id: 'T1', ticker: 'WINM26', side: 'LONG', qty: 2, date: '2026-04-22T10:00:00Z',
        entryTime: '2026-04-22T10:00:00Z', exitTime: '2026-04-22T10:30:00Z', result: 100 },
    ];
    const orders = [
      { externalOrderId: 'E1', instrument: 'WINM26', side: 'BUY', type: 'MARKET',
        status: 'FILLED', quantity: 2, filledPrice: 100000,
        submittedAt: '2026-04-22T10:00:00Z', filledAt: '2026-04-22T10:00:01Z',
        isStopOrder: false, correlatedTradeId: 'T1' },
      { externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 1, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    const out = preComputeShapes({ trades, plans: [], now: new Date('2026-04-25'), orders });
    expect(out.tradesWithOrderData).toBe(1);
    expect(out.executionEvents.length).toBe(1);
    expect(out.executionEvents[0].type).toBe('STOP_PARTIAL_SIZING');
  });

  it('orders sem correlatedTradeId NÃO contam para coverage', () => {
    const trades = [makeTrade('T1')];
    const orders = [
      { externalOrderId: 'E1', instrument: 'WINM26', side: 'BUY', status: 'FILLED',
        filledAt: '2026-03-01T10:00:00Z', isStopOrder: false /* sem correlatedTradeId */ },
    ];
    const out = preComputeShapes({ trades, plans: [], now: new Date('2026-04-01'), orders });
    expect(out.tradesWithOrderData).toBe(0);
  });
});
