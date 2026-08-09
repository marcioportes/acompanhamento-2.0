/**
 * TradeReviewSection.test.jsx (issue #345)
 * @description Janela de reflexão fechada em DISCUSSED + superfície de erro no salvar.
 *              Cobre a causa raiz do #345: a UI oferecia um write que rules e gateway negam,
 *              e a exceção morria em console.error ("nada acontece" pro aluno).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TradeReviewSection from '../../../components/Trades/TradeReviewSection';

const makeTrade = (overrides = {}) => ({
  id: 't1',
  symbol: 'WINFUT',
  result: 150,
  ...overrides,
});

describe('<TradeReviewSection /> — janela fechada (#345)', () => {
  it('DISCUSSED sem selfReview → estado janela fechada, sem formulário', () => {
    render(
      <TradeReviewSection trade={makeTrade({ status: 'DISCUSSED' })} canReview onSubmit={vi.fn()} />
    );
    expect(screen.getByText('Janela fechada')).toBeInTheDocument();
    expect(screen.getByText(/discutido na revisão sem a sua auto-análise/i)).toBeInTheDocument();
    // nenhum caminho de edição é oferecido
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Analisar o trade')).not.toBeInTheDocument();
  });

  it('DISCUSSED sem selfReview + startOpen → ainda janela fechada (não abre o formulário)', () => {
    render(
      <TradeReviewSection
        trade={makeTrade({ status: 'DISCUSSED' })}
        canReview
        startOpen
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Janela fechada')).toBeInTheDocument();
    expect(screen.queryByText('Salvar revisão')).not.toBeInTheDocument();
  });

  it('DISCUSSED COM selfReview → segue mostrando a reflexão (imortal, #269 v2)', () => {
    render(
      <TradeReviewSection
        trade={makeTrade({ status: 'DISCUSSED', selfReview: { wouldRepeat: true, answers: {} } })}
        canReview
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Faria de novo: Sim')).toBeInTheDocument();
    expect(screen.queryByText('Janela fechada')).not.toBeInTheDocument();
  });

  it('mentor (canReview=false) num DISCUSSED sem reflexão → não renderiza nada', () => {
    const { container } = render(
      <TradeReviewSection trade={makeTrade({ status: 'DISCUSSED' })} canReview={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('status não-terminal sem selfReview → nudge editável (comportamento do #327 preservado)', () => {
    render(
      <TradeReviewSection trade={makeTrade({ status: 'REVIEWED' })} canReview onSubmit={vi.fn()} />
    );
    expect(screen.getByText('Analisar o trade')).toBeInTheDocument();
    expect(screen.queryByText('Janela fechada')).not.toBeInTheDocument();
  });

  it('trade sem status → nudge editável (trade legado)', () => {
    render(<TradeReviewSection trade={makeTrade()} canReview onSubmit={vi.fn()} />);
    expect(screen.getByText('Analisar o trade')).toBeInTheDocument();
  });
});

describe('<TradeReviewSection /> — erro visível no salvar (#345)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const openAndAnswer = () => {
    fireEvent.click(screen.getByText('Sim'));
  };

  it('onSubmit rejeita → mensagem visível com o motivo técnico', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Missing or insufficient permissions.'));
    render(<TradeReviewSection trade={makeTrade()} canReview startOpen onSubmit={onSubmit} />);
    openAndAnswer();
    fireEvent.click(screen.getByText('Salvar revisão'));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível salvar sua reflexão/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Missing or insufficient permissions.')).toBeInTheDocument();
  });

  it('falha preserva as respostas digitadas e reabilita o botão', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('falhou'));
    render(<TradeReviewSection trade={makeTrade()} canReview startOpen onSubmit={onSubmit} />);
    openAndAnswer();

    const textarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(textarea, { target: { value: 'minha reflexão' } });
    fireEvent.click(screen.getByText('Salvar revisão'));

    await waitFor(() => expect(screen.getByText('falhou')).toBeInTheDocument());
    expect(screen.getAllByRole('textbox')[0].value).toBe('minha reflexão');
    expect(screen.getByText('Salvar revisão').closest('button')).not.toBeDisabled();
  });

  it('sucesso não mostra erro e chama onSubmit com o payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TradeReviewSection trade={makeTrade()} canReview startOpen onSubmit={onSubmit} />);
    openAndAnswer();
    fireEvent.click(screen.getByText('Salvar revisão'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ wouldRepeat: true, answers: {} });
    expect(screen.queryByText(/Não foi possível salvar/i)).not.toBeInTheDocument();
  });

  it('nova tentativa limpa o erro anterior', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('primeira falha'))
      .mockResolvedValueOnce(undefined);
    render(<TradeReviewSection trade={makeTrade()} canReview startOpen onSubmit={onSubmit} />);
    openAndAnswer();
    fireEvent.click(screen.getByText('Salvar revisão'));
    await waitFor(() => expect(screen.getByText('primeira falha')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Salvar revisão'));
    await waitFor(() => expect(screen.queryByText('primeira falha')).not.toBeInTheDocument());
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
