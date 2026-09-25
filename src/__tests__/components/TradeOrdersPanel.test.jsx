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

/**
 * #467 (épico #462 F4) — caso real de 24/09/2026 (WINV26, venda de 10 em duas pernas).
 *   Perna 1: SELL 5 @185.070 (15:52); bracket — stop limite de COMPRA enviado a 185.135,
 *            executado 17:40 a 184.985; alvo 184.570 cancelado pelo OCO.
 *   Perna 2: SELL 5 @185.300 (16:24); bracket — stop 185.280/limite 185.430 cancelado às
 *            17:21:04, no instante em que o alvo 184.800 da MESMA perna executou.
 *   Stops de 14:39 (Gráfico) cancelados às 15:08 — antes da posição existir.
 * Antes: o stop da perna 2 aparecia "retirada" (comparado com a saída do TRADE, 17:40) e
 * o stop executado da perna 1 mostrava o preço EXECUTADO (184.985) em vez do enviado.
 */
describe('#467 — TradeOrdersPanel no 24/09/2026', () => {
  const tr = {
    id: 'T24', ticker: 'WINV26', side: 'SHORT', qty: 10, entry: 185185, exit: 184892.5,
    result: 2925, entryTime: '2026-09-24T15:52:21-03:00', exitTime: '2026-09-24T17:40:14-03:00',
  };
  const b = { correlatedTradeId: 'T24', instrument: 'WINV26', filledAt: null, cancelledAt: null,
    stopPrice: null, isStopOrder: false, filledPrice: null };
  const d = (h) => `2026-09-24T${h}`;
  const ordens = [
    { ...b, externalOrderId: 'V1', side: 'BUY', orderType: 'STOP_LIMIT', isStopOrder: true, quantity: 1,
      price: 188870, limitPrice: 188870, stopPrice: 188720, status: 'CANCELLED',
      submittedAt: d('14:39:47'), cancelledAt: d('15:08:14') },
    { ...b, externalOrderId: 'V2', side: 'BUY', orderType: 'STOP_LIMIT', isStopOrder: true, quantity: 1,
      price: 189840, limitPrice: 189840, stopPrice: 189690, status: 'CANCELLED',
      submittedAt: d('14:39:51'), cancelledAt: d('15:08:18') },
    { ...b, externalOrderId: 'E1', side: 'SELL', orderType: 'LIMIT', quantity: 5, filledQuantity: 5,
      price: 185070, limitPrice: 185070, filledPrice: 185070, status: 'FILLED',
      submittedAt: d('15:52:19'), filledAt: d('15:52:24') },
    { ...b, externalOrderId: 'X1', side: 'BUY', orderType: 'LIMIT', quantity: 5, filledQuantity: 5,
      price: 184985, limitPrice: 185135, filledPrice: 184985, status: 'FILLED',
      submittedAt: d('15:52:21'), filledAt: d('17:40:14') },
    { ...b, externalOrderId: 'T1', side: 'BUY', orderType: 'LIMIT', quantity: 5,
      price: 184570, limitPrice: 184570, status: 'CANCELLED',
      submittedAt: d('15:52:21'), cancelledAt: d('17:40:14') },
    { ...b, externalOrderId: 'E2', side: 'SELL', orderType: 'LIMIT', quantity: 5, filledQuantity: 5,
      price: 185300, limitPrice: 185300, filledPrice: 185300, status: 'FILLED',
      submittedAt: d('15:49:44'), filledAt: d('16:24:31') },
    { ...b, externalOrderId: 'S2', side: 'BUY', orderType: 'STOP_LIMIT', isStopOrder: true, quantity: 5,
      price: 185430, limitPrice: 185430, stopPrice: 185280, status: 'CANCELLED',
      submittedAt: d('16:24:31'), cancelledAt: d('17:21:04') },
    { ...b, externalOrderId: 'X2', side: 'BUY', orderType: 'LIMIT', quantity: 5, filledQuantity: 5,
      price: 184800, limitPrice: 184800, filledPrice: 184800, status: 'FILLED',
      submittedAt: d('16:24:31'), filledAt: d('17:21:04') },
  ];
  const linhas = (container) => [...container.querySelectorAll('div.grid')].slice(1)
    .map(r => [...r.children].map(c => c.textContent.trim()).join(' | '));

  it('OCO da perna 2 morto no alvo da perna 2 é "ativa até a saída", não "retirada"', () => {
    const { container } = render(<TradeOrdersPanel trade={tr} orders={ordens} embedded />);
    const rows = linhas(container);
    const s2 = rows.find(r => r.includes('185280'));
    expect(s2).toMatch(/^Stop \| BUY \| 185280 \| 5 \| ativa até a saída/);
    expect(screen.queryByText(/^retirada$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Protegido o tempo todo/i)).toBeInTheDocument();
  });

  it('stop executado mostra o preço ENVIADO (185135), o mesmo que o trade grava', () => {
    const { container } = render(<TradeOrdersPanel trade={tr} orders={ordens} embedded />);
    const rows = linhas(container);
    const x1 = rows.find(r => r.includes('executada'));
    expect(x1).toMatch(/^Stop \| BUY \| 185135 \| 5 \| executada/);
    expect(rows.some(r => r.startsWith('Stop') && r.includes('184985'))).toBe(false);
  });

  it('stops de 14:39 cancelados antes da entrada não são proteção', () => {
    const { container } = render(<TradeOrdersPanel trade={tr} orders={ordens} embedded />);
    const rows = linhas(container);
    expect(rows.filter(r => r.includes('188720') || r.includes('189690'))).toEqual([]);
    expect(rows.filter(r => r.startsWith('Cancel'))).toHaveLength(3); // V1, V2 e o alvo T1
  });
});
