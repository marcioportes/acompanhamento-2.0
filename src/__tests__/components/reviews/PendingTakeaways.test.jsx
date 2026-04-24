/**
 * PendingTakeaways.test.jsx
 * @description Testes do card "Takeaways abertos da última revisão" no
 *              dashboard do aluno. Issue #119 task 27 / Fase J3.
 * @see src/components/reviews/PendingTakeaways.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockToggleAlunoDone = vi.fn();
let mockReviewState = { review: null, loading: false, error: null };
let mockWeeklyState = { actionLoading: false, toggleAlunoDone: mockToggleAlunoDone };

vi.mock('../../../hooks/useLatestClosedReview', () => ({
  __esModule: true,
  default: () => mockReviewState,
}));

vi.mock('../../../hooks/useWeeklyReviews', () => ({
  useWeeklyReviews: () => mockWeeklyState,
}));

import PendingTakeaways from '../../../components/reviews/PendingTakeaways';

const makeReview = (overrides = {}) => ({
  id: 'rev-1',
  periodKey: '2026-W17',
  weekStart: '2026-04-13',
  weekEnd: '2026-04-19',
  takeawayItems: [],
  alunoDoneIds: [],
  ...overrides,
});

describe('PendingTakeaways', () => {
  beforeEach(() => {
    mockToggleAlunoDone.mockReset();
    mockReviewState = { review: null, loading: false, error: null };
    mockWeeklyState = { actionLoading: false, toggleAlunoDone: mockToggleAlunoDone };
  });

  it('retorna null quando não há revisão CLOSED (review=null)', () => {
    const { container } = render(<PendingTakeaways studentId="student-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('retorna null quando loading=true (não ocupa espaço enquanto carrega)', () => {
    mockReviewState = { review: null, loading: true, error: null };
    const { container } = render(<PendingTakeaways studentId="student-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('retorna null quando revisão CLOSED existe mas não há takeaways pendentes', () => {
    mockReviewState = {
      review: makeReview({
        takeawayItems: [
          { id: 't-mentor', text: 'Encerrado pelo mentor', done: true },
          { id: 't-aluno', text: 'Já marcado pelo aluno', done: false },
        ],
        alunoDoneIds: ['t-aluno'],
      }),
      loading: false,
      error: null,
    };
    const { container } = render(<PendingTakeaways studentId="student-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza apenas takeaways pendentes (1 done + 1 alunoDone + 1 pendente → mostra só o pendente)', () => {
    mockReviewState = {
      review: makeReview({
        takeawayItems: [
          { id: 't-mentor', text: 'Encerrado pelo mentor', done: true },
          { id: 't-aluno', text: 'Já marcado pelo aluno', done: false },
          { id: 't-open', text: 'Único pendente', done: false },
        ],
        alunoDoneIds: ['t-aluno'],
      }),
      loading: false,
      error: null,
    };
    render(<PendingTakeaways studentId="student-1" />);
    expect(screen.getByText('Único pendente')).toBeInTheDocument();
    expect(screen.queryByText('Encerrado pelo mentor')).toBeNull();
    expect(screen.queryByText('Já marcado pelo aluno')).toBeNull();
    // Contador "1 item" (singular)
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('título do card foca na última revisão (issue #119 task 27)', () => {
    mockReviewState = {
      review: makeReview({
        takeawayItems: [{ id: 't-open', text: 'Pendente', done: false }],
      }),
      loading: false,
      error: null,
    };
    render(<PendingTakeaways studentId="student-1" />);
    expect(
      screen.getByText(/Takeaways abertos da última revisão/i),
    ).toBeInTheDocument();
  });

  it('mostra contexto "Revisão {periodKey} · {weekStart} → {weekEnd}" da última revisão', () => {
    mockReviewState = {
      review: makeReview({
        periodKey: '2026-W17',
        weekStart: '2026-04-13',
        weekEnd: '2026-04-19',
        takeawayItems: [{ id: 't1', text: 'Pendente', done: false }],
      }),
      loading: false,
      error: null,
    };
    render(<PendingTakeaways studentId="student-1" />);
    expect(
      screen.getByText(/Revisão 2026-W17 · 2026-04-13 → 2026-04-19/),
    ).toBeInTheDocument();
  });

  it('click no checkbox chama toggleAlunoDone(reviewId, itemId, true)', () => {
    mockReviewState = {
      review: makeReview({
        id: 'rev-42',
        takeawayItems: [{ id: 't-open', text: 'Pendente', done: false }],
      }),
      loading: false,
      error: null,
    };
    render(<PendingTakeaways studentId="student-1" />);
    fireEvent.click(screen.getByTitle('Marcar como feito'));
    expect(mockToggleAlunoDone).toHaveBeenCalledWith('rev-42', 't-open', true);
  });

  it('renderiza UMA única seção (não agrupa múltiplas revisões — só a última)', () => {
    mockReviewState = {
      review: makeReview({
        takeawayItems: [
          { id: 't1', text: 'Pendente A', done: false },
          { id: 't2', text: 'Pendente B', done: false },
        ],
      }),
      loading: false,
      error: null,
    };
    const { container } = render(<PendingTakeaways studentId="student-1" />);
    // Só uma "Revisão {periodKey} ..." linha de contexto
    const contextLines = container.querySelectorAll('.uppercase.tracking-wider');
    expect(contextLines.length).toBe(1);
    // Mas 2 takeaways pendentes
    expect(screen.getByText('Pendente A')).toBeInTheDocument();
    expect(screen.getByText('Pendente B')).toBeInTheDocument();
    expect(screen.getByText('2 itens')).toBeInTheDocument();
  });

  it('botão "abrir trade de origem" só aparece quando sourceTradeId presente E onNavigateToFeedback fornecido', () => {
    const onNav = vi.fn();
    mockReviewState = {
      review: makeReview({
        takeawayItems: [
          { id: 't-with', text: 'Com fonte', done: false, sourceTradeId: 'trade-99' },
          { id: 't-without', text: 'Sem fonte', done: false },
        ],
      }),
      loading: false,
      error: null,
    };
    render(
      <PendingTakeaways studentId="student-1" onNavigateToFeedback={onNav} />,
    );
    const tradeBtn = screen.getByTitle('Abrir trade de origem');
    expect(tradeBtn).toBeInTheDocument();
    fireEvent.click(tradeBtn);
    expect(onNav).toHaveBeenCalledWith({ id: 'trade-99' });
    // Apenas 1 botão de origem (o item sem sourceTradeId não renderiza)
    expect(screen.getAllByTitle('Abrir trade de origem')).toHaveLength(1);
  });
});
