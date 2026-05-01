/**
 * PendencyGuard.test.jsx
 * @description Modal de pendências do aluno (issue #220).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let mockTradesState = { trades: [], isLoading: false };
let mockReviewsState = { reviews: [], isLoading: false };

vi.mock('../../hooks/useTrades', () => ({
  useTrades: () => mockTradesState,
}));

vi.mock('../../hooks/useWeeklyReviews', () => ({
  useWeeklyReviews: () => mockReviewsState,
}));

import PendencyGuard from '../../components/PendencyGuard';

describe('PendencyGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTradesState = { trades: [], isLoading: false };
    mockReviewsState = { reviews: [], isLoading: false };
  });

  it('não renderiza nada sem pendências', () => {
    const { container } = render(<PendencyGuard studentId="u-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('não renderiza sem studentId', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    const { container } = render(<PendencyGuard studentId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza modal quando há trades REVIEWED', () => {
    mockTradesState = {
      trades: [
        { id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C', date: '2026-04-15', result: 100 },
      ],
      isLoading: false,
    };
    render(<PendencyGuard studentId="u-1" />);
    expect(screen.getByText('Você tem pendências')).toBeTruthy();
    expect(screen.getByText('Trades com feedback do mentor')).toBeTruthy();
    expect(screen.getByText('WINFUT')).toBeTruthy();
  });

  it('renderiza modal quando há takeaways abertos', () => {
    mockReviewsState = {
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          weekStart: '2026-04-13',
          takeawayItems: [{ id: 'i1', text: 'Revisar setup XYZ', done: false }],
          alunoDoneIds: [],
        },
      ],
      isLoading: false,
    };
    render(<PendencyGuard studentId="u-1" />);
    expect(screen.getByText('Takeaways abertos')).toBeTruthy();
    expect(screen.getByText('Revisar setup XYZ')).toBeTruthy();
  });

  it('mostra ambas as seções quando há trades + takeaways', () => {
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    mockReviewsState = {
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          takeawayItems: [{ id: 'i1', text: 'Item X', done: false }],
          alunoDoneIds: [],
        },
      ],
      isLoading: false,
    };
    render(<PendencyGuard studentId="u-1" />);
    expect(screen.getByText('Trades com feedback do mentor')).toBeTruthy();
    expect(screen.getByText('Takeaways abertos')).toBeTruthy();
  });

  it('clique em "OK, entendi" dispensa modal e seta sessionStorage', () => {
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    const { container } = render(<PendencyGuard studentId="u-1" />);
    fireEvent.click(screen.getByText('OK, entendi'));
    expect(container.firstChild).toBeNull();
    // Agora sessionStorage guarda fingerprint do conjunto, não '1'.
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).not.toBeNull();
  });

  it('Escape dispensa modal', () => {
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    const { container } = render(<PendencyGuard studentId="u-1" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.firstChild).toBeNull();
    // Agora sessionStorage guarda fingerprint do conjunto, não '1'.
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).not.toBeNull();
  });

  it('clique no X (botão fechar) dispensa modal', () => {
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    const { container } = render(<PendencyGuard studentId="u-1" />);
    fireEvent.click(screen.getByLabelText('Dispensar'));
    expect(container.firstChild).toBeNull();
  });

  it('clique em trade chama onNavigateToFeedback e fecha (sem persistir dismiss)', () => {
    const onNav = vi.fn();
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    const { container } = render(
      <PendencyGuard studentId="u-1" onNavigateToFeedback={onNav} />,
    );
    fireEvent.click(screen.getByText('WINFUT'));
    expect(onNav).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    expect(container.firstChild).toBeNull();
    // Importante: NÃO persiste dismiss em sessionStorage — modal pode reabrir se nova pendência surgir.
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).toBe(null);
  });

  it('clique em takeaway chama onNavigateToReviews e fecha (sem persistir dismiss)', () => {
    const onNav = vi.fn();
    mockReviewsState = {
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          takeawayItems: [{ id: 'i1', text: 'Item Y', done: false }],
          alunoDoneIds: [],
        },
      ],
      isLoading: false,
    };
    const { container } = render(
      <PendencyGuard studentId="u-1" onNavigateToReviews={onNav} />,
    );
    fireEvent.click(screen.getByText('Item Y'));
    expect(onNav).toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).toBe(null);
  });

  it('mostra contador "+N no extrato" quando há mais de 5 trades pendentes', () => {
    mockTradesState = {
      trades: Array.from({ length: 8 }, (_, i) => ({
        id: `t${i}`, status: 'REVIEWED', ticker: `T${i}`, side: 'C',
      })),
      isLoading: false,
    };
    render(<PendencyGuard studentId="u-1" />);
    expect(screen.getByText('+3 no extrato')).toBeTruthy();
  });

  it('não renderiza se sessionStorage tem fingerprint do conjunto atual (F5)', () => {
    // Pré-grava o fingerprint do set { t1 } como dispensado.
    const fp = JSON.stringify({ t: ['t1'], k: [] });
    sessionStorage.setItem('pendency_dismissed_u-1', fp);
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED', ticker: 'WINFUT', side: 'C' }],
      isLoading: false,
    };
    const { container } = render(<PendencyGuard studentId="u-1" />);
    expect(container.firstChild).toBeNull();
  });
});
