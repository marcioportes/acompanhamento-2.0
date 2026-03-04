/**
 * equityCurveSort.test.js
 * @version 1.0.0 (v1.15.0)
 * @description Testes de regressão para a ordenação determinística de trades na EquityCurve.
 * 
 * BUG ORIGINAL: Trades no mesmo dia ficavam em ordem aleatória porque
 * new Date('2026-03-03') === new Date('2026-03-03') retorna mesma timestamp,
 * causando vales/picos fantasma na curva de patrimônio.
 */

import { describe, it, expect } from 'vitest';

// Extraímos a lógica de sort para testar isoladamente.
// Esta função replica exatamente a sortTradesDeterministic do EquityCurve.
const sortTradesDeterministic = (trades) => {
  const indexed = trades.map((t, i) => ({ ...t, _origIdx: i }));
  return indexed.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.entryTime || a.createdAt?.seconds?.toString() || '';
    const timeB = b.entryTime || b.createdAt?.seconds?.toString() || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a._origIdx - b._origIdx;
  });
};

describe('sortTradesDeterministic', () => {
  it('ordena trades de dias diferentes por data ASC', () => {
    const trades = [
      { id: 'c', date: '2026-03-05', result: 100 },
      { id: 'a', date: '2026-03-03', result: -50 },
      { id: 'b', date: '2026-03-04', result: 200 },
    ];
    const sorted = sortTradesDeterministic(trades);
    expect(sorted.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('desempata trades do mesmo dia por entryTime ASC', () => {
    const trades = [
      { id: 'b', date: '2026-03-03', entryTime: '2026-03-03T14:30:00', result: 200 },
      { id: 'a', date: '2026-03-03', entryTime: '2026-03-03T09:15:00', result: -50 },
      { id: 'c', date: '2026-03-03', entryTime: '2026-03-03T16:00:00', result: 100 },
    ];
    const sorted = sortTradesDeterministic(trades);
    expect(sorted.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('desempata por createdAt.seconds quando não há entryTime', () => {
    const trades = [
      { id: 'b', date: '2026-03-03', createdAt: { seconds: 1709500000 }, result: 200 },
      { id: 'a', date: '2026-03-03', createdAt: { seconds: 1709400000 }, result: -50 },
    ];
    const sorted = sortTradesDeterministic(trades);
    expect(sorted.map(t => t.id)).toEqual(['a', 'b']);
  });

  it('usa índice original como último fallback (estabilidade)', () => {
    const trades = [
      { id: 'first', date: '2026-03-03', result: -50 },
      { id: 'second', date: '2026-03-03', result: 200 },
      { id: 'third', date: '2026-03-03', result: 100 },
    ];
    const sorted = sortTradesDeterministic(trades);
    // Sem entryTime nem createdAt, mantém ordem original
    expect(sorted.map(t => t.id)).toEqual(['first', 'second', 'third']);
  });

  it('REGRESSÃO: curva não gera vales fantasma com trades mesmo dia', () => {
    // Cenário real: 3 trades no mesmo dia, resultados +100, +50, -30
    // A curva deve ser monotonicamente: 0 → +100 → +150 → +120
    // O bug fazia aparecer -30 antes de +100, criando um vale artificial
    const trades = [
      { id: '1', date: '2026-03-03', entryTime: '2026-03-03T09:00:00', result: 100 },
      { id: '2', date: '2026-03-03', entryTime: '2026-03-03T10:30:00', result: 50 },
      { id: '3', date: '2026-03-03', entryTime: '2026-03-03T14:00:00', result: -30 },
    ];
    const sorted = sortTradesDeterministic(trades);
    
    // Simula construção da curva
    let balance = 0;
    const curve = sorted.map(t => {
      balance += t.result;
      return balance;
    });
    
    // Verifica que a curva tem a progressão correta: 100, 150, 120
    expect(curve).toEqual([100, 150, 120]);
    
    // E não algo como: -30, 70, 120 (se -30 viesse primeiro)
    // ou: 50, 150, 120 (se +50 viesse primeiro)
  });

  it('trata trades sem data graciosamente', () => {
    const trades = [
      { id: 'b', date: '2026-03-03', result: 100 },
      { id: 'a', date: null, result: 50 },
      { id: 'c', date: '2026-03-04', result: -20 },
    ];
    const sorted = sortTradesDeterministic(trades);
    // Sem data vai para o início (string vazia < qualquer data)
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
    expect(sorted[2].id).toBe('c');
  });

  it('array vazio retorna array vazio', () => {
    expect(sortTradesDeterministic([])).toEqual([]);
  });

  it('trade único retorna mesmo trade', () => {
    const trades = [{ id: 'solo', date: '2026-03-03', result: 42 }];
    const sorted = sortTradesDeterministic(trades);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe('solo');
  });
});
