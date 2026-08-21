/**
 * purgeOrphanOrders.test.js — v1.83.16
 *
 * Regra de produto (Marcio, 20/08/2026): **ordem só existe atrelada a trade vivo**.
 * Sem trade, a ordem não é registro — é lixo. Importar o que casa ou cria trade fica;
 * o resto morre. Não existe ordem sem trade no banco.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { purgeOrphanOrders, isOrphan } = require('../../orders/purgeOrphanOrders');

const AGORA = new Date('2026-08-20T18:00:00.000Z');
const minutosAtras = (m) => ({ toDate: () => new Date(AGORA.getTime() - m * 60_000) });

const orderDoc = (id, data) => ({ id, ref: { id }, data: () => data });

/** db falso: `orders` pagináveis + lookup de trades por id. */
const makeDb = (orders, tradesVivos = []) => {
  const deleted = [];
  const updated = [];
  const vivos = new Set(tradesVivos);
  const db = {
    collection: (name) => {
      if (name === 'trades') {
        const snap = { empty: vivos.size === 0, docs: [...vivos].map(id => orderDoc(id, {})) };
        return {
          get: async () => snap,
          doc: (id) => ({ get: async () => ({ exists: vivos.has(id) }) }),
          where: () => ({ get: async () => snap }),
        };
      }
      return {
        where: () => ({ get: async () => ({ empty: orders.length === 0, docs: orders }) }),
        get: async () => ({ empty: orders.length === 0, docs: orders, size: orders.length }),
      };
    },
    batch: () => ({
      delete: (ref) => deleted.push(ref.id),
      update: (ref, patch) => updated.push({ id: ref.id, patch }),
      commit: async () => {},
    }),
  };
  return { db, deleted, updated };
};

describe('isOrphan', () => {
  const vivos = new Set(['T1']);

  it('ordem ligada a trade vivo NÃO é órfã', () => {
    expect(isOrphan({ correlatedTradeId: 'T1', importedAt: minutosAtras(120) }, vivos, AGORA)).toBe(false);
  });

  it('ordem sem correlação é órfã', () => {
    expect(isOrphan({ correlatedTradeId: null, importedAt: minutosAtras(120) }, vivos, AGORA)).toBe(true);
  });

  it('ordem apontando para trade que não existe mais é órfã', () => {
    expect(isOrphan({ correlatedTradeId: 'T-MORTO', importedAt: minutosAtras(120) }, vivos, AGORA)).toBe(true);
  });

  it('ordem recém-importada é poupada — o import ainda está em curso', () => {
    // A correlação server-side (linkOrdersToCreatedTrade) roda em onTradeCreated, que é
    // assíncrona. Sem carência a varredura apagaria a ordem no intervalo entre a
    // ingestão e a criação do trade — matando o import que está funcionando.
    expect(isOrphan({ correlatedTradeId: null, importedAt: minutosAtras(2) }, vivos, AGORA)).toBe(false);
  });

  it('ordem sem importedAt é tratada como antiga, não como recente', () => {
    expect(isOrphan({ correlatedTradeId: null, importedAt: null }, vivos, AGORA)).toBe(true);
  });
});

describe('purgeOrphanOrders', () => {
  it('apaga as órfãs e preserva as ligadas a trade vivo', async () => {
    const orders = [
      orderDoc('viva', { correlatedTradeId: 'T1', importedAt: minutosAtras(60) }),
      orderDoc('semTrade', { correlatedTradeId: null, importedAt: minutosAtras(60) }),
      orderDoc('tradeMorto', { correlatedTradeId: 'T-MORTO', importedAt: minutosAtras(60) }),
    ];
    const { db, deleted } = makeDb(orders, ['T1']);

    const r = await purgeOrphanOrders(db, { now: AGORA });

    expect(deleted).toEqual(['semTrade', 'tradeMorto']);
    expect(r.deleted).toBe(2);
    expect(r.kept).toBe(1);
  });

  it('escopo por batch só olha aquele lote', async () => {
    const orders = [orderDoc('o1', { batchId: 'B1', correlatedTradeId: null, importedAt: minutosAtras(60) })];
    const { db, deleted } = makeDb(orders, ['T1']);

    await purgeOrphanOrders(db, { batchId: 'B1', now: AGORA });

    expect(deleted).toEqual(['o1']);
  });

  it('escopo por batch ignora a carência — o import acabou de terminar', async () => {
    // Quando o próprio import chama a purga, ele já esperou a correlação: o que ficou
    // órfão ali ficou órfão de verdade, e segurar por 15min só adiaria o lixo.
    const orders = [orderDoc('o1', { batchId: 'B1', correlatedTradeId: null, importedAt: minutosAtras(1) })];
    const { db, deleted } = makeDb(orders, ['T1']);

    await purgeOrphanOrders(db, { batchId: 'B1', now: AGORA });

    expect(deleted).toEqual(['o1']);
  });

  it('não apaga nada quando todas têm trade vivo', async () => {
    const orders = [orderDoc('a', { correlatedTradeId: 'T1', importedAt: minutosAtras(60) })];
    const { db, deleted } = makeDb(orders, ['T1']);

    const r = await purgeOrphanOrders(db, { now: AGORA });

    expect(deleted).toEqual([]);
    expect(r.deleted).toBe(0);
  });

  it('aborta se `trades` vier vazia — credencial ou projeto errado apagaria tudo', async () => {
    const orders = [orderDoc('a', { correlatedTradeId: 'T1', importedAt: minutosAtras(60) })];
    const { db, deleted } = makeDb(orders, []);

    await expect(purgeOrphanOrders(db, { now: AGORA })).rejects.toThrow(/trades/i);
    expect(deleted).toEqual([]);
  });

  it('dryRun conta sem apagar', async () => {
    const orders = [orderDoc('semTrade', { correlatedTradeId: null, importedAt: minutosAtras(60) })];
    const { db, deleted } = makeDb(orders, ['T1']);

    const r = await purgeOrphanOrders(db, { now: AGORA, dryRun: true });

    expect(deleted).toEqual([]);
    expect(r.deleted).toBe(1);
    expect(r.dryRun).toBe(true);
  });
});

describe('purgeOrphanOrders — vínculo decidido pelo cliente', () => {
  const cancelada = orderDoc('stopCancelado', {
    batchId: 'B1',
    externalOrderId: 'CL-STOP',
    instrument: 'WINV26', side: 'SELL', quantity: 5,
    submittedAt: '2026-08-20T11:46:45', filledAt: null,
    status: 'CANCELLED',
    correlatedTradeId: null,
    importedAt: minutosAtras(1),
  });

  it('ordem CANCELADA sobrevive quando o cliente informa o trade', async () => {
    // Sem isto ela morreria: linkOrdersToCreatedTrade casa por fingerprint com filledAt,
    // que ordem cancelada não tem. É a evidência de stop tampering e hesitação.
    const { db, deleted, updated } = makeDb([cancelada], ['T1']);

    const r = await purgeOrphanOrders(db, { batchId: 'B1', links: { 'eid:CL-STOP': 'T1' }, now: AGORA });

    expect(deleted).toEqual([]);
    expect(r.linked).toBe(1);
    expect(r.kept).toBe(1);
    expect(updated[0]).toMatchObject({ id: 'stopCancelado', patch: { correlatedTradeId: 'T1', correlationSource: 'import_decision' } });
  });

  it('vínculo apontando para trade inexistente não salva a ordem', async () => {
    const { db, deleted } = makeDb([cancelada], ['T1']);

    const r = await purgeOrphanOrders(db, { batchId: 'B1', links: { 'eid:CL-STOP': 'T-FANTASMA' }, now: AGORA });

    expect(deleted).toEqual(['stopCancelado']);
    expect(r.linked).toBe(0);
  });

  it('ordem do lote fora do mapa de vínculos morre', async () => {
    const semDecisao = orderDoc('solta', {
      batchId: 'B1', externalOrderId: 'CL-OUTRA', correlatedTradeId: null, importedAt: minutosAtras(1),
    });
    const { db, deleted } = makeDb([cancelada, semDecisao], ['T1']);

    await purgeOrphanOrders(db, { batchId: 'B1', links: { 'eid:CL-STOP': 'T1' }, now: AGORA });

    expect(deleted).toEqual(['solta']);
  });

  it('não sobrescreve correlação existente para trade vivo', async () => {
    const jaLigada = orderDoc('ok', {
      batchId: 'B1', externalOrderId: 'CL-STOP', correlatedTradeId: 'T1', importedAt: minutosAtras(1),
    });
    const { db, deleted } = makeDb([jaLigada], ['T1', 'T2']);

    const r = await purgeOrphanOrders(db, { batchId: 'B1', links: { 'eid:CL-STOP': 'T2' }, now: AGORA });

    expect(r.linked).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('chave composta casa quando não há externalOrderId (paridade com o cliente)', async () => {
    const legada = orderDoc('legada', {
      batchId: 'B1', externalOrderId: null,
      instrument: 'WINV26', side: 'SELL', quantity: 5,
      submittedAt: '2026-08-20T11:46:45', filledAt: null,
      correlatedTradeId: null, importedAt: minutosAtras(1),
    });
    const { db, deleted } = makeDb([legada], ['T1']);

    const r = await purgeOrphanOrders(db, {
      batchId: 'B1',
      links: { 'comp:WINV26|SELL|2026-08-20T11:46:45|5|': 'T1' },
      now: AGORA,
    });

    expect(r.linked).toBe(1);
    expect(deleted).toEqual([]);
  });
});
