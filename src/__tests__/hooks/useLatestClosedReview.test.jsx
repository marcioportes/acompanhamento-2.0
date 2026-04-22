/**
 * useLatestClosedReview.test.jsx
 * @description Testes do hook que lê a última review CLOSED do aluno
 *              (issue #164 — E1: SwotAnalysis consome review.swot).
 * @see src/hooks/useLatestClosedReview.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnSnapshot = vi.fn();
const whereCalls = [];
const orderByCalls = [];
const limitCalls = [];

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
  onSnapshot: (q, onNext, onError) => {
    mockOnSnapshot(q, onNext, onError);
    return () => {};
  },
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import useLatestClosedReview from '../../hooks/useLatestClosedReview';

describe('useLatestClosedReview', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear();
    whereCalls.length = 0;
    orderByCalls.length = 0;
    limitCalls.length = 0;
  });

  it('não dispara listener e retorna review=null, loading=false quando studentId é null', () => {
    const { result } = renderHook(() => useLatestClosedReview(null));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.review).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('inscreve onSnapshot quando studentId é fornecido', () => {
    renderHook(() => useLatestClosedReview('student-1'));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('aplica where(status == CLOSED), orderBy(weekStart desc) e limit(20)', () => {
    renderHook(() => useLatestClosedReview('student-1'));
    const statusWhere = whereCalls.find(args => args[0] === 'status');
    expect(statusWhere).toBeDefined();
    expect(statusWhere[1]).toBe('==');
    expect(statusWhere[2]).toBe('CLOSED');
    const orderBy = orderByCalls.find(args => args[0] === 'weekStart');
    expect(orderBy).toBeDefined();
    expect(orderBy[1]).toBe('desc');
    // v1.1.0: query broader, filtro de planId é client-side (resiliente a planId stale)
    expect(limitCalls).toContain(20);
  });

  it('filtro de planId é aplicado client-side (não via where) para tolerar planId stale', () => {
    renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    // v1.1.0: não adiciona mais where(planId) no servidor — filtro é client-side
    // para aceitar review.planId top-level E review.frozenSnapshot.planContext.planId
    const planIdWhere = whereCalls.find(args => args[0] === 'planId');
    expect(planIdWhere).toBeUndefined();
  });

  it('filtra por planId top-level no client', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ planId: 'plan-other', weekStart: '2026-04-20' }) },
          { id: 'r2', data: () => ({ planId: 'plan-abc',   weekStart: '2026-04-13', swot: { strengths: ['x'] } }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r2');
  });

  it('filtra por frozenSnapshot.planContext.planId quando top-level está stale', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1', 'plan-abc'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          { id: 'r1', data: () => ({ planId: 'plan-old', frozenSnapshot: { planContext: { planId: 'plan-abc' } }, weekStart: '2026-04-13', swot: {} }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review?.id).toBe('r1');
  });

  it('popula review com o primeiro doc do snapshot', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        empty: false,
        docs: [
          {
            id: '2026-W16-1',
            data: () => ({
              status: 'CLOSED',
              weekStart: '2026-04-13',
              swot: { strengths: ['ok'], weaknesses: [], opportunities: [], threats: [] },
            }),
          },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review).not.toBeNull();
    expect(result.current.review.id).toBe('2026-W16-1');
    expect(result.current.review.swot.strengths).toEqual(['ok']);
  });

  it('retorna review=null quando snapshot está vazio', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({ empty: true, docs: [] });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.review).toBeNull();
  });

  it('propaga erro do Firestore', async () => {
    const { result } = renderHook(() => useLatestClosedReview('student-1'));
    const [, , onError] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onError(new Error('permission-denied'));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.review).toBeNull();
  });

  it('recria o listener quando studentId muda', () => {
    const { rerender } = renderHook(({ sid }) => useLatestClosedReview(sid), {
      initialProps: { sid: 'student-1' },
    });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ sid: 'student-2' });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });
});
