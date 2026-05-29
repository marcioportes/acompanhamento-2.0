/**
 * SwotAnalysis.test.jsx
 * @description Testes do SwotAnalysis. A partir do #289 (Fase 2) o componente é
 *              presentacional: recebe `review`/`loading` como props (o fetch com
 *              filtro de ciclo foi elevado ao StudentDashboard e compartilhado
 *              com o card de Maturidade).
 * @see src/components/SwotAnalysis.jsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import SwotAnalysis from '../../components/SwotAnalysis';

describe('SwotAnalysis', () => {
  it('estado loading mostra skeleton/placeholder discreto', () => {
    render(<SwotAnalysis loading review={null} />);
    expect(screen.getByTestId('swot-loading')).toBeInTheDocument();
  });

  it('estado vazio: sem review CLOSED mostra mensagem e CTA "Ver Revisão Semanal"', () => {
    const onNavigate = vi.fn();
    render(<SwotAnalysis review={null} loading={false} onNavigateToReview={onNavigate} />);
    expect(screen.getByText(/Aguardando primeira Revisão Semanal/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Ver Revisão Semanal/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('estado vazio sem onNavigateToReview: botão não aparece', () => {
    render(<SwotAnalysis review={null} loading={false} />);
    expect(screen.getByText(/Aguardando primeira Revisão Semanal/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver Revisão Semanal/i })).toBeNull();
  });

  it('review com swot completo renderiza os 4 quadrantes com itens', () => {
    const review = {
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
    };
    render(<SwotAnalysis review={review} loading={false} />);
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
    const review = {
      id: 'r1',
      swot: {
        strengths: ['ok'], weaknesses: [], opportunities: [], threats: [],
        aiUnavailable: false, modelVersion: 'claude-sonnet-4-6',
      },
    };
    render(<SwotAnalysis review={review} loading={false} />);
    const badge = screen.getByTestId('swot-source-badge');
    expect(badge).toHaveTextContent(/IA/);
    expect(badge).toHaveTextContent(/claude-sonnet-4-6/);
  });

  it('aiUnavailable=true: badge amber "Fallback determinístico"', () => {
    const review = {
      id: 'r1',
      swot: {
        strengths: ['ok'], weaknesses: [], opportunities: [], threats: [],
        aiUnavailable: true,
      },
    };
    render(<SwotAnalysis review={review} loading={false} />);
    const badge = screen.getByTestId('swot-source-badge');
    expect(badge).toHaveTextContent(/Fallback determinístico/i);
  });

  it('quadrante com array vazio renderiza mensagem "Sem itens"', () => {
    const review = {
      id: 'r1',
      swot: {
        strengths: ['força única'], weaknesses: [], opportunities: [], threats: [],
        aiUnavailable: false, modelVersion: 'x',
      },
    };
    render(<SwotAnalysis review={review} loading={false} />);
    const semItens = screen.getAllByText(/Sem itens/i);
    expect(semItens.length).toBeGreaterThanOrEqual(3); // weaknesses, opportunities, threats
  });

  it('renderiza DebugBadge com component="SwotAnalysis"', () => {
    render(<SwotAnalysis review={null} loading={false} />);
    expect(screen.getByTestId('debug-badge')).toHaveTextContent('SwotAnalysis');
  });
});
