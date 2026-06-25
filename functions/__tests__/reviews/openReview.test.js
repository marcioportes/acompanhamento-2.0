/**
 * openReview.test.js — #269 v2
 *
 * Cobre buildOpenReviewDoc (shape) e getOrCreateOpenReview (idempotência via ponteiro
 * plan.activeDraftReviewId).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getOrCreateOpenReview, buildOpenReviewDoc } = require('../../reviews/openReview');

function makeDb(planData) {
  const setCalls = [];
  const updateCalls = [];
  const reviewRef = { id: 'NEW-REVIEW' };
  const planRef = { _kind: 'plan' };
  const db = {
    collection: (name) => ({
      doc: () => {
        if (name === 'plans') return planRef;
        if (name === 'students') {
          return { collection: () => ({ doc: () => reviewRef }) };
        }
        return {};
      },
    }),
    runTransaction: async (cb) => cb({
      get: async () => ({ exists: planData !== null, data: () => planData }),
      set: (ref, data) => setCalls.push({ ref, data }),
      update: (ref, data) => updateCalls.push({ ref, data }),
    }),
  };
  return { db, setCalls, updateCalls, reviewRef, planRef };
}

describe('buildOpenReviewDoc', () => {
  it('nasce DRAFT, sem includedTradeIds, com placeholders de período', () => {
    const doc = buildOpenReviewDoc('s1', 'p1', '2026-06-19');
    expect(doc.status).toBe('DRAFT');
    expect(doc.studentId).toBe('s1');
    expect(doc.planId).toBe('p1');
    expect(doc.sequenceNumber).toBeNull();
    expect(doc.periodStart).toBeNull();
    expect(doc.weekStart).toBe('2026-06-19'); // placeholder p/ ordenação
    expect(doc.source).toBe('backlog');
    expect('includedTradeIds' in doc).toBe(false); // morreu no v2
  });
});

describe('getOrCreateOpenReview', () => {
  it('cria a revisão e seta o ponteiro quando o plano não tem uma aberta', async () => {
    const { db, setCalls, updateCalls } = makeDb({ studentId: 's1', activeDraftReviewId: null });
    const res = await getOrCreateOpenReview(db, 's1', 'p1', '2026-06-19');

    expect(res).toEqual({ reviewId: 'NEW-REVIEW', created: true });
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data.status).toBe('DRAFT');
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].data).toEqual({ activeDraftReviewId: 'NEW-REVIEW' });
  });

  it('reusa a revisão aberta (idempotente) sem criar outra', async () => {
    const { db, setCalls, updateCalls } = makeDb({ studentId: 's1', activeDraftReviewId: 'EXISTING' });
    const res = await getOrCreateOpenReview(db, 's1', 'p1', '2026-06-19');

    expect(res).toEqual({ reviewId: 'EXISTING', created: false });
    expect(setCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });

  it('rejeita plano de outro aluno', async () => {
    const { db } = makeDb({ studentId: 'outro', activeDraftReviewId: null });
    await expect(getOrCreateOpenReview(db, 's1', 'p1', '2026-06-19')).rejects.toThrow(/não pertence/i);
  });

  it('rejeita plano inexistente', async () => {
    const { db } = makeDb(null);
    await expect(getOrCreateOpenReview(db, 's1', 'p1', '2026-06-19')).rejects.toThrow(/não encontrado/i);
  });
});
