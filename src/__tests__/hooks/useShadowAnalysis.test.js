import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock firebase/functions
const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable
}));

vi.mock('../../firebase', () => ({
  functions: {}
}));

import { useShadowAnalysis } from '../../hooks/useShadowAnalysis';

describe('useShadowAnalysis', () => {
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it('starts with loading=false and no error', () => {
    const { result } = renderHook(() => useShadowAnalysis());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastResult).toBeNull();
  });

  it('calls CF with studentId + dateFrom + dateTo and sets result', async () => {
    mockCallable.mockResolvedValueOnce({
      data: { analyzed: 3, total: 5, ordersFound: 12, message: 'OK' }
    });

    const { result } = renderHook(() => useShadowAnalysis());

    await act(async () => {
      await result.current.analyze({
        studentId: 'student-1',
        dateFrom: '2026-04-14',
        dateTo: '2026-04-14'
      });
    });

    expect(mockCallable).toHaveBeenCalledWith({
      studentId: 'student-1',
      dateFrom: '2026-04-14',
      dateTo: '2026-04-14'
    });
    expect(result.current.lastResult).toEqual({
      analyzed: 3,
      total: 5,
      ordersFound: 12,
      message: 'OK'
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rejects when studentId is missing', async () => {
    const { result } = renderHook(() => useShadowAnalysis());

    await expect(
      act(async () => {
        await result.current.analyze({});
      })
    ).rejects.toThrow('studentId é obrigatório');

    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('captures CF error', async () => {
    mockCallable.mockRejectedValueOnce(new Error('CF failure'));

    const { result } = renderHook(() => useShadowAnalysis());

    let caught = null;
    await act(async () => {
      try {
        await result.current.analyze({ studentId: 'student-1' });
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught.message).toBe('CF failure');
    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during call', async () => {
    let resolveCall;
    mockCallable.mockReturnValueOnce(
      new Promise(resolve => {
        resolveCall = resolve;
      })
    );

    const { result } = renderHook(() => useShadowAnalysis());

    act(() => {
      result.current.analyze({ studentId: 'student-1' });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveCall({ data: { analyzed: 0, total: 0 } });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
