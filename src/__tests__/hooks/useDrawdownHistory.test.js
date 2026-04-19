import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockLimit = vi.fn((n) => ({ __kind: 'limit', n }));
const mockOrderBy = vi.fn(() => ({ __kind: 'orderBy' }));
const mockQuery = vi.fn((...args) => ({ __kind: 'query', args }));
const mockCollection = vi.fn((..._args) => ({ __kind: 'collection' }));
const mockUnsubscribe = vi.fn();
const mockOnSnapshot = vi.fn((_q, onNext) => {
  onNext({ docs: [] });
  return mockUnsubscribe;
});

vi.mock('firebase/firestore', () => ({
  collection: (...a) => mockCollection(...a),
  query: (...a) => mockQuery(...a),
  orderBy: (...a) => mockOrderBy(...a),
  limit: (n) => mockLimit(n),
  onSnapshot: (q, onNext, onErr) => mockOnSnapshot(q, onNext, onErr),
}));

vi.mock('../../firebase', () => ({ db: {} }));

import { useDrawdownHistory, DEFAULT_LIMIT } from '../../hooks/useDrawdownHistory';

describe('useDrawdownHistory', () => {
  beforeEach(() => {
    mockLimit.mockClear();
    mockOnSnapshot.mockClear();
    mockCollection.mockClear();
  });

  it('DEFAULT_LIMIT é 1000 (ampliado de 100 para suportar equity curve — issue #145 Fase E)', () => {
    expect(DEFAULT_LIMIT).toBe(1000);
  });

  it('sem accountId retorna history vazio e loading false', () => {
    const { result } = renderHook(() => useDrawdownHistory(null));
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('com accountId aplica limit default (1000) quando não passa options', async () => {
    renderHook(() => useDrawdownHistory('acc-1'));
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    expect(mockLimit).toHaveBeenCalledWith(1000);
  });

  it('com options.limit custom respeita override', async () => {
    renderHook(() => useDrawdownHistory('acc-1', { limit: 50 }));
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('history vem em ordem cronológica asc (reverse do desc firestore)', async () => {
    mockOnSnapshot.mockImplementationOnce((_q, onNext) => {
      onNext({
        docs: [
          { id: 'c', data: () => ({ createdAt: 3, balance: 300 }) },
          { id: 'b', data: () => ({ createdAt: 2, balance: 200 }) },
          { id: 'a', data: () => ({ createdAt: 1, balance: 100 }) },
        ],
      });
      return () => {};
    });

    const { result } = renderHook(() => useDrawdownHistory('acc-1'));

    await waitFor(() => expect(result.current.history.length).toBe(3));
    expect(result.current.history.map(h => h.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.history[0].balance).toBe(100);
    expect(result.current.history[2].balance).toBe(300);
  });
});
