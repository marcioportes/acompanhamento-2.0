/**
 * PendingReflections.test.jsx (issue #327)
 * @description Fila "trades a refletir": filtra fechados sem selfReview, respeita
 *              planId, conta, e abre o trade ao clicar.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PendingReflections from '../../../components/reviews/PendingReflections';

const makeTrade = (overrides = {}) => ({
  id: 't1',
  symbol: 'WINFUT',
  date: '2026-06-20',
  result: 150,
  currency: 'BRL',
  planId: 'p1',
  ...overrides,
});

describe('<PendingReflections />', () => {
  it('não renderiza nada quando não há pendência', () => {
    const { container } = render(
      <PendingReflections trades={[makeTrade({ selfReview: { wouldRepeat: true } })]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('lista trades fechados sem selfReview', () => {
    render(<PendingReflections trades={[makeTrade()]} />);
    expect(screen.getByText('Trades a refletir')).toBeInTheDocument();
    expect(screen.getByText('WINFUT')).toBeInTheDocument();
  });

  it('exclui trade já refletido (com selfReview)', () => {
    render(
      <PendingReflections
        trades={[
          makeTrade({ id: 't1', symbol: 'WINFUT' }),
          makeTrade({ id: 't2', symbol: 'WDOFUT', selfReview: { wouldRepeat: false } }),
        ]}
      />
    );
    expect(screen.getByText('WINFUT')).toBeInTheDocument();
    expect(screen.queryByText('WDOFUT')).not.toBeInTheDocument();
  });

  it('exclui trade aberto (result null)', () => {
    render(
      <PendingReflections
        trades={[
          makeTrade({ id: 't1', symbol: 'WINFUT' }),
          makeTrade({ id: 't2', symbol: 'ABERTO', result: null }),
        ]}
      />
    );
    expect(screen.getByText('WINFUT')).toBeInTheDocument();
    expect(screen.queryByText('ABERTO')).not.toBeInTheDocument();
  });

  it('inclui breakeven (result 0)', () => {
    render(<PendingReflections trades={[makeTrade({ symbol: 'ZERADO', result: 0 })]} />);
    expect(screen.getByText('ZERADO')).toBeInTheDocument();
  });

  it('respeita o filtro de plano (planId)', () => {
    render(
      <PendingReflections
        planId="p1"
        trades={[
          makeTrade({ id: 't1', symbol: 'DOPLANO', planId: 'p1' }),
          makeTrade({ id: 't2', symbol: 'OUTRO', planId: 'p2' }),
        ]}
      />
    );
    expect(screen.getByText('DOPLANO')).toBeInTheDocument();
    expect(screen.queryByText('OUTRO')).not.toBeInTheDocument();
  });

  it('conta com plural correto', () => {
    render(
      <PendingReflections
        trades={[makeTrade({ id: 't1' }), makeTrade({ id: 't2', symbol: 'X' })]}
      />
    );
    expect(screen.getByText('2 trades')).toBeInTheDocument();
  });

  it('singular quando 1 trade', () => {
    render(<PendingReflections trades={[makeTrade()]} />);
    expect(screen.getByText('1 trade')).toBeInTheDocument();
  });

  it('clicar no item chama onOpenTrade com o trade', () => {
    const onOpenTrade = vi.fn();
    const trade = makeTrade();
    render(<PendingReflections trades={[trade]} onOpenTrade={onOpenTrade} />);
    fireEvent.click(screen.getByText('WINFUT'));
    expect(onOpenTrade).toHaveBeenCalledWith(trade);
  });
});
