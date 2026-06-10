/**
 * deleteStudentData.test.js — issue #309
 *
 * Cobre as 3 lacunas fechadas pela cascata de hard-delete do aluno:
 *   (1) movements por accountId — TRADE_RESULT (tem studentId) E
 *       DEPOSIT/INITIAL_BALANCE/ADJUSTMENT (só accountId) ambos apagados;
 *   (2) cycleClosures (studentId) apagado;
 *   (3) Storage trades/{tradeId}/ best-effort (não aborta se falhar).
 * Dados de OUTRO aluno (accounts/movements/cycleClosures/trades) sobrevivem.
 *
 * Fake-Firestore in-memory (sem emulador), no estilo CJS dos testes de functions.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deleteStudentData } = require('../../students/deleteStudentData');

// ── Fake Firestore ──────────────────────────────────────────────────────────

function makeFakeDb(seed) {
  const store = {};
  for (const [coll, docs] of Object.entries(seed)) {
    store[coll] = new Map(docs.map((d) => [d.id, { ...d }]));
  }

  const docRef = (coll, id) => ({
    id,
    __coll: coll,
    __id: id,
    listCollections: async () => [], // sem subcollections nas fixtures
    delete: async () => { (store[coll] || new Map()).delete(id); },
  });

  class Query {
    constructor(coll, filters = [], limitN = null) {
      this.coll = coll;
      this.filters = filters;
      this.limitN = limitN;
    }
    where(field, op, value) {
      return new Query(this.coll, [...this.filters, { field, op, value }], this.limitN);
    }
    limit(n) {
      return new Query(this.coll, this.filters, n);
    }
    doc(id) {
      return docRef(this.coll, id);
    }
    async get() {
      const map = store[this.coll] || new Map();
      let docs = [...map.entries()].map(([id, data]) => ({ id, data }));
      for (const f of this.filters) {
        docs = docs.filter((d) => {
          const val = d.data[f.field];
          if (f.op === '==') return val === f.value;
          if (f.op === 'in') return f.value.includes(val);
          return true;
        });
      }
      if (this.limitN != null) docs = docs.slice(0, this.limitN);
      const wrapped = docs.map((d) => ({ id: d.id, data: () => d.data, ref: docRef(this.coll, d.id) }));
      return { empty: wrapped.length === 0, size: wrapped.length, docs: wrapped };
    }
  }

  const batch = () => {
    const ops = [];
    return {
      delete(ref) { ops.push(ref); return this; },
      async commit() { for (const r of ops) (store[r.__coll] || new Map()).delete(r.__id); ops.length = 0; },
    };
  };

  return {
    store,
    collection: (name) => new Query(name),
    batch,
  };
}

const ids = (store, coll) => [...(store[coll] || new Map()).keys()].sort();

// ── Fixtures: aluno S1 (alvo) + S2 (sobrevive) ──────────────────────────────

function seedTwoStudents() {
  return {
    students: [{ id: 'S1' }, { id: 'S2' }],
    accounts: [
      { id: 'A1', studentId: 'S1' },
      { id: 'A2', studentId: 'S1' },
      { id: 'A3', studentId: 'S2' },
    ],
    movements: [
      { id: 'm1', accountId: 'A1', studentId: 'S1', type: 'TRADE_RESULT' }, // tem studentId
      { id: 'm2', accountId: 'A1', type: 'DEPOSIT' },                       // só accountId
      { id: 'm3', accountId: 'A2', type: 'INITIAL_BALANCE' },               // só accountId
      { id: 'm4', accountId: 'A1', type: 'ADJUSTMENT' },                    // só accountId
      { id: 'm9', accountId: 'A3', type: 'DEPOSIT' },                       // de S2 — sobrevive
    ],
    cycleClosures: [
      { id: 'c1', studentId: 'S1', accountId: 'A1' },
      { id: 'c2', studentId: 'S2', accountId: 'A3' }, // sobrevive
    ],
    trades: [
      { id: 't1', studentId: 'S1' },
      { id: 't2', studentId: 'S1' },
      { id: 't3', studentId: 'S2' }, // sobrevive
    ],
    notifications: [{ id: 'n1', studentId: 'S1' }],
  };
}

function fakeBucket() {
  const prefixes = [];
  return {
    prefixes,
    deleteFiles: async ({ prefix }) => { prefixes.push(prefix); },
  };
}

// ── Testes ──────────────────────────────────────────────────────────────────

describe('deleteStudentData (issue #309)', () => {
  it('apaga movements por accountId (TRADE_RESULT com studentId E DEPOSIT/INITIAL/ADJUST só accountId)', async () => {
    const db = makeFakeDb(seedTwoStudents());
    const bucket = fakeBucket();

    await deleteStudentData({ db, bucket, sid: 'S1' });

    // m1 (TRADE_RESULT), m2 (DEPOSIT), m3 (INITIAL_BALANCE), m4 (ADJUSTMENT) de S1 apagados;
    // m9 (de S2) sobrevive.
    expect(ids(db.store, 'movements')).toEqual(['m9']);
  });

  it('apaga TRADE_RESULT órfão (studentId mas account já deletado avulso)', async () => {
    const seed = seedTwoStudents();
    // m5: TRADE_RESULT de S1 cujo account 'GONE' não está em accounts (orfão).
    seed.movements.push({ id: 'm5', accountId: 'GONE', studentId: 'S1', type: 'TRADE_RESULT' });
    const db = makeFakeDb(seed);
    await deleteStudentData({ db, bucket: fakeBucket(), sid: 'S1' });
    // m5 não cai por accountId (GONE fora de [A1,A2]) mas cai pelo passe por studentId.
    expect(ids(db.store, 'movements')).toEqual(['m9']);
  });

  it('apaga cycleClosures do aluno e preserva os de outro aluno', async () => {
    const db = makeFakeDb(seedTwoStudents());
    await deleteStudentData({ db, bucket: fakeBucket(), sid: 'S1' });
    expect(ids(db.store, 'cycleClosures')).toEqual(['c2']);
  });

  it('apaga trades/accounts/notifications/students do aluno e isola o outro aluno', async () => {
    const db = makeFakeDb(seedTwoStudents());
    await deleteStudentData({ db, bucket: fakeBucket(), sid: 'S1' });
    expect(ids(db.store, 'trades')).toEqual(['t3']);
    expect(ids(db.store, 'accounts')).toEqual(['A3']);
    expect(ids(db.store, 'notifications')).toEqual([]);
    expect(ids(db.store, 'students')).toEqual(['S2']);
  });

  it('limpa Storage trades/{tradeId}/ para cada trade do aluno', async () => {
    const db = makeFakeDb(seedTwoStudents());
    const bucket = fakeBucket();
    await deleteStudentData({ db, bucket, sid: 'S1' });
    expect(bucket.prefixes.sort()).toEqual(['trades/t1/', 'trades/t2/']);
  });

  it('Storage é best-effort: falha no bucket não aborta a cascata (DEC-AUTO-309-01)', async () => {
    const db = makeFakeDb(seedTwoStudents());
    const explodingBucket = { deleteFiles: async () => { throw new Error('storage down'); } };

    await expect(deleteStudentData({ db, bucket: explodingBucket, sid: 'S1' })).resolves.toBeTruthy();
    // Dados Firestore ainda apagados apesar da falha de Storage.
    expect(ids(db.store, 'students')).toEqual(['S2']);
    expect(ids(db.store, 'movements')).toEqual(['m9']);
  });

  it('bucket null não quebra (Storage opcional)', async () => {
    const db = makeFakeDb(seedTwoStudents());
    await expect(deleteStudentData({ db, bucket: null, sid: 'S1' })).resolves.toBeTruthy();
    expect(ids(db.store, 'students')).toEqual(['S2']);
  });

  it('aluno sem contas nem movements: cascata não quebra e remove o doc', async () => {
    const db = makeFakeDb({ students: [{ id: 'S1' }], trades: [], accounts: [], movements: [] });
    const counts = await deleteStudentData({ db, bucket: fakeBucket(), sid: 'S1' });
    expect(ids(db.store, 'students')).toEqual([]);
    expect(counts.students).toBe(1);
  });

  it('retorna counts por coleção', async () => {
    const db = makeFakeDb(seedTwoStudents());
    const counts = await deleteStudentData({ db, bucket: fakeBucket(), sid: 'S1' });
    expect(counts.movements).toBe(4);          // m1..m4
    expect(counts['top:cycleClosures']).toBe(1);
    expect(counts['top:trades']).toBe(2);
    expect(counts['top:accounts']).toBe(2);
    expect(counts['storage:trades']).toBe(2);
    expect(counts.students).toBe(1);
  });
});
