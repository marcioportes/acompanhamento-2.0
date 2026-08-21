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
  entry: '100000',
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
      // #375 — trade limpo agora exige proteção desde a entrada: a posição não pode
      // passar tempo nua. Antes o stop entrava 29s depois e ninguém media isso.
      { externalOrderId: 'S1', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'FILLED', quantity: 2, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:01Z', filledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    expect(screen.getByText(/nenhum detectado/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum dos 7 padrões/i)).toBeInTheDocument();
  });

  it('renderiza badge HIGH para UNPROTECTED_SIZE com fonte literária', () => {
    const orders = [
      { externalOrderId: 'E0', instrument: 'WINM26', side: 'BUY', type: 'LIMIT',
        status: 'FILLED', quantity: 2, limitPrice: 100000, filledPrice: 100000,
        submittedAt: '2026-04-22T10:00:00Z', filledAt: '2026-04-22T10:00:01Z',
        isStopOrder: false, correlatedTradeId: 'T1' },
      { externalOrderId: 'NLGC439492', instrument: 'WINM26', side: 'SELL', type: 'STOP',
        status: 'CANCELLED', quantity: 1, stopPrice: 99500,
        submittedAt: '2026-04-22T10:00:30Z', cancelledAt: '2026-04-22T10:30:00Z',
        isStopOrder: true, correlatedTradeId: 'T1' },
    ];
    render(<ExecutionPatternsPanel trade={trade} orders={orders} />);
    expect(screen.getByText(/Padrões de execução/)).toBeInTheDocument();
    expect(screen.getByText(/1 detectado/)).toBeInTheDocument();
    expect(screen.getByText(/analisadas 2 ordens/)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/Posição sem proteção/)).toBeInTheDocument();
    expect(screen.getByText(/Shefrin & Statman/)).toBeInTheDocument();
    expect(screen.getByText(/NLGC439492/)).toBeInTheDocument();
  });

  it('stop reemitido para mais largo NÃO é mais evento por si só (#357)', () => {
    const orders = [
      // Antes disparava STOP_TAMPERING. Mover o stop deixou de ser sinal: o que conta é
      // o risco financeiro contra o RO, e este trade não tem baseline de plano.
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
    // O alargamento em si não é mais evento. Mas o stop de 2 contratos foi substituído
    // por um de 1: no fim da operação sobrou 1 contrato descoberto — isso sim é sinal.
    expect(screen.queryByText(/Stop reemitido para mais largo/)).toBeNull();
    expect(screen.getByText(/Posição sem proteção/)).toBeInTheDocument();
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
