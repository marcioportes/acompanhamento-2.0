/**
 * Step1Read.test.jsx — issue #282
 * Wiring do wizard de fechamento: grupos Performance (técnico) + Consistência
 * renderizam com a nomenclatura canônica, reusando a SSoT cycleMetricTiles.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const MOCK_PLAN = { id: 'p1', pl: 20300, riskPerOperation: 0.5, rrTarget: 2, cycleGoal: 10, cycleStop: 10 };
const MOCK_TRADES = [
  { id: 't1', planId: 'p1', date: '2026-04-01', side: 'LONG', entry: 128000, exit: 128130, result: 200, entryTime: '2026-04-01T09:38:00', exitTime: '2026-04-01T10:10:00' },
  { id: 't2', planId: 'p1', date: '2026-04-02', side: 'SHORT', entry: 128200, exit: 128260, result: -96, entryTime: '2026-04-02T14:15:00', exitTime: '2026-04-02T14:33:00' },
  { id: 't3', planId: 'p1', date: '2026-04-03', side: 'LONG', entry: 128100, exit: 128240, result: 176, entryTime: '2026-04-03T09:50:00', exitTime: '2026-04-03T10:20:00' },
];

vi.mock('../../../hooks/useTrades', () => ({ useTrades: () => ({ trades: MOCK_TRADES, loading: false }) }));
vi.mock('../../../hooks/usePlans', () => ({ usePlans: () => ({ plans: [MOCK_PLAN], loading: false }) }));
vi.mock('../../../hooks/useCycleConsistency', () => ({
  useCycleConsistency: () => ({
    sharpe: { value: 2.3, source: 'BCB', daysWithTrade: 5 },
    cvNormalized: { value: 0.59 },
    avgExcursion: { avgMEP: 1.2, avgMEN: -0.4, coverage: 1, coverageBelowThreshold: false },
    loading: false,
    error: null,
  }),
  default: () => ({}),
}));

import Step1Read from '../../../components/cycleClosure/steps/Step1Read';

const baseProps = {
  studentId: 's1', planId: 'p1',
  cycleStart: '2026-04-01', cycleEnd: '2026-04-30',
  onSnapshot: vi.fn(), onMetrics: vi.fn(),
};

describe('Step1Read — paridade de indicadores (#282)', () => {
  it('renderiza grupo PERFORMANCE com nomenclatura técnica', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getByText('Win Rate')).toBeTruthy();
    expect(screen.getByText('Payoff')).toBeTruthy();
    // técnicos que aparecem no tile e também no breakdown do TPS (mesmo nome, contextos distintos)
    expect(screen.getAllByText('Expectancy (R)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profit Factor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Max Drawdown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aderência').length).toBeGreaterThan(0);
  });

  it('renderiza grupo CONSISTÊNCIA com os 4 indicadores do dashboard', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.getByText('Consistência Operacional')).toBeTruthy();
    expect(screen.getByText('Sharpe')).toBeTruthy();
    expect(screen.getByText('CV norm.')).toBeTruthy();
    expect(screen.getByText('MEP médio')).toBeTruthy();
    expect(screen.getByText('MEN médio')).toBeTruthy();
    // valores vindos do hook mockado
    expect(screen.getByText('2.30')).toBeTruthy();   // Sharpe
    expect(screen.getByText('0.59')).toBeTruthy();   // CV norm.
    expect(screen.getByText('+1.2%')).toBeTruthy();  // MEP
    expect(screen.getByText('-0.4%')).toBeTruthy();  // MEN
  });

  it('não usa mais os rótulos didáticos antigos do wizard', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.queryByText('Lucro ÷ Prejuízo')).toBeNull();
    expect(screen.queryByText('Taxa de acerto')).toBeNull();
  });
});
