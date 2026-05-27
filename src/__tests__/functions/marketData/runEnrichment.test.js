/**
 * runEnrichment.test.js — issue #187 Fase 4
 *
 * Helper puro `runEnrichment` (parte do CF callable enrichTradeWithExcursions),
 * que orchestra symbolMapper → fetchYahooBars → computeExcursionFromBars →
 * write Firestore. Testado com `db` injetado (mock do Firestore admin).
 */

import { describe, it, expect, vi } from 'vitest';
import { runEnrichment, toBrasiliaISO } from '../../../../functions/marketData/enrichTradeWithExcursions';

const makeMockDb = (tradeData, { exists = true } = {}) => {
  const updateFn = vi.fn().mockResolvedValue();
  const tradeRef = {
    update: updateFn,
    get: vi.fn().mockResolvedValue({ exists, data: () => tradeData }),
  };
  return {
    db: { collection: () => ({ doc: () => tradeRef }) },
    updateFn,
    tradeRef,
  };
};

const futuresTrade = (overrides = {}) => ({
  ticker: 'MNQH6',
  side: 'LONG',
  studentId: 'u-1',
  entryTime: '2026-04-27T14:00:00Z',
  exitTime: '2026-04-27T14:30:00Z',
  mepPrice: null,
  menPrice: null,
  excursionSource: null,
  ...overrides,
});

describe('runEnrichment — happy path', () => {
  it('busca bars, computa MEP/MEN, escreve no trade com source yahoo', async () => {
    const trade = futuresTrade();
    const { db, updateFn } = makeMockDb(trade);

    // Timestamps alinhados com a janela do trade (entryTime/exitTime)
    const t1 = Math.floor(new Date(trade.entryTime).getTime() / 1000);
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        chart: { result: [{
          timestamp: [t1, t1 + 60, t1 + 120],
          indicators: { quote: [{ high: [100, 102, 105], low: [99, 100, 95] }] },
        }] },
      }),
    });

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.ok).toBe(true);
    expect(result.source).toBe('yahoo');
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(95);
    expect(updateFn).toHaveBeenCalledWith({
      mepPrice: 105,
      menPrice: 95,
      excursionSource: 'yahoo',
    });
  });

  it('SHORT inverte cálculo (mep=min, men=max)', async () => {
    const trade = futuresTrade({ side: 'SHORT' });
    const { db, updateFn } = makeMockDb(trade);
    const t1 = Math.floor(new Date(trade.entryTime).getTime() / 1000);
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        chart: { result: [{
          timestamp: [t1, t1 + 60],
          indicators: { quote: [{ high: [100, 110], low: [90, 95] }] },
        }] },
      }),
    });

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.mepPrice).toBe(90);  // min low (favorable for SHORT)
    expect(result.menPrice).toBe(110); // max high (adverse for SHORT)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ excursionSource: 'yahoo' }));
  });
});

describe('runEnrichment — fallbacks', () => {
  it('idempotente: se já tem MEP+MEN, retorna skipped sem fetch', async () => {
    const trade = futuresTrade({ mepPrice: 100, menPrice: 95, excursionSource: 'manual' });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment({ tradeId: 't-1' }, { db, fetchFn });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.source).toBe('manual');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(updateFn).not.toHaveBeenCalled();
  });

  it('sem mapping Yahoo (BR futures) → unavailable, escreve source mas não preços', async () => {
    const trade = futuresTrade({ ticker: 'WINM26' });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(result.reason).toMatch(/sem mapping/);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('Yahoo falha (HTTP 503) → unavailable', async () => {
    const trade = futuresTrade();
    const { db, updateFn } = makeMockDb(trade);

    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('trade > 7d → unavailable sem fetch', async () => {
    const trade = futuresTrade({
      entryTime: '2026-04-15T14:00:00Z',
      exitTime: '2026-04-15T14:30:00Z',
    });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('trade sem timestamps → unavailable', async () => {
    const trade = futuresTrade({ entryTime: null, exitTime: null, date: null });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment({ tradeId: 't-1' }, { db, fetchFn });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/entryTime\/exitTime/);
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('bars vazias → unavailable', async () => {
    const trade = futuresTrade();
    const { db, updateFn } = makeMockDb(trade);

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ chart: { result: [{ timestamp: [], indicators: { quote: [{ high: [], low: [] }] } }] } }),
    });

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-04-27T15:00:00Z') }
    );

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('falta exitTime (só entryTime) → unavailable sem fetch', async () => {
    const trade = futuresTrade({ exitTime: null });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment({ tradeId: 't-1' }, { db, fetchFn });

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(result.reason).toMatch(/entryTime\/exitTime/);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('falta entryTime (só exitTime) → unavailable sem fallback pra date', async () => {
    // antes: from = entryTime || date → usava date (meia-noite) e calculava errado
    const trade = futuresTrade({ entryTime: null, date: '2026-04-27' });
    const { db, updateFn } = makeMockDb(trade);
    const fetchFn = vi.fn();

    const result = await runEnrichment({ tradeId: 't-1' }, { db, fetchFn });

    expect(result.ok).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledWith({ excursionSource: 'unavailable' });
  });

  it('trade inexistente → throw', async () => {
    const { db } = makeMockDb({}, { exists: false });
    await expect(runEnrichment({ tradeId: 't-1' }, { db })).rejects.toThrow(/não encontrado/);
  });

  it('tradeId obrigatório', async () => {
    const { db } = makeMockDb({});
    await expect(runEnrichment({ tradeId: null }, { db })).rejects.toThrow(/tradeId/);
  });

  it('db obrigatório', async () => {
    await expect(runEnrichment({ tradeId: 't-1' }, {})).rejects.toThrow(/deps.db/);
  });
});

describe('toBrasiliaISO — bug 1 #267 (normalização de timezone)', () => {
  it('string naive (sem offset) → anexa -03:00 (horário de Brasília)', () => {
    expect(toBrasiliaISO('2026-05-20T10:30:00')).toBe('2026-05-20T10:30:00-03:00');
    expect(toBrasiliaISO('2026-05-20T10:30')).toBe('2026-05-20T10:30-03:00');
  });

  it('string com Z (UTC) → mantém intacta', () => {
    expect(toBrasiliaISO('2026-05-20T13:30:00Z')).toBe('2026-05-20T13:30:00Z');
    expect(toBrasiliaISO('2026-05-20T13:30:00.000Z')).toBe('2026-05-20T13:30:00.000Z');
  });

  it('string com offset explícito → mantém intacta', () => {
    expect(toBrasiliaISO('2026-05-20T10:30:00-03:00')).toBe('2026-05-20T10:30:00-03:00');
    expect(toBrasiliaISO('2026-05-20T08:30:00-05:00')).toBe('2026-05-20T08:30:00-05:00');
  });

  it('valor não-string ou vazio → passa sem alteração', () => {
    expect(toBrasiliaISO('')).toBe('');
    expect(toBrasiliaISO(null)).toBe(null);
    expect(toBrasiliaISO(undefined)).toBe(undefined);
  });
});

describe('runEnrichment — bug 1 #267 (janela busca o horário de Brasília, não UTC)', () => {
  it('entryTime naive 10:30 BRT busca Yahoo na janela 13:30 UTC (não 10:30 UTC)', async () => {
    const trade = futuresTrade({
      entryTime: '2026-05-20T10:30:00', // naive = 10:30 Brasília = 13:30 UTC
      exitTime: '2026-05-20T11:00:00',  // naive = 11:00 Brasília = 14:00 UTC
    });
    const { db, updateFn } = makeMockDb(trade);

    const expectedT1 = Math.floor(new Date('2026-05-20T13:30:00Z').getTime() / 1000);
    const expectedT2 = Math.floor(new Date('2026-05-20T14:00:00Z').getTime() / 1000);
    const wrongT1 = Math.floor(new Date('2026-05-20T10:30:00Z').getTime() / 1000);

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        chart: { result: [{
          timestamp: [expectedT1, expectedT1 + 60, expectedT2],
          indicators: { quote: [{ high: [100, 108, 105], low: [99, 100, 95] }] },
        }] },
      }),
    });

    const result = await runEnrichment(
      { tradeId: 't-1' },
      { db, fetchFn, now: () => new Date('2026-05-20T15:00:00Z') }
    );

    const url = fetchFn.mock.calls[0][0];
    expect(url).toContain(`period1=${expectedT1}`);
    expect(url).toContain(`period2=${expectedT2}`);
    expect(url).not.toContain(`period1=${wrongT1}`);

    // janela correta → bars caem dentro do range → MEP/MEN computados
    expect(result.ok).toBe(true);
    expect(result.source).toBe('yahoo');
    expect(result.mepPrice).toBe(108);
    expect(result.menPrice).toBe(95);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ excursionSource: 'yahoo' })
    );
  });
});
