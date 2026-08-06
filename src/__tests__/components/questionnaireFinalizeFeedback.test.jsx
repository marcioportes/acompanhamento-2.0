/**
 * questionnaireFinalizeFeedback.test.jsx
 * @description Issue #343 — B1: o botão "Finalizar questionário" precisa de estado
 *              de submissão e superfície de erro. Antes, uma falha de CF caía num
 *              console.error e o clique parecia não fazer nada (paridade com o fix
 *              do #166, que só cobriu o ProbingQuestionsFlow).
 * @see src/components/Onboarding/QuestionnaireFlow.jsx
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import QuestionnaireFlow from '../../components/Onboarding/QuestionnaireFlow.jsx';
import { ALL_QUESTIONS } from '../../utils/assessmentQuestions.js';

function makeQuestionnaire(overrides = {}) {
  const allAnswered = Object.fromEntries(
    ALL_QUESTIONS.map((q) => [q.id, { questionId: q.id, type: q.type, selectedOption: 'a' }])
  );
  return {
    currentQuestion: ALL_QUESTIONS[ALL_QUESTIONS.length - 1],
    currentIndex: ALL_QUESTIONS.length - 1,
    totalQuestions: ALL_QUESTIONS.length,
    isFirstQuestion: false,
    isLastQuestion: true,
    answeredCount: ALL_QUESTIONS.length,
    progress: 1,
    progressByDimension: {},
    responses: allAnswered,
    getOrderedOptions: () => [],
    answerClosed: vi.fn(),
    answerOpen: vi.fn(),
    goNext: vi.fn(),
    goPrev: vi.fn(),
    startTimer: vi.fn(),
    isComplete: true,
    getMissingQuestions: () => [],
    ...overrides,
  };
}

describe('QuestionnaireFlow — feedback do botão Finalizar (#343)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('exibe a mensagem de erro quando a finalização falha', () => {
    render(
      <QuestionnaireFlow
        questionnaire={makeQuestionnaire()}
        onComplete={vi.fn()}
        submitError="Não foi possível finalizar o questionário."
      />
    );

    expect(
      screen.getByText('Não foi possível finalizar o questionário.')
    ).toBeInTheDocument();
  });

  it('não exibe erro nenhum no estado normal', () => {
    render(<QuestionnaireFlow questionnaire={makeQuestionnaire()} onComplete={vi.fn()} />);

    expect(screen.queryByText(/não foi possível/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalizar questionário/i })).toBeEnabled();
  });

  it('desabilita o botão e troca o rótulo enquanto submete', () => {
    render(
      <QuestionnaireFlow
        questionnaire={makeQuestionnaire()}
        onComplete={vi.fn()}
        submitting
      />
    );

    const btn = screen.getByRole('button', { name: /finalizando/i });
    expect(btn).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^finalizar questionário$/i })).toBeNull();
  });

  it('segundo clique durante a submissão não dispara nova chamada', () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <QuestionnaireFlow questionnaire={makeQuestionnaire()} onComplete={onComplete} />
    );

    fireEvent.click(screen.getByRole('button', { name: /finalizar questionário/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);

    // O pai passa a submitting=true enquanto processa
    rerender(
      <QuestionnaireFlow
        questionnaire={makeQuestionnaire()}
        onComplete={onComplete}
        submitting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /finalizando/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
