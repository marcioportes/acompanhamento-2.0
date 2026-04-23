import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMaturityRecompute } from '../../../../functions/maturity/recomputeMaturity';

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

describe('runMaturityRecompute', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('trade status=OPEN → skipped reason="status != CLOSED"', async () => {
    const { db } = makeMockDb({});
    const r = await runMaturityRecompute(db, {
      tradeId: 't1',
      trade: { status: 'OPEN', studentId: 's1' },
    });
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('status != CLOSED');
  });

  it('trade sem studentId → skipped reason="missing studentId"', async () => {
    const { db } = makeMockDb({});
    const r = await runMaturityRecompute(db, {
      tradeId: 't1',
      trade: { status: 'CLOSED' },
    });
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('missing studentId');
  });

  it('student sem assessment → fallback baseline neutro + stageCurrent=1', async () => {
    const { db, batch, writes } = makeMockDb({
      assessment: undefined,
      currentMaturity: undefined,
      trades: [
        { id: 't1', studentId: 's1', status: 'CLOSED', date: '2026-04-23', result: 100, planId: 'p1', notes: 'note', stopLoss: 50 },
      ],
      plans: [{ id: 'p1', studentId: 's1', initialBalance: 10000 }],
    });

    const r = await runMaturityRecompute(db, {
      tradeId: 't1',
      trade: { status: 'CLOSED', studentId: 's1' },
      admin: fakeAdmin,
    });

    expect(r.skipped).toBe(false);
    expect(r.studentId).toBe('s1');
    expect(r.currentStage).toBe(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(2);
  });

  it('happy path → batch.commit chamado 1× com 2 docs (current + history)', async () => {
    const trades = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      studentId: 's1',
      status: 'CLOSED',
      date: `2026-04-${String((i % 23) + 1).padStart(2, '0')}`,
      result: i % 2 === 0 ? 100 : -50,
      planId: 'p1',
      notes: 'an entry note',
      stopLoss: 50,
    }));
    const { db, batch, writes } = makeMockDb({
      assessment: { stage: 2, dimensionScores: { emotional: 60, financial: 55, operational: 50 } },
      currentMaturity: { currentStage: 2 },
      trades,
      plans: [{ id: 'p1', studentId: 's1', initialBalance: 10000 }],
    });

    const r = await runMaturityRecompute(db, {
      tradeId: 't1',
      trade: { status: 'CLOSED', studentId: 's1' },
      admin: fakeAdmin,
    });

    expect(r.skipped).toBe(false);
    expect(r.currentStage).toBe(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(2);
    expect(writes[0].opts).toEqual({ merge: true });
    expect(writes[1].opts).toEqual({ merge: true });
    // Verifica que current e history foram escritos
    expect(writes.some((w) => w.ref?.path?.endsWith('/maturity/current'))).toBe(true);
    expect(writes.some((w) => w.ref?.path?.includes('/_historyBucket/history/'))).toBe(true);
  });

  it('exception durante fetch → skipped reason="exception", não propaga', async () => {
    const { db } = makeMockDb({ throwOn: 'trades' });
    const r = await runMaturityRecompute(db, {
      tradeId: 't1',
      trade: { status: 'CLOSED', studentId: 's1' },
      admin: fakeAdmin,
    });
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('exception');
    expect(r.error).toMatch(/trades fetch failed/);
  });
});
