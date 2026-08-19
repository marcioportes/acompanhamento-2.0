/**
 * linkOrdersToCreatedTrade.test.js — issue #351
 * Liga ordens do batch de importação ao trade criado pelo próprio Order Import.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  linkOrdersToCreatedTrade,
  tradeOrderFingerprints,
  orderDocFingerprint,
} = require('../../orders/linkOrdersToCreatedTrade');

// Caso real: WINV26 18/08/2026, LONG 8 contratos em 2 entradas (5 na abertura,
// 3 no meio da operação) e 2 saídas simultâneas no fechamento.
const trade = {
  ticker: 'WINV26',
  side: 'LONG',
  source: 'order_import',
  importBatchId: 'batch-18-08',
  _partials: [
    { type: 'ENTRY', price: 169760, qty: 5, dateTime: '2026-08-18T13:58:31', seq: 1 },
    { type: 'ENTRY', price: 169945, qty: 3, dateTime: '2026-08-18T14:46:17', seq: 2 },
    { type: 'EXIT', price: 170155, qty: 5, dateTime: '2026-08-18T15:14:48', seq: 3 },
    { type: 'EXIT', price: 170155, qty: 3, dateTime: '2026-08-18T15:14:48', seq: 4 },
  ],
};

const orderDoc = (id, data) => ({
  id,
  ref: { id },
  data: () => data,
});

const ordersOfBatch = () => [
  orderDoc('o1', { instrument: 'WINV26', side: 'BUY', filledAt: '2026-08-18T13:58:31', filledQuantity: 5, batchId: 'batch-18-08', correlatedTradeId: null }),
  orderDoc('o2', { instrument: 'WINV26', side: 'BUY', filledAt: '2026-08-18T14:46:17', filledQuantity: 3, batchId: 'batch-18-08', correlatedTradeId: null }),
  orderDoc('o3', { instrument: 'WINV26', side: 'SELL', filledAt: '2026-08-18T15:14:48', filledQuantity: 5, batchId: 'batch-18-08', correlatedTradeId: null }),
  orderDoc('o4', { instrument: 'WINV26', side: 'SELL', filledAt: '2026-08-18T15:14:48', filledQuantity: 3, batchId: 'batch-18-08', correlatedTradeId: null }),
];

const makeDb = (docs) => {
  const commits = [];
  const updates = [];
  const db = {
    collection: () => ({
      where: () => ({
        get: async () => ({ empty: docs.length === 0, docs }),
      }),
    }),
    batch: () => ({
      update: (ref, patch) => updates.push({ id: ref.id, patch }),
      commit: async () => { commits.push(true); },
    }),
  };
  return { db, updates, commits };
};

describe('tradeOrderFingerprints', () => {
  it('deriva BUY para ENTRY e SELL para EXIT num LONG', () => {
    const fps = [...tradeOrderFingerprints(trade)];
    expect(fps).toContain('WINV26|BUY|2026-08-18T13:58:31|5');
    expect(fps).toContain('WINV26|BUY|2026-08-18T14:46:17|3');
    expect(fps).toContain('WINV26|SELL|2026-08-18T15:14:48|5');
    expect(fps).toContain('WINV26|SELL|2026-08-18T15:14:48|3');
  });

  it('inverte os lados num SHORT', () => {
    const fps = [...tradeOrderFingerprints({ ...trade, side: 'SHORT' })];
    expect(fps).toContain('WINV26|SELL|2026-08-18T13:58:31|5');
    expect(fps).toContain('WINV26|BUY|2026-08-18T15:14:48|5');
  });

  it('ignora parcial sem horário', () => {
    const fps = tradeOrderFingerprints({
      ...trade,
      _partials: [{ type: 'ENTRY', qty: 1, dateTime: null }],
    });
    expect(fps.size).toBe(0);
  });

  it('fingerprint do doc de orders casa com o da parcial', () => {
    const d = ordersOfBatch()[1].data();
    expect(orderDocFingerprint(d)).toBe('WINV26|BUY|2026-08-18T14:46:17|3');
  });
});

describe('linkOrdersToCreatedTrade', () => {
  it('liga as 4 ordens do batch ao trade recém-criado — inclusive o aumento de posição', async () => {
    const { db, updates } = makeDb(ordersOfBatch());
    const result = await linkOrdersToCreatedTrade(db, { tradeId: 'tradeNovo', trade });

    expect(result.skipped).toBe(false);
    expect(result.linked).toBe(4);
    expect(updates.map(u => u.id).sort()).toEqual(['o1', 'o2', 'o3', 'o4']);
    for (const u of updates) {
      expect(u.patch.correlatedTradeId).toBe('tradeNovo');
      expect(u.patch.correlationSource).toBe('import_created');
    }
  });

  it('nunca sobrescreve correlação existente', async () => {
    const docs = ordersOfBatch();
    docs[0] = orderDoc('o1', { ...docs[0].data(), correlatedTradeId: 'outroTrade' });

    const { db, updates } = makeDb(docs);
    const result = await linkOrdersToCreatedTrade(db, { tradeId: 'tradeNovo', trade });

    expect(result.linked).toBe(3);
    expect(updates.map(u => u.id)).not.toContain('o1');
  });

  it('não toca ordem do batch que não casa com nenhuma parcial', async () => {
    const docs = [
      ...ordersOfBatch(),
      orderDoc('outro', { instrument: 'WDOV26', side: 'BUY', filledAt: '2026-08-18T11:00:00', filledQuantity: 1, batchId: 'batch-18-08', correlatedTradeId: null }),
    ];
    const { db, updates } = makeDb(docs);
    await linkOrdersToCreatedTrade(db, { tradeId: 'tradeNovo', trade });

    expect(updates.map(u => u.id)).not.toContain('outro');
  });

  it('skipa trade que não veio do Order Import', async () => {
    const { db, commits } = makeDb(ordersOfBatch());
    const result = await linkOrdersToCreatedTrade(db, {
      tradeId: 'tradeManual',
      trade: { ...trade, source: 'manual', importBatchId: null },
    });

    expect(result.skipped).toBe(true);
    expect(commits).toHaveLength(0);
  });

  it('skipa trade do import sem parciais', async () => {
    const { db, commits } = makeDb(ordersOfBatch());
    const result = await linkOrdersToCreatedTrade(db, {
      tradeId: 'tradeSemParciais',
      trade: { ...trade, _partials: [] },
    });

    expect(result.skipped).toBe(true);
    expect(commits).toHaveLength(0);
  });
});
