/**
 * CsvImportManager — dois defeitos que produziam "clico e nada acontece, sem erro".
 *
 * A) `handleDeleteSelected` chamava `if (!confirm(\`string\`)) return`. O `confirm` do
 *    useConfirmDialog retorna Promise (truthy) e espera um OBJETO: a guarda nunca
 *    bloqueava — excluía sem confirmação — e a string espalhada como opts abria um
 *    dialog `fixed inset-0 z-[90]` com título/corpo undefined, por cima de tudo,
 *    engolindo todo clique da tela.
 *
 * B) O componente nunca desmonta (os pais renderizam sempre, passando `isOpen`, e o
 *    `return null` fica depois dos hooks). Um `processing` travado em `true` — o que
 *    acontece quando um `await updateDoc` fica pendurado — sobrevivia a fechar e
 *    reabrir o modal, deixando todo botão de ação morto para o resto da sessão.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CsvImportManager from '../../components/csv/CsvImportManager';

const confirmMock = vi.fn();
vi.mock('../../components/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: confirmMock, dialog: null }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const trade = {
  id: 't1',
  ticker: 'WINV26',
  side: 'LONG',
  qty: 8,
  entry: 169829.38,
  exit: 170155,
  result: 521,
  entryTime: '2026-08-18T13:58:31-03:00',
  isComplete: false,
  importBatchId: 'csv_1',
};

const batches = [{
  batchId: 'csv_1',
  templateName: 'Profit-Full',
  createdAt: '2026-08-18T13:58:31-03:00',
  totalCount: 1,
  completeCount: 0,
  trades: [trade],
}];

const renderManager = (props = {}) =>
  render(
    <CsvImportManager
      isOpen
      onClose={vi.fn()}
      stagingTrades={[trade]}
      emotions={[{ id: 'e1', name: 'Ansioso', emoji: '😰' }]}
      setups={[{ id: 's1', name: 'Continuidade' }]}
      onUpdateStagingTrade={vi.fn()}
      onDeleteStagingTrade={vi.fn()}
      onDeleteStagingBatch={vi.fn()}
      onActivateTrade={vi.fn()}
      onActivateBatch={vi.fn()}
      getBatches={() => batches}
      {...props}
    />,
  );

// A lista de trades só renderiza com o batch expandido; a seleção sai do
// "Selecionar todos" (o checkbox por linha é um ícone sem texto acessível).
const selecionarTrade = () => {
  fireEvent.click(screen.getByText('Profit-Full'));
  fireEvent.click(screen.getByText('Selecionar todos'));
};

beforeEach(() => { confirmMock.mockReset(); });

describe('A — exclusão exige confirmação de verdade', () => {
  it('chama confirm com objeto de opções, não com string', async () => {
    confirmMock.mockResolvedValue(false);
    const onDeleteStagingTrade = vi.fn();
    renderManager({ onDeleteStagingTrade });
    selecionarTrade();

    fireEvent.click(await screen.findByText('Excluir'));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    const arg = confirmMock.mock.calls[0][0];
    expect(typeof arg).toBe('object');
    expect(arg).toMatchObject({ tone: 'danger' });
    expect(arg.title).toBeTruthy();
    expect(arg.body).toBeTruthy();
  });

  it('NÃO exclui quando o usuário cancela', async () => {
    confirmMock.mockResolvedValue(false);
    const onDeleteStagingTrade = vi.fn();
    renderManager({ onDeleteStagingTrade });
    selecionarTrade();

    fireEvent.click(await screen.findByText('Excluir'));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(onDeleteStagingTrade).not.toHaveBeenCalled();
  });

  it('exclui quando o usuário confirma', async () => {
    confirmMock.mockResolvedValue(true);
    const onDeleteStagingTrade = vi.fn().mockResolvedValue(undefined);
    renderManager({ onDeleteStagingTrade });
    selecionarTrade();

    fireEvent.click(await screen.findByText('Excluir'));

    await waitFor(() => expect(onDeleteStagingTrade).toHaveBeenCalledWith('t1'));
  });
});

describe('B — estado não sobrevive ao fechar o modal', () => {
  it('seleção é descartada ao fechar e reabrir', async () => {
    const { rerender } = renderManager();
    selecionarTrade();
    expect(await screen.findByText('1 selecionado(s)')).toBeTruthy();

    rerender(
      <CsvImportManager
        isOpen={false}
        onClose={vi.fn()}
        stagingTrades={[trade]}
        emotions={[]}
        setups={[]}
        onUpdateStagingTrade={vi.fn()}
        onDeleteStagingTrade={vi.fn()}
        onDeleteStagingBatch={vi.fn()}
        onActivateTrade={vi.fn()}
        onActivateBatch={vi.fn()}
        getBatches={() => batches}
      />,
    );
    rerender(
      <CsvImportManager
        isOpen
        onClose={vi.fn()}
        stagingTrades={[trade]}
        emotions={[]}
        setups={[]}
        onUpdateStagingTrade={vi.fn()}
        onDeleteStagingTrade={vi.fn()}
        onDeleteStagingBatch={vi.fn()}
        onActivateTrade={vi.fn()}
        onActivateBatch={vi.fn()}
        getBatches={() => batches}
      />,
    );

    await waitFor(() => expect(screen.queryByText('1 selecionado(s)')).toBeNull());
  });

  it('escrita pendurada trava a barra de ações — e fechar o modal destrava', async () => {
    // updateDoc que nunca resolve: reproduz a promise pendente do SDK do Firestore.
    const onUpdateStagingTrade = vi.fn(() => new Promise(() => {}));
    const { rerender } = renderManager({ onUpdateStagingTrade });
    selecionarTrade();

    fireEvent.click(await screen.findByText('Completar'));
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'Continuidade' } });
    fireEvent.click(screen.getByText('Aplicar'));

    // processing travado: os botões da barra ficam desabilitados
    await waitFor(() => {
      expect(screen.getByText('Aplicar').closest('button').disabled).toBe(true);
    });

    const props = {
      onClose: vi.fn(), stagingTrades: [trade], emotions: [], setups: [],
      onUpdateStagingTrade, onDeleteStagingTrade: vi.fn(), onDeleteStagingBatch: vi.fn(),
      onActivateTrade: vi.fn(), onActivateBatch: vi.fn(), getBatches: () => batches,
    };
    rerender(<CsvImportManager isOpen={false} {...props} />);
    rerender(<CsvImportManager isOpen {...props} />);

    // reabriu limpo: sem seleção, sem modal de completar preso
    await waitFor(() => expect(screen.queryByText('1 selecionado(s)')).toBeNull());
    expect(screen.queryByText('Aplicar')).toBeNull();
  });
});
