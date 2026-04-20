/**
 * ConversationalOpCard.test.jsx
 * @description Render por classe (match_confident / ambiguous / new / autoliq)
 *   + interações (Confirmar / Descartar / Ambiguous seleção obrigatória).
 * @see src/components/OrderImport/ConversationalOpCard.jsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationalOpCard from '../../components/OrderImport/ConversationalOpCard';
import { CLASSIFICATION } from '../../utils/orderTradeCreation';

// ============================================
// FIXTURES
// ============================================

const baseOp = {
  operationId: 'op-1',
  instrument: 'MNQH6',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 24900,
  avgExitPrice: 24950,
  entryTime: '2026-02-12T14:41:30',
  exitTime: '2026-02-12T15:02:00',
  entryOrders: [
    { filledPrice: 24900, filledQuantity: 1, filledAt: '2026-02-12T14:41:30' },
    { filledPrice: 24900, filledQuantity: 1, filledAt: '2026-02-12T14:42:10' },
  ],
  exitOrders: [
    { filledPrice: 24950, filledQuantity: 2, filledAt: '2026-02-12T15:02:00' },
  ],
};

const withClassification = (cls, extras = {}) => ({
  ...baseOp,
  classification: cls,
  ...extras,
});

// ============================================
// RENDER PER CLASS
// ============================================

describe('ConversationalOpCard — render per classification', () => {
  it('match_confident — renderiza copy canônica + 3 botões (Confirmar/Ajustar/Descartar)', () => {
    const op = withClassification(CLASSIFICATION.MATCH_CONFIDENT);
    const tradesById = new Map([
      ['trade-abc', { id: 'trade-abc', ticker: 'MNQH6', side: 'LONG', qty: 2, entryTime: '2026-02-12T14:41:00' }],
    ]);
    render(
      <ConversationalOpCard
        operation={op}
        matchCandidates={[{ tradeId: 'trade-abc', score: 0.92 }]}
        tradeId="trade-abc"
        tradesById={tradesById}
        onConfirm={() => {}}
        onAdjust={() => {}}
        onDiscard={() => {}}
      />
    );

    expect(screen.getByText(/Minha hipótese/i)).toBeInTheDocument();
    expect(screen.getByText(/Confere/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('ambiguous — lista candidatos ordenados por score com rádio + Confirmar disabled sem seleção', () => {
    const op = withClassification(CLASSIFICATION.AMBIGUOUS);
    const candidates = [
      { tradeId: 't-1', score: 0.6 },
      { tradeId: 't-2', score: 0.9 },
      { tradeId: 't-3', score: 0.75 },
    ];
    render(
      <ConversationalOpCard
        operation={op}
        matchCandidates={candidates}
        onConfirm={() => {}}
        onDiscard={() => {}}
      />
    );

    expect(screen.getByText(/3 candidatos encontrados/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirmar seleção/i });
    expect(confirmBtn).toBeDisabled();

    // Sorted by score desc: t-2 (90%), t-3 (75%), t-1 (60%)
    const labels = screen.getAllByText(/%/).map(el => el.textContent);
    expect(labels[0]).toContain('90%');
    expect(labels[1]).toContain('75%');
    expect(labels[2]).toContain('60%');

    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('new — renderiza "Nova operação detectada" + botões Criar trade/Descartar', () => {
    const op = withClassification(CLASSIFICATION.NEW);
    render(
      <ConversationalOpCard
        operation={op}
        onConfirm={() => {}}
        onDiscard={() => {}}
      />
    );
    expect(screen.getByText(/Nova operação detectada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar trade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('new — botão "Apontar trade existente" aparece quando há dayCandidates + onPointToExisting', () => {
    const op = withClassification(CLASSIFICATION.NEW);
    const dayCandidates = [
      { id: 'trade-xyz', ticker: 'MNQH6', side: 'LONG', qty: 1, entryTime: '2026-02-12T10:00:00' },
    ];
    render(
      <ConversationalOpCard
        operation={op}
        dayCandidates={dayCandidates}
        onConfirm={() => {}}
        onDiscard={() => {}}
        onPointToExisting={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Apontar trade existente/i })).toBeInTheDocument();
  });

  it('autoliq — renderiza AutoLiqBadge + cabeçalho vermelho + Registrar trade (amarelo)', () => {
    const op = withClassification(CLASSIFICATION.AUTOLIQ);
    render(
      <ConversationalOpCard
        operation={op}
        onConfirm={() => {}}
        onDiscard={() => {}}
      />
    );
    expect(screen.getByTestId('autoliq-badge')).toBeInTheDocument();
    expect(screen.getByText(/Evento de sistema detectado/i)).toBeInTheDocument();
    const registerBtn = screen.getByRole('button', { name: 'Registrar trade' });
    expect(registerBtn).toBeInTheDocument();
    expect(registerBtn.className).toMatch(/bg-amber-500/);
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('classificação desconhecida — renderiza stub defensivo sem botão de confirm', () => {
    const op = { ...baseOp, classification: 'whatever' };
    render(
      <ConversationalOpCard
        operation={op}
        onConfirm={() => {}}
        onDiscard={() => {}}
      />
    );
    expect(screen.getByText(/Classificação desconhecida/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  });
});

// ============================================
// INTERACTIONS
// ============================================

describe('ConversationalOpCard — interações', () => {
  it('match_confident — click Confirmar dispara onConfirm com tradeId', () => {
    const onConfirm = vi.fn();
    const onDiscard = vi.fn();
    render(
      <ConversationalOpCard
        operation={withClassification(CLASSIFICATION.MATCH_CONFIDENT)}
        matchCandidates={[{ tradeId: 'trade-abc', score: 1 }]}
        tradeId="trade-abc"
        onConfirm={onConfirm}
        onDiscard={onDiscard}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledWith({ decision: 'confirmed', tradeId: 'trade-abc' });
  });

  it('match_confident — click Descartar dispara onDiscard sem argumentos', () => {
    const onDiscard = vi.fn();
    render(
      <ConversationalOpCard
        operation={withClassification(CLASSIFICATION.MATCH_CONFIDENT)}
        matchCandidates={[{ tradeId: 'trade-abc', score: 1 }]}
        tradeId="trade-abc"
        onConfirm={() => {}}
        onDiscard={onDiscard}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('ambiguous — selecionar rádio habilita botão Confirmar seleção e dispara onConfirm com tradeId', () => {
    const onConfirm = vi.fn();
    render(
      <ConversationalOpCard
        operation={withClassification(CLASSIFICATION.AMBIGUOUS)}
        matchCandidates={[
          { tradeId: 't-1', score: 0.6 },
          { tradeId: 't-2', score: 0.9 },
        ]}
        onConfirm={onConfirm}
        onDiscard={() => {}}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: /Confirmar seleção/i });
    expect(confirmBtn).toBeDisabled();

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]); // primeiro radio = t-2 (maior score)
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith({ decision: 'confirmed', tradeId: 't-2' });
  });

  it('new — click "Criar trade" dispara onConfirm sem tradeId', () => {
    const onConfirm = vi.fn();
    render(
      <ConversationalOpCard
        operation={withClassification(CLASSIFICATION.NEW)}
        onConfirm={onConfirm}
        onDiscard={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar trade' }));
    expect(onConfirm).toHaveBeenCalledWith({ decision: 'confirmed' });
  });

  it('new — pick flow dispara onPointToExisting com tradeId', () => {
    const onPointToExisting = vi.fn();
    const op = withClassification(CLASSIFICATION.NEW);
    const dayCandidates = [
      { id: 'trade-xyz', ticker: 'MNQH6', side: 'LONG', qty: 1, entryTime: '2026-02-12T10:00:00' },
    ];
    render(
      <ConversationalOpCard
        operation={op}
        dayCandidates={dayCandidates}
        onConfirm={() => {}}
        onDiscard={() => {}}
        onPointToExisting={onPointToExisting}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Apontar trade existente/i }));
    const radio = screen.getByRole('radio');
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole('button', { name: /Apontar este trade/i }));
    expect(onPointToExisting).toHaveBeenCalledWith({ tradeId: 'trade-xyz' });
  });

  it('autoliq — click Registrar trade dispara onConfirm com decision confirmed', () => {
    const onConfirm = vi.fn();
    render(
      <ConversationalOpCard
        operation={withClassification(CLASSIFICATION.AUTOLIQ)}
        onConfirm={onConfirm}
        onDiscard={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trade' }));
    expect(onConfirm).toHaveBeenCalledWith({ decision: 'confirmed' });
  });
});
