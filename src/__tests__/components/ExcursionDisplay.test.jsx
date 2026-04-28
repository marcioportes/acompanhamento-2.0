/**
 * ExcursionDisplay.test.jsx — issue #187 Fase 2.5 (display universal)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExcursionDisplay from '../../components/ExcursionDisplay';

const baseTrade = {
  ticker: 'WINM26',
  side: 'LONG',
  entry: 194235,
  mepPrice: 194245,
  menPrice: 194055,
  excursionSource: 'profitpro',
};

describe('ExcursionDisplay — null guards', () => {
  it('retorna null para trade null/undefined', () => {
    const { container: c1 } = render(<ExcursionDisplay trade={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<ExcursionDisplay trade={undefined} />);
    expect(c2.firstChild).toBeNull();
  });

  it('compact: retorna null quando trade não tem MEP/MEN nem fonte', () => {
    const { container } = render(
      <ExcursionDisplay trade={{ ...baseTrade, mepPrice: null, menPrice: null, excursionSource: null }} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ExcursionDisplay — variant compact', () => {
  it('renderiza pts para futures LONG', () => {
    render(<ExcursionDisplay trade={baseTrade} variant="compact" />);
    expect(screen.getByText(/\+10 pts/)).toBeInTheDocument();
    expect(screen.getByText(/-180 pts/)).toBeInTheDocument();
  });

  it('renderiza % para equity LONG', () => {
    render(
      <ExcursionDisplay
        trade={{ ticker: 'PETR4', side: 'LONG', entry: 100, mepPrice: 105, menPrice: 98, excursionSource: 'manual' }}
        variant="compact"
      />
    );
    expect(screen.getByText(/\+5 %/)).toBeInTheDocument();
    expect(screen.getByText(/-2 %/)).toBeInTheDocument();
  });

  it('mostra badge da fonte', () => {
    render(<ExcursionDisplay trade={baseTrade} variant="compact" />);
    expect(screen.getByText('profitpro')).toBeInTheDocument();
  });

  it('renderiza apenas MEP quando MEN é null', () => {
    render(
      <ExcursionDisplay
        trade={{ ...baseTrade, menPrice: null, excursionSource: null }}
        variant="compact"
      />
    );
    expect(screen.getByText(/\+10 pts/)).toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });
});

describe('ExcursionDisplay — variant full', () => {
  it('renderiza grid 3-col com MEP, MEN e Fonte', () => {
    render(<ExcursionDisplay trade={baseTrade} variant="full" />);
    expect(screen.getByText('MEP')).toBeInTheDocument();
    expect(screen.getByText('MEN')).toBeInTheDocument();
    expect(screen.getByText('Fonte')).toBeInTheDocument();
    expect(screen.getByText(/\+10 pts/)).toBeInTheDocument();
    expect(screen.getByText(/-180 pts/)).toBeInTheDocument();
    expect(screen.getByText('profitpro')).toBeInTheDocument();
  });

  it('renderiza traço para campo ausente em variant full', () => {
    render(
      <ExcursionDisplay
        trade={{ ...baseTrade, mepPrice: null, menPrice: null }}
        variant="full"
      />
    );
    // Deve renderizar (excursionSource existe), mas com — nos valores
    expect(screen.getByText('MEP')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('ExcursionDisplay — SHORT side', () => {
  it('SHORT futures: MEP positivo (preço caiu), MEN negativo (preço subiu)', () => {
    render(
      <ExcursionDisplay
        trade={{ ticker: 'NQH6', side: 'SHORT', entry: 18000, mepPrice: 17950, menPrice: 18030, excursionSource: 'yahoo' }}
        variant="compact"
      />
    );
    expect(screen.getByText(/\+50 pts/)).toBeInTheDocument();
    expect(screen.getByText(/-30 pts/)).toBeInTheDocument();
  });
});
