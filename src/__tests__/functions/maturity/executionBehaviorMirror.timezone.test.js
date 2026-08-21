/**
 * Issue #375 — paridade ESM↔CJS do fuso de ordem.
 *
 * O espelho é o que roda na Cloud Function, e a CF roda em UTC: era exatamente ali que a
 * proteção sumia. Este teste exige que os dois lados produzam o mesmo veredicto para o
 * mesmo dado, com o trade em fusos diferentes.
 */
import { describe, it, expect } from 'vitest';
import { detectExecutionEvents as esmDetect } from '../../../utils/executionBehaviorEngine.js';
import {
  detectExecutionEvents as cjsDetect,
  protectionTimeline as cjsTimeline,
  REPLACEMENT_TOLERANCE_MS as CJS_TOL,
} from '../../../../functions/maturity/executionBehaviorMirror.js';
import {
  protectionTimeline as esmTimeline,
  REPLACEMENT_TOLERANCE_MS as ESM_TOL,
} from '../../../utils/executionBehaviorEngine.js';

const OFFSETS = ['-03:00', '-05:00', '-11:00', '+09:00', 'Z'];

const cenario = (off) => {
  const trade = {
    id: 'T1', side: 'LONG', qty: 10, entry: 174030, exit: 174290, result: 520,
    ticker: 'WINV26', date: '2026-08-21',
    entryTime: `2026-08-21T11:25:15${off}`,
    exitTime: `2026-08-21T11:27:51${off}`,
  };
  const base = { correlatedTradeId: 'T1', instrument: 'WINV26' };
  const orders = [
    { ...base, externalOrderId: 'e1', side: 'BUY', orderType: 'LIMIT', isStopOrder: false,
      price: 174050, limitPrice: 174050, stopPrice: null, filledPrice: 174050,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:14', filledAt: '2026-08-21T11:25:15', cancelledAt: null },
    { ...base, externalOrderId: 'e2', side: 'BUY', orderType: 'LIMIT', isStopOrder: false,
      price: 174010, limitPrice: 174010, stopPrice: null, filledPrice: 174010,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:09', filledAt: '2026-08-21T11:25:18', cancelledAt: null },
    { ...base, externalOrderId: 'e3', side: 'SELL', orderType: 'STOP_LIMIT', isStopOrder: true,
      price: 173755, limitPrice: 173755, stopPrice: 173905, filledPrice: null,
      quantity: 5, filledQuantity: 5, status: 'CANCELLED',
      submittedAt: '2026-08-21T11:25:15', filledAt: null, cancelledAt: '2026-08-21T11:27:51' },
    { ...base, externalOrderId: 'e4', side: 'SELL', orderType: 'STOP_LIMIT', isStopOrder: true,
      price: 173755, limitPrice: 173755, stopPrice: 173905, filledPrice: null,
      quantity: 5, filledQuantity: 5, status: 'CANCELLED',
      submittedAt: '2026-08-21T11:25:18', filledAt: null, cancelledAt: '2026-08-21T11:27:51' },
    { ...base, externalOrderId: 'e5', side: 'SELL', orderType: 'LIMIT', isStopOrder: false,
      price: 174290, limitPrice: 174290, stopPrice: null, filledPrice: 174290,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:15', filledAt: '2026-08-21T11:27:51', cancelledAt: null },
    { ...base, externalOrderId: 'e6', side: 'SELL', orderType: 'LIMIT', isStopOrder: false,
      price: 174290, limitPrice: 174290, stopPrice: null, filledPrice: 174290,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:18', filledAt: '2026-08-21T11:27:51', cancelledAt: null },
  ];
  return { trade, orders };
};

const tipos = (res) => (Array.isArray(res) ? res : (res.events || []))
  .map((e) => `${e.type}:${e.severity}`).sort();

describe('#375 — espelho CJS concorda com o motor ESM sobre o fuso da ordem', () => {
  it.each(OFFSETS)('mesmo veredicto nos dois lados com trade em %s', (off) => {
    const { trade, orders } = cenario(off);
    const esm = tipos(esmDetect({ trades: [trade], orders }));
    const cjs = tipos(cjsDetect({ trades: [trade], orders }));
    expect(cjs).toEqual(esm);
    expect(esm.filter((t) => t.startsWith('UNPROTECTED_SIZE'))).toHaveLength(0);
  });
});

describe('#375 — paridade da linha do tempo de proteção', () => {
  it('tolerância de substituição é a mesma nos dois lados', () => {
    expect(CJS_TOL).toBe(ESM_TOL);
  });

  it.each(OFFSETS)('janelas e emoção idênticas com trade em %s', (off) => {
    const { trade, orders } = cenario(off);
    // Retira a proteção no meio e não recoloca: janela nua de verdade nos dois motores.
    const semSegunda = orders.map((o) => (o.externalOrderId === 'e3'
      ? { ...o, cancelledAt: '2026-08-21T11:26:00' }
      : o)).filter((o) => o.externalOrderId !== 'e4');

    const esm = esmTimeline(trade, semSegunda);
    const cjs = cjsTimeline(trade, semSegunda);
    expect(cjs.windows).toEqual(esm.windows);
    expect(cjs.totalNakedMs).toBe(esm.totalNakedMs);
    expect(cjs.neverProtected).toBe(esm.neverProtected);
    expect(cjs.addedWhileNaked).toBe(esm.addedWhileNaked);
    expect(esm.windows.length).toBeGreaterThan(0);
  });
});
