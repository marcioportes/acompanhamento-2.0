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
    expect(res).toEqual({ written: 0, scanned: 0, preserved: 0 });
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
    expect(res).toEqual({ written: 0, scanned: 0, preserved: 0 });
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


/**
 * #451 — trade discutido é imutável também no servidor.
 *
 * O discutido continua ALIMENTANDO o cálculo (padrões de janela do vizinho dependem dele),
 * mas a gravação pula e conta em `preserved`.
 */
describe('#451 — trade DISCUSSED não é regravado', () => {
  const massaMista = () => [
    { ...clusterTrades()[0], status: 'DISCUSSED' },
    { ...clusterTrades()[1], status: 'CLOSED' },
    { id: 'T3', studentId: 'S1', date: '2026-05-05', side: 'C', entryTime: '2026-05-05T10:00:00', exitTime: '2026-05-05T10:20:00', result: 400, qty: 2, ticker: 'WIN', planId: 'P1', status: 'REVIEWED' },
    { id: 'T4', studentId: 'S1', date: '2026-05-06', side: 'C', entryTime: '2026-05-06T10:00:00', exitTime: '2026-05-06T10:20:00', result: 100, qty: 2, ticker: 'WIN', planId: 'P1' },
  ];

  it('massa mista: discutido não é escrito, os demais são; preserved correto', async () => {
    const { db, writes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, { trades: massaMista(), plans });
    expect(writes.map((w) => w.id).sort()).toEqual(['T2', 'T3', 'T4']);
    expect(res).toEqual({ written: 3, scanned: 4, preserved: 1 });
  });

  it('o discutido continua no cálculo: cluster do vizinho segue detectado', async () => {
    const { db, writes } = makeMockDb();
    await recomputeBehaviorProfiles(db, admin, { trades: massaMista(), plans });
    const t2 = writes.find((w) => w.id === 'T2').data.behaviorProfile;
    const cluster = t2.families.find((f) => f.canonicalCode === 'IMPULSE_CLUSTER');
    expect(cluster).toBeTruthy();
    expect(cluster.evidence.clusterCount).toBe(2);

    // Mesmo fingerprint de quando ninguém está discutido.
    const semTrava = makeMockDb();
    await recomputeBehaviorProfiles(semTrava.db, admin, { trades: clusterTrades(), plans });
    expect(t2.fingerprint).toBe(semTrava.writes.find((w) => w.id === 'T2').data.behaviorProfile.fingerprint);
  });

  it('discutido fora do writeScope não conta como preservado', async () => {
    const { db, writes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, { trades: massaMista(), plans, writeScope: ['T3'] });
    expect(writes.map((w) => w.id)).toEqual(['T3']);
    expect(res.preserved).toBe(0);
  });

  it('todos discutidos → nenhum commit, preserved = total', async () => {
    const { db, writes, commitSizes } = makeMockDb();
    const trades = massaMista().map((t) => ({ ...t, status: 'DISCUSSED' }));
    const res = await recomputeBehaviorProfiles(db, admin, { trades, plans });
    expect(res).toEqual({ written: 0, scanned: 4, preserved: 4 });
    expect(writes.length).toBe(0);
    expect(commitSizes.length).toBe(0);
  });

  it('lote > BATCH_LIMIT com discutidos intercalados não quebra', async () => {
    const trades = Array.from({ length: 1000 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0');
      const hh = String(9 + (i % 8)).padStart(2, '0');
      return {
        id: `B${i}`, studentId: 'S1', date: `2026-04-${day}`, side: 'C',
        entryTime: `2026-04-${day}T${hh}:${String(i % 60).padStart(2, '0')}:00`,
        exitTime: `2026-04-${day}T${hh}:${String(i % 60).padStart(2, '0')}:30`,
        result: i % 2 ? 50 : -50, qty: 1, ticker: 'WIN', planId: 'P1',
        status: i % 3 === 0 ? 'DISCUSSED' : 'CLOSED',
      };
    });
    const { db, writes, commitSizes } = makeMockDb();
    const res = await recomputeBehaviorProfiles(db, admin, { trades, plans });
    const discutidos = trades.filter((t) => t.status === 'DISCUSSED').length;
    expect(res.preserved).toBe(discutidos);
    expect(res.written).toBe(1000 - discutidos);
    expect(writes.length).toBe(res.written);
    expect(writes.some((w) => trades[Number(w.id.slice(1))].status === 'DISCUSSED')).toBe(false);
    expect(commitSizes.length).toBe(3);
    for (const n of commitSizes) expect(n).toBeLessThanOrEqual(450);
  });

  it('recomputeBehaviorForStudent devolve preserved dos docs carregados', async () => {
    const { db, writes } = makeFetchMockDb({ trades: massaMista(), plans });
    const res = await recomputeBehaviorForStudent(db, admin, 'S1');
    expect(res.preserved).toBe(1);
    expect(writes.some((w) => w.id === 'T1')).toBe(false);
  });
});
