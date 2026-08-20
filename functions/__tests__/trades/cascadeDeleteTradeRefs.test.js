/**
 * cascadeDeleteTradeRefs.test.js — issue #363 fase A
 * Cascata de deleção: tudo que aponta para o trade morre com ele.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { cascadeDeleteTradeRefs, SCALAR_REFS } = require('../../trades/cascadeDeleteTradeRefs');

const TRADE_ID = 'trade-abc';

const docRef = (id) => ({ id });
const docOf = (id) => ({ id, ref: docRef(id) });

/**
 * db falso. `byCollection` mapeia nome da collection → ids retornados pela query.
 * Registra os `where` recebidos e os deletes efetivamente commitados.
 */
const makeDb = (byCollection, { failOn = null, failCommitAfter = null } = {}) => {
  const queries = [];
  const deleted = [];
  const commits = [];
  const db = {
    collection: (name) => ({
      where: (field, op, value) => {
        queries.push({ collection: name, field, op, value });
        return {
          get: async () => {
            if (failOn === name) throw new Error(`boom em ${name}`);
            const ids = byCollection[name] || [];
            return { docs: ids.map(docOf) };
          },
        };
      },
    }),
    batch: () => {
      const pending = [];
      return {
        delete: (ref) => pending.push(ref.id),
        commit: async () => {
          if (failCommitAfter !== null && commits.length >= failCommitAfter) {
            throw new Error('deadline-exceeded');
          }
          commits.push(pending.length);
          deleted.push(...pending);
        },
      };
    },
  };
  return { db, queries, deleted, commits };
};

describe('cascadeDeleteTradeRefs', () => {
  it('apaga movements, orders e notifications do trade', async () => {
    const { db, deleted } = makeDb({
      movements: ['m1', 'm2'],
      orders: ['o1', 'o2', 'o3'],
      notifications: ['n1'],
    });

    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(r.skipped).toBe(false);
    expect(r.movements).toBe(2);
    expect(r.orders).toBe(3);
    expect(r.notifications).toBe(1);
    expect(r.errors).toEqual([]);
    expect(deleted).toEqual(['m1', 'm2', 'o1', 'o2', 'o3', 'n1']);
  });

  it('consulta cada collection pelo campo que aponta para o trade', async () => {
    const { db, queries } = makeDb({});
    await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(queries).toEqual([
      { collection: 'movements', field: 'tradeId', op: '==', value: TRADE_ID },
      { collection: 'orders', field: 'correlatedTradeId', op: '==', value: TRADE_ID },
      { collection: 'notifications', field: 'tradeId', op: '==', value: TRADE_ID },
    ]);
  });

  it('APAGA o doc de orders — não zera o correlatedTradeId (DEC-AUTO-363-01)', async () => {
    const { db, deleted } = makeDb({ orders: ['o1'] });
    // o db falso não expõe `update`: qualquer tentativa de desvincular quebraria o teste
    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(r.orders).toBe(1);
    expect(deleted).toContain('o1');
  });

  it('trade sem referência nenhuma não é erro', async () => {
    const { db, deleted, commits } = makeDb({});
    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(r).toMatchObject({ skipped: false, movements: 0, orders: 0, notifications: 0 });
    expect(r.errors).toEqual([]);
    expect(deleted).toEqual([]);
    expect(commits).toEqual([]); // não abre batch vazio
  });

  it('sem tradeId, pula sem tocar no banco', async () => {
    const { db, queries } = makeDb({ movements: ['m1'] });
    const r = await cascadeDeleteTradeRefs(db, {});

    expect(r.skipped).toBe(true);
    expect(queries).toEqual([]);
  });

  it('sem argumento nenhum, pula em vez de estourar', async () => {
    const { db } = makeDb({});
    await expect(cascadeDeleteTradeRefs(db)).resolves.toMatchObject({ skipped: true });
  });

  it('falha num alvo não impede os outros e o erro não some (INV-03)', async () => {
    const { db, deleted } = makeDb(
      { movements: ['m1'], orders: ['o1'], notifications: ['n1'] },
      { failOn: 'orders' }
    );

    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(r.movements).toBe(1);
    expect(r.orders).toBe(0);
    expect(r.notifications).toBe(1); // seguiu depois da falha
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('orders');
    expect(r.errors[0]).toContain('boom');
    expect(deleted).toEqual(['m1', 'n1']);
  });

  it('quebra em batches de 400 — 5.129 notificações não vão num commit só', async () => {
    const ids = Array.from({ length: 5129 }, (_, i) => `n${i}`);
    const { db, deleted, commits } = makeDb({ notifications: ids });

    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    expect(r.notifications).toBe(5129);
    expect(deleted).toHaveLength(5129);
    expect(commits).toEqual([400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 329]);
    expect(Math.max(...commits)).toBeLessThanOrEqual(500); // limite duro do Firestore
  });

  it('falha no meio da paginação reporta o que JÁ foi apagado, não zero', async () => {
    const ids = Array.from({ length: 5129 }, (_, i) => `n${i}`);
    const { db, deleted } = makeDb({ notifications: ids }, { failCommitAfter: 6 });

    const r = await cascadeDeleteTradeRefs(db, { tradeId: TRADE_ID });

    // 6 lotes de 400 saíram do banco antes do estouro; reportar 0 inverteria o log
    // em relação à realidade — 2.400 apagados, 2.729 ainda órfãos.
    expect(deleted).toHaveLength(2400);
    expect(r.notifications).toBe(2400);
    expect(r.errors[0]).toContain('deadline-exceeded');
  });

  it('a ordem de execução é movements → orders → notifications', () => {
    expect(SCALAR_REFS.map((r) => r.key)).toEqual(['movements', 'orders', 'notifications']);
  });
});
