/**
 * getSelicForDate.test.js — issue #235 F0.3
 *
 * Cobre 7 cenários:
 *  C1 — exact hit
 *  C2 — carry-forward 1 dia (sábado → sexta)
 *  C3 — carry-forward dentro do limite (5 dias)
 *  C4 — gap > maxCarryForwardDays → fallback
 *  C5 — coleção vazia → fallback
 *  C6 — erro Firestore → fallback + log
 *  C7 — daysDiffIso atravessa virada de mês sem drift
 *
 * Memoização (issue #387 task 03):
 *  C9  — segunda chamada para a mesma data não reconsulta
 *  C10 — chamadas concorrentes para a mesma data compartilham uma leitura
 *  C11 — datas diferentes não colidem no cache
 *  C12 — `db` / `maxCarryForwardDays` distintos não reusam entrada alheia
 *  C13 — fallback NÃO é cacheado (estado transitório) → próxima chamada reconsulta
 *  C14 — clearSelicCache() de fato limpa
 *  C15 — carry-forward na data corrente não é cacheado (doc do dia ainda pode chegar)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks de Firestore ──────────────────────────────────────

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((db, path) => ({ __doc: path }));
const mockCollection = vi.fn((db, path) => ({ __col: path }));
const mockQuery = vi.fn((col, ...constraints) => ({ __q: { col, constraints } }));
const mockWhere = vi.fn((field, op, value) => ({ __w: [field, op, value] }));
const mockOrderBy = vi.fn((field, dir) => ({ __o: [field, dir] }));
const mockLimit = vi.fn((n) => ({ __l: n }));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  doc: (...args) => mockDoc(...args),
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
}));

vi.mock('../../../firebase', () => ({
  db: { __mock: 'firestore-client' },
}));

import {
  getSelicForDate,
  clearSelicCache,
  daysDiffIso,
  SELIC_FALLBACK_DAILY,
  SELIC_HISTORY_PATH,
} from '../../../utils/marketData/getSelicForDate';

// ── Helpers ─────────────────────────────────────────────────

const docSnap = (data) =>
  data === null
    ? { exists: () => false, data: () => undefined }
    : { exists: () => true, data: () => data };

const querySnap = (rows) => ({
  empty: rows.length === 0,
  docs: rows.map((r) => ({ data: () => r })),
});

beforeEach(() => {
  // O cache é de escopo de MÓDULO: sem isso o resultado de um teste vaza para o
  // seguinte (vários casos aqui reusam a data '2026-05-02' com mocks diferentes).
  clearSelicCache();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockDoc.mockClear();
  mockCollection.mockClear();
  mockQuery.mockClear();
  mockWhere.mockClear();
  mockOrderBy.mockClear();
  mockLimit.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSelicForDate (ESM)', () => {
  it('C1 — exact hit retorna doc do dia sem carry-forward nem fallback', async () => {
    mockGetDoc.mockResolvedValueOnce(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );

    const result = await getSelicForDate('2026-05-02');

    expect(result).toEqual({
      rateDaily: 0.00052531,
      source: 'BCB-SGS-11',
      dateUsed: '2026-05-02',
      isCarryForward: false,
      isFallback: false,
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockDoc).toHaveBeenCalledWith(
      { __mock: 'firestore-client' },
      `${SELIC_HISTORY_PATH}/2026-05-02`
    );
  });

  it('C2 — sábado faz carry-forward para sexta (1 dia)', async () => {
    // sábado: doc do dia não existe → query devolve sexta
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(
      querySnap([{ date: '2026-05-01', rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );

    const result = await getSelicForDate('2026-05-02'); // sábado fictício

    expect(result).toEqual({
      rateDaily: 0.00052531,
      source: 'BCB-SGS-11',
      dateUsed: '2026-05-01',
      isCarryForward: true,
      isFallback: false,
    });
    // confirma uso da query com where/orderBy/limit
    expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2026-05-02');
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('C3 — gap de 5 dias dentro do maxCarryForwardDays default (7) → carry-forward', async () => {
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(
      querySnap([{ date: '2026-04-25', rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );

    const result = await getSelicForDate('2026-04-30');

    expect(result.isCarryForward).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(result.dateUsed).toBe('2026-04-25');
    expect(result.rateDaily).toBe(0.00052531);
  });

  it('C4 — gap > maxCarryForwardDays cai em fallback', async () => {
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(
      querySnap([{ date: '2026-04-01', rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );

    const result = await getSelicForDate('2026-04-30'); // 29 dias > 7

    expect(result).toEqual({
      rateDaily: SELIC_FALLBACK_DAILY,
      source: 'FALLBACK',
      dateUsed: null,
      isCarryForward: false,
      isFallback: true,
    });
  });

  it('C4b — limite customizado: maxCarryForwardDays=2 com gap=3 → fallback', async () => {
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(
      querySnap([{ date: '2026-04-27', rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );

    const result = await getSelicForDate('2026-04-30', { maxCarryForwardDays: 2 });

    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('FALLBACK');
  });

  it('C5 — coleção vazia → fallback', async () => {
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(querySnap([]));

    const result = await getSelicForDate('2026-05-02');

    expect(result).toEqual({
      rateDaily: SELIC_FALLBACK_DAILY,
      source: 'FALLBACK',
      dateUsed: null,
      isCarryForward: false,
      isFallback: true,
    });
  });

  it('C6 — getDocs throw → fallback + log estruturado, NUNCA throw', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    const fsErr = Object.assign(new Error('UNAVAILABLE'), { code: 'unavailable' });
    mockGetDocs.mockRejectedValueOnce(fsErr);

    const result = await getSelicForDate('2026-05-02');

    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('FALLBACK');
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0]).toMatch(/getSelicForDate/);
    expect(errSpy.mock.calls[0][0]).toMatch(/unavailable/);
    errSpy.mockRestore();
  });

  it('C6b — fallbackRateDaily customizado é respeitado', async () => {
    mockGetDoc.mockResolvedValueOnce(docSnap(null));
    mockGetDocs.mockResolvedValueOnce(querySnap([]));

    const result = await getSelicForDate('2026-05-02', { fallbackRateDaily: 0.0009 });

    expect(result.rateDaily).toBe(0.0009);
    expect(result.isFallback).toBe(true);
  });

  it('C7 — daysDiffIso sem timezone drift (atravessa mês e ano)', () => {
    expect(daysDiffIso('2026-03-01', '2026-02-28')).toBe(1);
    expect(daysDiffIso('2024-03-01', '2024-02-28')).toBe(2); // ano bissexto
    expect(daysDiffIso('2026-01-01', '2025-12-31')).toBe(1);
    expect(daysDiffIso('2026-05-02', '2026-05-01')).toBe(1);
    expect(daysDiffIso('2026-05-02', '2026-05-02')).toBe(0);
    expect(daysDiffIso('2026-04-01', '2026-04-30')).toBe(-29);
  });

  it('C8 — db injetável via opts.db substitui o default', async () => {
    const customDb = { __custom: true };
    mockGetDoc.mockResolvedValueOnce(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );

    await getSelicForDate('2026-05-02', { db: customDb });

    expect(mockDoc).toHaveBeenCalledWith(customDb, `${SELIC_HISTORY_PATH}/2026-05-02`);
  });
  // ── Memoização (issue #387 task 03) ───────────────────────

  it('C9 — segunda chamada para a mesma data não vai ao Firestore de novo', async () => {
    mockGetDoc.mockResolvedValue(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );

    const first = await getSelicForDate('2026-05-02');
    const second = await getSelicForDate('2026-05-02');

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second).toEqual({
      rateDaily: 0.00052531,
      source: 'BCB-SGS-11',
      dateUsed: '2026-05-02',
      isCarryForward: false,
      isFallback: false,
    });
  });

  it('C10 — chamadas CONCORRENTES para a mesma data compartilham uma única leitura', async () => {
    mockGetDoc.mockResolvedValue(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );

    // `computeCycleSharpe` dispara os lookups em Promise.all — é este o cenário real.
    const results = await Promise.all([
      getSelicForDate('2026-05-02'),
      getSelicForDate('2026-05-02'),
      getSelicForDate('2026-05-02'),
    ]);

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0].rateDaily).toBe(0.00052531);
  });

  it('C11 — datas diferentes não colidem no cache', async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        docSnap({ date: '2026-05-04', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
      )
      .mockResolvedValueOnce(
        docSnap({ date: '2026-05-05', rateDaily: 0.00049999, source: 'BCB-SGS-11' })
      );

    const a = await getSelicForDate('2026-05-04');
    const b = await getSelicForDate('2026-05-05');

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(a.dateUsed).toBe('2026-05-04');
    expect(a.rateDaily).toBe(0.00052531);
    expect(b.dateUsed).toBe('2026-05-05');
    expect(b.rateDaily).toBe(0.00049999);
  });

  it('C12 — `db` distinto e maxCarryForwardDays distinto não reusam entrada alheia', async () => {
    mockGetDoc.mockResolvedValue(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );
    const customDb = { __custom: true };

    await getSelicForDate('2026-05-02');
    await getSelicForDate('2026-05-02', { db: customDb });
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc).toHaveBeenLastCalledWith(customDb, `${SELIC_HISTORY_PATH}/2026-05-02`);

    // mesmo db, parâmetro numérico diferente → entrada própria
    await getSelicForDate('2026-05-02', { maxCarryForwardDays: 2 });
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
    await getSelicForDate('2026-05-02', { fallbackRateDaily: 0.0009 });
    expect(mockGetDoc).toHaveBeenCalledTimes(4);

    // e cada uma delas segue memoizada individualmente
    await getSelicForDate('2026-05-02');
    await getSelicForDate('2026-05-02', { db: customDb });
    await getSelicForDate('2026-05-02', { maxCarryForwardDays: 2 });
    expect(mockGetDoc).toHaveBeenCalledTimes(4);
  });

  it('C13 — fallback NÃO é cacheado: a chamada seguinte reconsulta', async () => {
    mockGetDoc.mockResolvedValue(docSnap(null));
    mockGetDocs.mockResolvedValue(querySnap([]));

    const first = await getSelicForDate('2026-05-02');
    expect(first.isFallback).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    // fallback é estado transitório (erro/gap) — congelá-lo fixaria taxa errada na sessão
    const second = await getSelicForDate('2026-05-02');
    expect(second.isFallback).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(2);

    // e quando o dado aparece, o resultado bom é o que vale
    mockGetDoc.mockResolvedValue(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );
    const third = await getSelicForDate('2026-05-02');
    expect(third.isFallback).toBe(false);
    expect(third.rateDaily).toBe(0.00052531);
  });

  it('C14 — clearSelicCache() limpa de fato', async () => {
    mockGetDoc.mockResolvedValue(
      docSnap({ date: '2026-05-02', rateDaily: 0.00052531, source: 'BCB-SGS-11' })
    );

    await getSelicForDate('2026-05-02');
    await getSelicForDate('2026-05-02');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    clearSelicCache();

    await getSelicForDate('2026-05-02');
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('C15 — carry-forward na data corrente não é cacheado; em data passada é', async () => {
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const yesterdayIso = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);

    // hoje ainda não tem doc próprio (CF das 09h BRT pode não ter rodado) → carry-forward
    mockGetDoc.mockResolvedValue(docSnap(null));
    mockGetDocs.mockResolvedValue(
      querySnap([{ date: yesterdayIso, rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );

    const t1 = await getSelicForDate(todayIso);
    expect(t1.isCarryForward).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    const t2 = await getSelicForDate(todayIso);
    expect(t2.isCarryForward).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(2); // reconsultou: doc do dia ainda pode chegar

    // data passada: fim-de-semana nunca terá doc exato → carry-forward é definitivo
    mockGetDocs.mockResolvedValue(
      querySnap([{ date: '2026-05-01', rateDaily: 0.00052531, source: 'BCB-SGS-11' }])
    );
    const past = await getSelicForDate('2026-05-02');
    expect(past.isCarryForward).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
    await getSelicForDate('2026-05-02');
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
  });
});
