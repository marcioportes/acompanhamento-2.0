/**
 * Issue #347 — o campo "Observação" do card de operação foi removido.
 *
 * Era um textarea editável (pré-preenchido com `operation.autoObservation`) cujo conteúdo o
 * `OrderImportPage.handleStagingConfirm` descartava: `onConfirm` recebia `observations` e nunca
 * lia a chave. Campo que promete gravar e não grava é perda de dados silenciosa — decisão de
 * produto (Marcio, 17/08/2026) foi remover, não persistir.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderStagingReview from '../../components/OrderImport/OrderStagingReview';

const operation = {
  operationId: 'OP-001',
  instrument: 'WINM26',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 100000,
  avgExitPrice: 100500,
  resultPoints: 500,
  entryTime: '2026-08-17T10:00:00-03:00',
  exitTime: '2026-08-17T10:30:00-03:00',
  duration: '30min',
  entryOrders: [{ orderId: 'o1', instrument: 'WINM26', side: 'BUY', filledQuantity: 2, price: 100000, filledAt: '2026-08-17T10:00:00-03:00' }],
  exitOrders: [{ orderId: 'o2', instrument: 'WINM26', side: 'SELL', filledQuantity: 2, price: 100500, filledAt: '2026-08-17T10:30:00-03:00' }],
  stopOrders: [],
  cancelledOrders: [],
  stopMovements: [],
  hasStopProtection: false,
  stopExecuted: false,
  // Campo legado: mesmo que venha no objeto, não pode mais virar textarea na tela.
  autoObservation: 'Stop cancelado (99.800). Operação prosseguiu sem proteção',
};

describe('OrderStagingReview — campo Observação removido (#347)', () => {
  it('não renderiza o campo de observação no card expandido', () => {
    render(<OrderStagingReview operations={[operation]} onConfirm={vi.fn()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('WINM26'));

    expect(screen.queryByText('Observação:')).toBeNull();
    expect(screen.queryByPlaceholderText(/Observação sobre esta operação/i)).toBeNull();
  });

  it('onConfirm entrega payload sem a chave observations', () => {
    const onConfirm = vi.fn();
    render(<OrderStagingReview operations={[operation]} onConfirm={onConfirm} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText(/Confirmar todas/i));
    fireEvent.click(screen.getByText(/Importar 1 operação/i));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload).not.toHaveProperty('observations');
    expect(payload.operations).toHaveLength(1);
    expect(payload.confirmedOrderKeys.length).toBeGreaterThan(0);
  });
});
