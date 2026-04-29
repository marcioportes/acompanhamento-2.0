/**
 * Issue #208 — Fase 7. Smoke + comportamento do card agregado de execução.
 * Cobre os 3 estados visíveis: vazio total, vazio com cobertura, eventos
 * agregados por tipo + expansão.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExecutionPatternsAggregateCard from '../../../components/Trades/ExecutionPatternsAggregateCard';

const STOP_TAMPER_TRADE = {
  id: 'TT', ticker: 'WINM26', side: 'LONG', qty: 1,
  entryTime: '2026-04-22T10:00:00Z', exitTime: '2026-04-22T10:30:00Z',
  result: -100,
};
const STOP_TAMPER_ORDERS = [
  {
    externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
    status: 'CANCELLED', quantity: 1, stopPrice: 99500,
    submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:05:00Z',
    isStopOrder: true, correlatedTradeId: 'TT',
  },
  {
    externalOrderId: 'S2', instrument: 'WINM26', side: 'SELL', type: 'STOP',
    status: 'FILLED', quantity: 1, stopPrice: 99300,
    submittedAt: '2026-04-22T10:05:30Z', filledAt: '2026-04-22T10:30:00Z',
    isStopOrder: true, correlatedTradeId: 'TT',
  },
];

describe('ExecutionPatternsAggregateCard', () => {
  it('estado vazio: nenhum trade tem ordens correlacionadas', () => {
    render(<ExecutionPatternsAggregateCard trades={[STOP_TAMPER_TRADE]} orders={[]} />);
    expect(screen.getByText(/Nenhum trade da janela/i)).toBeInTheDocument();
    expect(screen.getByText(/0\/1 trades/)).toBeInTheDocument();
  });

  it('cobertura mas sem padrão: mostra mensagem "execução limpa"', () => {
    const cleanTrade = { id: 'C1', ticker: 'WINM26', side: 'LONG', qty: 1,
      entryTime: '2026-04-22T10:00:00Z', exitTime: '2026-04-22T10:30:00Z' };
    const cleanOrders = [
      { externalOrderId: 'O1', instrument: 'WINM26', side: 'BUY', type: 'LIMIT',
        status: 'FILLED', quantity: 1, filledPrice: 100000,
        submittedAt: '2026-04-22T10:00:00Z', filledAt: '2026-04-22T10:00:01Z',
        isStopOrder: false, correlatedTradeId: 'C1' },
    ];
    render(<ExecutionPatternsAggregateCard trades={[cleanTrade]} orders={cleanOrders} />);
    expect(screen.getByText(/execução limpa/i)).toBeInTheDocument();
  });

  it('agrega eventos por tipo e mostra contagem', () => {
    render(
      <ExecutionPatternsAggregateCard
        trades={[STOP_TAMPER_TRADE]}
        orders={STOP_TAMPER_ORDERS}
        windowLabel="último mês"
      />
    );
    expect(screen.getByText(/Stop reemitido para mais largo/i)).toBeInTheDocument();
    expect(screen.getByText('1×')).toBeInTheDocument();
    expect(screen.getByText(/último mês/)).toBeInTheDocument();
  });

  it('expande detalhes ao clicar e dispara onTradeClick', () => {
    const onTradeClick = vi.fn();
    render(
      <ExecutionPatternsAggregateCard
        trades={[STOP_TAMPER_TRADE]}
        orders={STOP_TAMPER_ORDERS}
        onTradeClick={onTradeClick}
      />
    );
    const button = screen.getByText(/Stop reemitido/i).closest('button');
    fireEvent.click(button);
    // descrição literária aparece após expansão
    expect(screen.getByText(/loss aversion/i)).toBeInTheDocument();
    // citação literária presente
    expect(screen.getByText(/Kahneman/i)).toBeInTheDocument();
    // click no item dispara callback
    const item = screen.getByText(/WINM26/).closest('[role="button"]');
    fireEvent.click(item);
    expect(onTradeClick).toHaveBeenCalledWith(STOP_TAMPER_TRADE);
  });
});
