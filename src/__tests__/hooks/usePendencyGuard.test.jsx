/**
 * usePendencyGuard.test.jsx
 * @description Testes do agregador de pendências do aluno (issue #220).
 * Cobertura: computePendencies + computeFingerprint puros + hook reativo com fingerprint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { computePendencies, computeFingerprint, usePendencyGuard } from '../../hooks/usePendencyGuard';

let mockTradesState = { trades: [], isLoading: false };
let mockReviewsState = { reviews: [], isLoading: false };

vi.mock('../../hooks/useTrades', () => ({
  useTrades: () => mockTradesState,
}));

vi.mock('../../hooks/useWeeklyReviews', () => ({
  useWeeklyReviews: () => mockReviewsState,
}));

const Probe = ({ studentId }) => {
  const { shouldShow, pendingTrades, pendingTakeaways, dismiss, closeForNow, dismissed, currentFingerprint } = usePendencyGuard(studentId);
  return (
    <div>
      <span data-testid="show">{shouldShow ? 'yes' : 'no'}</span>
      <span data-testid="dismissed">{dismissed ? 'yes' : 'no'}</span>
      <span data-testid="trades-count">{pendingTrades.length}</span>
      <span data-testid="takeaways-count">{pendingTakeaways.length}</span>
      <span data-testid="fp">{currentFingerprint}</span>
      <button data-testid="dismiss-btn" onClick={dismiss}>dismiss</button>
      <button data-testid="close-btn" onClick={closeForNow}>close</button>
    </div>
  );
};

describe('computePendencies (puro)', () => {
  it('listas vazias quando trades e reviews ausentes', () => {
    expect(computePendencies({})).toEqual({ pendingTrades: [], pendingTakeaways: [] });
  });

  it('filtra apenas trades REVIEWED', () => {
    const result = computePendencies({
      trades: [
        { id: 't1', status: 'REVIEWED' },
        { id: 't2', status: 'CLOSED' },
        { id: 't3', status: 'REVIEWED' },
      ],
      reviews: [],
    });
    expect(result.pendingTrades.map(t => t.id)).toEqual(['t1', 't3']);
  });

  it('filtra takeaways apenas de revisões CLOSED/ARCHIVED', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        { id: 'r-draft', status: 'DRAFT', takeawayItems: [{ id: 'i1', text: 'a', done: false }], alunoDoneIds: [] },
        { id: 'r-closed', status: 'CLOSED', takeawayItems: [{ id: 'i2', text: 'b', done: false }], alunoDoneIds: [] },
        { id: 'r-archived', status: 'ARCHIVED', takeawayItems: [{ id: 'i3', text: 'c', done: false }], alunoDoneIds: [] },
      ],
    });
    expect(result.pendingTakeaways.map(t => t.id)).toEqual(['i2', 'i3']);
  });

  it('exclui takeaways done E alunoDoneIds', () => {
    const result = computePendencies({
      trades: [],
      reviews: [{
        id: 'r1',
        status: 'CLOSED',
        takeawayItems: [
          { id: 'i1', text: 'a', done: false },
          { id: 'i2', text: 'b', done: true },
          { id: 'i3', text: 'c', done: false },
        ],
        alunoDoneIds: ['i3'],
      }],
    });
    expect(result.pendingTakeaways.map(t => t.id)).toEqual(['i1']);
  });
});

describe('computeFingerprint (puro)', () => {
  it('vazio para conjunto vazio', () => {
    expect(computeFingerprint([], [])).toBe('');
  });

  it('estável independente da ordem', () => {
    const fp1 = computeFingerprint(
      [{ id: 't2' }, { id: 't1' }],
      [{ reviewId: 'r1', id: 'i2' }, { reviewId: 'r1', id: 'i1' }],
    );
    const fp2 = computeFingerprint(
      [{ id: 't1' }, { id: 't2' }],
      [{ reviewId: 'r1', id: 'i1' }, { reviewId: 'r1', id: 'i2' }],
    );
    expect(fp1).toBe(fp2);
  });

  it('muda quando set muda', () => {
    const fp1 = computeFingerprint([{ id: 't1' }], []);
    const fp2 = computeFingerprint([{ id: 't1' }, { id: 't2' }], []);
    expect(fp1).not.toBe(fp2);
  });
});

describe('usePendencyGuard (hook)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTradesState = { trades: [], isLoading: false };
    mockReviewsState = { reviews: [], isLoading: false };
  });

  it('shouldShow=false sem studentId', () => {
    render(<Probe studentId={null} />);
    expect(screen.getByTestId('show').textContent).toBe('no');
  });

  it('shouldShow=false quando loading', () => {
    mockTradesState = { trades: [], isLoading: true };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('no');
  });

  it('shouldShow=false quando ambas categorias vazias', () => {
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('no');
  });

  it('shouldShow=true quando há trades REVIEWED', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });

  it('shouldShow=true quando há takeaways pendentes', () => {
    mockReviewsState = {
      reviews: [{ id: 'r1', status: 'CLOSED', takeawayItems: [{ id: 'i1', done: false }], alunoDoneIds: [] }],
      isLoading: false,
    };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });

  it('dismiss grava fingerprint atual em sessionStorage', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-1" />);
    const fp = screen.getByTestId('fp').textContent;
    expect(fp).not.toBe('');
    expect(screen.getByTestId('show').textContent).toBe('yes');

    act(() => {
      fireEvent.click(screen.getByTestId('dismiss-btn'));
    });

    expect(screen.getByTestId('dismissed').textContent).toBe('yes');
    expect(screen.getByTestId('show').textContent).toBe('no');
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).toBe(fp);
  });

  it('F5 mantém dismiss para o MESMO conjunto de pendências', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    // Pré-gravado em "sessão anterior" (= F5)
    const fpExpected = computeFingerprint([{ id: 't1' }], []);
    sessionStorage.setItem('pendency_dismissed_u-2', fpExpected);
    render(<Probe studentId="u-2" />);
    expect(screen.getByTestId('dismissed').textContent).toBe('yes');
    expect(screen.getByTestId('show').textContent).toBe('no');
  });

  it('NOVA pendência (set diferente) reabre modal mesmo com dismiss prévio', () => {
    // Sessão anterior: dismiss feito com 1 trade REVIEWED.
    const fpOld = computeFingerprint([{ id: 't1' }], []);
    sessionStorage.setItem('pendency_dismissed_u-3', fpOld);

    // Cenário atual: agora tem 2 trades REVIEWED (mentor adicionou um novo).
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED' }, { id: 't2', status: 'REVIEWED' }],
      isLoading: false,
    };
    render(<Probe studentId="u-3" />);
    expect(screen.getByTestId('dismissed').textContent).toBe('no');
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });

  it('aluno limpa tudo → próxima pendência reabre modal mesmo na mesma sessão', () => {
    // Estado inicial: 1 trade + dismiss feito.
    const fpOld = computeFingerprint([{ id: 't1' }], []);
    sessionStorage.setItem('pendency_dismissed_u-4', fpOld);
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    const { rerender } = render(<Probe studentId="u-4" />);
    expect(screen.getByTestId('show').textContent).toBe('no');

    // Aluno fecha trade → lista zera.
    mockTradesState = { trades: [], isLoading: false };
    rerender(<Probe studentId="u-4" />);
    expect(screen.getByTestId('show').textContent).toBe('no');

    // Mentor adiciona novo trade REVIEWED → fingerprint diferente do dismissed.
    mockTradesState = { trades: [{ id: 't2', status: 'REVIEWED' }], isLoading: false };
    rerender(<Probe studentId="u-4" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });

  it('uid distinto não vê dismiss de outro uid', () => {
    sessionStorage.setItem('pendency_dismissed_u-1', 'qualquer-fp');
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-2" />);
    expect(screen.getByTestId('dismissed').textContent).toBe('no');
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });

  it('closeForNow fecha sem persistir (não toca sessionStorage)', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-5" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');

    act(() => {
      fireEvent.click(screen.getByTestId('close-btn'));
    });
    expect(screen.getByTestId('show').textContent).toBe('no');
    expect(sessionStorage.getItem('pendency_dismissed_u-5')).toBe(null);
  });

  it('closeForNow é resetado quando set de pendências muda', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    const { rerender } = render(<Probe studentId="u-6" />);

    act(() => {
      fireEvent.click(screen.getByTestId('close-btn'));
    });
    expect(screen.getByTestId('show').textContent).toBe('no');

    // Novo trade entra → set muda → closedForNow reset → modal reabre.
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED' }, { id: 't2', status: 'REVIEWED' }],
      isLoading: false,
    };
    rerender(<Probe studentId="u-6" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });
});
