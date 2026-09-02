/**
 * #416 C2 (D-11) — `editHistory` passa a registrar as DUAS mãos.
 *
 * Até aqui o `arrayUnion` só rodava quando `auditInfo.editedBy === 'mentor'`. A edição do
 * próprio aluno bumpava `updatedAt` e sumia do histórico — e `updatedAt` é carimbo, não
 * série. Como o gate `strategy-12-months` passou a medir meses desde a última mudança de
 * parâmetro de risco, esse ponto cego faria a métrica mentir em 68% dos planos.
 *
 * `editHistory` já existe no schema de `plans` (9/28 planos) → INV-15 não é acionada:
 * escrever nele com `by: 'student'` é uso, não criação.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUpdateDoc = vi.fn(() => Promise.resolve());

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  doc: (...args) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => ({ __type: 'where', args }),
  orderBy: (...args) => ({ __type: 'orderBy', args }),
  onSnapshot: (q, onNext) => { onNext({ docs: [] }); return () => {}; },
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-plan-id' })),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
  arrayUnion: (...items) => ({ __type: 'arrayUnion', items }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => vi.fn(() => Promise.resolve({ data: { updated: 0 } })),
}));

vi.mock('../../firebase', () => ({ db: { __type: 'db' } }));

let mockAuthState = { user: null, isMentor: () => false };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));

import { usePlans } from '../../hooks/usePlans';
import { RISK_FIELDS } from '../../utils/planRiskFields';

const MENTOR = { uid: 'mentor-1', email: 'marcio.portes@me.com' };
const ALUNO = { uid: 'aluno-1', email: 'aluno@exemplo.com' };

const PLAN_DATA = { name: 'Plano', riskPerOperation: 2, rrTarget: 3, periodStop: 2, cycleStop: 5 };

/** A entrada de editHistory é o segundo updateDoc — o primeiro grava os campos. */
function entradaDeHistorico() {
  const chamada = mockUpdateDoc.mock.calls.find(
    ([, payload]) => payload && payload.editHistory,
  );
  if (!chamada) return null;
  return chamada[1].editHistory.items[0];
}

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockAuthState = { user: null, isMentor: () => false };
});

describe('#416 C2 — usePlans.updatePlan grava editHistory', () => {
  it('edição do ALUNO grava entrada com by: "student"', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => usePlans());

    // StudentDashboard chama updatePlan SEM auditInfo — é o caminho real do aluno.
    await act(async () => { await result.current.updatePlan('plan-1', PLAN_DATA); });

    const entrada = entradaDeHistorico();
    expect(entrada).not.toBeNull();
    expect(entrada.by).toBe('student');
    expect(entrada.email).toBe(ALUNO.email);
    expect(entrada.fields).toEqual(Object.keys(PLAN_DATA));
  });

  it('edição do MENTOR segue gravando by: "mentor" — não regrediu', async () => {
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result } = renderHook(() => usePlans());

    await act(async () => {
      await result.current.updatePlan('plan-1', PLAN_DATA, {
        editedBy: 'mentor', email: MENTOR.email, changedFields: ['rrTarget'],
      });
    });

    const entrada = entradaDeHistorico();
    expect(entrada.by).toBe('mentor');
    expect(entrada.email).toBe(MENTOR.email);
    expect(entrada.fields).toEqual(['rrTarget']);
  });

  it('shape idêntico nos dois caminhos', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result: rAluno } = renderHook(() => usePlans());
    await act(async () => {
      await rAluno.current.updatePlan('plan-1', PLAN_DATA, {
        editedBy: 'student', email: ALUNO.email, changedFields: ['rrTarget'],
      });
    });
    const doAluno = entradaDeHistorico();

    mockUpdateDoc.mockClear();
    mockAuthState = { user: MENTOR, isMentor: () => true };
    const { result: rMentor } = renderHook(() => usePlans());
    await act(async () => {
      await rMentor.current.updatePlan('plan-1', PLAN_DATA, {
        editedBy: 'mentor', email: MENTOR.email, changedFields: ['rrTarget'],
      });
    });
    const doMentor = entradaDeHistorico();

    expect(Object.keys(doAluno).sort()).toEqual(['by', 'email', 'fields', 'timestamp']);
    expect(Object.keys(doAluno).sort()).toEqual(Object.keys(doMentor).sort());
    expect(typeof doAluno.timestamp).toBe('string');
    expect(Number.isFinite(Date.parse(doAluno.timestamp))).toBe(true);
  });

  it('a entrada é legível pela métrica: fields cobre RISK_FIELDS', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => usePlans());
    await act(async () => { await result.current.updatePlan('plan-1', PLAN_DATA); });

    const entrada = entradaDeHistorico();
    expect(entrada.fields.some((f) => RISK_FIELDS.includes(f))).toBe(true);
  });

  it('lastEditedBy* continua trilha exclusiva de mentor', async () => {
    mockAuthState = { user: ALUNO, isMentor: () => false };
    const { result } = renderHook(() => usePlans());
    await act(async () => { await result.current.updatePlan('plan-1', PLAN_DATA); });

    const camposGravados = mockUpdateDoc.mock.calls[0][1];
    expect(camposGravados.lastEditedBy).toBeUndefined();
    expect(camposGravados.lastEditedByEmail).toBeUndefined();
    expect(camposGravados.lastEditedAt).toBeUndefined();
  });

  it('sem usuário autenticado, o email cai em "unknown" sem quebrar', async () => {
    mockAuthState = { user: null, isMentor: () => false };
    const { result } = renderHook(() => usePlans());
    await act(async () => { await result.current.updatePlan('plan-1', PLAN_DATA); });

    expect(entradaDeHistorico().email).toBe('unknown');
  });
});
