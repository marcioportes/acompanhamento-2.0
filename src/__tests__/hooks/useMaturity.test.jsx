/**
 * useMaturity.test.jsx
 * @description Testes do hook que lê em real-time o doc
 *              students/{studentId}/maturity/current (issue #119 task 08).
 * @see src/hooks/useMaturity.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const docPaths = [];
const mockOnSnapshot = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args) => {
    const path = args.slice(1).join('/');
    docPaths.push(path);
    return { __type: 'doc', path };
  },
  onSnapshot: (ref, onNext, onError) => {
    mockOnSnapshot(ref, onNext, onError);
    return mockUnsubscribe;
  },
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

import { useMaturity } from '../../hooks/useMaturity';

describe('useMaturity', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    docPaths.length = 0;
  });

  it('não dispara listener e retorna maturity=null, loading=false quando studentId é null', () => {
    const { result } = renderHook(() => useMaturity(null));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.maturity).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('inscreve onSnapshot no path students/{id}/maturity/current quando studentId é fornecido', () => {
    renderHook(() => useMaturity('student-1'));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(docPaths).toContain('students/student-1/maturity/current');
  });

  it('popula maturity com os dados do doc quando snap.exists() === true', async () => {
    const { result } = renderHook(() => useMaturity('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        id: 'current',
        exists: () => true,
        data: () => ({
          currentStage: 'DISCIPLINED',
          windowSize: 30,
          dimensions: { operational: {}, financial: {}, emotional: {}, compliance: {} },
        }),
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maturity).not.toBeNull();
    expect(result.current.maturity.id).toBe('current');
    expect(result.current.maturity.currentStage).toBe('DISCIPLINED');
    expect(result.current.maturity.windowSize).toBe(30);
  });

  it('retorna maturity=null quando doc não existe (motor nunca rodou)', async () => {
    const { result } = renderHook(() => useMaturity('student-1'));
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        id: 'current',
        exists: () => false,
        data: () => undefined,
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maturity).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('propaga erro do Firestore e zera maturity', async () => {
    const { result } = renderHook(() => useMaturity('student-1'));
    const [, , onError] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onError(new Error('permission-denied'));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('permission-denied');
    expect(result.current.maturity).toBeNull();
  });

  it('chama unsubscribe no cleanup ao desmontar', () => {
    const { unmount } = renderHook(() => useMaturity('student-1'));
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('recria listener quando studentId muda', () => {
    const { rerender } = renderHook(({ sid }) => useMaturity(sid), {
      initialProps: { sid: 'student-1' },
    });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ sid: 'student-2' });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(docPaths).toContain('students/student-2/maturity/current');
  });
});
