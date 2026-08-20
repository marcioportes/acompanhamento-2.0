/**
 * ingestBatch — idempotência da ingestão (#362) e gravação pós-decisão (#366).
 *
 * #362 — Antes: `doc(collection(db,'orders'))` gerava id automático e o payload não
 * guardava `externalOrderId`. Sem chave natural nem id previsível, reimportar o mesmo
 * arquivo criava um conjunto novo de docs. Em produção a mesma perna de stop apareceu
 * em 3 batches; a limpeza de 19/08/2026 apagou 154 documentos nascidos assim.
 *
 * #366 — O id determinístico transformou reimportação em `set(merge)` sobre doc
 * existente, que as rules avaliam como *update* (`allow update: if false`) e negam o
 * writeBatch inteiro. A saída é pular o que já existe: toda escrita vira `create`,
 * que já é permitido, sem abrir `update` numa collection de `create` aberto e id
 * adivinhável a partir do UID.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeOrderDocId, makeOrderKey } from '../../utils/orderKey';

const calls = { set: [], deletes: [], docPaths: [], autoIds: 0, staging: [], batchOps: [] };

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'S1', email: 'aluno@x.com' }, isMentor: () => false }),
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ __col: name }),
  doc: (...args) => {
    // doc(db, 'orders', id) → id explícito · doc(collection) → id automático
    if (args.length === 3) { calls.docPaths.push(args[2]); return { id: args[2], __col: args[1] }; }
    calls.autoIds += 1;
    return { id: `auto-${calls.autoIds}` };
  },
  query: (...c) => ({ c }),
  where: () => ({}),
  orderBy: () => ({}),
  onSnapshot: () => () => {},
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({
    empty: calls.staging.length === 0,
    docs: calls.staging.map((d) => ({ id: d.id, data: () => d })),
  })),
  serverTimestamp: () => '__ts__',
  writeBatch: () => {
    // Cada writeBatch conta as próprias operações — o teto do Firestore é por batch.
    const contador = { ops: 0 };
    calls.batchOps.push(contador);
    return {
      set: (ref, payload, opts) => { contador.ops += 1; calls.set.push({ id: ref.id, payload, opts }); },
      update: vi.fn(),
      delete: (ref) => { contador.ops += 1; calls.deletes.push(ref.id); },
      commit: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

const ingest = async (stagingOrders, batchId = 'b1', correlations = {}, options = undefined) => {
  calls.staging = stagingOrders;
  const { renderHook } = await import('@testing-library/react');
  const { default: useOrderStaging } = await import('../../hooks/useOrderStaging');
  const { result } = renderHook(() => useOrderStaging());
  return result.current.ingestBatch(batchId, correlations, options?.confirmedOrderKeys ?? null, options);
};

const ordem = {
  id: 'stg1', studentId: 'S1', planId: 'P1',
  externalOrderId: 'NELO.3200520260818135831126523',
  instrument: 'WINV26', side: 'SELL', quantity: 5, status: 'CANCELLED',
  submittedAt: '2026-08-18T13:58:31', filledAt: null, isStopOrder: true,
};

beforeEach(() => {
  calls.set = []; calls.deletes = []; calls.docPaths = []; calls.autoIds = 0; calls.batchOps = [];
});

describe('ingestBatch — idempotência (#362)', () => {
  it('grava com id determinístico, não automático', async () => {
    await ingest([ordem]);

    expect(calls.autoIds).toBe(0);
    expect(calls.docPaths[0]).toBe(makeOrderDocId(ordem, 'S1'));
  });

  it('reimportar o mesmo arquivo escreve no MESMO doc', async () => {
    await ingest([ordem]);
    const primeiro = calls.docPaths[0];
    calls.docPaths = [];
    await ingest([{ ...ordem, id: 'stg2' }], 'batch-2');

    expect(calls.docPaths[0]).toBe(primeiro);
  });

  it('grava o externalOrderId — a chave que permite auditar de volta no broker', async () => {
    await ingest([ordem]);
    expect(calls.set[0].payload.externalOrderId).toBe(ordem.externalOrderId);
  });

  it('não apaga correlação existente quando a reimportação vem sem correlação', async () => {
    // A CF do #351 fase D e o backfill gravam correlatedTradeId server-side. Escrever
    // `null` por cima devolveria a ordem ao estado órfão.
    await ingest([ordem], 'b1', {});
    expect('correlatedTradeId' in calls.set[0].payload).toBe(false);
    expect(calls.set[0].opts).toEqual({ merge: true });
  });

  it('grava a correlação quando ela existe', async () => {
    await ingest([ordem], 'b1', { stg1: { tradeId: 'T9', confidence: 0.9 } });
    expect(calls.set[0].payload.correlatedTradeId).toBe('T9');
    expect(calls.set[0].payload.correlationConfidence).toBe(0.9);
  });
});

describe('ingestBatch — gravação pós-decisão (#366)', () => {
  it('pula doc que já existe em `orders` — nenhuma escrita que as rules leriam como update', async () => {
    const existingKeys = new Set([makeOrderKey(ordem)]);
    const r = await ingest([ordem], 'b1', {}, { existingKeys });

    expect(calls.set).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('doc já existente sai do staging — o rascunho não fica preso', async () => {
    const existingKeys = new Set([makeOrderKey(ordem)]);
    await ingest([ordem], 'b1', {}, { existingKeys });

    expect(calls.deletes).toContain('stg1');
  });

  it('batch já ingerido resolve em vez de lançar — o retry não morre aqui', async () => {
    // Se createTradesBatch falhar depois do ingest, o aluno reenvia: o staging já
    // está vazio e o `throw` de antes matava o retry com as ordens já gravadas.
    const r = await ingest([], 'b1');

    expect(r.alreadyIngested).toBe(true);
    expect(r.success).toBe(0);
  });

  it('nenhum writeBatch passa do teto de 500 operações', async () => {
    // Cada ordem confirmada gera set + delete: com BATCH_SIZE 450 eram 900 ops.
    const lote = Array.from({ length: 520 }, (_, i) => ({
      ...ordem, id: `stg-${i}`, externalOrderId: `CL-${i}`,
    }));
    await ingest(lote);

    expect(calls.batchOps.length).toBeGreaterThan(1);
    for (const b of calls.batchOps) expect(b.ops).toBeLessThanOrEqual(500);
  });

  it('aceita correlação por chave canônica da ordem', async () => {
    // O passo final conhece a decisão do aluno por orderKey, não por id de staging.
    await ingest([ordem], 'b1', { [makeOrderKey(ordem)]: { tradeId: 'T7', confidence: 1 } });

    expect(calls.set[0].payload.correlatedTradeId).toBe('T7');
  });

  it('ordem fora da lista confirmada é deletada do staging e não ingerida', async () => {
    await ingest([ordem], 'b1', {}, { confirmedOrderKeys: ['eid:OUTRA'] });

    expect(calls.set).toHaveLength(0);
    expect(calls.deletes).toContain('stg1');
  });

  it.skip('DT: fills múltiplos do mesmo externalOrderId colapsam num doc só', async () => {
    // aggregateFills agrupa N fills sob um externalOrderId; com id determinístico os N
    // viram writes no mesmo doc (last-write-wins) e o fingerprint por filledQuantity de
    // linkOrdersToCreatedTrade deixa de bater. Pré-existente ao #362, fora do escopo #366.
    const fills = [1, 2, 3].map(i => ({ ...ordem, id: `stg-${i}`, filledQuantity: i }));
    await ingest(fills);

    expect(new Set(calls.docPaths).size).toBe(3);
  });
});
