/**
 * AdjustmentModal.test.jsx
 * @description Render do diff, interações por campo, onConfirm com finalFields,
 *   onCancel, e modo simplificado (trade ausente).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdjustmentModal from '../../components/OrderImport/AdjustmentModal';

const baseOp = {
  instrument: 'MNQH6',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 24910,
  avgExitPrice: 24960,
  hasStopProtection: true,
  stopOrders: [{ stopPrice: 24880 }],
};

const baseTrade = {
  id: 'trade-abc',
  ticker: 'MNQH6',
  side: 'LONG',
  entry: 24900,
  exit: 24950,
  qty: 2,
  stopLoss: 24870,
};

describe('AdjustmentModal — render', () => {
  it('renderiza diff com colunas Atual / Novo e header com ticker', () => {
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/Ajustar campos/i)).toBeInTheDocument();
    expect(screen.getByText('MNQH6', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
    expect(screen.getByText('Novo (ordens)')).toBeInTheDocument();

    // 4 linhas: entry, exit, qty, stopLoss
    expect(screen.getByTestId('adjustment-row-entry')).toBeInTheDocument();
    expect(screen.getByTestId('adjustment-row-exit')).toBeInTheDocument();
    expect(screen.getByTestId('adjustment-row-qty')).toBeInTheDocument();
    expect(screen.getByTestId('adjustment-row-stopLoss')).toBeInTheDocument();
  });

  it('modo simplificado (trade null): oculta coluna Atual e botão "Manter atual"', () => {
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.queryByText('Atual')).not.toBeInTheDocument();
    expect(screen.getByText(/modo simplificado/i)).toBeInTheDocument();
    // Não existe botão "Manter atual" em nenhuma linha.
    expect(screen.queryByTestId('mode-current-entry')).not.toBeInTheDocument();
  });
});

describe('AdjustmentModal — interações', () => {
  it('confirm com defaults → finalFields iguais aos valores novos', () => {
    const onConfirm = vi.fn();
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('confirm-adjustment'));
    expect(onConfirm).toHaveBeenCalledWith({
      finalFields: { entry: 24910, exit: 24960, qty: 2, stopLoss: 24880 },
    });
  });

  it('selecionar "Manter atual" em entry → finalFields.entry = trade.entry', () => {
    const onConfirm = vi.fn();
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('mode-current-entry'));
    fireEvent.click(screen.getByTestId('confirm-adjustment'));
    expect(onConfirm).toHaveBeenCalledWith({
      finalFields: { entry: 24900, exit: 24960, qty: 2, stopLoss: 24880 },
    });
  });

  it('selecionar "Editar" e digitar valor custom → finalFields reflete valor editado', () => {
    const onConfirm = vi.fn();
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('mode-edit-exit'));
    const input = screen.getByTestId('edit-input-exit');
    fireEvent.change(input, { target: { value: '24970.5' } });
    fireEvent.click(screen.getByTestId('confirm-adjustment'));
    expect(onConfirm).toHaveBeenCalledWith({
      finalFields: { entry: 24910, exit: 24970.5, qty: 2, stopLoss: 24880 },
    });
  });

  it('cancelar → chama onCancel e não onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('X no header → chama onCancel', () => {
    const onCancel = vi.fn();
    render(
      <AdjustmentModal
        operation={baseOp}
        trade={baseTrade}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
