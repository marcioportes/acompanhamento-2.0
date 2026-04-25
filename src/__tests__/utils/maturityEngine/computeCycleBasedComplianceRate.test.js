/**
 * Issue #191 — computeCycleBasedComplianceRate (ESM mirror)
 *
 * Cenários A-E da memória de cálculo aprovada + casos limites.
 */

import { describe, it, expect } from 'vitest';
import { computeCycleBasedComplianceRate } from '../../../utils/maturityEngine/computeCycleBasedComplianceRate.js';

const NOW = new Date(2026, 3, 24, 15, 0, 0); // 2026-04-24 15:00 local
const PLAN_M = { id: 'p1', adjustmentCycle: 'Mensal' };
const PLAN_M2 = { id: 'p2', adjustmentCycle: 'Mensal' };
const PLAN_T = { id: 'pT', adjustmentCycle: 'Trimestral' };

function makeTrades(count, prefix, date, flagsForFirstN = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    date,
    hasRedFlags: i < flagsForFirstN,
  }));
}

describe('computeCycleBasedComplianceRate — cenários da memória', () => {
  it('A — janela inicial suficiente, 100% aderente → 100', () => {
    const trades = makeTrades(25, 'a', '2026-04-15', 0);
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100);
  });

  it('B — janela inicial < 20, fallback completa um ciclo → 86.67', () => {
    const apr = makeTrades(12, 'apr', '2026-04-10', 3); // 12 trades, 3 flags
    const mar = makeTrades(18, 'mar', '2026-03-15', 1); // 18 trades, 1 flag
    const rate = computeCycleBasedComplianceRate({
      trades: [...apr, ...mar],
      plans: [PLAN_M],
      now: NOW,
    });
    // União 30 trades, 4 flags → 26/30 * 100 = 86.6666...
    expect(rate).toBeCloseTo((26 / 30) * 100, 6);
  });

  it('C — histórico esgotado < 20 → null', () => {
    const trades = [
      ...makeTrades(3, 'apr', '2026-04-15', 0),
      ...makeTrades(2, 'mar', '2026-03-15', 0),
      ...makeTrades(3, 'feb', '2026-02-15', 0),
    ];
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBeNull();
  });

  it('D — múltiplos planos, ciclo ativo cobre 20 → 95.45', () => {
    // Ciclo Mensal de p1 = abril, ciclo de p2 também abril (mesmo adjustmentCycle).
    // União de ranges com mesmo intervalo dedup por trade.id.
    const trades = makeTrades(22, 'mix', '2026-04-12', 1); // 22 trades, 1 flag
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M, PLAN_M2],
      now: NOW,
    });
    expect(rate).toBeCloseTo((21 / 22) * 100, 6);
  });

  it('E — trader sem trades no ciclo atual, último encerrado cobre → 100', () => {
    const trades = makeTrades(24, 'mar', '2026-03-15', 0); // só março, 0 flags
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100);
  });
});

describe('computeCycleBasedComplianceRate — invariantes', () => {
  it('retorna null quando trades é vazio', () => {
    expect(computeCycleBasedComplianceRate({ trades: [], plans: [PLAN_M], now: NOW })).toBeNull();
  });

  it('retorna null quando plans é vazio', () => {
    const trades = makeTrades(25, 'x', '2026-04-15', 0);
    expect(computeCycleBasedComplianceRate({ trades, plans: [], now: NOW })).toBeNull();
  });

  it('retorna null quando now é inválido', () => {
    const trades = makeTrades(25, 'x', '2026-04-15', 0);
    expect(
      computeCycleBasedComplianceRate({ trades, plans: [PLAN_M], now: new Date('not-a-date') }),
    ).toBeNull();
  });

  it('ignora trades com date inválido sem quebrar', () => {
    const trades = [
      ...makeTrades(20, 'ok', '2026-04-10', 0),
      { id: 'bad-1', date: 'lixo' },
      { id: 'bad-2', date: null },
      { id: 'bad-3', date: undefined },
    ];
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100); // 20 ok, 0 flags
  });

  it('aceita trade.date em formato BR (DD/MM/YYYY)', () => {
    const trades = Array.from({ length: 20 }, (_, i) => ({
      id: `br-${i}`,
      date: '15/04/2026',
      hasRedFlags: false,
    }));
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100);
  });

  it('aceita trade.date como Date', () => {
    const trades = Array.from({ length: 20 }, (_, i) => ({
      id: `dt-${i}`,
      date: new Date(2026, 3, 15, 10),
      hasRedFlags: false,
    }));
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100);
  });

  it('redFlags array é equivalente a hasRedFlags=true', () => {
    const trades = [
      ...Array.from({ length: 19 }, (_, i) => ({
        id: `ok-${i}`,
        date: '2026-04-15',
      })),
      { id: 'rf', date: '2026-04-15', redFlags: ['x'] },
    ];
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBeCloseTo((19 / 20) * 100, 6);
  });

  it('trades duplicados por id são contados uma vez (planos sobrepostos)', () => {
    const shared = makeTrades(22, 'shared', '2026-04-12', 0);
    const rate = computeCycleBasedComplianceRate({
      trades: shared,
      plans: [PLAN_M, PLAN_M2, { id: 'p3', adjustmentCycle: 'Mensal' }],
      now: NOW,
    });
    expect(rate).toBe(100); // 22 trades únicos, não 66
  });

  it('plano Trimestral agrupa janela em quarter', () => {
    // Q2 2026 = abril+maio+junho. Ciclo ativo do plano Trimestral cobre Q2.
    // 25 trades em maio, 0 flags.
    const trades = Array.from({ length: 25 }, (_, i) => ({
      id: `q-${i}`,
      date: '2026-05-10',
      hasRedFlags: false,
    }));
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_T],
      now: NOW,
    });
    expect(rate).toBe(100);
  });

  it('respeita parâmetro minTrades customizado', () => {
    const trades = makeTrades(5, 'few', '2026-04-15', 1);
    // minTrades=4 deve aceitar e calcular
    expect(
      computeCycleBasedComplianceRate({ trades, plans: [PLAN_M], now: NOW, minTrades: 4 }),
    ).toBeCloseTo((4 / 5) * 100, 6);
    // minTrades=10 deve recusar
    expect(
      computeCycleBasedComplianceRate({ trades, plans: [PLAN_M], now: NOW, minTrades: 10 }),
    ).toBeNull();
  });

  it('plano sem adjustmentCycle defaults para Mensal', () => {
    const trades = makeTrades(20, 'd', '2026-04-15', 0);
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [{ id: 'no-cfg' }],
      now: NOW,
    });
    expect(rate).toBe(100);
  });

  it('histórico longo: retrocede múltiplos ciclos até atingir mínimo', () => {
    // 5 trades por mês, em abril/março/fevereiro/janeiro = 20 trades, 0 flags
    const trades = [
      ...makeTrades(5, 'apr', '2026-04-10', 0),
      ...makeTrades(5, 'mar', '2026-03-10', 0),
      ...makeTrades(5, 'feb', '2026-02-10', 0),
      ...makeTrades(5, 'jan', '2026-01-10', 0),
    ];
    const rate = computeCycleBasedComplianceRate({
      trades,
      plans: [PLAN_M],
      now: NOW,
    });
    expect(rate).toBe(100);
  });
});
