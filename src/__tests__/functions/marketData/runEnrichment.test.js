/**
 * runEnrichment.test.js — issue #187 Fase 4
 *
 * Helper puro `runEnrichment` (parte do CF callable enrichTradeWithExcursions),
 * que orchestra symbolMapper → fetchYahooBars → computeExcursionFromBars →
 * write Firestore. Testado com `db` injetado (mock do Firestore admin).
 */

import { describe, it, expect, vi } from 'vitest';
import { runEnrichment } from '../../../../functions/marketData/enrichTradeWithExcursions';

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
