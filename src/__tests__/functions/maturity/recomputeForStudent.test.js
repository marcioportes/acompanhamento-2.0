import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recomputeForStudent } from '../../../../functions/maturity/recomputeMaturity';

const fakeAdmin = {
  firestore: {
    FieldValue: { serverTimestamp: () => ({ __sentinel: 'serverTimestamp' }) },
    Timestamp: { fromDate: (d) => ({ __sentinel: 'timestamp', seconds: Math.floor(d.getTime() / 1000) }) },
  },
};

function makeDocSnap(data) {
  return {
    exists: data !== undefined && data !== null,
    data: () => data,
  };
}

function makeQuerySnap(docs) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d, id: undefined }) })),
  };
}

function makeMockDb({ assessment, currentMaturity, trades, plans, throwOn } = {}) {
  const writes = [];
  const batch = {
    set: (ref, doc, opts) => {
      writes.push({ ref, doc, opts });
      return batch;
    },
    commit: vi.fn(async () => undefined),
  };

  function studentSubcollection(studentId, name) {
    if (name === 'assessment') {
      return {
        doc: (docId) => ({
          get: async () => {
            if (throwOn === 'assessment') throw new Error('assessment fetch failed');
            if (docId === 'initial_assessment') return makeDocSnap(assessment);
            return makeDocSnap(undefined);
          },
        }),
      };
    }
    if (name === 'maturity') {
      return {
        doc: (docId) => {
          if (docId === 'current') {
            return {
              get: async () => makeDocSnap(currentMaturity),
              path: `students/${studentId}/maturity/current`,
            };
          }
          if (docId === '_historyBucket') {
            return {
              collection: (sub) => ({
                doc: (id) => ({ path: `students/${studentId}/maturity/_historyBucket/${sub}/${id}` }),
              }),
            };
          }
          return { path: `students/${studentId}/maturity/${docId}` };
        },
      };
    }
    return { doc: () => ({ get: async () => makeDocSnap(undefined) }) };
  }

  const db = {
    collection(name) {
      if (name === 'students') {
        return {
          doc: (studentId) => ({
            collection: (sub) => studentSubcollection(studentId, sub),
          }),
        };
      }
      if (name === 'trades') {
        const where = () => ({
          where: () => ({
            get: async () => {
              if (throwOn === 'trades') throw new Error('trades fetch failed');
              return makeQuerySnap(trades ?? []);
            },
          }),
        });
        return { where };
      }
      if (name === 'plans') {
        return {
          where: () => ({
            get: async () => {
              if (throwOn === 'plans') throw new Error('plans fetch failed');
              return makeQuerySnap(plans ?? []);
            },
          }),
        };
      }
      return { doc: () => ({ get: async () => makeDocSnap(undefined) }) };
    },
    batch: () => batch,
  };

  return { db, batch, writes };
}

describe('recomputeForStudent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('aluno sem assessment → fallback baseline {50,50,50} e stageCurrent=1', async () => {
    const { db, batch, writes } = makeMockDb({
      assessment: undefined,
      currentMaturity: undefined,
      trades: [
        { id: 't1', studentId: 's1', status: 'CLOSED', date: '2026-04-23', result: 50, planId: 'p1', notes: 'n', stopLoss: 20 },
      ],
      plans: [{ id: 'p1', studentId: 's1', initialBalance: 10000 }],
    });

    const r = await recomputeForStudent(db, 's1', { admin: fakeAdmin });

    expect(r.skipped).toBe(false);
    expect(r.studentId).toBe('s1');
    expect(r.tradeId).toBe(null); // lastTradeId não foi passado → null
    expect(r.currentStage).toBe(1); // stageCurrent = baselineStage default
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(2);
  });

  it('aluno com assessment e maturity/current → stageCurrent do current', async () => {
    const { db, batch, writes } = makeMockDb({
      assessment: { stage: 2, dimensionScores: { emotional: 60, financial: 55, operational: 50 } },
      currentMaturity: { currentStage: 3 },
      trades: [
        { id: 't1', studentId: 's2', status: 'CLOSED', date: '2026-04-23', result: 100, planId: 'p1', notes: 'n', stopLoss: 50 },
      ],
      plans: [{ id: 'p1', studentId: 's2', initialBalance: 10000 }],
    });

    const r = await recomputeForStudent(db, 's2', { lastTradeId: 'tX', admin: fakeAdmin });

    expect(r.skipped).toBe(false);
    expect(r.studentId).toBe('s2');
    expect(r.tradeId).toBe('tX');
    expect(r.currentStage).toBe(3); // lê do doc current, não do assessment
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(2);
  });

  it('batch.commit grava 2 refs: maturity/current e _historyBucket/history/{date}', async () => {
    const { db, batch, writes } = makeMockDb({
      assessment: { stage: 2, dimensionScores: { emotional: 60, financial: 55, operational: 50 } },
      currentMaturity: { currentStage: 2 },
      trades: [
        { id: 't1', studentId: 's3', status: 'CLOSED', date: '2026-04-23', result: 100, planId: 'p1', notes: 'n', stopLoss: 50 },
      ],
      plans: [{ id: 'p1', studentId: 's3', initialBalance: 10000 }],
    });

    await recomputeForStudent(db, 's3', { lastTradeId: null, admin: fakeAdmin });

    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(2);
    expect(writes[0].opts).toEqual({ merge: true });
    expect(writes[1].opts).toEqual({ merge: true });
    expect(writes.some((w) => w.ref?.path?.endsWith('/maturity/current'))).toBe(true);
    expect(writes.some((w) => w.ref?.path?.includes('/_historyBucket/history/'))).toBe(true);
  });

  it('exception durante fetch → skipped reason="exception" (não propaga)', async () => {
    const { db } = makeMockDb({ throwOn: 'plans' });
    const r = await recomputeForStudent(db, 's4', { admin: fakeAdmin });

    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('exception');
    expect(r.error).toMatch(/plans fetch failed/);
  });

  it('lastTradeId null (default) → retorno tradeId=null (uso típico de backfill)', async () => {
    const { db } = makeMockDb({
      assessment: { stage: 1, dimensionScores: { emotional: 50, financial: 50, operational: 50 } },
      currentMaturity: undefined,
      trades: [],
      plans: [],
    });

    const r = await recomputeForStudent(db, 's5', { admin: fakeAdmin });

    expect(r.skipped).toBe(false);
    expect(r.tradeId).toBe(null);
    expect(r.studentId).toBe('s5');
  });
});
