/**
 * Issue #280 — testes do filtro do inbox do mentor após "marcar sem comentário".
 *
 * Regression case: setMentorClosureComment({ comment: '' }) grava
 * mentor.closingComment=null + mentor.closingCommentAt=now. O hook filtrava
 * por presença de conteúdo em closingComment (vira null → filtro deixava passar →
 * item não saía do inbox). Fix: filtrar por closingCommentAt (timestamp sempre setado).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockQuery = vi.fn((...args) => ({ __kind: 'query', args }));
const mockCollection = vi.fn(() => ({ __kind: 'collection' }));
const mockWhere = vi.fn((field, op, value) => ({ __kind: 'where', field, op, value }));
const mockUnsubscribe = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...a) => mockCollection(...a),
  query: (...a) => mockQuery(...a),
  where: (...a) => mockWhere(...a),
  onSnapshot: (q, onNext, onErr) => mockOnSnapshot(q, onNext, onErr),
  Timestamp: { fromDate: (d) => ({ toDate: () => d, __ts: d.getTime() }) },
}));

vi.mock('../../firebase', () => ({ db: {} }));

import { useMentorClosureInbox } from '../../hooks/useMentorClosureInbox';

// Helpers
const HOURS_AGO = (h) => new Date(Date.now() - h * 3600 * 1000);
const closureDoc = (id, overrides = {}) => ({
  id,
  data: () => ({
    studentId: `student-${id}`,
    planId: `plan-${id}`,
    cycleKey: '2026-05',
    cycleStart: '2026-05-01',
    cycleEnd: '2026-05-31',
    status: 'CLOSED',
    closedAt: { toDate: () => HOURS_AGO(48) },  // 2 dias atrás (dentro da janela 7d)
    snapshot: { resultPercent: 5, tradesCount: 10 },
    metrics: { tradingPerformanceScore: 70 },
    maturity: {},
    ...overrides,
  }),
});

const deliverDocs = (docs) => {
  mockOnSnapshot.mockImplementation((_q, onNext) => {
    onNext({ docs });
    return mockUnsubscribe;
  });
};

beforeEach(() => {
  mockOnSnapshot.mockClear();
  mockQuery.mockClear();
  mockWhere.mockClear();
});

describe('useMentorClosureInbox — filtro de processamento (issue #280)', () => {
  it('REGRESSION: "no comment" (closingCommentAt set + closingComment null) sai do inbox em pending', async () => {
    deliverDocs([
      closureDoc('A', {
        mentor: {
          closingComment: null,
          closingCommentAt: { toDate: () => HOURS_AGO(1) },
        },
      }),
      closureDoc('B'),  // sem mentor — deve permanecer
    ]);
    const { result } = renderHook(() => useMentorClosureInbox({ mode: 'pending' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inbox.map((c) => c.id)).toEqual(['B']);
    expect(result.current.pendingCount).toBe(1);
  });

  it('closure com comentário de texto também sai do inbox em pending (caso já funcionava)', async () => {
    deliverDocs([
      closureDoc('A', {
        mentor: {
          closingComment: 'Bom ciclo, atenção a revenge clusters.',
          closingCommentAt: { toDate: () => HOURS_AGO(1) },
        },
      }),
      closureDoc('B'),
    ]);
    const { result } = renderHook(() => useMentorClosureInbox({ mode: 'pending' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inbox.map((c) => c.id)).toEqual(['B']);
  });

  it('closure sem closingCommentAt permanece no inbox em pending', async () => {
    deliverDocs([
      closureDoc('A'),       // não processado
      closureDoc('B', { mentor: {} }),  // mentor object vazio (também não processado)
    ]);
    const { result } = renderHook(() => useMentorClosureInbox({ mode: 'pending' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inbox.map((c) => c.id).sort()).toEqual(['A', 'B']);
    expect(result.current.pendingCount).toBe(2);
  });

  it('mode=all mostra todos os CLOSED, mas pendingCount ainda usa closingCommentAt', async () => {
    deliverDocs([
      closureDoc('A', {
        mentor: {
          closingComment: null,
          closingCommentAt: { toDate: () => HOURS_AGO(1) },  // processado no-comment
        },
      }),
      closureDoc('B'),  // não processado, dentro da janela
    ]);
    const { result } = renderHook(() => useMentorClosureInbox({ mode: 'all' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inbox.map((c) => c.id).sort()).toEqual(['A', 'B']);
    // pendingCount conta só B (A está processado via closingCommentAt)
    expect(result.current.pendingCount).toBe(1);
  });

  it('enabled=false retorna inbox vazio e não assina', () => {
    deliverDocs([]);
    const { result } = renderHook(() => useMentorClosureInbox({ mode: 'pending', enabled: false }));
    expect(result.current.inbox).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});
