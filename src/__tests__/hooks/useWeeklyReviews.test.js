import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockCallable = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
// getDocs default: snapshot vazio (nenhuma revisão anterior para carry-over).
// Cada teste que precisar pode sobrescrever via mockGetDocs.mockResolvedValueOnce(...).
const mockGetDocs = vi.fn(() => Promise.resolve({ docs: [], empty: true }));
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockArrayUnion = vi.fn((...items) => ({ __type: 'arrayUnion', items }));
const mockArrayRemove = vi.fn((...items) => ({ __type: 'arrayRemove', items }));

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
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...items) => mockArrayUnion(...items),
  arrayRemove: (...items) => mockArrayRemove(...items),
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
    mockGetDocs.mockClear();
    mockGetDocs.mockImplementation(() => Promise.resolve({ docs: [], empty: true }));
    mockDeleteDoc.mockClear();
    mockArrayUnion.mockClear();
    mockArrayRemove.mockClear();
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
      await result.current.closeReview('r1', { meetingLink: 'https://zoom.us/j/1' });
    });
    expect(mockUpdateDoc).toHaveBeenCalled();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('CLOSED');
    expect(payload.meetingLink).toBe('https://zoom.us/j/1');
    expect(payload.closedAt).toEqual({ __type: 'serverTimestamp' });
    expect('takeaways' in payload).toBe(false);
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

  describe('carry-over de takeaways ao createReview', () => {
    it('replica takeaways !done da revisão anterior CLOSED do mesmo plano', async () => {
      mockCallable.mockResolvedValueOnce({ data: { reviewId: 'new-1', status: 'DRAFT' } });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'old-1',
            data: () => ({
              status: 'CLOSED',
              planId: 'p1',
              weekStart: '2026-04-06',
              takeawayItems: [
                { id: 'a', text: 'estudar aula 21', done: false, sourceTradeId: 't-1' },
                { id: 'b', text: 'parar após 2 losses', done: true },
                { id: 'c', text: 'reforçar estrutura', done: false },
              ],
            }),
          },
        ],
        empty: false,
      });
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.createReview({ studentId: 'student-1', planId: 'p1', weekStart: '2026-04-13' });
      });
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(Array.isArray(payload.takeawayItems)).toBe(true);
      expect(payload.takeawayItems).toHaveLength(2); // só !done
      expect(payload.takeawayItems.map(it => it.text)).toEqual(['estudar aula 21', 'reforçar estrutura']);
      expect(payload.takeawayItems.every(it => it.done === false)).toBe(true);
      expect(payload.takeawayItems.every(it => it.carriedOverFromReviewId === 'old-1')).toBe(true);
      expect(payload.takeawayItems[0].sourceTradeId).toBe('t-1');
      expect(payload.takeawayItems[1].sourceTradeId).toBeNull();
    });

    it('não chama updateDoc se anterior tem todos takeaways encerrados', async () => {
      mockCallable.mockResolvedValueOnce({ data: { reviewId: 'new-2', status: 'DRAFT' } });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'old-2',
            data: () => ({
              status: 'CLOSED',
              planId: 'p1',
              weekStart: '2026-04-06',
              takeawayItems: [
                { id: 'a', text: 'feito', done: true },
                { id: 'b', text: 'também feito', done: true },
              ],
            }),
          },
        ],
        empty: false,
      });
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.createReview({ studentId: 'student-1', planId: 'p1', weekStart: '2026-04-13' });
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('ignora revisões de outro plano', async () => {
      mockCallable.mockResolvedValueOnce({ data: { reviewId: 'new-3', status: 'DRAFT' } });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'old-p2',
            data: () => ({
              status: 'CLOSED',
              planId: 'p2', // outro plano
              weekStart: '2026-04-06',
              takeawayItems: [{ id: 'x', text: 'item de outro plano', done: false }],
            }),
          },
        ],
        empty: false,
      });
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.createReview({ studentId: 'student-1', planId: 'p1', weekStart: '2026-04-13' });
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('não aborta a criação se o carry-over falha (best-effort)', async () => {
      mockCallable.mockResolvedValueOnce({ data: { reviewId: 'new-4', status: 'DRAFT' } });
      mockGetDocs.mockRejectedValueOnce(new Error('firestore offline'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      let returned;
      await act(async () => {
        returned = await result.current.createReview({ studentId: 'student-1', planId: 'p1', weekStart: '2026-04-13' });
      });
      expect(returned).toEqual({ reviewId: 'new-4', status: 'DRAFT' });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('exposes error when CF rejects', async () => {
    mockCallable.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWeeklyReviews('student-1'));
    await act(async () => {
      await expect(result.current.createReview({})).rejects.toThrow('boom');
    });
    expect(result.current.error).toBe('boom');
  });

  // Issue #197 — atualização operacional dos links pós-publicação
  describe('updateMeetingLinks', () => {
    it('grava meetingLink + videoLink + updatedAt sem mudar status', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.updateMeetingLinks('r1', {
          meetingLink: 'https://zoom.us/j/123',
          videoLink: 'https://loom.com/share/abc',
        });
      });
      expect(mockUpdateDoc).toHaveBeenCalled();
      const [docRef, payload] = mockUpdateDoc.mock.calls[0];
      expect(docRef.path).toBe('students/student-1/reviews/r1');
      expect(payload).toEqual({
        meetingLink: 'https://zoom.us/j/123',
        videoLink: 'https://loom.com/share/abc',
        updatedAt: { __type: 'serverTimestamp' },
      });
      expect(payload.status).toBeUndefined();
    });

    it('aceita strings vazias para limpar links', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.updateMeetingLinks('r1', { meetingLink: '', videoLink: '' });
      });
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(payload.meetingLink).toBe('');
      expect(payload.videoLink).toBe('');
    });

    it('rejeita URL inválida sem chamar updateDoc', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await expect(result.current.updateMeetingLinks('r1', {
          meetingLink: 'http://insecure.example.com/abc',
          videoLink: '',
        })).rejects.toThrow(/https/i);
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejeita host fora da allowlist sem chamar updateDoc', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await expect(result.current.updateMeetingLinks('r1', {
          meetingLink: 'https://evil.example.com/abc',
          videoLink: '',
        })).rejects.toThrow(/Host/i);
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('aceita ambos os campos undefined (no-op defensivo) sem persistir', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.updateMeetingLinks('r1', {});
      });
      // Quando ambos undefined, não tem o que salvar — não chama updateDoc.
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('persiste apenas o campo informado quando o outro é undefined', async () => {
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await result.current.updateMeetingLinks('r1', { meetingLink: 'https://meet.google.com/abc-defg-hij' });
      });
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(payload.meetingLink).toBe('https://meet.google.com/abc-defg-hij');
      expect(payload.videoLink).toBeUndefined();
      expect(payload.updatedAt).toEqual({ __type: 'serverTimestamp' });
    });

    it('expõe error quando updateDoc rejeita', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('rules denied'));
      const { result } = renderHook(() => useWeeklyReviews('student-1'));
      await act(async () => {
        await expect(result.current.updateMeetingLinks('r1', {
          meetingLink: 'https://zoom.us/j/123',
          videoLink: '',
        })).rejects.toThrow('rules denied');
      });
      expect(result.current.error).toBe('rules denied');
    });
  });
});
