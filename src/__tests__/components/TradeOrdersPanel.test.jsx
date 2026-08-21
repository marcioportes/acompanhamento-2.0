/**
 * #375 — o painel de ordens lê proteção com a MESMA definição do motor.
 *
 * Caso real (WINV26 LONG 10, 21/08/2026): duas pernas SELL 173.905 canceladas pelo OCO no
 * instante da saída no alvo. O painel checava CANCELLED antes de qualquer teste de
 * proteção, rotulava as duas como "Cancel" e anunciava "Sem stop" — em trade que tinha
 * stop do começo ao fim.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TradeOrdersPanel from '../../components/OrderImport/TradeOrdersPanel';

const T0 = '2026-08-21T11:25:15-03:00';
const SAIDA = '2026-08-21T11:27:51-03:00';

const trade = (over = {}) => ({
  id: 'T1', ticker: 'WINV26', side: 'LONG', qty: 10, entry: 174030, exit: 174290,
  result: 520, entryTime: T0, exitTime: SAIDA, ...over,
});

const base = { correlatedTradeId: 'T1', instrument: 'WINV26' };
const entrada = { ...base, externalOrderId: 'E1', side: 'BUY', orderType: 'LIMIT', isStopOrder: false,
  price: 174050, limitPrice: 174050, stopPrice: null, filledPrice: 174050,
  quantity: 10, filledQuantity: 10, status: 'FILLED',
  submittedAt: '2026-08-21T11:25:14', filledAt: '2026-08-21T11:25:15', cancelledAt: null };
const saida = { ...base, externalOrderId: 'X1', side: 'SELL', orderType: 'LIMIT', isStopOrder: false,
  price: 174290, limitPrice: 174290, stopPrice: null, filledPrice: 174290,
  quantity: 10, filledQuantity: 10, status: 'FILLED',
  submittedAt: '2026-08-21T11:25:15', filledAt: '2026-08-21T11:27:51', cancelledAt: null };
const protecao = (over = {}) => ({ ...base, externalOrderId: 'S1', side: 'SELL',
  orderType: 'STOP_LIMIT', isStopOrder: true, price: 173755, limitPrice: 173755,
  stopPrice: 173905, filledPrice: null, quantity: 10, filledQuantity: 10,
  status: 'CANCELLED', submittedAt: '2026-08-21T11:25:15', filledAt: null,
  cancelledAt: '2026-08-21T11:27:51', ...over });

describe('#375 — TradeOrdersPanel', () => {
  it('bracket cancelado pelo OCO no alvo é proteção, não "Cancel"', () => {
    render(<TradeOrdersPanel trade={trade()} orders={[entrada, protecao(), saida]} embedded />);
    expect(screen.getByText(/Protegido o tempo todo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sem stop/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ativa até a saída/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Cancel$/)).not.toBeInTheDocument();
  });

  it('proteção retirada com posição aberta aparece como exposição medida', () => {
    const retirada = protecao({ cancelledAt: '2026-08-21T11:26:00' });
    render(<TradeOrdersPanel trade={trade()} orders={[entrada, retirada, saida]} embedded />);
    expect(screen.getByText(/Sem proteção por/i)).toBeInTheDocument();
    expect(screen.getByText(/10 contratos sem proteção/i)).toBeInTheDocument();
    expect(screen.getByText(/retirada/i)).toBeInTheDocument();
  });

  it('troca de proteção dentro da tolerância é condução, não exposição', () => {
    const primeira = protecao({ externalOrderId: 'S1', cancelledAt: '2026-08-21T11:26:00' });
    const segunda = protecao({ externalOrderId: 'S2', stopPrice: 174000, price: 174000,
      limitPrice: 174000, submittedAt: '2026-08-21T11:26:05' });
    render(<TradeOrdersPanel trade={trade()} orders={[entrada, primeira, segunda, saida]} embedded />);
    expect(screen.queryByText(/Sem proteção por/i)).not.toBeInTheDocument();
    expect(screen.getByText(/troca de proteção/i)).toBeInTheDocument();
    expect(screen.getByText(/substituída por/i)).toBeInTheDocument();
  });

  it('sem proteção nenhuma e trade em lucro continua dizendo "Sem stop"', () => {
    render(<TradeOrdersPanel trade={trade()} orders={[entrada, saida]} embedded />);
    expect(screen.getByText(/Sem stop|Sem proteção por/i)).toBeInTheDocument();
    expect(screen.queryByText(/Protegido o tempo todo/i)).not.toBeInTheDocument();
  });
});
