/**
 * equityCurveIdeal.test.js
 * @description Testes da curva ideal (meta + stop) do EquityCurve (E5 — issue #164).
 *
 * Cobre:
 *  - generateIdealEquitySeries: trajetória linear pelos dias corridos do ciclo.
 *  - calculateIdealStatus: posição relativa (above / inside / below) do PL real.
 */

import { describe, it, expect } from 'vitest';
import {
  generateIdealEquitySeries,
  calculateIdealStatus,
} from '../../utils/equityCurveIdeal.js';

describe('generateIdealEquitySeries', () => {
  it('gera 31 pontos para ciclo de 30 dias (start + end inclusive)', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const series = generateIdealEquitySeries(plan, cycle);

    expect(Array.isArray(series)).toBe(true);
    expect(series.length).toBe(31);
    expect(series[0].dayIndex).toBe(0);
    expect(series[series.length - 1].dayIndex).toBe(30);
  });

  it('valores no dia 0 são iguais ao pl (corredor parte do mesmo ponto)', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const series = generateIdealEquitySeries(plan, cycle);

    expect(series[0].goal).toBeCloseTo(10000, 6);
    expect(series[0].stop).toBeCloseTo(10000, 6);
  });

  it('valores no fim do ciclo refletem cycleGoal e cycleStop totais', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const series = generateIdealEquitySeries(plan, cycle);

    const last = series[series.length - 1];
    expect(last.goal).toBeCloseTo(11000, 6); // pl × (1 + 10/100)
    expect(last.stop).toBeCloseTo(9500, 6); // pl × (1 − 5/100)
  });

  it('trajetória é monotonicamente crescente (goal) e decrescente (stop)', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const series = generateIdealEquitySeries(plan, cycle);

    for (let i = 1; i < series.length; i++) {
      expect(series[i].goal).toBeGreaterThanOrEqual(series[i - 1].goal);
      expect(series[i].stop).toBeLessThanOrEqual(series[i - 1].stop);
    }
  });

  it('trajetória linear: dia X tem goal = pl × (1 + cycleGoal/100 × (X / totalDays))', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const series = generateIdealEquitySeries(plan, cycle);

    // Dia 15 de 30 → meio do ciclo → 5% lucro acumulado proporcional
    const mid = series[15];
    expect(mid.dayIndex).toBe(15);
    expect(mid.goal).toBeCloseTo(10000 * (1 + 0.10 * (15 / 30)), 6); // = 10500
    expect(mid.stop).toBeCloseTo(10000 * (1 - 0.05 * (15 / 30)), 6); // = 9750
  });

  it('cada ponto tem date no formato ISO (YYYY-MM-DD)', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-05' };
    const series = generateIdealEquitySeries(plan, cycle);

    expect(series.map(p => p.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ]);
  });

  it('aceita Date objects em startDate/endDate', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = {
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-05T23:59:59Z'),
    };
    const series = generateIdealEquitySeries(plan, cycle);

    expect(series.length).toBe(5);
    expect(series[0].date).toBe('2026-01-01');
    expect(series[4].date).toBe('2026-01-05');
  });

  it('single day cycle (start == end) → 1 ponto com goal/stop em valor final', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-01' };
    const series = generateIdealEquitySeries(plan, cycle);

    expect(series.length).toBe(1);
    // Em ciclo de 1 dia, "fim do ciclo" é o próprio dia → exibe target final
    expect(series[0].goal).toBeCloseTo(11000, 6);
    expect(series[0].stop).toBeCloseTo(9500, 6);
    expect(series[0].dayIndex).toBe(0);
  });

  it('retorna null se pl <= 0', () => {
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    expect(generateIdealEquitySeries({ pl: 0, cycleGoal: 10, cycleStop: 5 }, cycle)).toBeNull();
    expect(generateIdealEquitySeries({ pl: -100, cycleGoal: 10, cycleStop: 5 }, cycle)).toBeNull();
  });

  it('retorna null se cycleGoal/cycleStop ausentes ou zero', () => {
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    expect(generateIdealEquitySeries({ pl: 10000, cycleStop: 5 }, cycle)).toBeNull();
    expect(generateIdealEquitySeries({ pl: 10000, cycleGoal: 10 }, cycle)).toBeNull();
    expect(generateIdealEquitySeries({ pl: 10000, cycleGoal: 0, cycleStop: 0 }, cycle)).toBeNull();
  });

  it('retorna null se ciclo sem startDate ou endDate', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    expect(generateIdealEquitySeries(plan, null)).toBeNull();
    expect(generateIdealEquitySeries(plan, {})).toBeNull();
    expect(generateIdealEquitySeries(plan, { startDate: '2026-01-01' })).toBeNull();
    expect(generateIdealEquitySeries(plan, { endDate: '2026-01-31' })).toBeNull();
  });

  it('retorna null se startDate posterior a endDate', () => {
    const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
    const cycle = { startDate: '2026-02-01', endDate: '2026-01-01' };
    expect(generateIdealEquitySeries(plan, cycle)).toBeNull();
  });

  it('retorna null se plan ausente', () => {
    const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
    expect(generateIdealEquitySeries(null, cycle)).toBeNull();
    expect(generateIdealEquitySeries(undefined, cycle)).toBeNull();
  });
});

describe('calculateIdealStatus', () => {
  const plan = { pl: 10000, cycleGoal: 10, cycleStop: 5 };
  const cycle = { startDate: '2026-01-01', endDate: '2026-01-31' };
  const series = generateIdealEquitySeries(plan, cycle);
  const initialBalance = 10000;

  it('detecta status above quando equity real > goal do dia', () => {
    // Dia 15: goal=10500, stop=9750. PL real de +600 → equity 10600 > goal 10500
    const now = new Date('2026-01-16T12:00:00Z'); // dayIndex 15
    const result = calculateIdealStatus(600, initialBalance, series, now);
    expect(result.status).toBe('above');
    expect(result.percentVsGoal).toBeGreaterThan(0);
  });

  it('detecta status inside quando equity real está entre stop e goal', () => {
    // Dia 15: goal=10500, stop=9750. PL real de +200 → equity 10200 ∈ [9750, 10500]
    const now = new Date('2026-01-16T12:00:00Z');
    const result = calculateIdealStatus(200, initialBalance, series, now);
    expect(result.status).toBe('inside');
  });

  it('detecta status below quando equity real < stop do dia', () => {
    // Dia 15: stop=9750. PL real de -300 → equity 9700 < stop 9750
    const now = new Date('2026-01-16T12:00:00Z');
    const result = calculateIdealStatus(-300, initialBalance, series, now);
    expect(result.status).toBe('below');
    expect(result.percentVsStop).toBeLessThan(0);
  });

  it('equity exatamente na linha da meta → inside (limite superior do corredor)', () => {
    // Dia 15: goal=10500. PL real de +500 → equity 10500 == goal
    const now = new Date('2026-01-16T12:00:00Z');
    const result = calculateIdealStatus(500, initialBalance, series, now);
    expect(result.status).toBe('inside');
  });

  it('equity exatamente na linha do stop → inside (limite inferior do corredor)', () => {
    // Dia 15: stop=9750. PL real de -250 → equity 9750 == stop
    const now = new Date('2026-01-16T12:00:00Z');
    const result = calculateIdealStatus(-250, initialBalance, series, now);
    expect(result.status).toBe('inside');
  });

  it('clampa o índice ao último ponto quando now é depois do fim do ciclo', () => {
    // now muito depois do ciclo → usa o último ponto da série (goal=11000, stop=9500)
    const now = new Date('2027-01-01T00:00:00Z');
    const result = calculateIdealStatus(2000, initialBalance, series, now); // equity 12000 > goal 11000
    expect(result.status).toBe('above');
  });

  it('clampa o índice ao primeiro ponto quando now é antes do ciclo', () => {
    // now antes do ciclo → usa primeiro ponto (goal=stop=10000)
    const now = new Date('2025-12-01T00:00:00Z');
    const result = calculateIdealStatus(0, initialBalance, series, now);
    expect(result.status).toBe('inside');
  });

  it('retorna null se idealSeries é null/empty', () => {
    const now = new Date('2026-01-16T12:00:00Z');
    expect(calculateIdealStatus(0, initialBalance, null, now)).toBeNull();
    expect(calculateIdealStatus(0, initialBalance, [], now)).toBeNull();
  });

  it('percentVsGoal e percentVsStop calculados como % do pl', () => {
    // Dia 15: goal=10500, stop=9750, pl=10000. PL real de +700 → equity 10700.
    // percentVsGoal = (10700 - 10500) / 10000 × 100 = +2%
    // percentVsStop = (10700 - 9750) / 10000 × 100 = +9.5%
    const now = new Date('2026-01-16T12:00:00Z');
    const result = calculateIdealStatus(700, initialBalance, series, now);
    expect(result.percentVsGoal).toBeCloseTo(2, 4);
    expect(result.percentVsStop).toBeCloseTo(9.5, 4);
  });
});
