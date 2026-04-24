/**
 * ReviewTradesSection.test.jsx
 * @description Testes da tabela de trades read-only com day-grouping e link
 *              opcional para FeedbackPage. Issue #119 task 28.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewTradesSection from '../../../components/reviews/ReviewTradesSection';

const makeTrade = (overrides = {}) => ({
  tradeId: 't1',
  symbol: 'MES',
  side: 'LONG',
  qty: 2,
  pnl: 15,
  entryTime: '2026-04-24T09:05:00-03:00',
  ...overrides,
});

describe('<ReviewTradesSection />', () => {
  it('placeholder quando sem trades', () => {
    render(<ReviewTradesSection trades={[]} />);
    expect(screen.getByText(/Sem trades no período/i)).toBeInTheDocument();
  });

  it('renderiza trades flat quando ≤2 por dia', () => {
    const trades = [
      makeTrade({ tradeId: 't1', pnl: 10 }),
      makeTrade({ tradeId: 't2', pnl: -5, entryTime: '2026-04-24T10:00:00-03:00' }),
    ];
    render(<ReviewTradesSection trades={trades} />);
    // Duas linhas de trade (sem daySummary)
    expect(screen.getAllByText('MES').length).toBe(2);
  });

  it('agrupa dia com 3+ trades em daySummary colapsado', () => {
    const trades = [
      makeTrade({ tradeId: 't1', pnl: 10 }),
      makeTrade({ tradeId: 't2', pnl: -5, entryTime: '2026-04-24T10:00:00-03:00' }),
      makeTrade({ tradeId: 't3', pnl: 20, entryTime: '2026-04-24T11:00:00-03:00' }),
    ];
    render(<ReviewTradesSection trades={trades} />);
    expect(screen.getByText(/3 trades/)).toBeInTheDocument();
    // colapsado → só resumo, detalhes individuais não visíveis
    expect(screen.queryAllByText('MES')).toHaveLength(0);
  });

  it('click no daySummary expande', () => {
    const trades = [
      makeTrade({ tradeId: 't1' }),
      makeTrade({ tradeId: 't2', entryTime: '2026-04-24T10:00:00-03:00' }),
      makeTrade({ tradeId: 't3', entryTime: '2026-04-24T11:00:00-03:00' }),
    ];
    render(<ReviewTradesSection trades={trades} />);
    fireEvent.click(screen.getByText(/3 trades/));
    expect(screen.getAllByText('MES').length).toBe(3);
  });

  it('sem onNavigateToFeedback, não renderiza botão de feedback', () => {
    const trades = [makeTrade()];
    const { container } = render(<ReviewTradesSection trades={trades} />);
    expect(container.querySelector('button[title="Abrir feedback do trade"]')).toBeNull();
  });

  it('com onNavigateToFeedback, click no botão chama com trade', () => {
    const onNav = vi.fn();
    const trades = [makeTrade()];
    render(<ReviewTradesSection trades={trades} onNavigateToFeedback={onNav} />);
    const btn = screen.getByTitle('Abrir feedback do trade');
    fireEvent.click(btn);
    expect(onNav).toHaveBeenCalledOnce();
    expect(onNav).toHaveBeenCalledWith(expect.objectContaining({
      id: 't1',
      ticker: 'MES',
      tradeId: 't1',
    }));
  });

  it('trade sem tradeId não renderiza botão mesmo com onNavigateToFeedback', () => {
    const onNav = vi.fn();
    const trades = [makeTrade({ tradeId: null })];
    render(<ReviewTradesSection trades={trades} onNavigateToFeedback={onNav} />);
    expect(screen.queryByTitle('Abrir feedback do trade')).toBeNull();
  });

  it('marca trade "fora" quando outOfPeriod (weekStart/weekEnd fornecidos)', () => {
    const trades = [makeTrade({ entryTime: '2026-04-30T09:00:00-03:00' })];
    render(
      <ReviewTradesSection
        trades={trades}
        weekStart="2026-04-20"
        weekEnd="2026-04-26"
      />,
    );
    expect(screen.getByText('fora')).toBeInTheDocument();
  });

  it('badge C para LONG/BUY/C, V para SHORT/SELL/V', () => {
    const trades = [
      makeTrade({ tradeId: 't1', side: 'LONG' }),
      makeTrade({ tradeId: 't2', side: 'SHORT', entryTime: '2026-04-24T10:00:00-03:00' }),
    ];
    render(<ReviewTradesSection trades={trades} />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('V')).toBeInTheDocument();
  });
});
