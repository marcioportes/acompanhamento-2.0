import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockCallable = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => mockCallable,
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  doc: (...args) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => ({ __type: 'where', args }),
  orderBy: (...args) => ({ __type: 'orderBy', args }),
  onSnapshot: (q, onNext, onError) => {
    mockOnSnapshot(q, onNext, onError);
    return () => {};
  },
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

const mockAuthValue = { user: { uid: 'u1' }, isMentor: () => true };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';

describe('useWeeklyReviews', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockUpdateDoc.mockClear();
    mockOnSnapshot.mockClear();
    mockAuthValue.user = { uid: 'u1' };
    mockAuthValue.isMentor = () => true;
  });

  it('starts with loading=true and empty reviews when studentId provided', () => {
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.reviews).toEqual([]);
  });

  it('returns empty with loading=false when studentId missing', () => {
    const { result } = renderHook(() => useWeeklyReviews(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reviews).toEqual([]);
  });

  it('subscribes via onSnapshot and populates reviews', async () => {
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    expect(mockOnSnapshot).toHaveBeenCalled();
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        docs: [
          { id: '2026-W16-1', data: () => ({ status: 'DRAFT', weekStart: '2026-04-13' }) },
          { id: '2026-W15-1', data: () => ({ status: 'CLOSED', weekStart: '2026-04-06' }) },
        ],
      });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reviews).toHaveLength(2);
    expect(result.current.reviews[0].id).toBe('2026-W16-1');
  });

  it('mentor sees all statuses (no where clause applied)', () => {
    renderHook(() => useWeeklyReviews('student-1'));
    const [queryArg] = mockOnSnapshot.mock.calls[0];
    const argTypes = (queryArg.args || []).map(a => a.__type);
    expect(argTypes).not.toContain('where');
    expect(argTypes).toContain('orderBy');
  });

  it('student (non-mentor) filters by status in [CLOSED, ARCHIVED]', () => {
    mockAuthValue.isMentor = () => false;
    renderHook(() => useWeeklyReviews('student-1'));
    const [queryArg] = mockOnSnapshot.mock.calls[0];
    const whereClause = (queryArg.args || []).find(a => a.__type === 'where');
    expect(whereClause).toBeDefined();
    expect(whereClause.args[0]).toBe('status');
    expect(whereClause.args[1]).toBe('in');
    expect(whereClause.args[2]).toEqual(['CLOSED', 'ARCHIVED']);
  });

  it('createReview forwards payload to the CF and returns data', async () => {
    mockCallable.mockResolvedValueOnce({ data: { reviewId: 'x-1', status: 'DRAFT' } });
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    let returned;
    await act(async () => {
      returned = await result.current.createReview({ studentId: 'student-1', planId: 'p1' });
    });
    expect(mockCallable).toHaveBeenCalledWith({ studentId: 'student-1', planId: 'p1' });
    expect(returned).toEqual({ reviewId: 'x-1', status: 'DRAFT' });
  });

  it('generateSwot injects studentId + reviewId in payload', async () => {
    mockCallable.mockResolvedValueOnce({ data: { swot: { strengths: [] }, aiUnavailable: false } });
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    await act(async () => {
      await result.current.generateSwot({ reviewId: 'r1' });
    });
    expect(mockCallable).toHaveBeenCalledWith({ studentId: 'student-1', reviewId: 'r1' });
  });

  it('closeReview updates doc with status=CLOSED + closedAt', async () => {
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    await act(async () => {
      await result.current.closeReview('r1', { takeaways: 'ok' });
    });
    expect(mockUpdateDoc).toHaveBeenCalled();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('CLOSED');
    expect(payload.takeaways).toBe('ok');
    expect(payload.closedAt).toEqual({ __type: 'serverTimestamp' });
  });

  it('archiveReview updates doc with status=ARCHIVED + archivedAt', async () => {
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    await act(async () => {
      await result.current.archiveReview('r1');
    });
    expect(mockUpdateDoc).toHaveBeenCalled();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('ARCHIVED');
    expect(payload.archivedAt).toEqual({ __type: 'serverTimestamp' });
  });

  it('exposes error when CF rejects', async () => {
    mockCallable.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    await act(async () => {
      await expect(result.current.createReview({})).rejects.toThrow('boom');
    });
    expect(result.current.error).toBe('boom');
  });
});
