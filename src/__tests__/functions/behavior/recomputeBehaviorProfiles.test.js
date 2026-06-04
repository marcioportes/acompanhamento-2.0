/**
 * recomputeBehaviorProfiles — camada de persistência (Fase 2 #301). Valida:
 *  - grava `behaviorProfile` em trades sem profile;
 *  - pula trades cujo fingerprint não mudou (idempotência → anti-loop/custo);
 *  - escreve SOMENTE o campo `behaviorProfile` (garantia anti-loop: fora do guard
 *    de onTradeUpdated, sem result/plan/compliance → não re-dispara);
 *  - propaga `computedBy`.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { recomputeBehaviorProfiles, recomputeBehaviorForStudent } = require(
  '../../../../functions/behavior/recomputeBehaviorProfiles.js',
);

const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };

const makeMockDb = () => {
  const writes = [];
  const commitSizes = [];
  const db = {
    collection: () => ({ doc: (id) => ({ __id: id }) }),
    batch: () => {
      const ops = [];
      return {
        update: (ref, data) => ops.push({ id: ref.__id, data }),
        commit: async () => { writes.push(...ops); commitSizes.push(ops.length); },
      };
    },
  };
  return { db, writes, commitSizes };
};

const clusterTrades = () => [
  { id: 'T1', studentId: 'S1', date: '2026-05-04', side: 'C', entryTime: '2026-05-04T09:00:00', exitTime: '2026-05-04T09:05:00', result: -200, qty: 2, ticker: 'WIN', planId: 'P1' },
  { id: 'T2', studentId: 'S1', date: '2026-05-04', side: 'C', entryTime: '2026-05-04T09:07:00', exitTime: '2026-05-04T09:12:00', result: -150, qty: 2, ticker: 'WIN', planId: 'P1' },
];
const plans = [{ id: 'P1', riskPerOperation: 1.0, rrTarget: 2, pl: 20000 }];

describe('recomputeBehaviorProfiles — persistência', () => {
  it('retorna {written:0,scanned:0} para trades vazio', async () => {
    const { db, writes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, { trades: [] });
    expect(res).toEqual({ written: 0, scanned: 0 });
    expect(writes.length).toBe(0);
  });

  it('grava behaviorProfile em trades sem profile prévio', async () => {
    const { db, writes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, { trades: clusterTrades(), plans });
    expect(res.written).toBeGreaterThan(0);
    expect(writes.length).toBe(res.written);
    for (const w of writes) {
      expect(w.data.behaviorProfile).toBeTruthy();
      expect(w.data.behaviorProfile.computedBy).toBe('auto');
      expect(w.data.behaviorProfile.computedAt).toBe('TS');
    }
  });

  it('escreve SOMENTE o campo behaviorProfile (garantia anti-loop)', async () => {
    const { db, writes } = makeMockDb();
    await recomputeBehaviorProfiles(db, admin, { trades: clusterTrades(), plans });
    for (const w of writes) {
      // nenhum campo do guard de onTradeUpdated pode aparecer no update
      expect(Object.keys(w.data)).toEqual(['behaviorProfile']);
    }
  });

  it('é idempotente: re-run com fingerprint igual não grava nada', async () => {
    // 1ª passada captura os profiles gravados
    const first = makeMockDb();
    await recomputeBehaviorProfiles(first.db, admin, { trades: clusterTrades(), plans });

    // injeta os profiles gravados de volta nos trades e re-roda
    const writtenById = new Map(first.writes.map((w) => [w.id, w.data.behaviorProfile]));
    const tradesWithProfile = clusterTrades().map((t) => ({ ...t, behaviorProfile: writtenById.get(t.id) }));

    const second = makeMockDb();
    const res = await recomputeBehaviorProfiles(second.db, admin, { trades: tradesWithProfile, plans });
    expect(res.written).toBe(0);
    expect(second.writes.length).toBe(0);
  });

  it('propaga computedBy (ex: backfill)', async () => {
    const { db, writes } = makeMockDb();
    await recomputeBehaviorProfiles(db, admin, { trades: clusterTrades(), plans, computedBy: 'backfill' });
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w.data.behaviorProfile.computedBy).toBe('backfill');
  });
});

// Mock db que serve queries por coleção (p/ a variante com fetch — on-plan-change).
const makeFetchMockDb = ({ trades = [], plans = [], orders = [], emotions = [] }) => {
  const writes = [];
  const snap = (arr) => ({ docs: arr.map((o) => ({ id: o.id, data: () => o })) });
  const byName = { trades, plans, orders, emotions };
  const db = {
    collection: (name) => ({
      where: () => ({ get: async () => snap(byName[name] || []) }),
      get: async () => snap(byName[name] || []),
      doc: (id) => ({ __id: id }),
    }),
    batch: () => {
      const ops = [];
      return { update: (ref, data) => ops.push({ id: ref.__id, data }), commit: async () => { writes.push(...ops); } };
    },
  };
  return { db, writes };
};

describe('recomputeBehaviorForStudent — variante com fetch (on-plan-change)', () => {
  it('studentId vazio → no-op', async () => {
    const { db, writes } = makeFetchMockDb({});
    const res = await recomputeBehaviorForStudent(db, admin, null);
    expect(res).toEqual({ written: 0, scanned: 0 });
    expect(writes.length).toBe(0);
  });

  it('carrega trades/plans e grava behaviorProfile', async () => {
    const { db, writes } = makeFetchMockDb({ trades: clusterTrades(), plans });
    const res = await recomputeBehaviorForStudent(db, admin, 'S1', { computedBy: 'auto' });
    expect(res.written).toBeGreaterThan(0);
    expect(writes.length).toBe(res.written);
    for (const w of writes) {
      expect(Object.keys(w.data)).toEqual(['behaviorProfile']);
      expect(w.data.behaviorProfile.computedBy).toBe('auto');
    }
  });
});
