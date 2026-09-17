/**
 * tradeWritesImmutability.test.js — escritas vivas de `index.js` em trades passam pela trava (#451).
 *
 * Carrega o `index.js` REAL com `firebase-admin` substituído por um Firestore em memória e
 * chama os handlers via `.run()` (firebase-functions v1). Cobre `addFeedbackComment`,
 * `closeTrade`, `onTradeCreated` e `onTradeUpdated`: discutido → nenhuma escrita no trade;
 * não discutido → o mesmo patch de antes.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── Firestore em memória ─────────────────────────────────────────────────────
let store;       // path → data
let tradeWrites; // [{ id, patch }] — só updates em trades/*
let autoId;

const snapOf = (ref) => ({ id: ref.id, ref, exists: store.has(ref.path), data: () => store.get(ref.path) });

function docRef(path) {
  const id = path.split('/').pop();
  const ref = {
    id,
    path,
    get: async () => snapOf(ref),
    update: async (patch) => {
      if (path.startsWith('trades/')) tradeWrites.push({ id, patch });
      store.set(path, { ...(store.get(path) || {}), ...patch });
    },
    set: async (data) => { store.set(path, data); },
    collection: (name) => collectionRef(`${path}/${name}`),
  };
  return ref;
}

function collectionRef(path) {
  const children = () => [...store.keys()]
    .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
    .map((k) => snapOf(docRef(k)));
  const query = {
    get: async () => { const docs = children(); return { docs, empty: docs.length === 0, size: docs.length }; },
    where: () => query,
    limit: () => query,
  };
  return {
    ...query,
    doc: (id) => docRef(`${path}/${id ?? `auto${++autoId}`}`),
    add: async (data) => { const r = docRef(`${path}/auto${++autoId}`); store.set(r.path, data); return r; },
  };
}

const fakeDb = {
  collection: (name) => collectionRef(name),
  runTransaction: async (fn) => fn({
    get: (ref) => ref.get(),
    set: (ref, data) => { store.set(ref.path, data); },
    update: (ref, patch) => { store.set(ref.path, { ...(store.get(ref.path) || {}), ...patch }); },
  }),
};

const firestore = () => fakeDb;
firestore.FieldValue = {
  serverTimestamp: () => 'TS',
  arrayUnion: (...items) => ({ arrayUnion: items }),
  delete: () => 'DELETE',
  increment: (n) => ({ increment: n }),
};

let fns;
beforeAll(() => {
  const adminPath = require.resolve('firebase-admin');
  require.cache[adminPath] = {
    id: adminPath, filename: adminPath, loaded: true,
    exports: { apps: [{}], initializeApp: () => {}, firestore, auth: () => ({}), storage: () => ({}) },
  };
  fns = require('../../index.js');
});

beforeEach(() => {
  store = new Map();
  tradeWrites = [];
  autoId = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const PRESERVED = (fn, id) => `[${fn}] trade ${id} DISCUSSED — escrita preservada (#451)`;
const mentorCtx = { auth: { uid: 'm', token: { email: 'marcio.portes@me.com', name: 'Marcio' } } };
const studentCtx = { auth: { uid: 's1', token: { email: 'aluno@x.com', name: 'Aluno' } } };
const seedTrade = (id, data) => store.set(`trades/${id}`, data);

// ── addFeedbackComment ───────────────────────────────────────────────────────
describe('addFeedbackComment', () => {
  it('DISCUSSED sem newStatus (mentor): não grava, não notifica, erro de pré-condição', async () => {
    seedTrade('t1', { status: 'DISCUSSED', studentId: 's1' });
    await expect(fns.addFeedbackComment.run({ tradeId: 't1', content: 'oi' }, mentorCtx))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(tradeWrites).toEqual([]);
    expect([...store.keys()].some((k) => k.startsWith('notifications/'))).toBe(false);
    expect(console.log).toHaveBeenCalledWith(PRESERVED('addFeedbackComment', 't1'));
  });

  it('DISCUSSED com newStatus: mantém o erro de transição de antes', async () => {
    seedTrade('t1', { status: 'DISCUSSED' });
    await expect(fns.addFeedbackComment.run({ tradeId: 't1', content: 'x', newStatus: 'CLOSED' }, studentCtx))
      .rejects.toMatchObject({ code: 'failed-precondition', message: 'Transição inválida: DISCUSSED → CLOSED' });
    expect(tradeWrites).toEqual([]);
  });

  it('OPEN (mentor): grava o mesmo patch de antes', async () => {
    seedTrade('t1', { status: 'OPEN', studentId: 's1' });
    const res = await fns.addFeedbackComment.run({ tradeId: 't1', content: 'bom' }, mentorCtx);
    expect(res).toMatchObject({ success: true, status: 'REVIEWED' });
    expect(tradeWrites).toHaveLength(1);
    expect(tradeWrites[0].patch).toMatchObject({
      status: 'REVIEWED', updatedAt: 'TS', mentorFeedback: 'bom', feedbackDate: 'TS',
    });
    expect(tradeWrites[0].patch.feedbackHistory.arrayUnion[0]).toMatchObject({ content: 'bom', authorRole: 'mentor' });
  });
});

// ── closeTrade ───────────────────────────────────────────────────────────────
describe('closeTrade', () => {
  it('DISCUSSED: não vira CLOSED, erro de pré-condição', async () => {
    seedTrade('t1', { status: 'DISCUSSED', studentEmail: 'aluno@x.com' });
    await expect(fns.closeTrade.run({ tradeId: 't1' }, studentCtx))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(tradeWrites).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(PRESERVED('closeTrade', 't1'));
  });

  it('REVIEWED: grava CLOSED como antes', async () => {
    seedTrade('t1', { status: 'REVIEWED', studentEmail: 'aluno@x.com' });
    expect(await fns.closeTrade.run({ tradeId: 't1' }, studentCtx)).toEqual({ success: true, status: 'CLOSED' });
    expect(tradeWrites).toEqual([{
      id: 't1',
      patch: { status: 'CLOSED', closedAt: 'TS', closedBy: 'aluno@x.com', updatedAt: 'TS' },
    }]);
  });
});

// ── onTradeCreated ───────────────────────────────────────────────────────────
describe('onTradeCreated', () => {
  const createdSnap = (id, data) => { seedTrade(id, data); return snapOf(docRef(`trades/${id}`)); };

  it('doc nascido DISCUSSED: não reescreve status/compliance', async () => {
    const snap = createdSnap('t1', { status: 'DISCUSSED', stopLoss: 10, studentId: 's1' });
    await fns.onTradeCreated.run(snap, { params: { tradeId: 't1' } });
    expect(tradeWrites).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(PRESERVED('onTradeCreated', 't1'));
  });

  it('trade novo: grava o mesmo patch de antes', async () => {
    const snap = createdSnap('t1', { stopLoss: 10, studentId: 's1' });
    await fns.onTradeCreated.run(snap, { params: { tradeId: 't1' } });
    expect(tradeWrites).toHaveLength(1);
    expect(tradeWrites[0].patch).toMatchObject({
      status: 'OPEN', feedbackHistory: [], hasRedFlags: true, createdAt: 'TS',
    });
    expect(tradeWrites[0].patch.redFlags.map((f) => f.type)).toEqual(['TRADE_SEM_PLANO']);
  });
});

// ── onTradeUpdated ───────────────────────────────────────────────────────────
describe('onTradeUpdated', () => {
  const run = (id, before, after) => {
    seedTrade(id, after);
    const change = {
      before: { data: () => before },
      after: snapOf(docRef(`trades/${id}`)),
    };
    return fns.onTradeUpdated.run(change, { params: { tradeId: id } });
  };
  const plan = { riskPerOperation: 1, pl: 10000, currentPl: 10000, rrTarget: 2, blockedEmotions: [] };

  it('INV-03 — evento da transição do publishReview (REVIEWED → DISCUSSED) não escreve nada', async () => {
    const base = { studentId: 's1', planId: 'p1', reviewId: 'r1', stopLoss: 90, entry: 100, result: -50 };
    await run('t1', { ...base, status: 'REVIEWED' }, { ...base, status: 'DISCUSSED', updatedAt: 'TS' });
    expect(tradeWrites).toEqual([]);
    expect(console.log).not.toHaveBeenCalledWith(PRESERVED('onTradeUpdated', 't1'));
  });

  const lockedEdit = (status) => ({
    before: { status, planId: 'p1', stopLoss: 90, importBatchId: 'b0', _lockedByMentor: true },
    after: { status, planId: 'p1', stopLoss: 95, importBatchId: 'b1', _lockedByMentor: true },
  });

  it('DISCUSSED com dado alterado: compliance e destrava por import preservados', async () => {
    store.set('plans/p1', plan);
    const { before, after } = lockedEdit('DISCUSSED');
    await run('t1', before, after);
    expect(tradeWrites).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(PRESERVED('onTradeUpdated', 't1'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Compliance recalculado'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Lock destravado'));
  });

  it('REVIEWED com dado alterado: grava compliance e destrava como antes', async () => {
    store.set('plans/p1', plan);
    const { before, after } = lockedEdit('REVIEWED');
    await run('t1', before, after);
    expect(tradeWrites).toHaveLength(2);
    expect(Object.keys(tradeWrites[0].patch).sort())
      .toEqual(['compliance', 'hasRedFlags', 'redFlags', 'riskPercent', 'rrAssumed', 'rrRatio']);
    expect(tradeWrites[1].patch).toEqual({
      _lockedByMentor: false,
      _unlockedAt: 'TS',
      _unlockedBy: { uid: 'system', email: null, reason: 'import:b1' },
    });
  });

  it('entrada em REVIEWED (aluno alpha): carimba reviewId e limpa _pendingReviewNote como antes', async () => {
    store.set('students/s1/subscriptions/sub1', { type: 'paid', status: 'active', plan: 'mentoria' });
    store.set('plans/p1', { studentId: 's1', activeDraftReviewId: 'r7' });
    store.set('students/s1/reviews/r7', { status: 'DRAFT', sessionNotes: '' });
    const base = { studentId: 's1', planId: 'p1' };
    await run('t1', { ...base, status: 'OPEN' }, { ...base, status: 'REVIEWED', _pendingReviewNote: 'nota' });
    expect(tradeWrites.map((w) => w.patch)).toEqual([{ reviewId: 'r7' }, { _pendingReviewNote: 'DELETE' }]);
    expect(store.get('students/s1/reviews/r7').sessionNotes).toBe('nota');
  });
});
