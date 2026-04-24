/**
 * MaturitySemaphoreBadge.test.jsx — issue #119 task 17 (Fase F Mentor).
 *
 * Cobre render de todas as cores (green/amber/red/unknown),
 * tooltip (label, gates, reason de regression), showLabel e embedded.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import MaturitySemaphoreBadge from '../../components/MaturitySemaphoreBadge';

describe('MaturitySemaphoreBadge', () => {
  it('renderiza testId semaphore-unknown quando maturity é null', () => {
    render(<MaturitySemaphoreBadge maturity={null} />);
    const badge = screen.getByTestId('semaphore-unknown');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toBe('Sem dados de maturidade');
    expect(badge.getAttribute('aria-label')).toBe('Maturidade: Sem dados');
  });

  it('renderiza testId semaphore-red e tooltip com reason quando há regression', () => {
    const maturity = {
      signalRegression: { detected: true, reasons: ['Queda abrupta de winrate'] },
      gatesMet: 3,
      gatesTotal: 8,
    };
    render(<MaturitySemaphoreBadge maturity={maturity} />);
    const badge = screen.getByTestId('semaphore-red');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toContain('Regressão detectada');
    expect(badge.getAttribute('title')).toContain('Queda abrupta de winrate');
  });

  it('renderiza testId semaphore-red sem reason quando reasons está vazio', () => {
    const maturity = {
      signalRegression: { detected: true, reasons: [] },
    };
    render(<MaturitySemaphoreBadge maturity={maturity} />);
    const badge = screen.getByTestId('semaphore-red');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toBe('Regressão detectada');
  });

  it('renderiza testId semaphore-green e tooltip com gates quando proposed=UP', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'UP', toStage: 'MASTERY' },
      gatesMet: 7,
      gatesTotal: 8,
    };
    render(<MaturitySemaphoreBadge maturity={maturity} />);
    const badge = screen.getByTestId('semaphore-green');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toContain('Pronto para subir');
    expect(badge.getAttribute('title')).toContain('7/8 gates');
  });

  it('renderiza testId semaphore-amber quando proposed=STAY', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'STAY' },
      gatesMet: 2,
      gatesTotal: 5,
    };
    render(<MaturitySemaphoreBadge maturity={maturity} />);
    const badge = screen.getByTestId('semaphore-amber');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('title')).toContain('Estagnado');
    expect(badge.getAttribute('title')).toContain('2/5 gates');
  });

  it('renderiza label textual quando showLabel=true', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'UP' },
    };
    render(<MaturitySemaphoreBadge maturity={maturity} showLabel />);
    expect(screen.getByText('Pronto para subir')).toBeTruthy();
  });

  it('omite label textual quando showLabel=false (default)', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'UP' },
    };
    render(<MaturitySemaphoreBadge maturity={maturity} />);
    expect(screen.queryByText('Pronto para subir')).toBeNull();
  });

  it('renderiza DebugBadge quando embedded=false', () => {
    render(<MaturitySemaphoreBadge maturity={null} embedded={false} />);
    expect(screen.getByTestId('debug-badge')).toBeTruthy();
    expect(screen.getByText('MaturitySemaphoreBadge')).toBeTruthy();
  });

  it('não renderiza DebugBadge por default (embedded=true)', () => {
    render(<MaturitySemaphoreBadge maturity={null} />);
    expect(screen.queryByTestId('debug-badge')).toBeNull();
  });
});
