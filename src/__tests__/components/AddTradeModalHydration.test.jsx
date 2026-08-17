/**
 * Issue #347 — o modal de edição descartava o que o aluno tinha digitado.
 *
 * O efeito de hidratação tinha `[editTrade, isOpen, plans, exchanges, setups, emotions]` nas deps.
 * Qualquer troca de identidade — o update otimista de `setEditingTrade` ao salvar a reflexão, ou
 * um onSnapshot em plans/setups/emotions — re-rodava `setFormData` e sobrescrevia o formulário com
 * o trade congelado no clique do lápis. Perda silenciosa de texto escrito pelo aluno (produção).
 *
 * Estes testes travam o contrato: hidrata ao ABRIR e ao TROCAR de trade; nunca no meio da digitação.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddTradeModal from '../../components/AddTradeModal';

const mockMasterData = {
  setups: [{ id: 's1', name: 'Fibo 61,8' }],
  emotions: [{ id: 'e1', name: 'Neutro', category: 'neutral' }],
  exchanges: [{ id: 'x1', code: 'B3' }],
  tickers: [],
  loading: false,
};

vi.mock('../../hooks/useMasterData', () => ({
  useMasterData: () => mockMasterData,
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({ accounts: [{ id: 'acc1', currency: 'BRL' }], loading: false }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const basePlans = [{ id: 'plan1', name: 'Plano 1', accountId: 'acc1', currency: 'BRL' }];

const baseTrade = {
  id: 'trade-1',
  ticker: 'WINM26',
  exchange: 'B3',
  side: 'LONG',
  entry: 100000,
  exit: 100500,
  qty: 2,
  result: 60,
  stopLoss: null,
  setup: 'Fibo 61,8',
  emotionEntry: 'Neutro',
  emotionExit: 'Neutro',
  notes: '',
  planId: 'plan1',
  entryTime: '2026-08-17T10:00:00-03:00',
  exitTime: '2026-08-17T10:30:00-03:00',
};

const renderModal = (props = {}) =>
  render(
    <AddTradeModal
      isOpen={true}
      onClose={() => {}}
      onSubmit={vi.fn()}
      editTrade={baseTrade}
      plans={basePlans}
      loading={false}
      {...props}
    />
  );

const getNotes = () => screen.getByPlaceholderText(/Racional do trade/i);

describe('AddTradeModal — hidratação não descarta entrada do aluno (#347)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserva o texto digitado quando o pai recria o objeto editTrade (update otimista da reflexão)', () => {
    const { rerender } = renderModal();

    fireEvent.change(getNotes(), { target: { value: 'Entrada no rompimento, stop abaixo da mínima.' } });
    expect(getNotes().value).toBe('Entrada no rompimento, stop abaixo da mínima.');

    // Exatamente o que StudentDashboard/TradesJournal fazem em handleSubmitReview:
    // novo objeto, mesmo id.
    rerender(
      <AddTradeModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={vi.fn()}
        editTrade={{ ...baseTrade, selfReview: { wouldRepeat: true, answers: {} } }}
        plans={basePlans}
        loading={false}
      />
    );

    expect(getNotes().value).toBe('Entrada no rompimento, stop abaixo da mínima.');
  });

  it('preserva o texto digitado quando o array de plans muda de identidade (onSnapshot)', () => {
    const { rerender } = renderModal();

    fireEvent.change(getNotes(), { target: { value: 'texto que não pode sumir' } });

    rerender(
      <AddTradeModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={vi.fn()}
        editTrade={baseTrade}
        plans={[...basePlans]}
        loading={false}
      />
    );

    expect(getNotes().value).toBe('texto que não pode sumir');
  });

  it('preserva o stop digitado nos mesmos cenários', () => {
    const { rerender } = renderModal();

    const stopInput = document.querySelector('input[name="stopLoss"]');
    expect(stopInput).toBeTruthy();
    fireEvent.change(stopInput, { target: { value: '99800' } });

    rerender(
      <AddTradeModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={vi.fn()}
        editTrade={{ ...baseTrade }}
        plans={[...basePlans]}
        loading={false}
      />
    );

    expect(document.querySelector('input[name="stopLoss"]').value).toBe('99800');
  });

  it('re-hidrata quando o aluno abre OUTRO trade (id diferente)', () => {
    const { rerender } = renderModal();

    fireEvent.change(getNotes(), { target: { value: 'rascunho do trade 1' } });

    rerender(
      <AddTradeModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={vi.fn()}
        editTrade={{ ...baseTrade, id: 'trade-2', notes: 'observação do trade 2' }}
        plans={basePlans}
        loading={false}
      />
    );

    expect(getNotes().value).toBe('observação do trade 2');
  });

  it('re-hidrata ao reabrir o modal no mesmo trade (isOpen false → true)', () => {
    const { rerender } = renderModal();

    fireEvent.change(getNotes(), { target: { value: 'rascunho abandonado' } });

    const withOpen = (isOpen) => (
      <AddTradeModal
        isOpen={isOpen}
        onClose={() => {}}
        onSubmit={vi.fn()}
        editTrade={baseTrade}
        plans={basePlans}
        loading={false}
      />
    );

    rerender(withOpen(false));
    rerender(withOpen(true));

    expect(getNotes().value).toBe('');
  });
});
