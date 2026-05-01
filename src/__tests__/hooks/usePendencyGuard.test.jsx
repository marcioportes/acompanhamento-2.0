/**
 * usePendencyGuard.test.jsx
 * @description Testes do agregador de pendências do aluno (issue #220).
 * Cobertura: computePendencies puro + hook reativo (mock dos hooks de dados).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { computePendencies, usePendencyGuard } from '../../hooks/usePendencyGuard';

let mockTradesState = { trades: [], isLoading: false };
let mockReviewsState = { reviews: [], isLoading: false };

vi.mock('../../hooks/useTrades', () => ({
  useTrades: () => mockTradesState,
}));

vi.mock('../../hooks/useWeeklyReviews', () => ({
  useWeeklyReviews: () => mockReviewsState,
}));

const Probe = ({ studentId }) => {
  const { shouldShow, pendingTrades, pendingTakeaways, dismiss, dismissed } = usePendencyGuard(studentId);
  return (
    <div>
      <span data-testid="show">{shouldShow ? 'yes' : 'no'}</span>
      <span data-testid="dismissed">{dismissed ? 'yes' : 'no'}</span>
      <span data-testid="trades-count">{pendingTrades.length}</span>
      <span data-testid="takeaways-count">{pendingTakeaways.length}</span>
      <button data-testid="dismiss-btn" onClick={dismiss}>dismiss</button>
    </div>
  );
};

describe('computePendencies (puro)', () => {
  it('retorna listas vazias quando trades e reviews ausentes', () => {
    expect(computePendencies({})).toEqual({ pendingTrades: [], pendingTakeaways: [] });
    expect(computePendencies({ trades: null, reviews: null })).toEqual({
      pendingTrades: [],
      pendingTakeaways: [],
    });
  });

  it('filtra apenas trades com status REVIEWED', () => {
    const result = computePendencies({
      trades: [
        { id: 't1', status: 'REVIEWED' },
        { id: 't2', status: 'CLOSED' },
        { id: 't3', status: 'REVIEWED' },
        { id: 't4', status: 'OPEN' },
      ],
      reviews: [],
    });
    expect(result.pendingTrades.map(t => t.id)).toEqual(['t1', 't3']);
    expect(result.pendingTakeaways).toEqual([]);
  });

  it('filtra takeaways apenas de revisões CLOSED/ARCHIVED', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        {
          id: 'r-draft',
          status: 'DRAFT',
          takeawayItems: [{ id: 'i1', text: 'a', done: false }],
          alunoDoneIds: [],
        },
        {
          id: 'r-closed',
          status: 'CLOSED',
          weekStart: '2026-04-20',
          takeawayItems: [{ id: 'i2', text: 'b', done: false }],
          alunoDoneIds: [],
        },
        {
          id: 'r-archived',
          status: 'ARCHIVED',
          weekStart: '2026-04-13',
          takeawayItems: [{ id: 'i3', text: 'c', done: false }],
          alunoDoneIds: [],
        },
      ],
    });
    expect(result.pendingTakeaways.map(t => t.id)).toEqual(['i2', 'i3']);
  });

  it('exclui takeaways done pelo mentor (item.done=true)', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          takeawayItems: [
            { id: 'i1', text: 'pendente', done: false },
            { id: 'i2', text: 'mentor encerrou', done: true },
          ],
          alunoDoneIds: [],
        },
      ],
    });
    expect(result.pendingTakeaways.map(t => t.id)).toEqual(['i1']);
  });

  it('exclui takeaways marcados como feitos pelo aluno (alunoDoneIds)', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          takeawayItems: [
            { id: 'i1', text: 'pendente', done: false },
            { id: 'i2', text: 'aluno marcou', done: false },
          ],
          alunoDoneIds: ['i2'],
        },
      ],
    });
    expect(result.pendingTakeaways.map(t => t.id)).toEqual(['i1']);
  });

  it('agrega takeaways de múltiplas revisões com reviewId+weekStart no item', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        {
          id: 'r-old',
          status: 'CLOSED',
          weekStart: '2026-04-13',
          periodKey: '2026-W17',
          takeawayItems: [{ id: 'i1', text: 'old', done: false }],
          alunoDoneIds: [],
        },
        {
          id: 'r-new',
          status: 'CLOSED',
          weekStart: '2026-04-20',
          periodKey: '2026-W18',
          takeawayItems: [{ id: 'i2', text: 'new', done: false }],
          alunoDoneIds: [],
        },
      ],
    });
    expect(result.pendingTakeaways).toHaveLength(2);
    expect(result.pendingTakeaways[0]).toMatchObject({ id: 'i1', reviewId: 'r-old', reviewWeekStart: '2026-04-13' });
    expect(result.pendingTakeaways[1]).toMatchObject({ id: 'i2', reviewId: 'r-new', reviewWeekStart: '2026-04-20' });
  });

  it('é defensivo a takeawayItems não-array e alunoDoneIds não-array', () => {
    const result = computePendencies({
      trades: [],
      reviews: [
        { id: 'r1', status: 'CLOSED', takeawayItems: null, alunoDoneIds: 'wrong' },
        { id: 'r2', status: 'CLOSED', takeawayItems: undefined, alunoDoneIds: undefined },
      ],
    });
    expect(result.pendingTakeaways).toEqual([]);
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
    expect(screen.getByTestId('trades-count').textContent).toBe('0');
    expect(screen.getByTestId('takeaways-count').textContent).toBe('0');
  });

  it('shouldShow=true quando há trades REVIEWED', () => {
    mockTradesState = {
      trades: [{ id: 't1', status: 'REVIEWED' }],
      isLoading: false,
    };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
    expect(screen.getByTestId('trades-count').textContent).toBe('1');
  });

  it('shouldShow=true quando há takeaways pendentes', () => {
    mockReviewsState = {
      reviews: [
        {
          id: 'r1',
          status: 'CLOSED',
          takeawayItems: [{ id: 'i1', text: 'x', done: false }],
          alunoDoneIds: [],
        },
      ],
      isLoading: false,
    };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');
    expect(screen.getByTestId('takeaways-count').textContent).toBe('1');
  });

  it('dismiss seta sessionStorage e flip dismissed', () => {
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-1" />);
    expect(screen.getByTestId('show').textContent).toBe('yes');

    act(() => {
      fireEvent.click(screen.getByTestId('dismiss-btn'));
    });

    expect(screen.getByTestId('dismissed').textContent).toBe('yes');
    expect(screen.getByTestId('show').textContent).toBe('no');
    expect(sessionStorage.getItem('pendency_dismissed_u-1')).toBe('1');
  });

  it('dismiss persiste em mount subsequente (sessionStorage carregado no init)', () => {
    sessionStorage.setItem('pendency_dismissed_u-2', '1');
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-2" />);
    expect(screen.getByTestId('dismissed').textContent).toBe('yes');
    expect(screen.getByTestId('show').textContent).toBe('no');
  });

  it('uid distinto não vê dismiss de outro uid', () => {
    sessionStorage.setItem('pendency_dismissed_u-1', '1');
    mockTradesState = { trades: [{ id: 't1', status: 'REVIEWED' }], isLoading: false };
    render(<Probe studentId="u-2" />);
    expect(screen.getByTestId('dismissed').textContent).toBe('no');
    expect(screen.getByTestId('show').textContent).toBe('yes');
  });
});
