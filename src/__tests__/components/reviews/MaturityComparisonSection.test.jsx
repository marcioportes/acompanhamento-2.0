/**
 * MaturityComparisonSection.test.jsx
 * @description Testes do componente que exibe evolução de maturidade 4D
 *              entre review N e N-1 CLOSED/ARCHIVED do mesmo plano.
 *              Issue #119 task 16 / Fase E2.
 * @see src/components/reviews/MaturityComparisonSection.jsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import MaturityComparisonSection from '../../../components/reviews/MaturityComparisonSection';

const makeSnapshot = (overrides = {}) => ({
  currentStage: 2,
  dimensionScores: {
    emotional: 50,
    financial: 60,
    operational: 55,
    maturity: 40,
    composite: 52,
  },
  gates: [],
  ...overrides,
});

describe('MaturityComparisonSection', () => {
  it('renderiza skeleton de loading quando loading=true', () => {
    render(<MaturityComparisonSection current={null} previous={null} loading />);
    expect(screen.getByText(/Carregando comparativo/i)).toBeInTheDocument();
  });

  it('renderiza fallback "Comparativo indisponível" quando error truthy', () => {
    render(
      <MaturityComparisonSection
        current={null}
        previous={null}
        error={new Error('permission-denied')}
      />,
    );
    expect(screen.getByText(/Comparativo indisponível/i)).toBeInTheDocument();
  });

  it('retorna null (nada renderizado) quando current é null e não há loading/error', () => {
    const { container } = render(
      <MaturityComparisonSection current={null} previous={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('mostra "Primeira revisão fechada" quando previous=null e current presente', () => {
    const current = makeSnapshot({ currentStage: 2 });
    render(<MaturityComparisonSection current={current} previous={null} />);
    expect(screen.getByText(/Primeira revisão fechada/i)).toBeInTheDocument();
    expect(screen.getByText(/Evolução desde a revisão anterior/i)).toBeInTheDocument();
  });

  it('renderiza deltas de score, stage badge e gates quando current+previous presentes', () => {
    const current = makeSnapshot({
      currentStage: 3,
      dimensionScores: { emotional: 70, financial: 75, operational: 65, maturity: 55, composite: 68 },
      gates: [
        { id: 'g1', label: 'Gate conquistado', met: true, value: 90 },
        { id: 'g2', label: 'Gate perdido', met: false, value: 40 },
      ],
    });
    const previous = makeSnapshot({
      currentStage: 2,
      dimensionScores: { emotional: 50, financial: 60, operational: 55, maturity: 40, composite: 52 },
      gates: [
        { id: 'g1', label: 'Gate conquistado', met: false, value: 60 },
        { id: 'g2', label: 'Gate perdido', met: true, value: 80 },
      ],
    });
    render(<MaturityComparisonSection current={current} previous={previous} />);

    // Score deltas presentes
    const scoreBlock = screen.getByTestId('score-deltas');
    expect(within(scoreBlock).getByText('+20.0')).toBeInTheDocument(); // emotional
    expect(within(scoreBlock).getByText('+16.0')).toBeInTheDocument(); // composite

    // Stage badge mostra UP com nomes
    expect(screen.getByText(/Stage avançou/i)).toBeInTheDocument();
    expect(screen.getByText(/METHODICAL/)).toBeInTheDocument();

    // Gates conquistados / perdidos
    expect(screen.getByTestId('gates-gained')).toBeInTheDocument();
    expect(screen.getByTestId('gates-lost')).toBeInTheDocument();
    expect(screen.getByText(/Gate conquistado/)).toBeInTheDocument();
    expect(screen.getByText(/Gate perdido/)).toBeInTheDocument();
  });

  it('mostra badge "Stage avançou" com classes verde (UP)', () => {
    const current = makeSnapshot({ currentStage: 3 });
    const previous = makeSnapshot({ currentStage: 2 });
    const { container } = render(
      <MaturityComparisonSection current={current} previous={previous} />,
    );
    const badge = container.querySelector('.bg-emerald-500\\/20');
    expect(badge).not.toBeNull();
    expect(screen.getByText(/Stage avançou/i)).toBeInTheDocument();
  });

  it('mostra badge "Stage regrediu" com classes vermelho (DOWN)', () => {
    const current = makeSnapshot({ currentStage: 2 });
    const previous = makeSnapshot({ currentStage: 3 });
    const { container } = render(
      <MaturityComparisonSection current={current} previous={previous} />,
    );
    const badge = container.querySelector('.bg-red-500\\/20');
    expect(badge).not.toBeNull();
    expect(screen.getByText(/Stage regrediu/i)).toBeInTheDocument();
  });

  it('mostra badge "Stage mantido" com classes slate (SAME)', () => {
    const current = makeSnapshot({ currentStage: 2 });
    const previous = makeSnapshot({ currentStage: 2 });
    render(<MaturityComparisonSection current={current} previous={previous} />);
    expect(screen.getByText(/Stage mantido/i)).toBeInTheDocument();
  });

  it('exibe gates pendentes com truncamento acima de 5', () => {
    const gates = Array.from({ length: 8 }, (_, i) => ({
      id: `g-pending-${i}`,
      label: `Gate pendente ${i}`,
      met: false,
      value: 10,
    }));
    const current = makeSnapshot({ currentStage: 2, gates });
    const previous = makeSnapshot({ currentStage: 2, gates });
    render(<MaturityComparisonSection current={current} previous={previous} />);
    expect(screen.getByTestId('gates-stagnant')).toBeInTheDocument();
    expect(screen.getByText(/\.\.\. e mais 3/)).toBeInTheDocument();
  });

  it('inclui DebugBadge com component="MaturityComparisonSection" em modo não-embedded', () => {
    const current = makeSnapshot({ currentStage: 2 });
    const previous = makeSnapshot({ currentStage: 2 });
    render(<MaturityComparisonSection current={current} previous={previous} />);
    const badge = screen.getByTestId('debug-badge');
    expect(badge).toHaveTextContent('MaturityComparisonSection');
  });

  it('omite DebugBadge quando embedded=true', () => {
    const current = makeSnapshot({ currentStage: 2 });
    const previous = makeSnapshot({ currentStage: 2 });
    render(<MaturityComparisonSection current={current} previous={previous} embedded />);
    expect(screen.queryByTestId('debug-badge')).toBeNull();
  });
});
