import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock firebase/functions
const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('../../firebase', () => ({
  functions: {},
}));

import { useRecomputeStudentMaturity } from '../../hooks/useRecomputeStudentMaturity';

describe('useRecomputeStudentMaturity', () => {
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it('estado inicial: loading=false, error=null, throttled=false', () => {
    const { result } = renderHook(() => useRecomputeStudentMaturity());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.throttled).toBe(false);
    expect(result.current.nextAllowedAt).toBeNull();
    expect(result.current.lastResult).toBeNull();
  });

  it('happy path: chama CF com studentId e expõe snapshot', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        stageCurrent: 3,
        gatesMet: 4,
        gatesTotal: 6,
        timestamp: { _seconds: 100 },
      },
    });

    const { result } = renderHook(() => useRecomputeStudentMaturity());

    let returned;
    await act(async () => {
      returned = await result.current.recompute('student-1');
    });

    expect(mockCallable).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(returned.success).toBe(true);
    expect(result.current.lastResult.stageCurrent).toBe(3);
    expect(result.current.throttled).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('resposta throttled: expõe throttled=true e nextAllowedAt', async () => {
    const nextAt = { _seconds: 200 };
    mockCallable.mockResolvedValueOnce({
      data: { throttled: true, nextAllowedAt: nextAt },
    });

    const { result } = renderHook(() => useRecomputeStudentMaturity());

    await act(async () => {
      await result.current.recompute('student-1');
    });

    expect(result.current.throttled).toBe(true);
    expect(result.current.nextAllowedAt).toEqual(nextAt);
    expect(result.current.error).toBeNull();
  });

  it('rejeita studentId ausente sem chamar CF', async () => {
    const { result } = renderHook(() => useRecomputeStudentMaturity());

    let caught = null;
    await act(async () => {
      try {
        await result.current.recompute(null);
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught.message).toBe('studentId é obrigatório');
    expect(mockCallable).not.toHaveBeenCalled();
    expect(result.current.error).not.toBeNull();
  });

  it('erro da CF é propagado e gravado em error', async () => {
    const cfErr = new Error('permission-denied');
    mockCallable.mockRejectedValueOnce(cfErr);

    const { result } = renderHook(() => useRecomputeStudentMaturity());

    let caught = null;
    await act(async () => {
      try {
        await result.current.recompute('student-1');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(cfErr);
    expect(result.current.error).toBe(cfErr);
    expect(result.current.loading).toBe(false);
  });

  it('loading=true durante chamada', async () => {
    let resolveCall;
    mockCallable.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCall = resolve;
      })
    );

    const { result } = renderHook(() => useRecomputeStudentMaturity());

    act(() => {
      result.current.recompute('student-1');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveCall({ data: { success: true, stageCurrent: 1, gatesMet: 0, gatesTotal: 0, timestamp: null } });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('reset de flags entre chamadas (throttled → success)', async () => {
    const { result } = renderHook(() => useRecomputeStudentMaturity());

    mockCallable.mockResolvedValueOnce({ data: { throttled: true, nextAllowedAt: { _seconds: 1 } } });
    await act(async () => {
      await result.current.recompute('student-1');
    });
    expect(result.current.throttled).toBe(true);

    mockCallable.mockResolvedValueOnce({
      data: { success: true, stageCurrent: 2, gatesMet: 1, gatesTotal: 4, timestamp: null },
    });
    await act(async () => {
      await result.current.recompute('student-1');
    });

    expect(result.current.throttled).toBe(false);
    expect(result.current.nextAllowedAt).toBeNull();
    expect(result.current.lastResult.stageCurrent).toBe(2);
  });
});
