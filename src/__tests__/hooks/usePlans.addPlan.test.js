import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mocks firebase/firestore
const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-plan-id' }));
const mockServerTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
const mockOnSnapshot = vi.fn((q, onNext) => {
  onNext({ docs: [] });
  return () => {};
});

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
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...items) => ({ __type: 'arrayUnion', items }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => vi.fn(() => Promise.resolve({ data: {} })),
}));

vi.mock('../../firebase', () => ({
  db: { __type: 'db' },
}));

// useAuth configurável por teste
let mockAuthState = {
  user: null,
  isMentor: () => false,
};
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

import { usePlans } from '../../hooks/usePlans';

const MENTOR = {
  uid: 'mentor-uid-123',
  email: 'marcio.portes@me.com',
  displayName: 'Marcio Mentor',
};

const ALUNO = {
  uid: 'aluno-uid-456',
  email: 'aluno@exemplo.com',
  displayName: 'Aluno Teste',
};

const BASE_PLAN_DATA = {
  name: 'Plano Novo',
  accountId: 'account-abc',
  pl: 10000,
  plPercent: 50,
  riskPerOperation: 2,
  rrTarget: 2,
  cycleGoal: 10,
  cycleStop: 5,
  periodGoal: 2,
  periodStop: 2,
};

function lastAddDocPayload() {
  const calls = mockAddDoc.mock.calls;
  if (calls.length === 0) throw new Error('addDoc não foi chamado');
  return calls[calls.length - 1][1];
}

describe('usePlans.addPlan — issue #183 ownership', () => {
  beforeEach(() => {
    mockAddDoc.mockClear();
    mockOnSnapshot.mockClear();
  });

  it('aluno criando próprio plano: studentId = aluno.uid, createdBy = aluno.uid', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => usePlans(null));

    await act(async () => {
      await result.current.addPlan({ ...BASE_PLAN_DATA });
    });

    const payload = lastAddDocPayload();
    expect(payload.studentId).toBe(ALUNO.uid);
    expect(payload.studentEmail).toBe(ALUNO.email);
    expect(payload.studentName).toBe(ALUNO.displayName);
    expect(payload.createdBy).toBe(ALUNO.uid);
    expect(payload.createdByEmail).toBe(ALUNO.email);
  });

  it('mentor em view-as-student: studentId = aluno, createdBy = mentor', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => usePlans(ALUNO.uid));

    await act(async () => {
      await result.current.addPlan({ ...BASE_PLAN_DATA });
    });

    const payload = lastAddDocPayload();
    expect(payload.studentId).toBe(ALUNO.uid);
    // sem email/name no planData: como criador != dono, ficam null (não vazam email do mentor)
    expect(payload.studentEmail).toBeNull();
    expect(payload.studentName).toBeNull();
    expect(payload.createdBy).toBe(MENTOR.uid);
    expect(payload.createdByEmail).toBe(MENTOR.email);
  });

  it('planData.studentId tem prioridade sobre overrideStudentId', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => usePlans('outro-aluno-uid'));

    await act(async () => {
      await result.current.addPlan({
        ...BASE_PLAN_DATA,
        studentId: ALUNO.uid,
        studentEmail: ALUNO.email,
        studentName: ALUNO.displayName,
      });
    });

    const payload = lastAddDocPayload();
    expect(payload.studentId).toBe(ALUNO.uid);
    expect(payload.studentEmail).toBe(ALUNO.email);
    expect(payload.studentName).toBe(ALUNO.displayName);
    expect(payload.createdBy).toBe(MENTOR.uid);
  });

  it('mentor sem override e sem planData.studentId (fluxo legado): studentId = mentor.uid (comportamento antigo preservado quando contexto ausente)', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => usePlans(null));

    await act(async () => {
      await result.current.addPlan({ ...BASE_PLAN_DATA });
    });

    const payload = lastAddDocPayload();
    // Sem contexto de aluno, fallback é o criador (evita perder o plano)
    // Este é o cenário que o wrapper em AccountsPage/StudentDashboard deve eliminar
    expect(payload.studentId).toBe(MENTOR.uid);
    expect(payload.createdBy).toBe(MENTOR.uid);
  });

  it('aluno criando próprio plano (regressão): campos financeiros preservados', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => usePlans(null));

    await act(async () => {
      await result.current.addPlan({
        ...BASE_PLAN_DATA,
        pl: 25000,
        riskPerOperation: 1.5,
        rrTarget: 3,
      });
    });

    const payload = lastAddDocPayload();
    expect(payload.pl).toBe(25000);
    expect(payload.currentPl).toBe(25000);
    expect(payload.riskPerOperation).toBe(1.5);
    expect(payload.rrTarget).toBe(3);
    expect(payload.active).toBe(true);
  });
});
