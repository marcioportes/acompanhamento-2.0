/**
 * ReviewKpiGrid.test.jsx
 * @description Testes da grade de 8 KPIs congelados com delta opcional
 *              vs revisão anterior. Issue #119 task 28.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewKpiGrid from '../../../components/reviews/ReviewKpiGrid';

const makeKpis = (overrides = {}) => ({
  wr: 58.3,
  payoff: 1.82,
  profitFactor: 2.15,
  evPerTrade: 12.5,
  avgRR: 1.65,
  compliance: { overall: 82.5 },
  coefVariation: 1.05,
  avgHoldTimeMin: 8,
  avgHoldTimeWinMin: 12,
  avgHoldTimeLossMin: 4,
  ...overrides,
});

describe('<ReviewKpiGrid />', () => {
  it('mostra placeholder quando kpis ausente', () => {
    render(<ReviewKpiGrid kpis={null} />);
    expect(screen.getByText(/Snapshot indisponível/i)).toBeInTheDocument();
  });

  it('renderiza os 8 KPIs (labels)', () => {
    render(<ReviewKpiGrid kpis={makeKpis()} />);
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('Payoff')).toBeInTheDocument();
    expect(screen.getByText('Profit factor')).toBeInTheDocument();
    expect(screen.getByText('EV / trade')).toBeInTheDocument();
    expect(screen.getByText('RR médio')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Coef. variação')).toBeInTheDocument();
    expect(screen.getByText('Tempo médio')).toBeInTheDocument();
  });

  it('sem prevKpis, não exibe deltas (nem "anterior:")', () => {
    render(<ReviewKpiGrid kpis={makeKpis()} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/anterior:/i)).not.toBeInTheDocument();
  });

  it('com prevKpis melhores, delta positivo e texto "anterior:" aparece', () => {
    const curr = makeKpis({ wr: 62, payoff: 2.0 });
    const prev = makeKpis({ wr: 55, payoff: 1.5 });
    render(<ReviewKpiGrid kpis={curr} prevKpis={prev} />);
    // delta de wr: +7.0%
    expect(screen.getByText('+7.0%')).toBeInTheDocument();
    // delta de payoff: +0.50
    expect(screen.getByText('+0.50')).toBeInTheDocument();
    // rótulo anterior
    expect(screen.getAllByText(/anterior:/i).length).toBeGreaterThan(0);
  });

  it('com prevKpis iguais, delta é "="', () => {
    const curr = makeKpis({ wr: 50 });
    const prev = makeKpis({ wr: 50 });
    render(<ReviewKpiGrid kpis={curr} prevKpis={prev} />);
    expect(screen.getAllByText('=').length).toBeGreaterThan(0);
  });

  it('coefVariation usa invertColors (maior = pior)', () => {
    const curr = makeKpis({ coefVariation: 1.5 });
    const prev = makeKpis({ coefVariation: 1.0 });
    const { container } = render(<ReviewKpiGrid kpis={curr} prevKpis={prev} />);
    // O delta +0.50 deve aparecer com classe vermelha (pior)
    const delta = screen.getByText('+0.50');
    expect(delta.className).toMatch(/red/);
  });

  it('currency BRL formata com R$', () => {
    render(<ReviewKpiGrid kpis={makeKpis({ evPerTrade: 12.5 })} currency="BRL" />);
    expect(screen.getByText(/R\$/)).toBeInTheDocument();
  });
});
