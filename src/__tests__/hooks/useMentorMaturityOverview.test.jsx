/**
 * useMentorMaturityOverview.test.jsx
 * @description Testes do batch listener de maturity/current via collectionGroup
 *              (issue #119 task 17 — Fase F Mentor).
 * @see src/hooks/useMentorMaturityOverview.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const collectionGroupCalls = [];
const mockOnSnapshot = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collectionGroup: (db, path) => {
    collectionGroupCalls.push(path);
    return { __type: 'collectionGroup', path };
  },
  query: (ref) => ({ __type: 'query', ref }),
  onSnapshot: (ref, onNext, onError) => {
    mockOnSnapshot(ref, onNext, onError);
    return mockUnsubscribe;
  },
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import { useMentorMaturityOverview } from '../../hooks/useMentorMaturityOverview';

// Helper — cria fake DocumentSnapshot para collectionGroup query
function makeDoc(uid, id, data) {
  return {
    id,
    ref: {
      parent: {
        parent: uid ? { id: uid } : null,
      },
    },
    data: () => data,
  };
}

describe('useMentorMaturityOverview', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    collectionGroupCalls.length = 0;
  });

  it('não dispara listener e retorna map vazio quando enabled=false', () => {
    const { result } = renderHook(() => useMentorMaturityOverview(false));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.map.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('dispara collectionGroup("maturity") quando enabled=true', () => {
    renderHook(() => useMentorMaturityOverview(true));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(collectionGroupCalls).toContain('maturity');
  });

  it('popula map com docs cujo id === "current", keyed por parent.parent.id', async () => {
    const { result } = renderHook(() => useMentorMaturityOverview(true));
    const [, onNext] = mockOnSnapshot.mock.calls[0];

    act(() => {
      onNext({
        docs: [
          makeDoc('uid-A', 'current', { currentStage: 2, dimensionScores: { composite: 60 } }),
          makeDoc('uid-B', 'current', { currentStage: 3, dimensionScores: { composite: 72 } }),
          // Doc com id diferente (history bucket) — deve ser ignorado
          makeDoc('uid-A', '2026-W15', { windowKey: '2026-W15' }),
        ],
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.map.size).toBe(2);
    expect(result.current.map.get('uid-A')).toBeTruthy();
    expect(result.current.map.get('uid-A').currentStage).toBe(2);
    expect(result.current.map.get('uid-B').currentStage).toBe(3);
    // history bucket não entra
    expect([...result.current.map.keys()].every((k) => k === 'uid-A' || k === 'uid-B')).toBe(true);
  });

  it('ignora docs sem parent.parent.id', async () => {
    const { result } = renderHook(() => useMentorMaturityOverview(true));
    const [, onNext] = mockOnSnapshot.mock.calls[0];

    act(() => {
      onNext({
        docs: [
          makeDoc(null, 'current', { currentStage: 1 }), // sem parent.parent
          makeDoc('uid-C', 'current', { currentStage: 4 }),
        ],
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.map.size).toBe(1);
    expect(result.current.map.get('uid-C')).toBeTruthy();
  });

  it('propaga erro do Firestore e zera map', async () => {
    const { result } = renderHook(() => useMentorMaturityOverview(true));
    const [, , onError] = mockOnSnapshot.mock.calls[0];

    act(() => {
      onError(new Error('permission-denied'));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.map.size).toBe(0);
  });

  it('chama unsubscribe no cleanup', () => {
    const { unmount } = renderHook(() => useMentorMaturityOverview(true));
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
