import { describe, it, expect } from 'vitest';
import { computePropPlanDefaults } from '../../utils/propPlanDefaults';

const baseApexEod25k = {
  mode: 'execution',
  incompatible: false,
  drawdownMax: 1000,
  dailyLossLimit: 500,
  profitTarget: 1500,
  dailyTarget: 72,
  roPerTrade: 150,
  maxTradesPerDay: 2,
  rrMinimum: 2,
};

const baseYlosChallenge25k = {
  mode: 'execution',
  incompatible: false,
  drawdownMax: 1500,
  dailyLossLimit: null,
  profitTarget: 1500,
  dailyTarget: 50,
  roPerTrade: 150,
  maxTradesPerDay: 2,
  rrMinimum: 2,
};

const baseAbstractApex = {
  mode: 'abstract',
  incompatible: false,
  drawdownMax: 1000,
  dailyLossLimit: 500,
  profitTarget: 1500,
  dailyTarget: 72,
  roPerTrade: 0,
  maxTradesPerDay: 0,
  rrMinimum: 2,
};

const baseAbstractYlos = {
  mode: 'abstract',
  incompatible: false,
  drawdownMax: 1500,
  dailyLossLimit: null,
  profitTarget: 1500,
  dailyTarget: 50,
  roPerTrade: 0,
  maxTradesPerDay: 0,
  rrMinimum: 2,
};

describe('computePropPlanDefaults', () => {
  it('Apex EOD 25K execution: periodStop derivado de maxTrades × RO (1.2%), não dailyLossLimit (2%)', () => {
    const result = computePropPlanDefaults(baseApexEod25k, 25000);
    expect(result.periodStopPct).toBe(1.2);
    expect(result.periodStopPct).not.toBe(2);
  });

  it('Ylos Challenge 25K execution: periodStop = 1.2% mesmo com dailyLossLimit=null', () => {
    const result = computePropPlanDefaults(baseYlosChallenge25k, 25000);
    expect(result.periodStopPct).toBe(1.2);
  });

  it('Modo abstract Apex: roPerTrade=0 → fallback para dailyLossLimit (2%)', () => {
    const result = computePropPlanDefaults(baseAbstractApex, 25000);
    expect(result.periodStopPct).toBe(2);
  });

  it('Modo abstract Ylos (sem daily loss): roPerTrade=0 + dailyLossLimit=null → fallback final 2.0', () => {
    const result = computePropPlanDefaults(baseAbstractYlos, 25000);
    expect(result.periodStopPct).toBe(2);
  });

  it('Apex EOD 25K: cycleGoal/cycleStop/periodGoal mantidos corretos', () => {
    const result = computePropPlanDefaults(baseApexEod25k, 25000);
    expect(result.cycleGoalPct).toBe(6);
    expect(result.cycleStopPct).toBe(4);
    expect(result.periodGoalPct).toBe(0.3);
  });

  it('initialBalance=0: retorna todos valores em fallback padrão (não NaN/Infinity)', () => {
    const result = computePropPlanDefaults(baseApexEod25k, 0);
    expect(result.cycleGoalPct).toBe(10);
    expect(result.cycleStopPct).toBe(10);
    expect(result.periodGoalPct).toBe(1);
    expect(result.periodStopPct).toBe(2);
    expect(Number.isFinite(result.cycleGoalPct)).toBe(true);
  });

  it('riskPctPerOp execution: usa roPerTrade / initialBalance', () => {
    const result = computePropPlanDefaults(baseApexEod25k, 25000);
    expect(result.riskPctPerOp).toBe(0.6);
  });

  it('riskPctPerOp abstract: default 0.5 (sem instrumento)', () => {
    const result = computePropPlanDefaults(baseAbstractApex, 25000);
    expect(result.riskPctPerOp).toBe(0.5);
  });

  it('rrTarget: usa attackPlan.rrMinimum', () => {
    const result = computePropPlanDefaults(baseApexEod25k, 25000);
    expect(result.rrTarget).toBe(2);
  });

  it('rrTarget fallback: attackPlan.rrMinimum undefined → 1.5', () => {
    const result = computePropPlanDefaults({ ...baseApexEod25k, rrMinimum: undefined }, 25000);
    expect(result.rrTarget).toBe(1.5);
  });
});
