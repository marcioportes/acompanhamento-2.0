/**
 * useReviewMaturitySnapshot.test.jsx
 * @description Testes do hook que busca o maturitySnapshot da review atual
 *              + o da review CLOSED/ARCHIVED imediatamente anterior do mesmo plano.
 *              Issue #119 task 16 / Fase E2.
 * @see src/hooks/useReviewMaturitySnapshot.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const whereCalls = [];
const orderByCalls = [];
const limitCalls = [];
let getDocsImpl = () => Promise.resolve({ docs: [] });

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => {
    whereCalls.push(args);
    return { __type: 'where', args };
  },
  orderBy: (...args) => {
    orderByCalls.push(args);
    return { __type: 'orderBy', args };
  },
  limit: (n) => {
    limitCalls.push(n);
    return { __type: 'limit', n };
  },
  getDocs: (...args) => getDocsImpl(...args),
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import { useReviewMaturitySnapshot } from '../../hooks/useReviewMaturitySnapshot';

const makeReview = (overrides = {}) => ({
  id: 'rev-N',
  status: 'CLOSED',
  weekStart: '2026-04-20',
  planId: 'plan-1',
  frozenSnapshot: {
    planContext: { planId: 'plan-1' },
    maturitySnapshot: {
      currentStage: 2,
      dimensionScores: { emotional: 70, financial: 60, operational: 55, maturity: 40, composite: 52 },
      gates: [],
      frozenAt: '2026-04-23T10:00:00.000Z',
    },
  },
  ...overrides,
});

describe('useReviewMaturitySnapshot', () => {
  beforeEach(() => {
    whereCalls.length = 0;
    orderByCalls.length = 0;
    limitCalls.length = 0;
    getDocsImpl = () => Promise.resolve({ docs: [] });
  });

  it('retorna current=null, previous=null, loading=false quando studentId é null', () => {
    const review = makeReview();
    const { result } = renderHook(() => useReviewMaturitySnapshot(null, review, 'plan-1'));
    expect(result.current.current).toBeNull();
    expect(result.current.previous).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('retorna current=null quando currentReview não tem frozenSnapshot.maturitySnapshot', async () => {
    const review = makeReview({ frozenSnapshot: { planContext: { planId: 'plan-1' } } });
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.current).toBeNull();
    expect(result.current.previous).toBeNull();
  });

  it('não dispara query quando review.status !== "CLOSED"', async () => {
    const getDocsSpy = vi.fn(() => Promise.resolve({ docs: [] }));
    getDocsImpl = getDocsSpy;
    const review = makeReview({ status: 'DRAFT' });
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    // Espera tick
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDocsSpy).not.toHaveBeenCalled();
    // current ainda vem do frozenSnapshot (mesmo que não vá comparar, o consumer pode querer)
    expect(result.current.previous).toBeNull();
  });

  it('em CLOSED + plan match, popula previous com maturitySnapshot da review anterior', async () => {
    const prevReview = {
      id: 'rev-N-1',
      weekStart: '2026-04-13',
      planId: 'plan-1',
      status: 'CLOSED',
      frozenSnapshot: {
        planContext: { planId: 'plan-1' },
        maturitySnapshot: {
          currentStage: 1,
          dimensionScores: { emotional: 50, financial: 45, operational: 40, maturity: 20, composite: 38 },
          gates: [],
          frozenAt: '2026-04-16T10:00:00.000Z',
        },
      },
    };
    getDocsImpl = () => Promise.resolve({
      docs: [
        // primeiro é a própria review atual, deve ser ignorada
        { id: 'rev-N', data: () => makeReview() },
        { id: 'rev-N-1', data: () => prevReview },
      ],
    });

    const review = makeReview();
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.current).toEqual(review.frozenSnapshot.maturitySnapshot);
    expect(result.current.previous).toEqual(prevReview.frozenSnapshot.maturitySnapshot);
  });

  it('aplica filtros: status in [CLOSED, ARCHIVED] + orderBy weekStart desc + limit 20', async () => {
    const review = makeReview();
    renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(whereCalls.length).toBeGreaterThan(0));
    const statusWhere = whereCalls.find((a) => a[0] === 'status');
    expect(statusWhere).toBeDefined();
    expect(statusWhere[1]).toBe('in');
    expect(statusWhere[2]).toEqual(['CLOSED', 'ARCHIVED']);
    const orderBy = orderByCalls.find((a) => a[0] === 'weekStart');
    expect(orderBy).toBeDefined();
    expect(orderBy[1]).toBe('desc');
    expect(limitCalls).toContain(20);
  });

  it('ignora doc da própria review atual (não compara consigo mesma)', async () => {
    const review = makeReview();
    getDocsImpl = () => Promise.resolve({
      docs: [{ id: 'rev-N', data: () => review }],
    });
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.previous).toBeNull();
  });

  it('ignora docs com weekStart >= currentWeekStart', async () => {
    const review = makeReview({ weekStart: '2026-04-13' });
    const futureReview = {
      weekStart: '2026-04-20', planId: 'plan-1', status: 'CLOSED',
      frozenSnapshot: { planContext: { planId: 'plan-1' }, maturitySnapshot: { currentStage: 3, dimensionScores: {}, gates: [] } },
    };
    getDocsImpl = () => Promise.resolve({
      docs: [{ id: 'rev-future', data: () => futureReview }],
    });
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.previous).toBeNull();
  });

  it('faz match via frozenSnapshot.planContext.planId quando top-level planId é stale', async () => {
    const prevReview = {
      weekStart: '2026-04-13',
      planId: 'plan-legacy',
      status: 'CLOSED',
      frozenSnapshot: {
        planContext: { planId: 'plan-1' },
        maturitySnapshot: { currentStage: 1, dimensionScores: {}, gates: [] },
      },
    };
    getDocsImpl = () => Promise.resolve({
      docs: [{ id: 'rev-N-1', data: () => prevReview }],
    });
    const review = makeReview();
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.previous).toEqual(prevReview.frozenSnapshot.maturitySnapshot);
  });

  it('getDocs throws → error preenchido e previous=null', async () => {
    getDocsImpl = () => Promise.reject(new Error('permission-denied'));
    const review = makeReview();
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.previous).toBeNull();
  });

  it('quando previous.maturitySnapshot é ausente (review legada sem task 15), previous=null', async () => {
    const legacyReview = {
      weekStart: '2026-04-13',
      planId: 'plan-1',
      status: 'CLOSED',
      frozenSnapshot: { planContext: { planId: 'plan-1' } /* sem maturitySnapshot */ },
    };
    getDocsImpl = () => Promise.resolve({
      docs: [{ id: 'rev-legacy', data: () => legacyReview }],
    });
    const review = makeReview();
    const { result } = renderHook(() => useReviewMaturitySnapshot('student-1', review, 'plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.previous).toBeNull();
    expect(result.current.current).toEqual(review.frozenSnapshot.maturitySnapshot);
  });
});
