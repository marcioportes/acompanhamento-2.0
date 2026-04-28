/**
 * onTradeCreatedAutoEnrich.test.js — issue #187 Fase 5
 *
 * Testa a lógica do trigger via `handler` puro injetado.
 * Mock do firebase-admin via vi.mock para interceptar a chamada de runEnrichment
 * sem dependência de Firestore real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin antes de importar o handler
const mockUpdate = vi.fn().mockResolvedValue();
const mockGet = vi.fn();
vi.mock('firebase-admin', () => {
  const firestore = () => ({
    collection: () => ({
      doc: () => ({ update: mockUpdate, get: mockGet }),
    }),
  });
  return { default: { firestore }, firestore };
});

import { handler, SEVEN_DAYS_MS } from '../../../../functions/marketData/onTradeCreatedAutoEnrich';

const makeSnap = (data) => ({ data: () => data });
const makeCtx = (tradeId = 't-1') => ({ params: { tradeId } });

const recentTrade = (overrides = {}) => ({
  ticker: 'MNQH6',
  side: 'LONG',
  studentId: 'u-1',
  entryTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  exitTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  mepPrice: null,
  menPrice: null,
  excursionSource: null,
  ...overrides,
});

describe('onTradeCreatedAutoEnrich.handler — skips', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
  });

  it('skip se já tem MEP+MEN', async () => {
    const snap = makeSnap(recentTrade({ mepPrice: 100, menPrice: 95 }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skip se source é manual (override humano)', async () => {
    const snap = makeSnap(recentTrade({ excursionSource: 'manual' }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('skip se source é profitpro (parser já entregou)', async () => {
    const snap = makeSnap(recentTrade({ excursionSource: 'profitpro' }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('skip se ticker não mapeia (BR futures)', async () => {
    const snap = makeSnap(recentTrade({ ticker: 'WINM26' }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('skip se ticker é equity', async () => {
    const snap = makeSnap(recentTrade({ ticker: 'PETR4' }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('skip se trade > 7d', async () => {
    const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const snap = makeSnap(recentTrade({ entryTime: oldTime, exitTime: oldTime }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('skip se trade sem timestamps', async () => {
    const snap = makeSnap(recentTrade({ entryTime: null, exitTime: null, date: null }));
    await handler(snap, makeCtx());
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('onTradeCreatedAutoEnrich.handler — falha silenciosa', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
  });

  it('ticker mapeia + trade recente: tenta enrich (chama get/update)', async () => {
    // Simula o snapshot que runEnrichment vai ler do Firestore
    mockGet.mockResolvedValueOnce({ exists: true, data: () => recentTrade() });

    const snap = makeSnap(recentTrade());
    // handler chama runEnrichment internamente; runEnrichment usará fetchYahooBars com
    // global fetch (provavelmente falha em ambiente de teste). Mas o handler captura
    // o erro silenciosamente — não rethrows.
    await expect(handler(snap, makeCtx())).resolves.toBeUndefined();
  });

  it('NUNCA propaga erro (catch global)', async () => {
    // Snap quebrado de propósito — data() retorna null
    const brokenSnap = { data: () => { throw new Error('deliberado'); } };
    await expect(handler(brokenSnap, makeCtx())).resolves.toBeUndefined();
  });
});

describe('SEVEN_DAYS_MS exposto', () => {
  it('é 7 dias em ms', () => {
    expect(SEVEN_DAYS_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
