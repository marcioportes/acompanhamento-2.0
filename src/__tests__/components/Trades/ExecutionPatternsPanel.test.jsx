/**
 * Issue #208 — testes da seção "Padrões de execução" no TradeDetailModal.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutionPatternsPanel from '../../../components/Trades/ExecutionPatternsPanel';

const trade = {
  id: 'T1',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entryTime: '2026-04-22T10:00:00Z',
  exitTime: '2026-04-22T10:30:00Z',
};

describe('ExecutionPatternsPanel', () => {
  it('não renderiza quando trade não tem orders correlacionadas', () => {
    const { container } = render(<ExecutionPatternsPanel trade={trade} orders={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza estado "nenhum padrão" quando há orders correlacionadas mas sem eventos', () => {
    const orders = [
      { externalOrderId: 'E1', instrument: 'WINM26', side: 'BUY', type: 'MARKET',
        status: 'FILLED', quantity: 2, filledPrice: 100000,
        submittedAt: '2026-04-22T10:00:00Z', filledAt: '2026-04-22T10:00:01Z',
        isStopOrder: false, correlatedTradeId: 'T1' },
      { externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'FILLED', quantity: 2, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', filledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    expect(screen.getByText(/nenhum detectado/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum dos 5 padrões/i)).toBeInTheDocument();
  });

  it('renderiza badge HIGH para STOP_PARTIAL_SIZING com fonte literária', () => {
    const orders = [
      { externalOrderId: 'NLGC439492', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 1, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    expect(screen.getByText(/Padrões de execução/)).toBeInTheDocument();
    expect(screen.getByText(/1 detectado/)).toBeInTheDocument();
    expect(screen.getByText(/analisadas 1 ordem/)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/Stop dimensionado para meio lote/)).toBeInTheDocument();
    expect(screen.getByText(/Shefrin & Statman/)).toBeInTheDocument();
    expect(screen.getByText(/NLGC439492/)).toBeInTheDocument();
  });

  it('renderiza múltiplos eventos com pluralização correta', () => {
    const orders = [
      // STOP_TAMPERING — 2 stops, primeiro mais apertado, segundo mais largo
      { externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 2, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:05:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
      { externalOrderId: 'S2', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 1, stopPrice: 99300,
        submittedAt: '2026-04-22T10:05:30Z', cancelledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    // Trade qty=2; stop qtys = [2, 1] = soma 3 ≥ 2 → não dispara partial. Apenas STOP_TAMPERING.
    expect(screen.getByText(/1 detectado/)).toBeInTheDocument();
    expect(screen.getByText(/Stop reemitido para mais largo/)).toBeInTheDocument();
  });

  it('orders de outro trade são ignoradas', () => {
    const orders = [
      { externalOrderId: 'X1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 1, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T_OUTRO_TRADE' },
    ];
    const { container } = render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    expect(container).toBeEmptyDOMElement();
  });
});
