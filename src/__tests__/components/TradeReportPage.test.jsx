/**
 * TradeReportPage.test.jsx — Relatório do Mês (#414).
 *
 * Render real em jsdom: build verde não prova tela viva (AP-08). Cobre o que a
 * página promete — só trade com feedback, recorte do mês, total por moeda sem
 * cross-currency, refs clicáveis e o clique que leva pra conversa.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

let mockTradesState = { trades: [], loading: false };

vi.mock('../../hooks/useTrades', () => ({
  useTrades: () => mockTradesState,
}));

vi.mock('../../version', () => ({
  VERSION: { display: 'v0.0.0-test', full: '0.0.0-test' },
  default: { display: 'v0.0.0-test', full: '0.0.0-test' },
}));

import TradeReportPage from '../../pages/TradeReportPage';

const AGO = '2026-08';

const trade = (over = {}) => ({
  id: 't1', date: '2026-08-27', entryTime: '2026-08-27T15:05:00-03:00',
  ticker: 'WINM26', side: 'LONG', qty: 2, result: -94, currency: 'BRL',
  status: 'DISCUSSED', notes: 'Barra 2 no HTF de 60min.',
  mentorFeedback: 'A entrada veio antes do fechamento da barra.',
  ...over,
});

// A página abre no mês corrente; os fixtures são de agosto/2026.
const inAugust = () => vi.setSystemTime(new Date(2026, 7, 15, 12, 0));

describe('TradeReportPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    inAugust();
    mockTradesState = { trades: [], loading: false };
  });

  it('mostra as três colunas do relatório', () => {
    mockTradesState = { trades: [trade()], loading: false };
    render(<TradeReportPage />);
    expect(screen.getByText('Trade')).toBeTruthy();
    expect(screen.getAllByText('Observação de entrada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Feedback do mentor').length).toBeGreaterThan(0);
    expect(screen.getByText('Barra 2 no HTF de 60min.')).toBeTruthy();
    expect(screen.getByText('A entrada veio antes do fechamento da barra.')).toBeTruthy();
  });

  it('trade SEM feedback não aparece', () => {
    mockTradesState = {
      trades: [
        trade({ id: 'com', ticker: 'WINM26' }),
        trade({ id: 'sem', ticker: 'WDOU26', mentorFeedback: null, feedbackHistory: [] }),
      ],
      loading: false,
    };
    render(<TradeReportPage />);
    expect(screen.getByText('WINM26')).toBeTruthy();
    expect(screen.queryByText('WDOU26')).toBeNull();
  });

  it('trade de outro mês só aparece ao navegar pra ele', () => {
    mockTradesState = {
      trades: [trade({ id: 'jul', date: '2026-07-10', ticker: 'WDOU26' })],
      loading: false,
    };
    render(<TradeReportPage />);
    expect(screen.queryByText('WDOU26')).toBeNull();
    expect(screen.getByText(/Nenhum trade com feedback em agosto \/ 2026/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText('julho / 2026')).toBeTruthy();
    expect(screen.getByText('WDOU26')).toBeTruthy();
  });

  it('NUNCA soma moedas diferentes — uma linha de total por moeda', () => {
    mockTradesState = {
      trades: [
        trade({ id: 'a', date: '2026-08-10', result: -340, currency: 'BRL' }),
        trade({ id: 'b', date: '2026-08-11', result: 128, currency: 'USD' }),
      ],
      loading: false,
    };
    render(<TradeReportPage />);
    // o número mora num <strong> — casa pelo texto normalizado do elemento
    expect(screen.getByText((_, el) => el?.textContent?.trim() === '2 trades com feedback')).toBeTruthy();
    expect(screen.getByText('BRL')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    // -340 + 128 = -212 não pode existir em lugar nenhum da tela
    expect(screen.queryByText(/-?212/)).toBeNull();
  });

  it('clicar na linha abre a conversa do trade', () => {
    const onNavigateToFeedback = vi.fn();
    mockTradesState = { trades: [trade()], loading: false };
    render(<TradeReportPage onNavigateToFeedback={onNavigateToFeedback} />);
    fireEvent.click(screen.getByText('WINM26'));
    expect(onNavigateToFeedback).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('clicar na ref abre a imagem sem disparar a navegação da linha', () => {
    const onNavigateToFeedback = vi.fn();
    mockTradesState = {
      trades: [trade({ htfUrl: 'https://x/htf.png', ltfUrl: 'https://x/ltf.png' })],
      loading: false,
    };
    render(<TradeReportPage onNavigateToFeedback={onNavigateToFeedback} />);
    fireEvent.click(screen.getByAltText('HTF'));
    expect(onNavigateToFeedback).not.toHaveBeenCalled();
    expect(screen.getByAltText('Gráfico')).toBeTruthy();
  });

  it('trade sem observação diz isso, em vez de linha em branco', () => {
    mockTradesState = { trades: [trade({ notes: '' })], loading: false };
    render(<TradeReportPage />);
    expect(screen.getByText('Sem observação registrada')).toBeTruthy();
  });

  it('mês vazio oferece atalho pro mês mais recente que tem feedback', () => {
    mockTradesState = { trades: [trade({ date: '2026-05-10' })], loading: false };
    render(<TradeReportPage />);
    const atalho = screen.getByText(/Ver maio \/ 2026/);
    fireEvent.click(atalho);
    expect(screen.getByText('maio / 2026')).toBeTruthy();
    expect(screen.getByText('WINM26')).toBeTruthy();
  });

  it('mostra as duas primeiras mensagens do mentor e conta o resto', () => {
    mockTradesState = {
      trades: [trade({
        mentorFeedback: null,
        feedbackHistory: [
          { id: '1', authorRole: 'mentor', content: 'primeira', createdAt: '2026-08-28T10:00:00Z' },
          { id: '2', authorRole: 'student', content: 'do aluno', createdAt: '2026-08-28T10:30:00Z' },
          { id: '3', authorRole: 'mentor', content: 'segunda', createdAt: '2026-08-28T11:00:00Z' },
          { id: '4', authorRole: 'mentor', content: 'terceira', createdAt: '2026-08-28T12:00:00Z' },
        ],
      })],
      loading: false,
    };
    render(<TradeReportPage />);
    expect(screen.getByText('primeira')).toBeTruthy();
    expect(screen.getByText('segunda')).toBeTruthy();
    expect(screen.queryByText('terceira')).toBeNull();
    expect(screen.queryByText('do aluno')).toBeNull();
    expect(screen.getByText(/\+1 mensagem na conversa/)).toBeTruthy();
  });
});
