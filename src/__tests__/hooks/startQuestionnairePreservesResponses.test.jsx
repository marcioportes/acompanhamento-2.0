/**
 * startQuestionnairePreservesResponses.test.jsx
 * @description Issue #343 — C1: reabrir o questionário não pode destruir respostas.
 *              DEC-026 promete que o reset do mentor preserva o histórico, mas o
 *              `setDoc` sem merge do startQuestionnaire zerava `responses` na
 *              reativação. Cobre os dois caminhos: com e sem respostas gravadas.
 * @see src/hooks/useAssessment.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const setDocCalls = [];
const updateDocCalls = [];
let questionnaireSnap = { exists: false, data: null };

vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ __type: 'doc', path: segments.join('/') }),
  getDoc: async (ref) => ({
    exists: () => ref.path.endsWith('assessment/questionnaire') && questionnaireSnap.exists,
    data: () => questionnaireSnap.data,
  }),
  setDoc: async (ref, data) => {
    setDocCalls.push({ path: ref.path, data });
  },
  updateDoc: async (ref, data) => {
    updateDocCalls.push({ path: ref.path, data });
  },
  // O hook depende do listener do doc do aluno para popular onboardingStatus —
  // sem emitir, a state machine rejeita a transição para pre_assessment.
  onSnapshot: (ref, onNext) => {
    const isStudentDoc = /^students\/[^/]+$/.test(ref.path);
    onNext({
      exists: () => isStudentDoc,
      data: () => (isStudentDoc ? { onboardingStatus: 'lead' } : null),
    });
    return () => {};
  },
  serverTimestamp: () => '__serverTimestamp__',
}));

vi.mock('../../firebase', () => ({ db: { __type: 'db' } }));

import { useAssessment } from '../../hooks/useAssessment.js';

const STUDENT = 'student-abc';
const qPath = `students/${STUDENT}/assessment/questionnaire`;

function responsesFixture(n) {
  return Array.from({ length: n }, (_, i) => ({
    questionId: `EMO-${String(i + 1).padStart(2, '0')}`,
    type: 'closed',
    selectedOption: 'a',
  }));
}

describe('useAssessment.startQuestionnaire — preservação de respostas (#343)', () => {
  beforeEach(() => {
    setDocCalls.length = 0;
    updateDocCalls.length = 0;
    questionnaireSnap = { exists: false, data: null };
  });

  it('cria o doc zerado quando o aluno nunca respondeu nada', async () => {
    const { result } = renderHook(() => useAssessment(STUDENT));

    await act(async () => {
      await result.current.startQuestionnaire();
    });

    const created = setDocCalls.find((c) => c.path === qPath);
    expect(created).toBeDefined();
    expect(created.data.responses).toEqual([]);
    expect(created.data.completedAt).toBeNull();
  });

  it('NÃO sobrescreve responses quando já existem respostas gravadas', async () => {
    questionnaireSnap = {
      exists: true,
      data: { responses: responsesFixture(34), completedAt: null },
    };

    const { result } = renderHook(() => useAssessment(STUDENT));

    await act(async () => {
      await result.current.startQuestionnaire();
    });

    // Nenhum setDoc no doc do questionário — seria a escrita destrutiva
    expect(setDocCalls.filter((c) => c.path === qPath)).toHaveLength(0);

    const reopened = updateDocCalls.find((c) => c.path === qPath);
    expect(reopened).toBeDefined();
    expect(reopened.data).not.toHaveProperty('responses');
    expect(reopened.data.completedAt).toBeNull();
  });

  it('trata doc existente com responses vazio como início do zero', async () => {
    questionnaireSnap = { exists: true, data: { responses: [] } };

    const { result } = renderHook(() => useAssessment(STUDENT));

    await act(async () => {
      await result.current.startQuestionnaire();
    });

    const created = setDocCalls.find((c) => c.path === qPath);
    expect(created).toBeDefined();
    expect(created.data.responses).toEqual([]);
  });
});
