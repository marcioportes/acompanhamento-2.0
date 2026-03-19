/**
 * v1197-sidebar-badge.test.js
 * Testes para badge de revisões não trabalhadas (REVIEWED) no Sidebar do aluno
 * @version 1.19.7
 */
import { describe, it, expect } from 'vitest';

// Simula a lógica do useMemo de unreviewedFeedbackCount do App.jsx
function countUnreviewedFeedback(allTrades, isMentor, viewingAsStudent) {
  if (isMentor && !viewingAsStudent) return 0;
  try {
    return (allTrades || []).filter(t => t.status === 'REVIEWED').length;
  } catch (e) {
    return 0;
  }
}

describe('unreviewedFeedbackCount', () => {
  it('conta trades REVIEWED para aluno', () => {
    const trades = [
      { id: '1', status: 'OPEN' },
      { id: '2', status: 'REVIEWED' },
      { id: '3', status: 'REVIEWED' },
      { id: '4', status: 'CLOSED' },
    ];
    expect(countUnreviewedFeedback(trades, false, false)).toBe(2);
  });

  it('retorna 0 quando nenhum trade REVIEWED', () => {
    const trades = [
      { id: '1', status: 'OPEN' },
      { id: '2', status: 'CLOSED' },
      { id: '3', status: 'QUESTION' },
    ];
    expect(countUnreviewedFeedback(trades, false, false)).toBe(0);
  });

  it('retorna 0 para mentor (nao eh badge do mentor)', () => {
    const trades = [
      { id: '1', status: 'REVIEWED' },
      { id: '2', status: 'REVIEWED' },
    ];
    expect(countUnreviewedFeedback(trades, true, false)).toBe(0);
  });

  it('conta REVIEWED quando mentor em viewAsStudent', () => {
    const trades = [
      { id: '1', status: 'REVIEWED' },
      { id: '2', status: 'OPEN' },
    ];
    expect(countUnreviewedFeedback(trades, true, true)).toBe(1);
  });

  it('nao conta QUESTION como nao trabalhado', () => {
    const trades = [
      { id: '1', status: 'QUESTION' },
      { id: '2', status: 'REVIEWED' },
    ];
    expect(countUnreviewedFeedback(trades, false, false)).toBe(1);
  });

  it('retorna 0 com allTrades null', () => {
    expect(countUnreviewedFeedback(null, false, false)).toBe(0);
  });

  it('retorna 0 com allTrades undefined', () => {
    expect(countUnreviewedFeedback(undefined, false, false)).toBe(0);
  });

  it('retorna 0 com array vazio', () => {
    expect(countUnreviewedFeedback([], false, false)).toBe(0);
  });
});
