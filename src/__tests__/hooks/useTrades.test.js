import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ============================================================
// Mocks firebase/firestore — captura de writes + snapshot configurável
// ============================================================
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn(() => Promise.resolve());

// Snapshot entregue ao listener (mentor mode → allTrades). Configurável por teste.
let mockSnapshotDocs = [];
// getDoc(tradeRef) configurável: retorna o snap do trade "atual".
let mockGetDocImpl = () => ({ exists: () => false });

function makeDoc(trade) {
  const { id, ...fields } = trade;
  return { id, data: () => fields };
}

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  doc: (...args) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => ({ __type: 'where', args }),
  orderBy: (...args) => ({ __type: 'orderBy', args }),
  onSnapshot: (q, onNext) => {
    onNext({ docs: mockSnapshotDocs.map(makeDoc) });
    return () => {};
  },
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDoc: (...args) => Promise.resolve(mockGetDocImpl(...args)),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
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

// Filtro matriz #269 — inReviewScope configurável por teste
let mockInReviewScope = true;
vi.mock('../../utils/studentClassify', () => ({
  classifyStudent: () => 'alpha',
  inReviewScope: () => mockInReviewScope,
}));

// useAuth configurável por teste
let mockAuthState = { user: null, isMentor: () => false };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

import { useTrades } from '../../hooks/useTrades';

const MENTOR = { uid: 'mentor-1', email: 'mentor@espelho.com', displayName: 'Mentor' };
const ALUNO = { uid: 'aluno-1', email: 'aluno@espelho.com', displayName: 'Aluno' };

// Helper: localiza a chamada de updateDoc cujo payload satisfaz o predicado
function updatePayloadMatching(pred) {
  const call = mockUpdateDoc.mock.calls.find((c) => pred(c[1]));
  if (!call) throw new Error('Nenhuma chamada de updateDoc casou o predicado');
  return call[1];
}

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockBatchUpdate.mockClear();
  mockBatchCommit.mockClear();
  mockSnapshotDocs = [];
  mockGetDocImpl = () => ({ exists: () => false });
  mockInReviewScope = true;
  mockAuthState = { user: null, isMentor: () => false };
});

// ============================================================
// Selectors / helpers (mentor mode popula allTrades via snapshot)
// ============================================================
describe('useTrades — selectors sobre allTrades', () => {
  const FIXTURE = [
    { id: 't1', studentEmail: 'a@x.com', studentName: 'Ana', studentId: 'sa', status: 'OPEN' },
    { id: 't2', studentEmail: 'a@x.com', studentName: 'Ana', studentId: 'sa', status: 'REVIEWED' },
    { id: 't3', studentEmail: 'a@x.com', studentName: 'Ana', studentId: 'sa', status: 'QUESTION' },
    { id: 't4', studentEmail: 'b@x.com', studentName: 'Bob', studentId: 'sb', status: 'OPEN' },
    { id: 't5', studentEmail: 'b@x.com', studentName: 'Bob', studentId: 'sb', status: 'CLOSED' },
  ];

  function renderMentorWith(docs) {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockSnapshotDocs = docs;
    return renderHook(() => useTrades(null));
  }

  it('mentor mode: snapshot popula allTrades e trades', () => {
    const { result } = renderMentorWith(FIXTURE);
    expect(result.current.allTrades).toHaveLength(5);
    expect(result.current.allTrades[0]).toMatchObject({ id: 't1', studentEmail: 'a@x.com' });
    expect(result.current.loading).toBe(false);
  });

  it('getTradesByStudent filtra por email', () => {
    const { result } = renderMentorWith(FIXTURE);
    expect(result.current.getTradesByStudent('a@x.com').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(result.current.getTradesByStudent('b@x.com')).toHaveLength(2);
    expect(result.current.getTradesByStudent('ninguem@x.com')).toEqual([]);
  });

  it('getTradesAwaitingFeedback retorna apenas OPEN e QUESTION', () => {
    const { result } = renderMentorWith(FIXTURE);
    const ids = result.current.getTradesAwaitingFeedback().map((t) => t.id).sort();
    expect(ids).toEqual(['t1', 't3', 't4']);
  });

  it('getTradesGroupedByStudent agrupa por email', () => {
    const { result } = renderMentorWith(FIXTURE);
    const grouped = result.current.getTradesGroupedByStudent();
    expect(Object.keys(grouped).sort()).toEqual(['a@x.com', 'b@x.com']);
    expect(grouped['a@x.com']).toHaveLength(3);
    expect(grouped['b@x.com']).toHaveLength(2);
  });

  it('getTradesGroupedByStudent usa "unknown" quando falta email', () => {
    const { result } = renderMentorWith([{ id: 'tx', status: 'OPEN' }]);
    expect(result.current.getTradesGroupedByStudent()).toHaveProperty('unknown');
  });

  it('getUniqueStudents deduplica por email', () => {
    const { result } = renderMentorWith(FIXTURE);
    const students = result.current.getUniqueStudents();
    expect(students).toHaveLength(2);
    expect(students.find((s) => s.email === 'a@x.com')).toMatchObject({ name: 'Ana', studentId: 'sa' });
  });

  it('getUniqueStudents deriva nome do email quando studentName ausente', () => {
    const { result } = renderMentorWith([{ id: 'tx', studentEmail: 'carol@x.com', studentId: 'sc', status: 'OPEN' }]);
    expect(result.current.getUniqueStudents()[0].name).toBe('carol');
  });

  it('getStudentFeedbackCounts conta por status', () => {
    const { result } = renderMentorWith(FIXTURE);
    expect(result.current.getStudentFeedbackCounts('a@x.com')).toEqual({
      open: 1, question: 1, reviewed: 1, closed: 0, total: 3,
    });
    expect(result.current.getStudentFeedbackCounts('b@x.com')).toEqual({
      open: 1, question: 0, reviewed: 0, closed: 1, total: 2,
    });
  });

  it('getStudentFeedbackCounts conta DISCUSSED como revisado (#333)', () => {
    const { result } = renderMentorWith([
      { id: 'd1', studentEmail: 'c@x.com', studentId: 'sc', status: 'REVIEWED' },
      { id: 'd2', studentEmail: 'c@x.com', studentId: 'sc', status: 'DISCUSSED' },
      { id: 'd3', studentEmail: 'c@x.com', studentId: 'sc', status: 'DISCUSSED' },
    ]);
    // DISCUSSED (terminal revisado+discutido) entra no bucket "reviewed", não some da contagem.
    expect(result.current.getStudentFeedbackCounts('c@x.com')).toEqual({
      open: 0, question: 0, reviewed: 3, closed: 0, total: 3,
    });
  });

  it('getTradesByStudentAndStatus cruza email + status', () => {
    const { result } = renderMentorWith(FIXTURE);
    expect(result.current.getTradesByStudentAndStatus('a@x.com', 'REVIEWED').map((t) => t.id)).toEqual(['t2']);
    expect(result.current.getTradesByStudentAndStatus('b@x.com', 'QUESTION')).toEqual([]);
  });
});

// ============================================================
// Guards de autenticação
// ============================================================
describe('useTrades — guards', () => {
  it('addTrade sem usuário lança', async () => {
    mockAuthState = { user: null, isMentor: () => false };
    const { result } = renderHook(() => useTrades(null));
    await expect(result.current.addTrade({})).rejects.toThrow('não autenticado');
  });

  it('sem usuário, trades fica vazio e loading resolve', () => {
    mockAuthState = { user: null, isMentor: () => false };
    const { result } = renderHook(() => useTrades(null));
    expect(result.current.trades).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('addFeedback exige mentor', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => useTrades(null));
    await expect(result.current.addFeedback('t1', 'oi')).rejects.toThrow('Apenas mentores');
  });

  it('addBulkFeedback rejeita lista vazia', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => useTrades(null));
    await expect(result.current.addBulkFeedback([], 'texto')).rejects.toThrow('obrigatórios');
  });
});

// ============================================================
// Sistema de feedback (máquina de estados)
// ============================================================
describe('useTrades — addFeedback', () => {
  it('mentor: grava mentorFeedback, status REVIEWED e comentário no histórico', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedback('t1', '  bom trade  ');
    });

    const payload = updatePayloadMatching((p) => p.mentorFeedback !== undefined);
    expect(payload.mentorFeedback).toBe('  bom trade  ');
    expect(payload.status).toBe('REVIEWED');
    const comment = payload.feedbackHistory.items[0];
    expect(comment.authorRole).toBe('mentor');
    expect(comment.content).toBe('bom trade'); // trim no comentário
    expect(comment.isQuestion).toBe(false);
  });
});

describe('useTrades — addFeedbackComment (máquina de estados)', () => {
  it('mentor sobre trade OPEN: transita para REVIEWED e seta mentorFeedback legado', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedbackComment('t1', 'observação');
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('REVIEWED');
    expect(payload.mentorFeedback).toBe('observação'); // primeiro feedback do mentor
    expect(payload.feedbackHistory.items[0].authorRole).toBe('mentor');
  });

  it('mentor sobre trade QUESTION: volta para REVIEWED sem reescrever mentorFeedback legado', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'QUESTION' }) });
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedbackComment('t1', 'resposta');
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('REVIEWED');
    expect(payload.mentorFeedback).toBeUndefined(); // só no primeiro (OPEN)
  });

  it('aluno com dúvida sobre trade REVIEWED: transita para QUESTION', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'REVIEWED' }) });
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedbackComment('t1', 'não entendi', true);
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('QUESTION');
    expect(payload.feedbackHistory.items[0].authorRole).toBe('student');
    expect(payload.feedbackHistory.items[0].isQuestion).toBe(true);
  });

  it('imageUrl é anexada ao comentário quando fornecida', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.addFeedbackComment('t1', 'veja', false, 'https://img/x.png');
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.feedbackHistory.items[0].imageUrl).toBe('https://img/x.png');
  });

  it('mentor fora do escopo de revisão (#269) é bloqueado', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockInReviewScope = false;
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));

    await expect(result.current.addFeedbackComment('t1', 'x')).rejects.toThrow('Alpha');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('trade inexistente lança', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => false });
    const { result } = renderHook(() => useTrades(null));
    await expect(result.current.addFeedbackComment('tX', 'x')).rejects.toThrow('não encontrado');
  });

  // #325 — ponto pra revisão viaja com o feedback quando o trade entra em REVIEWED.
  it('mentor OPEN→REVIEWED com reviewNote: grava _pendingReviewNote', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));
    await act(async () => {
      await result.current.addFeedbackComment('t1', 'feedback', false, null, '[15/06 WIN +10] rever stop');
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('REVIEWED');
    expect(payload._pendingReviewNote).toBe('[15/06 WIN +10] rever stop');
  });

  it('mentor QUESTION→REVIEWED com reviewNote: grava _pendingReviewNote', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'QUESTION' }) });
    const { result } = renderHook(() => useTrades(null));
    await act(async () => {
      await result.current.addFeedbackComment('t1', 'resposta', false, null, 'ponto x');
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('REVIEWED');
    expect(payload._pendingReviewNote).toBe('ponto x');
  });

  it('sem reviewNote: NÃO grava _pendingReviewNote', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));
    await act(async () => {
      await result.current.addFeedbackComment('t1', 'feedback');
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect('_pendingReviewNote' in payload).toBe(false);
  });

  it('reviewNote só de espaços: NÃO grava _pendingReviewNote', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa', status: 'OPEN' }) });
    const { result } = renderHook(() => useTrades(null));
    await act(async () => {
      await result.current.addFeedbackComment('t1', 'feedback', false, null, '   ');
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect('_pendingReviewNote' in payload).toBe(false);
  });
});

describe('useTrades — addBulkFeedback', () => {
  it('aplica batch update em todos os trades e commita uma vez', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa' }) });
    const { result } = renderHook(() => useTrades(null));

    let ret;
    await act(async () => {
      ret = await result.current.addBulkFeedback(['t1', 't2', 't3'], 'feedback em massa');
    });

    expect(ret).toEqual({ success: true, count: 3 });
    expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    const firstPayload = mockBatchUpdate.mock.calls[0][1];
    expect(firstPayload.status).toBe('REVIEWED');
    expect(firstPayload.mentorFeedback).toBe('feedback em massa');
    expect(firstPayload.feedbackHistory.items[0].isBulk).toBe(true);
    expect(firstPayload.feedbackHistory.items[0].bulkCount).toBe(3);
  });

  it('bloqueado quando aluno fora do escopo (#269)', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    mockInReviewScope = false;
    mockGetDocImpl = () => ({ exists: () => true, data: () => ({ studentId: 'sa' }) });
    const { result } = renderHook(() => useTrades(null));

    await expect(result.current.addBulkFeedback(['t1'], 'x')).rejects.toThrow('Alpha');
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

describe('useTrades — updateTradeStatus', () => {
  it('grava status e updatedAt', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => useTrades(null));

    await act(async () => {
      await result.current.updateTradeStatus('t1', 'CLOSED');
    });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('CLOSED');
    expect(payload.updatedAt).toEqual({ __type: 'serverTimestamp' });
  });
});
