/**
 * fetchSelicDaily.test.js — issue #235 F0.1
 *
 * Cobre 6 cenários:
 *  1. Sucesso 1ª tentativa
 *  2. Retry — 1ª e 2ª falham, 3ª sucesso
 *  3. Todas falham → grava lastError, NÃO grava history, NÃO throw
 *  4. Payload vazio (final de semana) → atualiza lastFetchedAt apenas
 *  5. Idempotência — history já existe com source BCB-SGS-11
 *  6. Schema lock — payload com campo extra não quebra
 *
 * Firestore stub: doc/collection com `set`, `get`, `batch` registrando
 * em estruturas locais. Não depende de firebase-admin em runtime de teste.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runFetchSelicDaily, parsePayload, brToIso } = require('../../marketData/fetchSelicDaily');

// ── Firestore stub ──────────────────────────────────────────

function createDbStub() {
  const docs = new Map(); // path -> data

  function makeDocRef(path) {
    return {
      path,
      collection: (sub) => makeColRef(`${path}/${sub}`),
      get: async () => {
        const data = docs.get(path);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
      set: async (data, opts = {}) => {
        if (opts.merge) {
          const prev = docs.get(path) ?? {};
          docs.set(path, { ...prev, ...data });
        } else {
          docs.set(path, { ...data });
        }
      },
    };
  }
  function makeColRef(path) {
    return {
      path,
      doc: (id) => makeDocRef(`${path}/${id}`),
    };
  }

  function makeBatch() {
    const ops = [];
    return {
      set: (ref, data, opts = {}) => {
        ops.push({ ref, data, opts });
      },
      commit: async () => {
        for (const op of ops) {
          await op.ref.set(op.data, op.opts);
        }
      },
    };
  }

  return {
    _docs: docs,
    collection: (name) => makeColRef(name),
    batch: makeBatch,
  };
}

// ── Fetch mock helpers ──────────────────────────────────────

const mockFetchOk = (payload) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });

const mockFetchFail = (status = 503) => ({
  ok: false,
  status,
  json: async () => null,
});

// ── Setup comum ─────────────────────────────────────────────

const FIXED_NOW = new Date('2026-05-02T15:00:00Z'); // 12:00 BRT — alvo D-1 = 01/05/2026
const TARGET_ISO = '2026-05-01';

const baseDeps = (db, fetchFn, overrides = {}) => ({
  db,
  fetchFn,
  now: () => FIXED_NOW,
  attempts: 3,
  backoffBase: 1, // backoff irrelevante via sleepFn
  timeoutMs: 100,
  sleepFn: async () => {},
  timestamp: { now: () => 'TS' },
  ...overrides,
});

describe('fetchSelicDaily — runFetchSelicDaily', () => {
  let db;
  beforeEach(() => {
    db = createDbStub();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cenário 1: sucesso 1ª tentativa grava doc + history', async () => {
    const fetchFn = mockFetchOk([{ data: '01/05/2026', valor: '0.04953' }]);
    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));

    expect(result).toEqual({
      ok: true,
      status: 'written',
      date: TARGET_ISO,
      rateDaily: 0.0004953,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toMatch(/dataInicial=01%2F05%2F2026/);

    expect(db._docs.get(`systemConfig/selic/history/${TARGET_ISO}`)).toEqual({
      date: TARGET_ISO,
      rateDaily: 0.0004953,
      source: 'BCB-SGS-11',
      fetchedAt: 'TS',
    });
    expect(db._docs.get('systemConfig/selic')).toEqual({
      lastDate: TARGET_ISO,
      lastRate: 0.0004953,
      lastFetchedAt: 'TS',
      source: 'BCB-SGS-11',
      lastError: null,
    });
  });

  it('cenário 2: 1ª e 2ª falham com 503, 3ª sucesso → grava normal sem lastError', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(mockFetchFail(503))
      .mockResolvedValueOnce(mockFetchFail(503))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ data: '01/05/2026', valor: '0.04953' }],
      });

    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));
    expect(result.ok).toBe(true);
    expect(result.status).toBe('written');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(db._docs.get('systemConfig/selic').lastError).toBe(null);
    expect(db._docs.has(`systemConfig/selic/history/${TARGET_ISO}`)).toBe(true);
  });

  it('cenário 3: 3 erros consecutivos gravam lastError, NÃO throw, NÃO grava history', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockFetchFail(500));

    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(fetchFn).toHaveBeenCalledTimes(3);

    const doc = db._docs.get('systemConfig/selic');
    expect(doc).toBeDefined();
    expect(doc.lastError).toMatchObject({
      code: 'http_500',
      message: 'HTTP 500',
      attemptedAt: 'TS',
    });
    expect(db._docs.has(`systemConfig/selic/history/${TARGET_ISO}`)).toBe(false);
  });

  it('cenário 4: payload vazio → não grava history, atualiza lastFetchedAt e zera lastError', async () => {
    const fetchFn = mockFetchOk([]);
    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));

    expect(result).toEqual({ ok: true, status: 'no_data' });
    expect(db._docs.has(`systemConfig/selic/history/${TARGET_ISO}`)).toBe(false);
    const doc = db._docs.get('systemConfig/selic');
    expect(doc.lastFetchedAt).toBe('TS');
    expect(doc.lastError).toBe(null);
    expect(doc.source).toBe('BCB-SGS-11');
    expect(doc.lastDate).toBeUndefined();
  });

  it('cenário 5: idempotente — history já existe com source BCB-SGS-11 pula escrita', async () => {
    db._docs.set(`systemConfig/selic/history/${TARGET_ISO}`, {
      date: TARGET_ISO,
      rateDaily: 0.0004953,
      source: 'BCB-SGS-11',
      fetchedAt: 'PREV',
    });

    const fetchFn = mockFetchOk([{ data: '01/05/2026', valor: '0.04953' }]);
    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));

    expect(result).toEqual({
      ok: true,
      status: 'skipped_idempotent',
      date: TARGET_ISO,
      rateDaily: 0.0004953,
    });
    // history não foi sobrescrito
    expect(db._docs.get(`systemConfig/selic/history/${TARGET_ISO}`).fetchedAt).toBe('PREV');
    // metadata atualizado
    expect(db._docs.get('systemConfig/selic').lastFetchedAt).toBe('TS');
  });

  it('cenário 6: schema lock — payload com campo extra parseia normalmente', async () => {
    const fetchFn = mockFetchOk([{ data: '01/05/2026', valor: '0.04953', foo: 'bar', extra: 42 }]);
    const result = await runFetchSelicDaily(baseDeps(db, fetchFn));

    expect(result.ok).toBe(true);
    expect(result.status).toBe('written');
    expect(result.rateDaily).toBe(0.0004953);
    // campo extra não vaza para o doc gravado
    const hist = db._docs.get(`systemConfig/selic/history/${TARGET_ISO}`);
    expect(hist).toEqual({
      date: TARGET_ISO,
      rateDaily: 0.0004953,
      source: 'BCB-SGS-11',
      fetchedAt: 'TS',
    });
    expect(hist.foo).toBeUndefined();
  });
});

// ── Sanidade do parser ──────────────────────────────────────

describe('fetchSelicDaily — parsePayload (sanity)', () => {
  it('rejeita payload não-array', () => {
    expect(parsePayload({ error: 'oops' })).toBeNull();
    expect(parsePayload(null)).toBeNull();
  });
  it('rejeita item sem data ou valor', () => {
    expect(parsePayload([{ data: '01/05/2026' }])).toBeNull();
    expect(parsePayload([{ valor: '0.04' }])).toBeNull();
  });
  it('rejeita data malformada', () => {
    expect(parsePayload([{ data: '2026-05-01', valor: '0.04' }])).toBeNull();
  });
  it('aceita campo extra', () => {
    const out = parsePayload([{ data: '01/05/2026', valor: '0.04953', foo: 1 }]);
    expect(out).toEqual([{ date: '2026-05-01', rateDaily: 0.0004953 }]);
  });
});

describe('fetchSelicDaily — brToIso', () => {
  it('converte DD/MM/YYYY → YYYY-MM-DD', () => {
    expect(brToIso('01/05/2026')).toBe('2026-05-01');
  });
  it('rejeita formato inválido', () => {
    expect(brToIso('2026-05-01')).toBeNull();
    expect(brToIso('1/5/26')).toBeNull();
  });
});
