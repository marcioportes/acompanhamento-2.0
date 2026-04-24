/**
 * useMaturityHistory.test.jsx
 * @description Testes do hook que faz query dos últimos N dias em
 *              students/{studentId}/maturity/_historyBucket/history
 *              (issue #119 task 08 — path DEC-AUTO-119-06).
 * @see src/hooks/useMaturityHistory.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const collectionPaths = [];
const whereCalls = [];
const orderByCalls = [];
const limitCalls = [];
const mockOnSnapshot = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args) => {
    const path = args.slice(1).join('/');
    collectionPaths.push(path);
    return { __type: 'collection', path };
  },
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
    return mockUnsubscribe;
  },
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import { useMaturityHistory } from '../../hooks/useMaturityHistory';

describe('useMaturityHistory', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    collectionPaths.length = 0;
    whereCalls.length = 0;
    orderByCalls.length = 0;
    limitCalls.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não dispara listener e retorna history vazio, loading=false quando studentId é null', () => {
    const { result } = renderHook(() => useMaturityHistory(null));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('monta query no path correto (DEC-AUTO-119-06): maturity/_historyBucket/history', () => {
    renderHook(() => useMaturityHistory('student-1'));
    expect(collectionPaths).toContain(
      'students/student-1/maturity/_historyBucket/history'
    );
  });

  it('aplica where(date >= cutoff), orderBy(date asc) e limit(400)', () => {
    renderHook(() => useMaturityHistory('student-1'));
    const dateWhere = whereCalls.find((args) => args[0] === 'date');
    expect(dateWhere).toBeDefined();
    expect(dateWhere[1]).toBe('>=');
    expect(typeof dateWhere[2]).toBe('string');
    expect(dateWhere[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const dateOrder = orderByCalls.find((args) => args[0] === 'date');
    expect(dateOrder).toBeDefined();
    expect(dateOrder[1]).toBe('asc');

    expect(limitCalls).toContain(400);
  });

  it('calcula cutoffDate = hoje (UTC) - days com days=90 (default)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));

    renderHook(() => useMaturityHistory('student-1'));
    const dateWhere = whereCalls.find((args) => args[0] === 'date');
    // 2026-04-23 - 90d = 2026-01-23
    expect(dateWhere[2]).toBe('2026-01-23');
  });

  it('respeita custom days no cálculo do cutoff', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));

    renderHook(() => useMaturityHistory('student-1', 7));
    const dateWhere = whereCalls.find((args) => args[0] === 'date');
    // 2026-04-23 - 7d = 2026-04-16
    expect(dateWhere[2]).toBe('2026-04-16');
  });

  it('popula history com docs do snapshot mantendo ordem recebida', async () => {
    const { result } = renderHook(() => useMaturityHistory('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        docs: [
          { id: '2026-02-10', data: () => ({ date: '2026-02-10', currentStage: 'CHAOS' }) },
          { id: '2026-03-15', data: () => ({ date: '2026-03-15', currentStage: 'AWARE' }) },
          { id: '2026-04-20', data: () => ({ date: '2026-04-20', currentStage: 'DISCIPLINED' }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toHaveLength(3);
    expect(result.current.history.map((h) => h.id)).toEqual([
      '2026-02-10', '2026-03-15', '2026-04-20',
    ]);
    expect(result.current.history[2].currentStage).toBe('DISCIPLINED');
  });

  it('propaga erro do Firestore e mantém history vazio', async () => {
    const { result } = renderHook(() => useMaturityHistory('student-1'));
    const [, , onError] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onError(new Error('permission-denied'));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.history).toEqual([]);
  });

  it('chama unsubscribe no cleanup ao desmontar', () => {
    const { unmount } = renderHook(() => useMaturityHistory('student-1'));
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
