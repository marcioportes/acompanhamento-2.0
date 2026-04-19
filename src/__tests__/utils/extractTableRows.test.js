/**
 * extractTableRows.test.js
 * @description Testes do helper buildTableRows — monta rows da ExtractTable
 *   com duas visões de acumulado: ciclo (cumPnL) e período (periodCumPnL).
 */

import { describe, it, expect } from 'vitest';
import { buildTableRows } from '../../utils/extractTableRows';
import { computePlanState } from '../../utils/planStateMachine';

const makeTrade = (date, result, overrides = {}) => ({
  id: `t_${date}_${result}_${Math.random().toString(36).slice(2, 6)}`,
  date,
  entryTime: `${date}T10:00:00`,
  result,
  planId: 'plan_test',
  ...overrides,
});

const basePlanConfig = {
  pl: 20000,
  periodGoal: 2,
  periodStop: 2,
  cycleGoal: 8,
  cycleStop: 6,
  operationPeriod: 'Diário',
  adjustmentCycle: 'Mensal',
};

describe('buildTableRows', () => {
  it('planState null → retorna tableRows vazio e carryOver 0', () => {
    const out = buildTableRows(null, null);
    expect(out.tableRows).toEqual([]);
    expect(out.carryOver).toBe(0);
  });

  it('visão ciclo, 1 período → periodCumPnL = cumPnL em cada row', () => {
    const trades = [
      makeTrade('2026-03-04', 100),
      makeTrade('2026-03-04', 50),
      makeTrade('2026-03-04', 80),
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const { tableRows, carryOver } = buildTableRows(planState, null);
    expect(carryOver).toBe(0);
    expect(tableRows).toHaveLength(3);
    expect(tableRows.map(r => r.cumPnL)).toEqual([100, 150, 230]);
    expect(tableRows.map(r => r.periodCumPnL)).toEqual([100, 150, 230]);
    expect(tableRows.every(r => r.cycleEvent === null)).toBe(true);
  });

  it('visão ciclo, 2+ períodos → periodCumPnL reseta na fronteira do período', () => {
    const trades = [
      makeTrade('2026-03-04', 100),
      makeTrade('2026-03-04', 50),
      makeTrade('2026-03-04', 80),
      makeTrade('2026-03-05', -30),
      makeTrade('2026-03-05', 60),
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const { tableRows } = buildTableRows(planState, null);
    expect(tableRows).toHaveLength(5);
    expect(tableRows.map(r => r.cumPnL)).toEqual([100, 150, 230, 200, 260]);
    expect(tableRows.map(r => r.periodCumPnL)).toEqual([100, 150, 230, -30, 30]);
  });

  it('visão ciclo, goal hit → cycleEvent marcado no trade que cruza', () => {
    const trades = [
      makeTrade('2026-03-04', 800),
      makeTrade('2026-03-05', 900), // runningTotal 1700 ≥ 1600 (cycleGoal 8% de 20000)
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const { tableRows } = buildTableRows(planState, null);
    expect(tableRows[0].cycleEvent).toBe(null);
    expect(tableRows[1].cycleEvent).toBe('CYCLE_GOAL_HIT');
  });

  it('visão período, primeiro período → carry 0, periodCumPnL = row.cumPnL', () => {
    const trades = [
      makeTrade('2026-03-04', 100),
      makeTrade('2026-03-04', 50),
      makeTrade('2026-03-05', -30),
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const firstKey = planState.availablePeriods[0];
    const { tableRows, carryOver } = buildTableRows(planState, firstKey);
    expect(carryOver).toBe(0);
    expect(tableRows).toHaveLength(2);
    expect(tableRows.map(r => r.cumPnL)).toEqual([100, 150]);
    expect(tableRows.map(r => r.periodCumPnL)).toEqual([100, 150]);
    expect(tableRows.every(r => r.cycleEvent === null)).toBe(true);
  });

  it('visão período, segundo período → carry soma período anterior, periodCumPnL período-only', () => {
    const trades = [
      makeTrade('2026-03-04', 100),
      makeTrade('2026-03-04', 130), // day1 total = 230
      makeTrade('2026-03-05', -30),
      makeTrade('2026-03-05', 60),  // day2 period-only = [-30, 30]
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const secondKey = planState.availablePeriods[1];
    const { tableRows, carryOver } = buildTableRows(planState, secondKey);
    expect(carryOver).toBe(230);
    expect(tableRows).toHaveLength(2);
    expect(tableRows.map(r => r.cumPnL)).toEqual([200, 260]);      // carry + period
    expect(tableRows.map(r => r.periodCumPnL)).toEqual([-30, 30]); // period-only
    expect(tableRows.every(r => r.cycleEvent === null)).toBe(true);
  });

  it('visão período vazio (periodKey inválido) → tableRows vazio, carryOver soma períodos anteriores', () => {
    const trades = [
      makeTrade('2026-03-04', 100),
    ];
    const planState = computePlanState(trades, basePlanConfig, {
      targetDate: new Date('2026-03-15T12:00:00'),
    });
    const { tableRows, carryOver } = buildTableRows(planState, 'periodo-inexistente');
    expect(tableRows).toEqual([]);
    expect(carryOver).toBe(100);
  });
});
