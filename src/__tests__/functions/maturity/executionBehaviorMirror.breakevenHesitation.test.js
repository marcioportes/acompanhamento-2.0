/**
 * Issue #229 — paridade ESM↔CJS dos detectores STOP_BREAKEVEN_TOO_EARLY +
 * STOP_HESITATION.
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

const TRADE = {
  id: 'T1',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entry: 100000,
  entryTime: '2026-04-22T10:30:00Z',
  exitTime: '2026-04-22T11:00:00Z',
};

const STOP = (overrides) => ({
  externalOrderId: 'S',
  instrument: 'WINM26',
  side: 'SELL',
  type: 'STOP',
  status: 'CANCELLED',
  quantity: 2,
  stopPrice: null,
  submittedAt: null,
  isStopOrder: true,
  correlatedTradeId: 'T1',
  ...overrides,
});

const stripVolatile = (events) => events.map(e => ({
  type: e.type,
  severity: e.severity,
  tradeId: e.tradeId,
  orderIds: [...(e.orderIds || [])].sort(),
  evidence: e.evidence,
}));

describe('Mirror parity #229 — EVENT_TYPES novos exportados', () => {
  it('CJS expõe STOP_BREAKEVEN_TOO_EARLY + STOP_HESITATION (paridade com ESM)', () => {
    expect(CJS_TYPES.STOP_BREAKEVEN_TOO_EARLY).toBe(ESM_TYPES.STOP_BREAKEVEN_TOO_EARLY);
    expect(CJS_TYPES.STOP_HESITATION).toBe(ESM_TYPES.STOP_HESITATION);
  });
});

describe('Mirror parity #229 — STOP_BREAKEVEN_TOO_EARLY', () => {
  it('ESM e CJS produzem mesmo resultado em LONG breakeven dentro de 5min', () => {
    const orders = [
      STOP({ externalOrderId: 'S1', stopPrice: 99500, submittedAt: '2026-04-22T10:30:30Z' }),
      STOP({ externalOrderId: 'S2', stopPrice: 100002, submittedAt: '2026-04-22T10:32:00Z' }),
    ];
    const esm = stripVolatile(esmDetect({ trades: [TRADE], orders }));
    const cjs = stripVolatile(cjsDetect({ trades: [TRADE], orders }));
    expect(cjs).toEqual(esm);
  });
});

describe('Mirror parity #229 — STOP_HESITATION', () => {
  it('ESM e CJS produzem mesmo resultado em 3 stops idênticos', () => {
    const orders = [
      STOP({ externalOrderId: 'S1', stopPrice: 99500, submittedAt: '2026-04-22T10:30:30Z' }),
      STOP({ externalOrderId: 'S2', stopPrice: 99500, submittedAt: '2026-04-22T10:35:00Z' }),
      STOP({ externalOrderId: 'S3', stopPrice: 99500, submittedAt: '2026-04-22T10:40:00Z' }),
    ];
    const esm = stripVolatile(esmDetect({ trades: [TRADE], orders }));
    const cjs = stripVolatile(cjsDetect({ trades: [TRADE], orders }));
    expect(cjs).toEqual(esm);
  });
});

describe('Mirror parity #229 — fixture realista (FEV-Orders 12/02 inspirado)', () => {
  it('3 stops Sell: 25177.75 / 25177.75 / 25199.25 (MNQ tolerance 0.25) — paridade', () => {
    const trade = {
      id: 'T_FEV',
      ticker: 'MNQH6',
      side: 'LONG',
      qty: 1,
      entry: 25180.00,
      entryTime: '2026-02-12T17:13:00Z',
      exitTime: '2026-02-12T17:21:52Z',
    };
    const orders = [
      STOP({ externalOrderId: 'F1', stopPrice: 25177.75, submittedAt: '2026-02-12T17:14:45Z',
        instrument: 'MNQH6', correlatedTradeId: 'T_FEV' }),
      STOP({ externalOrderId: 'F2', stopPrice: 25177.75, submittedAt: '2026-02-12T17:18:39Z',
        instrument: 'MNQH6', correlatedTradeId: 'T_FEV' }),
      STOP({ externalOrderId: 'F3', stopPrice: 25199.25, status: 'FILLED',
        submittedAt: '2026-02-12T17:21:52Z',
        instrument: 'MNQH6', correlatedTradeId: 'T_FEV' }),
    ];
    const esm = stripVolatile(esmDetect({ trades: [trade], orders }));
    const cjs = stripVolatile(cjsDetect({ trades: [trade], orders }));
    expect(cjs).toEqual(esm);
    // Ainda valida que noOpReissues = 1 (par 1↔2 dentro de tolerance, par 2↔3 fora)
    // → STOP_HESITATION exige ≥2, então NÃO dispara aqui.
    const hesitation = cjs.filter(e => e.type === 'STOP_HESITATION');
    expect(hesitation).toHaveLength(0);
  });
});
