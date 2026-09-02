/**
 * Step6Adjust.test.jsx — issue #416 (A1/A2)
 *
 * O card de projeção do próximo ciclo dividia as somas do Monte Carlo pela
 * constante `1000` em vez do capital base — errava por ~30× num número
 * forward-looking. E anunciava o pool amostral com string fixa.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const MOCK_PLAN = { id: 'p1', pl: 29000, riskPerOperation: 0.5, rrTarget: 2, cycleGoal: 10, cycleStop: 10 };
const MOCK_TRADES = Array.from({ length: 20 }, (_, i) => ({
  id: `t${i}`, planId: 'p1', date: '2026-08-03',
  result: i % 3 === 0 ? -180 : 140,
}));

// Capital base = snapshot.plEnd (advisePlanAdjustment:92) — R$ 30.426 no ciclo real.
const SNAPSHOT = { plEnd: 30426, resultPercent: 4.9, stopBreach: null };

// Percentis do ciclo de agosto/2026, em R$ (bootstrap aditivo de trade.result).
const MC = {
  samplePool: 'last100', samplePoolSize: 20, nSims: 1000, nPerSim: 20,
  p10: -1355, p25: -400, p50: 405, p75: 1300, p90: 2270,
  min: -4000, max: 6000, mean: 420, reason: null,
};

vi.mock('../../../hooks/useTrades', () => ({ useTrades: () => ({ trades: MOCK_TRADES, loading: false }) }));
vi.mock('../../../hooks/useAccounts', () => ({ useAccounts: () => ({ accounts: [], loading: false }) }));

const plansMock = { plans: [MOCK_PLAN] };
vi.mock('../../../hooks/usePlans', () => ({ usePlans: () => ({ plans: plansMock.plans, loading: false }) }));

// projectNextCycle é estocástico — fixamos a saída. pctOfBase (o que está sob
// teste) segue sendo o real.
vi.mock('../../../utils/cycleClosure/monteCarlo', async (importOriginal) => ({
  ...(await importOriginal()),
  projectNextCycle: () => MC,
}));

import Step6Adjust from '../../../components/cycleClosure/steps/Step6Adjust';

const baseProps = {
  studentId: 's1', planId: 'p1',
  cycleStart: '2026-08-01', cycleEnd: '2026-08-31',
  metrics: { maxDrawdown: { percent: 0.039 }, ruleAdherenceRate: 0.9 },
  snapshot: SNAPSHOT,
  patterns: { eventCounts: {} },
  forward: {},
  maturityRegression: [],
  onChange: vi.fn(),
  onBlockSeal: vi.fn(),
};

describe('Step6Adjust — Monte Carlo sobre o capital base (#416 A1)', () => {
  beforeEach(() => { plansMock.plans = [MOCK_PLAN]; });

  it('converte os percentis sobre baseCapital, não sobre a constante 1000', () => {
    render(<Step6Adjust {...baseProps} />);
    // 405 / 30426 → +1.3% (antes: 405 / 1000 → +40.5%)
    expect(screen.getByText('+1.3%')).toBeTruthy();
    expect(screen.getByText('-4.5%')).toBeTruthy();
    expect(screen.getByText('+7.5%')).toBeTruthy();
    expect(screen.queryByText('+40.5%')).toBeNull();
    expect(screen.queryByText('-135.5%')).toBeNull();
    expect(screen.queryByText('+227.0%')).toBeNull();
  });

  it('anuncia o capital base usado na conversão', () => {
    const { container } = render(<Step6Adjust {...baseProps} />);
    expect(container.textContent).toContain('Sobre o capital base R$ 30.426,00');
  });

  it('exibe o tamanho real do pool amostral, não string fixa', () => {
    const { container } = render(<Step6Adjust {...baseProps} />);
    expect(container.textContent).toContain('base = 20 trades do plano');
    expect(container.textContent).not.toContain('últimos 100 trades');
  });

  it('distingue pool do ciclo anterior mantendo a contagem verdadeira', () => {
    MC.samplePool = 'priorCycle';
    MC.samplePoolSize = 34;
    try {
      const { container } = render(<Step6Adjust {...baseProps} />);
      expect(container.textContent).toContain('base = 34 trades do ciclo anterior');
    } finally {
      MC.samplePool = 'last100';
      MC.samplePoolSize = 20;
    }
  });

  it('sem capital base utilizável, exibe em R$ e omite o percentual (D-01)', () => {
    plansMock.plans = [{ ...MOCK_PLAN, pl: 0 }];
    const { container } = render(
      <Step6Adjust {...baseProps} snapshot={{ resultPercent: null, stopBreach: null }} />,
    );
    expect(container.textContent).toContain('capital base indisponível');
    expect(container.textContent).toContain('R$ 405,00');
    expect(screen.queryByText('+1.3%')).toBeNull();
    expect(screen.queryByText('+40.5%')).toBeNull();
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('Infinity');
  });
});
