/**
 * Sidebar.test.jsx — issue #119 task 26 (Fase J2).
 *
 * Cobre a inserção do item "Revisões" no menu do aluno (id `student-reviews`,
 * logo após "Feedback") e garante que o menu do mentor permanece intacto
 * (sem item aluno; "Fila de Revisão" do mentor continua presente).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

let mockAuthState = {
  user: { email: 'aluno@example.com', displayName: 'Aluno' },
  logout: vi.fn(),
  isMentor: () => false,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../version', () => ({
  VERSION: { display: 'v0.0.0-test' },
  default: { display: 'v0.0.0-test' },
}));

import Sidebar from '../../components/Sidebar';

const baseProps = {
  currentView: 'dashboard',
  onViewChange: vi.fn(),
  collapsed: false,
  onToggle: vi.fn(),
};

describe('Sidebar — menu do aluno', () => {
  beforeEach(() => {
    mockAuthState = {
      user: { email: 'aluno@example.com', displayName: 'Aluno' },
      logout: vi.fn(),
      isMentor: () => false,
    };
  });

  it('renderiza item "Revisões" logo após "Feedback"', () => {
    const { container } = render(<Sidebar {...baseProps} />);

    const nav = container.querySelector('nav');
    const buttons = within(nav).getAllByRole('button');
    const labels = buttons.map((b) => b.textContent);

    const feedbackIdx = labels.findIndex((l) => /Feedback/.test(l));
    const reviewsIdx = labels.findIndex((l) => /^Revisões/.test(l));

    expect(feedbackIdx).toBeGreaterThanOrEqual(0);
    expect(reviewsIdx).toBe(feedbackIdx + 1);
  });

  it('clique em "Revisões" chama onViewChange com id "student-reviews"', () => {
    const onViewChange = vi.fn();
    render(<Sidebar {...baseProps} onViewChange={onViewChange} />);

    const btn = screen.getByText('Revisões').closest('button');
    btn.click();

    expect(onViewChange).toHaveBeenCalledWith('student-reviews');
  });
});

describe('Sidebar — menu do mentor', () => {
  beforeEach(() => {
    mockAuthState = {
      user: { email: 'mentor@example.com', displayName: 'Mentor' },
      logout: vi.fn(),
      isMentor: () => true,
    };
  });

  it('não mostra item "Revisões" (aluno) mas mostra "Fila de Revisão" (mentor)', () => {
    render(<Sidebar {...baseProps} />);

    expect(screen.queryByText('Revisões')).toBeNull();
    expect(screen.getByText('Fila de Revisão')).toBeInTheDocument();
  });

  it('clique em "Fila de Revisão" chama onViewChange com id "reviews" (não "student-reviews")', () => {
    const onViewChange = vi.fn();
    render(<Sidebar {...baseProps} onViewChange={onViewChange} />);

    const btn = screen.getByText('Fila de Revisão').closest('button');
    btn.click();

    expect(onViewChange).toHaveBeenCalledWith('reviews');
    expect(onViewChange).not.toHaveBeenCalledWith('student-reviews');
  });
});
