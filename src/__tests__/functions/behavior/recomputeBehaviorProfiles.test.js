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

/**
 * #389 — separar "com que dados calcular" de "o que regravar".
 *
 * A janela era um input escondido: o botão do mentor recalculava com um dia e o gatilho
 * automático com o histórico inteiro, produzindo perfis diferentes para o mesmo trade.
 * Agora o cálculo usa sempre o conjunto recebido e `writeScope` decide o que é gravado.
 */
describe('#389 — writeScope', () => {
  const historico = () => [
    ...clusterTrades(),
    { id: 'T3', studentId: 'S1', date: '2026-05-05', side: 'C', entryTime: '2026-05-05T10:00:00', exitTime: '2026-05-05T10:20:00', result: 400, qty: 2, ticker: 'WIN', planId: 'P1' },
  ];

  it('calcula com tudo e grava só o recorte pedido', async () => {
    const { db, writes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, {
      trades: historico(), plans, writeScope: new Set(['T3']),
    });
    expect(writes.map((w) => w.id)).toEqual(['T3']);
    expect(res.written).toBe(1);
    // `scanned` continua refletindo o universo calculado, não o gravado.
    expect(res.scanned).toBe(3);
  });

  it('aceita array além de Set', async () => {
    const { db, writes } = makeMockDb();
    await recomputeBehaviorProfiles(db, admin, {
      trades: historico(), plans, writeScope: ['T1'],
    });
    expect(writes.map((w) => w.id)).toEqual(['T1']);
  });

  it('sem writeScope, comportamento antigo preservado — grava todos', async () => {
    const { db, writes } = makeMockDb();
    await recomputeBehaviorProfiles(db, admin, { trades: historico(), plans });
    expect(writes.map((w) => w.id).sort()).toEqual(['T1', 'T2', 'T3']);
  });

  it('o perfil gravado com writeScope é IDÊNTICO ao gravado sem ele', async () => {
    // O contrato do issue: o recorte muda o que é escrito, nunca o conteúdo.
    const a = makeMockDb();
    await recomputeBehaviorProfiles(a.db, admin, { trades: historico(), plans, writeScope: ['T3'] });
    const b = makeMockDb();
    await recomputeBehaviorProfiles(b.db, admin, { trades: historico(), plans });

    const perfilA = a.writes.find((w) => w.id === 'T3').data.behaviorProfile;
    const perfilB = b.writes.find((w) => w.id === 'T3').data.behaviorProfile;
    expect(perfilA.fingerprint).toBe(perfilB.fingerprint);
  });
});

