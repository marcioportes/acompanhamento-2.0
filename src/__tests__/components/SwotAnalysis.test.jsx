/**
 * SwotAnalysis.test.jsx
 * @description Testes do SwotAnalysis refatorado para consumir review.swot
 *              (issue #164 — E1: SWOT vem da última review CLOSED).
 * @see src/components/SwotAnalysis.jsx
 * @see src/hooks/useLatestClosedReview.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockHookReturn = { review: null, loading: false, error: null };

vi.mock('../../hooks/useLatestClosedReview', () => ({
  __esModule: true,
  default: () => mockHookReturn,
}));

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import SwotAnalysis from '../../components/SwotAnalysis';

const setHook = (overrides) => {
  Object.assign(mockHookReturn, { review: null, loading: false, error: null }, overrides);
};

describe('SwotAnalysis', () => {
  beforeEach(() => {
    setHook({});
  });

  it('estado loading mostra skeleton/placeholder discreto', () => {
    setHook({ loading: true });
    render(<SwotAnalysis studentId="s1" />);
    expect(screen.getByTestId('swot-loading')).toBeInTheDocument();
  });

  it('estado vazio: sem review CLOSED mostra mensagem e CTA "Ver Revisão Semanal"', () => {
    const onNavigate = vi.fn();
    setHook({ review: null, loading: false });
    render(<SwotAnalysis studentId="s1" onNavigateToReview={onNavigate} />);
    expect(screen.getByText(/Aguardando primeira Revisão Semanal/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Ver Revisão Semanal/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('estado vazio sem onNavigateToReview: botão não aparece', () => {
    setHook({ review: null, loading: false });
    render(<SwotAnalysis studentId="s1" />);
    expect(screen.getByText(/Aguardando primeira Revisão Semanal/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver Revisão Semanal/i })).toBeNull();
  });

  it('review com swot completo renderiza os 4 quadrantes com itens', () => {
    setHook({
      review: {
        id: 'r1',
        weekStart: '2026-04-13',
        swot: {
          strengths: ['Respeitou stops', 'WR 66% em MNQ'],
          weaknesses: ['Overtrading após 15h'],
          opportunities: ['Explorar setups de abertura'],
          threats: ['Concentração em MNQ'],
          aiUnavailable: false,
          modelVersion: 'claude-sonnet-4-6',
          generatedAt: { seconds: 1712937600, nanoseconds: 0 },
          generationCount: 1,
        },
      },
    });
    render(<SwotAnalysis studentId="s1" />);
    expect(screen.getByText('Respeitou stops')).toBeInTheDocument();
    expect(screen.getByText('WR 66% em MNQ')).toBeInTheDocument();
    expect(screen.getByText('Overtrading após 15h')).toBeInTheDocument();
    expect(screen.getByText('Explorar setups de abertura')).toBeInTheDocument();
    expect(screen.getByText('Concentração em MNQ')).toBeInTheDocument();
    expect(screen.getByText(/Forças/i)).toBeInTheDocument();
    expect(screen.getByText(/Fraquezas/i)).toBeInTheDocument();
    expect(screen.getByText(/Oportunidades/i)).toBeInTheDocument();
    expect(screen.getByText(/Ameaças/i)).toBeInTheDocument();
  });

  it('aiUnavailable=false: badge verde com modelVersion', () => {
    setHook({
      review: {
        id: 'r1',
        swot: {
          strengths: ['ok'],
          weaknesses: [],
          opportunities: [],
          threats: [],
          aiUnavailable: false,
          modelVersion: 'claude-sonnet-4-6',
        },
      },
    });
    render(<SwotAnalysis studentId="s1" />);
    const badge = screen.getByTestId('swot-source-badge');
    expect(badge).toHaveTextContent(/IA/);
    expect(badge).toHaveTextContent(/claude-sonnet-4-6/);
  });

  it('aiUnavailable=true: badge amber "Fallback determinístico"', () => {
    setHook({
      review: {
        id: 'r1',
        swot: {
          strengths: ['ok'],
          weaknesses: [],
          opportunities: [],
          threats: [],
          aiUnavailable: true,
        },
      },
    });
    render(<SwotAnalysis studentId="s1" />);
    const badge = screen.getByTestId('swot-source-badge');
    expect(badge).toHaveTextContent(/Fallback determinístico/i);
  });

  it('quadrante com array vazio renderiza mensagem "Sem itens"', () => {
    setHook({
      review: {
        id: 'r1',
        swot: {
          strengths: ['força única'],
          weaknesses: [],
          opportunities: [],
          threats: [],
          aiUnavailable: false,
          modelVersion: 'x',
        },
      },
    });
    render(<SwotAnalysis studentId="s1" />);
    const semItens = screen.getAllByText(/Sem itens/i);
    expect(semItens.length).toBeGreaterThanOrEqual(3); // weaknesses, opportunities, threats
  });

  it('renderiza DebugBadge com component="SwotAnalysis"', () => {
    setHook({ review: null });
    render(<SwotAnalysis studentId="s1" />);
    expect(screen.getByTestId('debug-badge')).toHaveTextContent('SwotAnalysis');
  });
});
