/**
 * ingestBatch — idempotência da ingestão (issue #362).
 *
 * Antes: `doc(collection(db,'orders'))` gerava id automático e o payload não guardava
 * `externalOrderId`. Sem chave natural nem id previsível, reimportar o mesmo arquivo
 * criava um conjunto novo de docs. Em produção a mesma perna de stop apareceu em 3
 * batches; a limpeza de 19/08/2026 apagou 154 documentos nascidos assim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeOrderDocId } from '../../utils/orderKey';

const calls = { set: [], docPaths: [], autoIds: 0, staging: [] };

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'S1', email: 'aluno@x.com' }, isMentor: () => false }),
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ __col: name }),
  doc: (...args) => {
    // doc(db, 'orders', id) → id explícito · doc(collection) → id automático
    if (args.length === 3) { calls.docPaths.push(args[2]); return { id: args[2] }; }
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
  writeBatch: () => ({
    set: (ref, payload, opts) => calls.set.push({ id: ref.id, payload, opts }),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }),
}));

const ingest = async (stagingOrders, batchId = 'b1', correlations = {}) => {
  calls.staging = stagingOrders;
  const { renderHook } = await import('@testing-library/react');
  const { default: useOrderStaging } = await import('../../hooks/useOrderStaging');
  const { result } = renderHook(() => useOrderStaging());
  return result.current.ingestBatch(batchId, correlations, null);
};

const ordem = {
  id: 'stg1', studentId: 'S1', planId: 'P1',
  externalOrderId: 'NELO.3200520260818135831126523',
  instrument: 'WINV26', side: 'SELL', quantity: 5, status: 'CANCELLED',
  submittedAt: '2026-08-18T13:58:31', filledAt: null, isStopOrder: true,
};

beforeEach(() => { calls.set = []; calls.docPaths = []; calls.autoIds = 0; });

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
