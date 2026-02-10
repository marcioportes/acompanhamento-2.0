/**
 * Testes unitários para utils/calculations.js
 * 
 * Testa funções de cálculo de P&L, Win Rate, Profit Factor, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTradeResult,
  calculateResultPercent,
  calculateStats,
  filterTradesByPeriod,
  filterTradesByDateRange,
  formatCurrency,
  formatPercent,
  searchTrades,
} from '@/utils/calculations';

describe('calculateTradeResult', () => {
  it('deve calcular resultado de trade LONG positivo', () => {
    const result = calculateTradeResult('LONG', 100, 110, 10);
    expect(result).toBe(100); // (110 - 100) * 10 = 100
  });

  it('deve calcular resultado de trade LONG negativo', () => {
    const result = calculateTradeResult('LONG', 100, 90, 10);
    expect(result).toBe(-100); // (90 - 100) * 10 = -100
  });

  it('deve calcular resultado de trade SHORT positivo', () => {
    const result = calculateTradeResult('SHORT', 100, 90, 10);
    expect(result).toBe(100); // (100 - 90) * 10 = 100
  });

  it('deve calcular resultado de trade SHORT negativo', () => {
    const result = calculateTradeResult('SHORT', 100, 110, 10);
    expect(result).toBe(-100); // (100 - 110) * 10 = -100
  });

  it('deve retornar 0 para trade sem movimento', () => {
    const result = calculateTradeResult('LONG', 100, 100, 10);
    expect(result).toBe(0);
  });

  it('deve lidar com valores string', () => {
    const result = calculateTradeResult('LONG', '100', '110', '10');
    expect(result).toBe(100);
  });

  it('deve retornar 0 para inputs inválidos', () => {
    expect(calculateTradeResult('LONG', null, 110, 10)).toBe(0);
    expect(calculateTradeResult('LONG', 100, undefined, 10)).toBe(0);
    expect(calculateTradeResult('LONG', 100, 110, 0)).toBe(0);
  });
});

describe('calculateResultPercent', () => {
  it('deve calcular percentual de trade LONG', () => {
    const result = calculateResultPercent('LONG', 100, 110);
    expect(result).toBeCloseTo(10); // 10%
  });

  it('deve calcular percentual de trade SHORT', () => {
    const result = calculateResultPercent('SHORT', 100, 90);
    expect(result).toBeCloseTo(10); // 10%
  });

  it('deve retornar 0 para entry 0', () => {
    const result = calculateResultPercent('LONG', 0, 100);
    expect(result).toBe(0);
  });
});

describe('calculateStats', () => {
  const mockTrades = [
    { result: 100, entry: 100, exit: 110, side: 'LONG' },
    { result: 50, entry: 100, exit: 105, side: 'LONG' },
    { result: -30, entry: 100, exit: 97, side: 'LONG' },
    { result: -20, entry: 100, exit: 102, side: 'SHORT' },
    { result: 200, entry: 100, exit: 80, side: 'SHORT' },
  ];

  it('deve calcular total de trades', () => {
    const stats = calculateStats(mockTrades);
    expect(stats.totalTrades).toBe(5);
  });

  it('deve calcular P&L total corretamente', () => {
    const stats = calculateStats(mockTrades);
    expect(stats.totalPL).toBe(300); // 100 + 50 - 30 - 20 + 200
  });

  it('deve calcular win rate corretamente', () => {
    const stats = calculateStats(mockTrades);
    expect(stats.winRate).toBe(60); // 3 wins / 5 total = 60%
  });

  it('deve calcular profit factor corretamente', () => {
    const stats = calculateStats(mockTrades);
    // Wins: 100 + 50 + 200 = 350
    // Losses: 30 + 20 = 50
    // PF = 350 / 50 = 7
    expect(stats.profitFactor).toBe(7);
  });

  it('deve retornar Infinity para profit factor sem losses', () => {
    const winningTrades = [
      { result: 100 },
      { result: 50 },
    ];
    const stats = calculateStats(winningTrades);
    expect(stats.profitFactor).toBe(Infinity);
  });

  it('deve contar wins e losses corretamente', () => {
    const stats = calculateStats(mockTrades);
    expect(stats.winTrades).toBe(3);
    expect(stats.lossTrades).toBe(2);
  });

  it('deve retornar stats zeradas para array vazio', () => {
    const stats = calculateStats([]);
    expect(stats.totalTrades).toBe(0);
    expect(stats.totalPL).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });
});

describe('filterTradesByPeriod', () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0];

  const trades = [
    { id: '1', date: today, result: 100 },
    { id: '2', date: yesterday, result: 50 },
    { id: '3', date: lastWeek, result: -30 },
    { id: '4', date: lastMonth, result: 200 },
  ];

  it('deve filtrar trades de hoje', () => {
    const filtered = filterTradesByPeriod(trades, 'today');
    expect(filtered.length).toBe(1);
    expect(filtered[0].date).toBe(today);
  });

  it('deve filtrar trades da semana', () => {
    const filtered = filterTradesByPeriod(trades, 'week');
    expect(filtered.length).toBeGreaterThanOrEqual(2);
  });

  it('deve retornar todos para período "all"', () => {
    const filtered = filterTradesByPeriod(trades, 'all');
    expect(filtered.length).toBe(trades.length);
  });
});

describe('filterTradesByDateRange', () => {
  const trades = [
    { id: '1', date: '2026-02-01', result: 100 },
    { id: '2', date: '2026-02-05', result: 50 },
    { id: '3', date: '2026-02-10', result: -30 },
    { id: '4', date: '2026-02-15', result: 200 },
  ];

  it('deve filtrar por range de datas', () => {
    const filtered = filterTradesByDateRange(trades, '2026-02-01', '2026-02-10');
    expect(filtered.length).toBe(3);
  });

  it('deve incluir datas nos limites', () => {
    const filtered = filterTradesByDateRange(trades, '2026-02-05', '2026-02-10');
    expect(filtered.some(t => t.date === '2026-02-05')).toBe(true);
    expect(filtered.some(t => t.date === '2026-02-10')).toBe(true);
  });

  it('deve retornar vazio para range sem trades', () => {
    const filtered = filterTradesByDateRange(trades, '2026-03-01', '2026-03-31');
    expect(filtered.length).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('deve formatar valor em BRL', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toContain('1.234');
    expect(formatted).toContain('56');
  });

  it('deve formatar valor negativo', () => {
    const formatted = formatCurrency(-500);
    expect(formatted).toContain('500');
    expect(formatted).toContain('-');
  });

  it('deve formatar zero', () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain('0');
  });
});

describe('formatPercent', () => {
  it('deve formatar percentual', () => {
    const formatted = formatPercent(65.5);
    expect(formatted).toContain('65');
  });

  it('deve formatar zero', () => {
    const formatted = formatPercent(0);
    expect(formatted).toContain('0');
  });
});

describe('searchTrades', () => {
  const trades = [
    { id: '1', ticker: 'WINFUT', setup: 'Rompimento', notes: 'Trade matinal' },
    { id: '2', ticker: 'PETR4', setup: 'Reversão', notes: 'Payroll' },
    { id: '3', ticker: 'WINFUT', setup: 'Scalp', notes: 'Sem observações' },
  ];

  it('deve buscar por ticker', () => {
    const results = searchTrades(trades, 'WINFUT');
    expect(results.length).toBe(2);
  });

  it('deve buscar por setup', () => {
    const results = searchTrades(trades, 'Rompimento');
    expect(results.length).toBe(1);
  });

  it('deve buscar por notes', () => {
    const results = searchTrades(trades, 'Payroll');
    expect(results.length).toBe(1);
  });

  it('deve ser case-insensitive', () => {
    const results = searchTrades(trades, 'winfut');
    expect(results.length).toBe(2);
  });

  it('deve retornar vazio para busca sem resultados', () => {
    const results = searchTrades(trades, 'INEXISTENTE');
    expect(results.length).toBe(0);
  });

  it('deve retornar todos para busca vazia', () => {
    const results = searchTrades(trades, '');
    expect(results.length).toBe(trades.length);
  });
});
