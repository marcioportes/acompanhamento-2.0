/**
 * Issue #278 — tradeId muted no header do TradeDetailModal.
 * Cobre presença do span, classes esperadas e copy via clipboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeDetailModal from '../../components/TradeDetailModal';

const baseTrade = {
  id: 'trade-abc-123',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entry: 100000,
  exit: 100500,
  result: 60,
  currency: 'USD',
  status: 'OPEN',
  entryTime: '2026-04-22T10:00:00Z',
  exitTime: '2026-04-22T10:30:00Z'
};

describe('TradeDetailModal — tradeId muted no header', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue() },
      writable: true,
      configurable: true
    });
  });

  it('renderiza span com trade.id no header', () => {
    render(
      <TradeDetailModal
        isOpen={true}
        onClose={() => {}}
        trade={baseTrade}
      />
    );
    const idSpan = screen.getByText('trade-abc-123');
    expect(idSpan).toBeInTheDocument();
    expect(idSpan.tagName).toBe('SPAN');
  });

  it('span tem classes muted esperadas', () => {
    render(
      <TradeDetailModal
        isOpen={true}
        onClose={() => {}}
        trade={baseTrade}
      />
    );
    const idSpan = screen.getByText('trade-abc-123');
    expect(idSpan.className).toContain('text-xs');
    expect(idSpan.className).toContain('font-mono');
    expect(idSpan.className).toContain('text-slate-500/40');
  });

  it('click no span chama navigator.clipboard.writeText com trade.id', () => {
    render(
      <TradeDetailModal
        isOpen={true}
        onClose={() => {}}
        trade={baseTrade}
      />
    );
    const idSpan = screen.getByText('trade-abc-123');
    fireEvent.click(idSpan);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('trade-abc-123');
  });

  it('click no span não fecha o modal (stopPropagation)', () => {
    const onClose = vi.fn();
    render(
      <TradeDetailModal
        isOpen={true}
        onClose={onClose}
        trade={baseTrade}
      />
    );
    const idSpan = screen.getByText('trade-abc-123');
    fireEvent.click(idSpan);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// #327 — Espelho editável no detalhe pro próprio aluno (fila "trades a refletir").
describe('TradeDetailModal — reflexão editável (#327)', () => {
  const closedNoReview = { ...baseTrade, result: 60, selfReview: undefined };

  it('aluno + onSubmitReview + fechado sem selfReview → mostra nudge de auto-análise', () => {
    render(
      <TradeDetailModal isOpen onClose={() => {}} trade={closedNoReview} onSubmitReview={vi.fn()} />
    );
    expect(screen.getByText(/ainda não tem sua auto-análise/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analisar o trade/i })).toBeInTheDocument();
  });

  it('mentor (isMentor) NÃO vê o nudge de reflexão', () => {
    render(
      <TradeDetailModal isOpen onClose={() => {}} trade={closedNoReview} isMentor onSubmitReview={vi.fn()} />
    );
    expect(screen.queryByText(/ainda não tem sua auto-análise/i)).not.toBeInTheDocument();
  });

  it('sem onSubmitReview NÃO mostra o nudge (read-only)', () => {
    render(<TradeDetailModal isOpen onClose={() => {}} trade={closedNoReview} />);
    expect(screen.queryByText(/ainda não tem sua auto-análise/i)).not.toBeInTheDocument();
  });

  it('trade sem resultado (aberto) NÃO mostra o nudge', () => {
    render(
      <TradeDetailModal isOpen onClose={() => {}} trade={{ ...baseTrade, result: null }} onSubmitReview={vi.fn()} />
    );
    expect(screen.queryByText(/ainda não tem sua auto-análise/i)).not.toBeInTheDocument();
  });
});
