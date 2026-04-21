/**
 * Tests for ProbingQuestionsFlow finalizar button — issue #166
 * Covers: success, error, loading state, and double-click guard.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import ProbingQuestionsFlow from '../../components/Onboarding/ProbingQuestionsFlow.jsx';

function makeProbing(overrides = {}) {
  return {
    currentProbingQuestion: null,
    currentProbingIndex: 3,
    totalProbingQuestions: 3,
    isProbingComplete: true,
    analyzing: false,
    error: null,
    answerProbingQuestion: vi.fn(),
    completeAllProbing: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProbingQuestionsFlow — botão Finalizar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('chama onComplete após completeAllProbing resolver', async () => {
    const onComplete = vi.fn();
    const probing = makeProbing();

    render(<ProbingQuestionsFlow probing={probing} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    await waitFor(() => {
      expect(probing.completeAllProbing).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('NÃO chama onComplete quando completeAllProbing rejeita; exibe mensagem de erro', async () => {
    const onComplete = vi.fn();
    const probing = makeProbing({
      completeAllProbing: vi.fn().mockRejectedValue(new Error('network fail')),
    });

    render(<ProbingQuestionsFlow probing={probing} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText('Erro ao finalizar. Tente novamente.')).toBeInTheDocument();
    });
  });

  it('desabilita botão e exibe spinner durante execução', async () => {
    let resolve;
    const deferred = new Promise((r) => { resolve = r; });
    const probing = makeProbing({ completeAllProbing: vi.fn(() => deferred) });

    render(<ProbingQuestionsFlow probing={probing} onComplete={vi.fn()} />);

    const btn = screen.getByRole('button', { name: /finalizar/i });

    act(() => { fireEvent.click(btn); });

    await waitFor(() => {
      expect(btn).toBeDisabled();
      expect(screen.getByText('Finalizando...')).toBeInTheDocument();
    });

    await act(async () => { resolve(); });
  });

  it('segundo clique durante execução não dispara nova chamada', async () => {
    let resolve;
    const deferred = new Promise((r) => { resolve = r; });
    const completeAllProbing = vi.fn(() => deferred);
    const probing = makeProbing({ completeAllProbing });

    render(<ProbingQuestionsFlow probing={probing} onComplete={vi.fn()} />);

    const btn = screen.getByRole('button', { name: /finalizar/i });

    act(() => { fireEvent.click(btn); });

    await waitFor(() => expect(btn).toBeDisabled());

    fireEvent.click(btn);

    await act(async () => { resolve(); });

    expect(completeAllProbing).toHaveBeenCalledTimes(1);
  });
});
