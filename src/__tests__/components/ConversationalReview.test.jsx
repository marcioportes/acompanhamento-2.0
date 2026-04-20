/**
 * ConversationalReview.test.jsx
 * @description Gate de submit (bloqueado até todas decidirem + coverage gap) +
 *   banner amarelo de plano retroativo.
 * @see src/components/OrderImport/ConversationalReview.jsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationalReview from '../../components/OrderImport/ConversationalReview';
import { CLASSIFICATION } from '../../utils/orderTradeCreation';

const baseOp = {
  operationId: 'op-1',
  instrument: 'MNQH6',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 24900,
  avgExitPrice: 24950,
  entryTime: '2026-02-12T14:41:30',
  exitTime: '2026-02-12T15:02:00',
  entryOrders: [{ filledPrice: 24900, filledQuantity: 2, filledAt: '2026-02-12T14:41:30' }],
  exitOrders: [{ filledPrice: 24950, filledQuantity: 2, filledAt: '2026-02-12T15:02:00' }],
};

const newItem = (id) => ({
  operation: { ...baseOp, operationId: id, classification: CLASSIFICATION.NEW },
  classification: CLASSIFICATION.NEW,
  matchCandidates: [],
  userDecision: 'pending',
});

describe('ConversationalReview — gate de submit', () => {
  it('submit disabled quando há ops pendentes', () => {
    render(
      <ConversationalReview
        queue={[newItem('a'), newItem('b')]}
        coverageGap={{ hasCoverageGap: false, gapOperations: [] }}
        onDecide={() => {}}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );
    const submit = screen.getByTestId('submit-decisions');
    expect(submit).toBeDisabled();
  });

  it('submit habilita quando todas as ops têm decisão', () => {
    const queue = [
      { ...newItem('a'), userDecision: 'confirmed' },
      { ...newItem('b'), userDecision: 'discarded' },
    ];
    render(
      <ConversationalReview
        queue={queue}
        coverageGap={{ hasCoverageGap: false, gapOperations: [] }}
        onDecide={() => {}}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByTestId('submit-decisions')).not.toBeDisabled();
  });

  it('coverage gap bloqueia submit mesmo com todas decididas', () => {
    const queue = [{ ...newItem('a'), userDecision: 'confirmed' }];
    render(
      <ConversationalReview
        queue={queue}
        coverageGap={{ hasCoverageGap: true, gapOperations: [{ operation: queue[0].operation }] }}
        onDecide={() => {}}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByTestId('coverage-gap-banner')).toBeInTheDocument();
    expect(screen.getByTestId('submit-decisions')).toBeDisabled();
  });

  it('banner mostra botão "Criar plano retroativo" quando onCreateRetroactivePlan presente', () => {
    const onCreateRetro = vi.fn();
    render(
      <ConversationalReview
        queue={[{ ...newItem('a'), userDecision: 'confirmed' }]}
        coverageGap={{ hasCoverageGap: true, gapOperations: [{ operation: {} }] }}
        onDecide={() => {}}
        onBack={() => {}}
        onSubmit={() => {}}
        onCreateRetroactivePlan={onCreateRetro}
      />
    );
    const btn = screen.getByRole('button', { name: /Criar plano retroativo/i });
    fireEvent.click(btn);
    expect(onCreateRetro).toHaveBeenCalledTimes(1);
  });

  it('onDecide dispara com index + payload quando card chama onConfirm', () => {
    const onDecide = vi.fn();
    render(
      <ConversationalReview
        queue={[newItem('a')]}
        coverageGap={{ hasCoverageGap: false, gapOperations: [] }}
        onDecide={onDecide}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar trade' }));
    expect(onDecide).toHaveBeenCalledWith(0, { decision: 'confirmed' });
  });

  it('match_confident + click "Ajustar" abre AdjustmentModal; confirm dispara onDecide com adjustments', () => {
    const onDecide = vi.fn();
    const tradesById = new Map([
      ['trade-abc', { id: 'trade-abc', ticker: 'MNQH6', side: 'LONG', entry: 24800, exit: 24900, qty: 2, stopLoss: 24750 }],
    ]);
    const matchItem = {
      operation: { ...baseOp, classification: CLASSIFICATION.MATCH_CONFIDENT },
      classification: CLASSIFICATION.MATCH_CONFIDENT,
      tradeId: 'trade-abc',
      matchCandidates: [{ tradeId: 'trade-abc', score: 0.95 }],
      userDecision: 'pending',
    };

    render(
      <ConversationalReview
        queue={[matchItem]}
        tradesById={tradesById}
        coverageGap={{ hasCoverageGap: false, gapOperations: [] }}
        onDecide={onDecide}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );

    // Modal fechado inicialmente
    expect(screen.queryByTestId('adjustment-modal')).not.toBeInTheDocument();

    // Click "Ajustar" → modal abre
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    expect(screen.getByTestId('adjustment-modal')).toBeInTheDocument();

    // Confirmar com defaults (usar novo) → onDecide é chamado com adjustments
    fireEvent.click(screen.getByTestId('confirm-adjustment'));
    expect(onDecide).toHaveBeenCalledWith(0, {
      decision: 'adjusted',
      tradeId: 'trade-abc',
      adjustments: { entry: 24900, exit: 24950, qty: 2, stopLoss: null },
    });

    // Modal fecha
    expect(screen.queryByTestId('adjustment-modal')).not.toBeInTheDocument();
  });

  it('Ajustar modal: cancelar fecha modal sem chamar onDecide', () => {
    const onDecide = vi.fn();
    const matchItem = {
      operation: { ...baseOp, classification: CLASSIFICATION.MATCH_CONFIDENT },
      classification: CLASSIFICATION.MATCH_CONFIDENT,
      tradeId: 'trade-abc',
      matchCandidates: [{ tradeId: 'trade-abc', score: 0.95 }],
      userDecision: 'pending',
    };
    const tradesById = new Map([['trade-abc', { id: 'trade-abc', entry: 24800, exit: 24900, qty: 2 }]]);

    render(
      <ConversationalReview
        queue={[matchItem]}
        tradesById={tradesById}
        coverageGap={{ hasCoverageGap: false, gapOperations: [] }}
        onDecide={onDecide}
        onBack={() => {}}
        onSubmit={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    expect(screen.getByTestId('adjustment-modal')).toBeInTheDocument();
    // Cancelar
    const modal = screen.getByTestId('adjustment-modal');
    const cancelBtn = modal.querySelector('button[aria-label="Fechar"]');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('adjustment-modal')).not.toBeInTheDocument();
    expect(onDecide).not.toHaveBeenCalled();
  });
});
