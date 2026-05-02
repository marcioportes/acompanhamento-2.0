/**
 * getSelicForDate.test.js — issue #235 F0.3 (CJS mirror)
 *
 * Cobre os mesmos 7 cenários do espelho ESM, com stub Firestore admin
 * (chained API: collection().doc().collection().where().orderBy().limit().get()).
 *
 *  C1 — exact hit
 *  C2 — carry-forward 1 dia
 *  C3 — carry-forward 5 dias (dentro do default 7)
 *  C4 — gap > maxCarryForwardDays → fallback
 *  C5 — coleção vazia → fallback
 *  C6 — erro Firestore (.get() throw) → fallback + log
 *  C7 — daysDiffIso atravessa virada de mês/ano sem drift
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getSelicForDate,
  daysDiffIso,
  SELIC_FALLBACK_DAILY,
} = require('../../marketData/getSelicForDate');

// ── Firestore admin stub ────────────────────────────────────
//
// API admin (chained):
//   db.collection('systemConfig').doc('selic').collection('history')
//     .doc(date).get()                                  → DocumentSnapshot {exists, data()}
//   .where(...).orderBy(...).limit(1).get()             → QuerySnapshot {empty, docs[]}

function createAdminDbStub({ historyDocs = {}, queryRows = [], queryThrows = null } = {}) {
  const docCalls = [];
  const queryCalls = { where: [], orderBy: [], limit: [] };

  const historyCol = {
    doc: (id) => {
      docCalls.push(id);
      return {
        get: async () => {
          const data = historyDocs[id];
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
      };
    },
    where: (field, op, value) => {
      queryCalls.where.push([field, op, value]);
      return historyCol;
    },
    orderBy: (field, dir) => {
      queryCalls.orderBy.push([field, dir]);
      return historyCol;
    },
    limit: (n) => {
      queryCalls.limit.push(n);
      return historyCol;
    },
    get: async () => {
      if (queryThrows) throw queryThrows;
      return {
        empty: queryRows.length === 0,
        docs: queryRows.map((r) => ({ data: () => r })),
      };
    },
  };

  return {
    _docCalls: docCalls,
    _queryCalls: queryCalls,
    collection: (name) => {
      if (name !== 'systemConfig') throw new Error(`unexpected col ${name}`);
      return {
        doc: (id) => {
          if (id !== 'selic') throw new Error(`unexpected doc ${id}`);
          return {
            collection: (sub) => {
              if (sub !== 'history') throw new Error(`unexpected sub ${sub}`);
              return historyCol;
            },
          };
        },
      };
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSelicForDate (CJS)', () => {
  it('C1 — exact hit retorna doc do dia sem carry-forward nem fallback', async () => {
    const db = createAdminDbStub({
      historyDocs: {
        '2026-05-02': { date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' },
      },
    });

    const result = await getSelicForDate('2026-05-02', { db });

    expect(result).toEqual({
      rateDaily: 0.00052531,
      source: 'BCB-SGS-11',
      dateUsed: '2026-05-02',
      isCarryForward: false,
      isFallback: false,
    });
    expect(db._docCalls).toEqual(['2026-05-02']);
    // não chamou a query (where/orderBy/limit)
    expect(db._queryCalls.where).toHaveLength(0);
  });

  it('C2 — sábado faz carry-forward para sexta (1 dia)', async () => {
    const db = createAdminDbStub({
      historyDocs: {}, // sábado não tem doc
      queryRows: [{ date: '2026-05-01', rateDaily: 0.00052531, source: 'BCB-SGS-11' }],
    });

    const result = await getSelicForDate('2026-05-02', { db });

    expect(result).toEqual({
      rateDaily: 0.00052531,
      source: 'BCB-SGS-11',
      dateUsed: '2026-05-01',
      isCarryForward: true,
      isFallback: false,
    });
    expect(db._queryCalls.where).toEqual([['date', '<=', '2026-05-02']]);
    expect(db._queryCalls.orderBy).toEqual([['date', 'desc']]);
    expect(db._queryCalls.limit).toEqual([1]);
  });

  it('C3 — gap de 5 dias dentro do default (7) → carry-forward', async () => {
    const db = createAdminDbStub({
      queryRows: [{ date: '2026-04-25', rateDaily: 0.00052531, source: 'BCB-SGS-11' }],
    });

    const result = await getSelicForDate('2026-04-30', { db });

    expect(result.isCarryForward).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(result.dateUsed).toBe('2026-04-25');
  });

  it('C4 — gap > maxCarryForwardDays → fallback', async () => {
    const db = createAdminDbStub({
      queryRows: [{ date: '2026-04-01', rateDaily: 0.00052531, source: 'BCB-SGS-11' }],
    });

    const result = await getSelicForDate('2026-04-30', { db });

    expect(result).toEqual({
      rateDaily: SELIC_FALLBACK_DAILY,
      source: 'FALLBACK',
      dateUsed: null,
      isCarryForward: false,
      isFallback: true,
    });
  });

  it('C4b — limite customizado: maxCarryForwardDays=2 com gap=3 → fallback', async () => {
    const db = createAdminDbStub({
      queryRows: [{ date: '2026-04-27', rateDaily: 0.00052531, source: 'BCB-SGS-11' }],
    });

    const result = await getSelicForDate('2026-04-30', { db, maxCarryForwardDays: 2 });

    expect(result.isFallback).toBe(true);
  });

  it('C5 — coleção vazia → fallback', async () => {
    const db = createAdminDbStub({ queryRows: [] });

    const result = await getSelicForDate('2026-05-02', { db });

    expect(result).toEqual({
      rateDaily: SELIC_FALLBACK_DAILY,
      source: 'FALLBACK',
      dateUsed: null,
      isCarryForward: false,
      isFallback: true,
    });
  });

  it('C6 — .get() da query throw → fallback + log estruturado, NUNCA throw', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fsErr = Object.assign(new Error('UNAVAILABLE'), { code: 'unavailable' });
    const db = createAdminDbStub({ queryThrows: fsErr });

    const result = await getSelicForDate('2026-05-02', { db });

    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('FALLBACK');
    expect(result.rateDaily).toBe(SELIC_FALLBACK_DAILY);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0]).toMatch(/getSelicForDate/);
    expect(errSpy.mock.calls[0][0]).toMatch(/unavailable/);
    errSpy.mockRestore();
  });

  it('C6b — fallbackRateDaily customizado é respeitado', async () => {
    const db = createAdminDbStub({ queryRows: [] });

    const result = await getSelicForDate('2026-05-02', { db, fallbackRateDaily: 0.0009 });

    expect(result.rateDaily).toBe(0.0009);
    expect(result.isFallback).toBe(true);
  });

  it('C7 — daysDiffIso sem timezone drift (atravessa mês e ano)', () => {
    expect(daysDiffIso('2026-03-01', '2026-02-28')).toBe(1);
    expect(daysDiffIso('2024-03-01', '2024-02-28')).toBe(2);
    expect(daysDiffIso('2026-01-01', '2025-12-31')).toBe(1);
    expect(daysDiffIso('2026-05-02', '2026-05-01')).toBe(1);
    expect(daysDiffIso('2026-05-02', '2026-05-02')).toBe(0);
    expect(daysDiffIso('2026-04-01', '2026-04-30')).toBe(-29);
  });

  it('C8 — exact hit existe mas dado vazio: usa schema gravado tal qual', async () => {
    // garante que extraímos rateDaily/source do data() sem fallback espúrio
    const db = createAdminDbStub({
      historyDocs: {
        '2026-05-02': { date: '2026-05-02', rateDaily: 0.0006, source: 'BCB-SGS-11' },
      },
    });

    const result = await getSelicForDate('2026-05-02', { db });

    expect(result.rateDaily).toBe(0.0006);
    expect(result.source).toBe('BCB-SGS-11');
    expect(result.isFallback).toBe(false);
  });
});
