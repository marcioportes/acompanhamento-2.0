/**
 * CycleConsistencyCard.test.jsx — issue #235 F2.2
 *
 * Cobre:
 *  C1 — happy path: 4 métricas + badge BCB + sem coverage warning
 *  C2 — loading=true → skeleton visível
 *  C3 — error → mensagem amigável
 *  C4 — Sharpe insufficientReason='min_days' → label "Insuficiente · ≥X dias", sem badge BCB
 *  C5 — CV insufficientReason='no_target_rr' → label do plano sem RR
 *  C6 — coverage abaixo do threshold → badge "MEP/MEN em N de M trades"
 *  C7 — DebugBadge com component="CycleConsistencyCard"
 *
 * Mocka useCycleConsistency para isolar UI da pipeline async (Selic via Firestore).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../hooks/useCycleConsistency', () => ({
  useCycleConsistency: vi.fn(),
}));

import CycleConsistencyCard from '../../../components/dashboard/CycleConsistencyCard';
import { useCycleConsistency } from '../../../hooks/useCycleConsistency';

const baseProps = {
  trades: [],
  plan: { pl: 10000, targetRR: 2, expectedWinRate: 0.5 },
  cycleStart: '2026-02-01',
  cycleEnd: '2026-02-28',
};

const happyState = {
  sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
  cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 12 },
  avgExcursion: {
    avgMEP: 1.8,
    avgMEN: -0.6,
    coverage: 1,
    coverageBelowThreshold: false,
    totalTrades: 12,
    tradesWithData: 12,
  },
  loading: false,
  error: null,
};

describe('CycleConsistencyCard', () => {
  beforeEach(() => {
    vi.mocked(useCycleConsistency).mockReset();
  });

  it('C1 — happy path renderiza 4 métricas, badge BCB e header com cycleLabel derivado', () => {
    vi.mocked(useCycleConsistency).mockReturnValue(happyState);

    render(<CycleConsistencyCard {...baseProps} />);

    // Header
    expect(screen.getByText(/Consistencia Operacional/i)).toBeTruthy();
    expect(screen.getByText('(FEV/2026)')).toBeTruthy();

    // 4 valores
    expect(screen.getByText('1.42')).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();
    expect(screen.getByText('+1.8%')).toBeTruthy();
    expect(screen.getByText('-0.6%')).toBeTruthy();
    expect(screen.getByText(/MEP \/ MEN médio/)).toBeTruthy();

    // Sharpe row label inclui o ciclo
    expect(screen.getByText(/Sharpe \(FEV\/2026\)/)).toBeTruthy();

    // Badge BCB presente, sem coverage warning
    expect(screen.getByText(/BCB/)).toBeTruthy();
    expect(screen.queryByText(/MEP\/MEN em/)).toBeNull();
  });

  it('C2 — loading=true exibe skeleton', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: null,
      cvNormalized: null,
      avgExcursion: null,
      loading: true,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByTestId('cycle-consistency-skeleton')).toBeTruthy();
    expect(screen.queryByText('1.42')).toBeNull();
  });

  it('C3 — error exibe mensagem amigável', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: null,
      cvNormalized: null,
      avgExcursion: null,
      loading: false,
      error: new Error('selic boom'),
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/Não foi possível carregar métricas do ciclo/i)).toBeTruthy();
    expect(screen.queryByTestId('cycle-consistency-skeleton')).toBeNull();
  });

  it('C4 — Sharpe insufficientReason=min_days mostra label e oculta badge BCB', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: null, daysWithTrade: 2, source: 'BCB', insufficientReason: 'min_days', fallbackUsed: false },
      cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 2 },
      avgExcursion: {
        avgMEP: 1.0, avgMEN: -0.5,
        coverage: 1, coverageBelowThreshold: false,
        totalTrades: 2, tradesWithData: 2,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} opts={{ minDays: 5 }} />);

    expect(screen.getByText(/Insuficiente · ≥5 dias/)).toBeTruthy();
    expect(screen.queryByText(/BCB/)).toBeNull();
  });

  it('C5 — CV insufficientReason=no_target_rr mostra label de plano sem RR', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
      cvNormalized: {
        value: null,
        cvObs: null,
        cvExp: null,
        daysWithTrade: 12,
        insufficientReason: 'no_target_rr',
        label: 'Plano sem RR alvo definido — definir para ativar métrica',
      },
      avgExcursion: {
        avgMEP: 1.0, avgMEN: -0.5,
        coverage: 1, coverageBelowThreshold: false,
        totalTrades: 12, tradesWithData: 12,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/Plano sem RR alvo definido/i)).toBeTruthy();
  });

  it('C6 — coverage abaixo do threshold exibe label de cobertura', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
      cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 12 },
      avgExcursion: {
        avgMEP: 1.8, avgMEN: -0.6,
        coverage: 0.5, coverageBelowThreshold: true,
        coverageLabel: '⚠ MEP/MEN em 6 de 12 trades',
        totalTrades: 12, tradesWithData: 6,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/MEP\/MEN em 6 de 12 trades/)).toBeTruthy();
  });

  it('C7 — DebugBadge presente com component="CycleConsistencyCard"', () => {
    vi.mocked(useCycleConsistency).mockReturnValue(happyState);

    render(<CycleConsistencyCard {...baseProps} />);

    // DebugBadge default render: "{component} • {VERSION.display}"
    expect(screen.getByText(/CycleConsistencyCard/)).toBeTruthy();
  });
});
