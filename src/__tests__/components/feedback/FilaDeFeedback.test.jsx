/**
 * FilaDeFeedback — árvore aluno → dia → plano → trade (issue #408, Fase C).
 *
 * O que estes testes protegem: o nível de plano só aparece quando há mais de um
 * (senão é moldura sobre moldura), a passagem para a FeedbackPage entrega o TRADE
 * inteiro (a página não mudou e não pode receber a linha do período no lugar do
 * documento), e a ordem em dúvida cala o predicado por operação.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilaDeFeedback from '../../../components/feedback/FilaDeFeedback';
import { buildFilaDeFeedback } from '../../../utils/filaDeFeedback';

const b3 = { id: 'b3', name: 'Ago-Plano', pl: 30000, periodStop: 1.67, periodGoal: 3, riskPerOperation: 0.84, operationPeriod: 'Diário' };
const mesa = { id: 'mesa', name: 'Mesa', pl: 4000, periodStop: 1, periodGoal: 2, riskPerOperation: 1, operationPeriod: 'Diário' };

const op = (id, hora, result, extra = {}) => ({
  id, studentId: 'sa', studentName: 'Sandra', date: '2026-08-26', status: 'OPEN',
  ticker: 'WINV26', side: 'LONG', currency: 'BRL', planId: 'b3', result,
  entryTime: `2026-08-26T${hora}-03:00`, ...extra,
});

const montar = (trades, plans = [b3, mesa], props = {}) =>
  render(<FilaDeFeedback fila={buildFilaDeFeedback({ pendentes: trades, plans })} {...props} />);

describe('<FilaDeFeedback /> — nível de plano', () => {
  it('com um plano só, o dia não ganha moldura de plano — o nome vai no cabeçalho', () => {
    montar([op('a', '10:00:00', -250)]);
    expect(screen.getByText(/plano Ago-Plano/)).toBeInTheDocument();
    expect(screen.queryByText(/em 2 planos/)).not.toBeInTheDocument();
  });

  it('com dois planos no mesmo dia, cada período aparece com nome e moeda', () => {
    montar([
      op('a', '10:00:00', -250),
      op('b', '11:00:00', -30, { planId: 'mesa', currency: 'USD', ticker: 'MNQU6' }),
    ]);
    expect(screen.getByText(/em 2 planos/)).toBeInTheDocument();
    expect(screen.getByText('Ago-Plano')).toBeInTheDocument();
    expect(screen.getByText('Mesa')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});

describe('<FilaDeFeedback /> — passagem para a FeedbackPage', () => {
  it('entrega o documento do trade, não a linha do período', () => {
    const onAbrirTrade = vi.fn();
    montar([op('a', '10:00:00', -250)], [b3, mesa], { onAbrirTrade });
    fireEvent.click(screen.getByText('WINV26'));
    expect(onAbrirTrade).toHaveBeenCalledTimes(1);
    const recebido = onAbrirTrade.mock.calls[0][0];
    expect(recebido.id).toBe('a');
    expect(recebido.ticker).toBe('WINV26');
    expect(recebido.result).toBe(-250);
    expect(recebido.entryTime).toBe('2026-08-26T10:00:00-03:00');
  });

  it('selecionar o dia inteiro devolve todos os ids do dia', () => {
    const onSelecionarDia = vi.fn();
    montar([op('a', '10:00:00', -250), op('b', '11:00:00', -265)], [b3, mesa], { onSelecionarDia, selecionados: new Set() });
    fireEvent.click(screen.getByText('o dia'));
    expect(onSelecionarDia).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('<FilaDeFeedback /> — ordem em dúvida', () => {
  it('explica o silêncio e não acusa operação nenhuma', () => {
    montar([op('a', '11:37:15', -250), op('b', '11:37:15', -265)]);
    expect(screen.getByText(/mesmo instante/)).toBeInTheDocument();
    expect(screen.queryByText(/Aberta sem previsão de stop/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aberta depois do stop/)).not.toBeInTheDocument();
    // o fato do conjunto continua na tela
    expect(screen.getByText(/além do stop/i)).toBeInTheDocument();
  });
});

describe('<FilaDeFeedback /> — fila vazia', () => {
  it('estado vazio é resultado, não tela quebrada', () => {
    render(<FilaDeFeedback fila={[]} />);
    expect(screen.getByText(/Nenhum trade esperando feedback/)).toBeInTheDocument();
  });
});
