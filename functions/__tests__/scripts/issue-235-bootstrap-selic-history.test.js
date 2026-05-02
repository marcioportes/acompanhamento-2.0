/**
 * issue-235-bootstrap-selic-history.test.js — issue #235 F0.2
 *
 * Cobre 5 cenários (A..E) + sanity das funções puras:
 *   A — parsePayload BCB SGS-11 válido (1 e múltiplos itens, campo extra)
 *   B — chunkBatch divide N=1234 em 3 batches (500/500/234)
 *   C — iterateDateRange("2024-01-01", "2024-01-05") retorna 5 datas
 *   D — dry-run com 10 fetched, 3 já existentes → would_write=7, skipped=3
 *   E — execute com erro de batch → registra em errors[], continua subsequentes
 *
 * O script bootstrap é ESM (.mjs); importado direto via import nativo do
 * Vitest (não precisa createRequire).
 */

import { describe, it, expect, vi } from 'vitest';

import {
  parsePayload,
  chunkBatch,
  iterateDateRange,
  chunkDateRange,
  brToIso,
  isoToBr,
  runBootstrap,
  SOURCE,
} from '../../../scripts/issue-235-bootstrap-selic-history.mjs';

// ── Firestore stub ──────────────────────────────────────────

function createDbStub({ existingHistoryDates = [], commitFailures = [] } = {}) {
  const docs = new Map();
  for (const d of existingHistoryDates) {
    docs.set(`systemConfig/selic/history/${d}`, {
      date: d,
      rateDaily: 0.0001,
      source: SOURCE,
      fetchedAt: 'PREV',
    });
  }
  let commitCallCount = 0;

  function makeDocRef(path) {
    return {
      path,
      collection: (sub) => makeColRef(`${path}/${sub}`),
      get: async () => {
        const data = docs.get(path);
        return { exists: data !== undefined, data: () => data };
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
    return { path, doc: (id) => makeDocRef(`${path}/${id}`) };
  }
  function makeBatch() {
    const ops = [];
    return {
      set: (ref, data, opts = {}) => ops.push({ ref, data, opts }),
      commit: async () => {
        const idx = commitCallCount++;
        if (commitFailures.includes(idx)) {
          const err = new Error(`simulated batch failure #${idx}`);
          err.code = 'commit_fail';
          throw err;
        }
        for (const op of ops) await op.ref.set(op.data, op.opts);
      },
    };
  }

  return {
    _docs: docs,
    _commitCallCount: () => commitCallCount,
    collection: (name) => makeColRef(name),
    batch: makeBatch,
  };
}

const mockFetchOk = (payload) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });

const buildBrItems = (isoDates, valor = '0.04953') =>
  isoDates.map((iso) => ({ data: isoToBr(iso), valor }));

// ── A — parsePayload BCB SGS-11 válido ──────────────────────

describe('Cenário A — parsePayload BCB SGS-11 válido', () => {
  it('parseia 1 item simples', () => {
    expect(parsePayload([{ data: '01/05/2026', valor: '0.04953' }])).toEqual([
      { date: '2026-05-01', rateDaily: 0.0004953 },
    ]);
  });

  it('parseia múltiplos itens preservando ordem', () => {
    const out = parsePayload([
      { data: '01/05/2026', valor: '0.04953' },
      { data: '02/05/2026', valor: '0.05000' },
      { data: '05/05/2026', valor: '0.04500' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ date: '2026-05-01', rateDaily: 0.0004953 });
    expect(out[1]).toEqual({ date: '2026-05-02', rateDaily: 0.0005 });
    expect(out[2].date).toBe('2026-05-05');
    expect(out[2].rateDaily).toBeCloseTo(0.00045, 10);
  });

  it('aceita campo extra sem vazar para o output', () => {
    const out = parsePayload([{ data: '01/05/2026', valor: '0.04953', foo: 1, extra: 'bar' }]);
    expect(out).toEqual([{ date: '2026-05-01', rateDaily: 0.0004953 }]);
    expect(out[0]).not.toHaveProperty('foo');
  });

  it('retorna [] quando payload BCB é vazio (fim de semana)', () => {
    expect(parsePayload([])).toEqual([]);
  });

  it('rejeita payload com schema inválido', () => {
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload({ error: 'oops' })).toBeNull();
    expect(parsePayload([{ data: '01/05/2026' }])).toBeNull();
    expect(parsePayload([{ valor: '0.04' }])).toBeNull();
    expect(parsePayload([{ data: '2026-05-01', valor: '0.04' }])).toBeNull();
    expect(parsePayload([{ data: '01/05/2026', valor: 'NaN-text' }])).toBeNull();
  });
});

// ── B — chunkBatch ──────────────────────────────────────────

describe('Cenário B — chunkBatch divide N=1234 em 3 batches (500/500/234)', () => {
  it('divide 1234 itens em [500, 500, 234] com size=500', () => {
    const arr = Array.from({ length: 1234 }, (_, i) => i);
    const chunks = chunkBatch(arr, 500);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(234);
    // Cobertura completa, sem duplicação.
    expect(chunks.flat()).toEqual(arr);
  });

  it('lida com array vazio', () => {
    expect(chunkBatch([], 500)).toEqual([]);
  });

  it('lida com array menor que size', () => {
    expect(chunkBatch([1, 2, 3], 500)).toEqual([[1, 2, 3]]);
  });

  it('rejeita argumentos inválidos', () => {
    expect(() => chunkBatch('nope', 500)).toThrow(TypeError);
    expect(() => chunkBatch([1], 0)).toThrow(RangeError);
    expect(() => chunkBatch([1], -1)).toThrow(RangeError);
    expect(() => chunkBatch([1], 1.5)).toThrow(RangeError);
  });
});

// ── C — iterateDateRange ────────────────────────────────────

describe('Cenário C — iterateDateRange("2024-01-01", "2024-01-05") retorna 5 datas', () => {
  it('inclusivo nas duas pontas, 5 dias consecutivos', () => {
    expect(iterateDateRange('2024-01-01', '2024-01-05')).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ]);
  });

  it('mesmo dia → 1 entrada', () => {
    expect(iterateDateRange('2024-03-15', '2024-03-15')).toEqual(['2024-03-15']);
  });

  it('atravessa virada de mês', () => {
    expect(iterateDateRange('2024-01-30', '2024-02-02')).toEqual([
      '2024-01-30',
      '2024-01-31',
      '2024-02-01',
      '2024-02-02',
    ]);
  });

  it('atravessa ano bissexto (29/02/2024)', () => {
    expect(iterateDateRange('2024-02-28', '2024-03-01')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('from > to retorna []', () => {
    expect(iterateDateRange('2024-12-31', '2024-01-01')).toEqual([]);
  });

  it('rejeita ISO mal formado', () => {
    expect(() => iterateDateRange('2024-1-1', '2024-01-05')).toThrow(RangeError);
    expect(() => iterateDateRange('not-a-date', '2024-01-05')).toThrow(RangeError);
  });
});

describe('chunkDateRange — divide janela em sub-janelas de até 365 dias', () => {
  it('janela curta cabe em 1 chunk', () => {
    const r = chunkDateRange('2024-01-01', '2024-01-05');
    expect(r).toEqual([{ from: '2024-01-01', to: '2024-01-05' }]);
  });

  it('janela > 365 dias é dividida', () => {
    const r = chunkDateRange('2024-01-01', '2025-12-31', 365);
    expect(r.length).toBeGreaterThanOrEqual(2);
    // O primeiro chunk começa no from original
    expect(r[0].from).toBe('2024-01-01');
    // O último chunk termina no to original
    expect(r[r.length - 1].to).toBe('2025-12-31');
  });
});

// ── D — Dry-run idempotente: 10 fetched, 3 existentes ───────

describe('Cenário D — dry-run com 10 fetched, 3 existentes → would_write=7, skipped=3', () => {
  it('conta corretamente sem gravar', async () => {
    const dates = [
      '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08',
      '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2024-01-15',
    ];
    const existing = ['2024-01-03', '2024-01-08', '2024-01-12'];

    const db = createDbStub({ existingHistoryDates: existing });
    const fetchFn = mockFetchOk(buildBrItems(dates));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-15',
      mode: 'dryrun',
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.mode).toBe('dryrun');
    expect(summary.fetched_count).toBe(10);
    expect(summary.skipped).toBe(3);
    expect(summary.would_write).toBe(7);
    expect(summary).not.toHaveProperty('wrote');
    expect(summary.errors).toEqual([]);

    // Nenhum doc novo gravado — só os 3 pré-existentes.
    expect(db._commitCallCount()).toBe(0);
    const newWrites = [...db._docs.keys()].filter(
      (k) => k.startsWith('systemConfig/selic/history/') && !existing.includes(k.split('/').pop())
    );
    expect(newWrites).toEqual([]);
    // Parent doc não foi tocado.
    expect(db._docs.has('systemConfig/selic')).toBe(false);
  });

  it('idempotência: rodar dry-run após execute completa → would_write=0, skipped=N', async () => {
    const dates = ['2024-01-02', '2024-01-03', '2024-01-04'];
    const db = createDbStub({ existingHistoryDates: dates });
    const fetchFn = mockFetchOk(buildBrItems(dates));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-04',
      mode: 'dryrun',
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.would_write).toBe(0);
    expect(summary.skipped).toBe(3);
  });
});

// ── E — Execute com batch error ─────────────────────────────

describe('Cenário E — execute com erro de batch registra em errors[] e continua', () => {
  it('1ª batch falha, 2ª e 3ª commitam; errors[] tem 1 entrada', async () => {
    // 10 itens, batchSize=4 → 3 batches (4/4/2). Falhar o batch idx=0.
    const dates = [
      '2024-02-01', '2024-02-02', '2024-02-05', '2024-02-06',
      '2024-02-07', '2024-02-08', '2024-02-09', '2024-02-12',
      '2024-02-13', '2024-02-14',
    ];
    const db = createDbStub({ commitFailures: [0] });
    const fetchFn = mockFetchOk(buildBrItems(dates));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-02-01',
      to: '2024-02-14',
      mode: 'execute',
      batchSize: 4,
      timestamp: { now: () => 'TS' },
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    // Função NÃO joga; retorna summary com errors.
    expect(summary.mode).toBe('execute');
    expect(summary.fetched_count).toBe(10);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].phase).toBe('commit');
    expect(summary.errors[0].batch).toBe(1);
    expect(summary.errors[0].size).toBe(4);
    expect(summary.errors[0].code).toBe('commit_fail');

    // Batches 2 e 3 commitaram: 4 + 2 = 6 docs gravados.
    expect(summary.wrote).toBe(6);

    // Parent doc atualizado com a maior data efetivamente gravada.
    const parent = db._docs.get('systemConfig/selic');
    expect(parent).toBeDefined();
    expect(parent.source).toBe(SOURCE);
    expect(parent.lastError).toBeNull();
    expect(parent.lastDate).toBe('2024-02-14');
  });

  it('falha em todos os batches → wrote=0 e parent doc NÃO é atualizado', async () => {
    const dates = ['2024-03-01', '2024-03-04'];
    const db = createDbStub({ commitFailures: [0] });
    const fetchFn = mockFetchOk(buildBrItems(dates));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-03-01',
      to: '2024-03-04',
      mode: 'execute',
      batchSize: 500,
      timestamp: { now: () => 'TS' },
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.wrote).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(db._docs.has('systemConfig/selic')).toBe(false);
  });

  it('execute sucesso completo grava history + parent {lastDate, lastRate}', async () => {
    const dates = ['2024-01-02', '2024-01-03', '2024-01-04'];
    const db = createDbStub();
    const fetchFn = mockFetchOk(buildBrItems(dates, '0.05000'));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-04',
      mode: 'execute',
      batchSize: 500,
      timestamp: { now: () => 'TS' },
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.wrote).toBe(3);
    expect(summary.errors).toEqual([]);

    // Schema 1:1 com a CF.
    expect(db._docs.get('systemConfig/selic/history/2024-01-02')).toEqual({
      date: '2024-01-02',
      rateDaily: 0.0005,
      source: SOURCE,
      fetchedAt: 'TS',
    });

    // Parent: lastDate = max(dates), lastRate = 0.0005, lastError = null.
    expect(db._docs.get('systemConfig/selic')).toEqual({
      lastDate: '2024-01-04',
      lastRate: 0.0005,
      lastFetchedAt: 'TS',
      source: SOURCE,
      lastError: null,
    });
  });

  it('NÃO regride lastDate quando bootstrap roda sobre janela antiga', async () => {
    // Parent doc já tem lastDate=2026-05-01. Bootstrap roda em 2024-01.
    const db = createDbStub();
    db._docs.set('systemConfig/selic', {
      lastDate: '2026-05-01',
      lastRate: 0.0006,
      source: SOURCE,
      lastError: null,
    });

    const dates = ['2024-01-02', '2024-01-03'];
    const fetchFn = mockFetchOk(buildBrItems(dates));

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-03',
      mode: 'execute',
      batchSize: 500,
      timestamp: { now: () => 'TS' },
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.wrote).toBe(2);
    // Parent permanece com lastDate=2026-05-01 (não regride).
    const parent = db._docs.get('systemConfig/selic');
    expect(parent.lastDate).toBe('2026-05-01');
    expect(parent.lastRate).toBe(0.0006);
    // History foi gravado normalmente.
    expect(db._docs.has('systemConfig/selic/history/2024-01-02')).toBe(true);
    expect(db._docs.has('systemConfig/selic/history/2024-01-03')).toBe(true);
  });
});

// ── Sanity das funções de data ──────────────────────────────

describe('brToIso / isoToBr', () => {
  it('brToIso converte DD/MM/YYYY → YYYY-MM-DD', () => {
    expect(brToIso('01/05/2026')).toBe('2026-05-01');
    expect(brToIso('29/02/2024')).toBe('2024-02-29');
  });

  it('brToIso rejeita formato inválido', () => {
    expect(brToIso('2026-05-01')).toBeNull();
    expect(brToIso('1/5/26')).toBeNull();
  });

  it('isoToBr converte YYYY-MM-DD → DD/MM/YYYY', () => {
    expect(isoToBr('2026-05-01')).toBe('01/05/2026');
    expect(isoToBr('2024-02-29')).toBe('29/02/2024');
  });

  it('isoToBr rejeita formato inválido', () => {
    expect(isoToBr('01/05/2026')).toBeNull();
    expect(isoToBr('not-a-date')).toBeNull();
  });

  it('roundtrip BR↔ISO preserva dados', () => {
    expect(brToIso(isoToBr('2024-07-15'))).toBe('2024-07-15');
    expect(isoToBr(brToIso('15/07/2024'))).toBe('15/07/2024');
  });
});

// ── Sanity da contract: payload vazio no fetch ──────────────

describe('runBootstrap — payload vazio retorna fetched_count=0', () => {
  it('dry-run sobre janela sem dados (fim de semana puro) → would_write=0', async () => {
    const db = createDbStub();
    const fetchFn = mockFetchOk([]);

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-06',
      to: '2024-01-07',
      mode: 'dryrun',
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.fetched_count).toBe(0);
    expect(summary.would_write).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.errors).toEqual([]);
  });

  it('schema inválido vira erro phase=parse', async () => {
    const db = createDbStub();
    const fetchFn = mockFetchOk({ error: 'service unavailable' });

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-05',
      mode: 'dryrun',
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.fetched_count).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].phase).toBe('parse');
    expect(summary.errors[0].code).toBe('bad_schema');
  });

  it('HTTP 5xx vira erro phase=fetch', async () => {
    const db = createDbStub();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => null,
    });

    const summary = await runBootstrap({
      db,
      fetchFn,
      from: '2024-01-02',
      to: '2024-01-05',
      mode: 'dryrun',
      now: () => new Date('2026-05-02T15:00:00Z'),
    });

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].phase).toBe('fetch');
    expect(summary.errors[0].code).toBe('http_503');
  });
});
