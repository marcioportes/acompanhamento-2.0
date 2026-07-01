import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ============================================================
// Regressão #316 — o gate de feedback (assertStudentInReviewScope) precisa
// chamar classifyStudent do FRONT com a assinatura correta (_student, subs).
// A #269 passou as subs na posição errada (1 arg), fazendo classifyStudent
// retornar sempre null → mentor bloqueado pra TODO aluno, mesmo Alpha.
//
// Diferença chave vs useTrades.test.js: aqui NÃO mockamos studentClassify —
// usamos a implementação REAL, e configuramos getDocs pra devolver subs
// reais. Só assim o mismatch de argumentos aparece.
// ============================================================

const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn(() => Promise.resolve());

// Subscriptions devolvidas por getDocs(students/{id}/subscriptions). Configurável.
let mockSubsDocs = [];
// getDoc(tradeRef) — trade "atual" configurável.
let mockGetDocImpl = () => ({ exists: () => false });

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  doc: (...args) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => ({ __type: 'where', args }),
  orderBy: (...args) => ({ __type: 'orderBy', args }),
  onSnapshot: (q, onNext) => {
    onNext({ docs: [] });
    return () => {};
  },
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDoc: (...args) => Promise.resolve(mockGetDocImpl(...args)),
  // Único getDocs relevante no fluxo de feedback é o das subscriptions.
  getDocs: vi.fn(() => Promise.resolve({ docs: mockSubsDocs.map((s) => ({ data: () => s })) })),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
  arrayUnion: (...items) => ({ __type: 'arrayUnion', items }),
  writeBatch: () => ({ update: mockBatchUpdate, commit: mockBatchCommit }),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(() => Promise.resolve({ ref: {} })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/img.png')),
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
  storage: { __type: 'storage' },
}));

// NOTA: studentClassify NÃO é mockado — usamos a implementação real de propósito.

let mockAuthState = { user: null, isMentor: () => false };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

import { useTrades } from '../../hooks/useTrades';

const MENTOR = { uid: 'mentor-1', email: 'mentor@espelho.com', displayName: 'Mentor' };

const sub = (over = {}) => ({
  type: 'paid', plan: 'alpha', status: 'active', renewalDate: '2026-12-01', ...over,
});

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockBatchUpdate.mockClear();
  mockBatchCommit.mockClear();
  mockSubsDocs = [];
  mockGetDocImpl = () => ({ exists: () => false });
  mockAuthState = { user: MENTOR, isMentor: () => true };
});

describe('useTrades — gate de feedback com classifyStudent REAL (#316)', () => {
  it('aluno Alpha (paid): mentor consegue dar feedback — não bloqueia', async () => {
    mockSubsDocs = [sub({ plan: 'alpha', type: 'paid' })];
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    // Sob o bug (args trocados) isto lançaria 'Alpha'. Com o fix, passa.
    await act(async () => {
      await result.current.addFeedbackComment('t1', 'observação');
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('REVIEWED');
  });

  it('aluno Trial-Alpha: mentor consegue dar feedback — não bloqueia', async () => {
    mockSubsDocs = [sub({ plan: 'alpha', type: 'trial', trialEndsAt: '2026-12-01' })];
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedbackComment('t1', 'observação');
    });

    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('aluno Espelho (self_service): mentor é bloqueado', async () => {
    mockSubsDocs = [sub({ plan: 'self_service', type: 'paid' })];
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await expect(result.current.addFeedbackComment('t1', 'x')).rejects.toThrow('Alpha');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('aluno sem sub ativa: mentor é bloqueado', async () => {
    mockSubsDocs = [];
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await expect(result.current.addFeedbackComment('t1', 'x')).rejects.toThrow('Alpha');
  });

  it('addBulkFeedback: aluno Alpha passa o gate e commita o batch', async () => {
    mockSubsDocs = [sub({ plan: 'alpha', type: 'paid' })];
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa' }) });
    const { result } = renderHook(() => useTrades(null));

    let ret;
    await act(async () => {
      ret = await result.current.addBulkFeedback(['t1', 't2'], 'feedback em massa');
    });

    expect(ret).toEqual({ success: true, count: 2 });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});
