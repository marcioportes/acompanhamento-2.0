/**
 * useDashboardMetrics — ContextBar respect (issue #188 F4)
 *
 * Garante que TODOS os cards consumidores recebem trades filtrados pela
 * janela `context.periodRange` quando definida. Sem exceção, sem override
 * vitalício. Também verifica que a granularidade (ticker/setup/emotion)
 * continua operando, e que o hook é idempotente quando periodRange=null.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import useDashboardMetrics from '../../hooks/useDashboardMetrics';

const baseAccounts = [
  { id: 'acc-1', currency: 'USD', initialBalance: 10000, currentBalance: 10500 },
];

const basePlans = [{ id: 'plan-1', accountId: 'acc-1', active: true }];

const mkTrade = (id, date, result = 100, overrides = {}) => ({
  id,
  date,
  accountId: 'acc-1',
  planId: 'plan-1',
  result,
  ticker: 'WIN',
  setup: 'Pullback',
  emotion: 'Calmo',
  ...overrides,
});

const neutralFilters = {
  accountId: 'acc-1',
  ticker: 'all',
  setup: 'all',
  emotion: 'all',
  exchange: 'all',
  result: 'all',
  search: '',
};

describe('useDashboardMetrics — ContextBar respect', () => {
  const trades = [
    mkTrade('t1', '2026-01-15', 500),
    mkTrade('t2', '2026-02-10', -200),
    mkTrade('t3', '2026-02-20', 300),
    mkTrade('t4', '2026-03-05', 150),
    mkTrade('t5', '2026-04-12', -100),
  ];

  it('sem context.periodRange retorna todos os trades do escopo', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
      })
    );
    expect(result.current.filteredTrades).toHaveLength(5);
    expect(result.current.stats.totalPL).toBe(500 - 200 + 300 + 150 - 100);
  });

  it('com context.periodRange retorna só trades dentro da janela (inclusivo)', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          accountId: 'acc-1',
          planId: 'plan-1',
          cycleKey: '2026-02',
          periodRange: {
            kind: 'CYCLE',
            start: new Date(2026, 1, 1), // fev 1
            end: new Date(2026, 1, 28), // fev 28
          },
        },
      })
    );
    const ids = result.current.filteredTrades.map((t) => t.id);
    expect(ids).toEqual(['t2', 't3']);
    expect(result.current.stats.totalPL).toBe(100);
  });

  it('periodRange inclui trade na borda end (23:59:59 do último dia)', () => {
    const borderTrades = [
      mkTrade('a', '2026-02-28', 50),
      mkTrade('b', '2026-03-01', 999),
    ];
    const { result } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades: borderTrades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          periodRange: {
            kind: 'CYCLE',
            start: new Date(2026, 1, 1),
            end: new Date(2026, 1, 28),
          },
        },
      })
    );
    const ids = result.current.filteredTrades.map((t) => t.id);
    expect(ids).toEqual(['a']);
  });

  it('periodRange combinado com filters granular reduz ainda mais', () => {
    const mixed = [
      mkTrade('x', '2026-02-10', 100, { ticker: 'WIN' }),
      mkTrade('y', '2026-02-15', 200, { ticker: 'MNQ' }),
      mkTrade('z', '2026-01-20', 300, { ticker: 'WIN' }),
    ];
    const { result } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades: mixed,
        plans: basePlans,
        filters: { ...neutralFilters, ticker: 'WIN' },
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          periodRange: {
            start: new Date(2026, 1, 1),
            end: new Date(2026, 1, 28),
          },
        },
      })
    );
    const ids = result.current.filteredTrades.map((t) => t.id);
    expect(ids).toEqual(['x']); // dentro da janela E ticker=WIN
  });

  it('periodRange sem start/end é ignorado (fallback permissivo)', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: { periodRange: { kind: 'CYCLE', start: null, end: null } },
      })
    );
    expect(result.current.filteredTrades).toHaveLength(5);
  });

  it('plContext label reflete kind do periodRange', () => {
    const { result: resCycle } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          periodRange: { kind: 'CYCLE', start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) },
        },
      })
    );
    expect(resCycle.current.plContext.label).toMatch(/Ciclo/i);

    const { result: resMonth } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          periodRange: { kind: 'MONTH', start: new Date(2026, 3, 1), end: new Date(2026, 3, 30) },
        },
      })
    );
    expect(resMonth.current.plContext.label).toMatch(/Mês/i);

    const { result: resNone } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
      })
    );
    expect(resNone.current.plContext.label).toBe('P&L Total');
  });

  it('MaxDrawdown é calculado apenas sobre a janela', () => {
    const ddTrades = [
      mkTrade('big', '2026-01-15', -5000),
      mkTrade('m1', '2026-02-10', 100),
      mkTrade('m2', '2026-02-20', -200),
      mkTrade('m3', '2026-02-25', 50),
    ];
    const { result: resFull } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades: ddTrades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
      })
    );
    expect(resFull.current.maxDrawdownData.maxDD).toBeGreaterThanOrEqual(5000);

    const { result: resFev } = renderHook(() =>
      useDashboardMetrics({
        accounts: baseAccounts,
        trades: ddTrades,
        plans: basePlans,
        filters: neutralFilters,
        selectedPlanId: null,
        accountTypeFilter: 'all',
        context: {
          periodRange: { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) },
        },
      })
    );
    // MaxDD do ciclo fev = 200 (após peak de 100)
    expect(resFev.current.maxDrawdownData.maxDD).toBe(200);
  });
});
