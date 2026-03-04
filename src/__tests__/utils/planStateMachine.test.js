/**
 * planStateMachine.test.js
 * @version 1.0.0 (v1.16.0)
 * @description Testes da máquina de estados do plano.
 *   Cobre: períodos, ciclos, transições, POST_GOAL/POST_STOP,
 *   agrupamento diário/semanal, boundary de ciclo, badges.
 */

import { describe, it, expect } from 'vitest';
import {
  PERIOD_STATES,
  computePeriodState,
  computePlanState,
  getPeriodKey,
  getCycleStartDate,
  getCycleEndDate,
  classifyPeriodBadge,
  getSentimentFromState,
} from '../../utils/planStateMachine';

// ============================================
// HELPERS — Factory de trades para testes
// ============================================

const makeTrade = (overrides = {}) => ({
  id: `trade_${Math.random().toString(36).slice(2, 8)}`,
  date: '2026-03-04',
  entryTime: '2026-03-04T10:00:00',
  result: 0,
  planId: 'plan_test',
  ...overrides,
});

const makePlanConfig = (overrides = {}) => ({
  pl: 20000,
  periodGoal: 2,       // 2% = R$ 400
  periodStop: 2,       // 2% = R$ 400
  cycleGoal: 8,        // 8% = R$ 1600
  cycleStop: 6,        // 6% = R$ 1200
  operationPeriod: 'Diário',
  adjustmentCycle: 'Mensal',
  ...overrides,
});

// ============================================
// computePeriodState
// ============================================

describe('computePeriodState', () => {
  it('período vazio → IN_PROGRESS, sem eventos', () => {
    const state = computePeriodState([], 400, 400);
    expect(state.status).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.rows).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.summary.tradesCount).toBe(0);
    expect(state.summary.totalPnL).toBe(0);
  });

  it('1 trade lucrativo abaixo da meta → IN_PROGRESS', () => {
    const trades = [makeTrade({ result: 200 })];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.rows[0].periodEvent).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.summary.totalPnL).toBe(200);
    expect(state.summary.goalPercent).toBe(50); // 200/400
  });

  it('acumulado atinge meta → GOAL_HIT no trade correto', () => {
    const trades = [
      makeTrade({ result: 150, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: 100, entryTime: '2026-03-04T10:30:00' }),
      makeTrade({ result: 200, entryTime: '2026-03-04T11:00:00' }), // acum = 450 >= 400
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.GOAL_HIT);
    expect(state.rows[0].periodEvent).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.rows[1].periodEvent).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.rows[2].periodEvent).toBe(PERIOD_STATES.GOAL_HIT);
    expect(state.events).toHaveLength(1);
    expect(state.events[0].type).toBe('GOAL_HIT');
    expect(state.events[0].tradeIndex).toBe(2);
  });

  it('trade após GOAL_HIT → POST_GOAL', () => {
    const trades = [
      makeTrade({ result: 500, entryTime: '2026-03-04T10:00:00' }), // GOAL_HIT
      makeTrade({ result: -100, entryTime: '2026-03-04T11:00:00' }), // POST_GOAL
      makeTrade({ result: 50, entryTime: '2026-03-04T11:30:00' }),   // POST_GOAL
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.POST_GOAL);
    expect(state.rows[0].periodEvent).toBe(PERIOD_STATES.GOAL_HIT);
    expect(state.rows[1].periodEvent).toBe(PERIOD_STATES.POST_GOAL);
    expect(state.rows[2].periodEvent).toBe(PERIOD_STATES.POST_GOAL);
    expect(state.summary.preEventPnL).toBe(500);
    expect(state.summary.postEventPnL).toBe(-50); // -100 + 50
    expect(state.summary.postEventCount).toBe(2);
  });

  it('acumulado atinge stop → STOP_HIT', () => {
    const trades = [
      makeTrade({ result: -200, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: -250, entryTime: '2026-03-04T10:30:00' }), // acum = -450 <= -400
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.STOP_HIT);
    expect(state.rows[1].periodEvent).toBe(PERIOD_STATES.STOP_HIT);
    expect(state.events[0].type).toBe('STOP_HIT');
    expect(state.summary.stopPercent).toBeCloseTo(112.5); // 450/400 * 100
  });

  it('trade após STOP_HIT → POST_STOP', () => {
    const trades = [
      makeTrade({ result: -500, entryTime: '2026-03-04T10:00:00' }), // STOP_HIT
      makeTrade({ result: 200, entryTime: '2026-03-04T11:00:00' }),   // POST_STOP
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.POST_STOP);
    expect(state.rows[0].periodEvent).toBe(PERIOD_STATES.STOP_HIT);
    expect(state.rows[1].periodEvent).toBe(PERIOD_STATES.POST_STOP);
  });

  it('meta atingida, depois devolveu → POST_GOAL com pnl negativo pós-evento', () => {
    const trades = [
      makeTrade({ result: 450, entryTime: '2026-03-04T10:00:00' }),  // GOAL_HIT
      makeTrade({ result: -300, entryTime: '2026-03-04T11:00:00' }), // POST_GOAL, devolveu
      makeTrade({ result: -200, entryTime: '2026-03-04T11:30:00' }), // POST_GOAL, devolveu mais
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.POST_GOAL);
    expect(state.summary.totalPnL).toBe(-50); // 450 - 300 - 200
    expect(state.summary.preEventPnL).toBe(450);
    expect(state.summary.postEventPnL).toBe(-500);
  });

  it('goalVal = 0 → nunca atinge meta', () => {
    const trades = [makeTrade({ result: 10000 })];
    const state = computePeriodState(trades, 0, 400);
    expect(state.status).toBe(PERIOD_STATES.IN_PROGRESS);
  });

  it('stopVal = 0 → nunca atinge stop', () => {
    const trades = [makeTrade({ result: -10000 })];
    const state = computePeriodState(trades, 400, 0);
    expect(state.status).toBe(PERIOD_STATES.IN_PROGRESS);
  });

  it('trade com result = 0 → não muda estado', () => {
    const trades = [
      makeTrade({ result: 0, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: 0, entryTime: '2026-03-04T10:30:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    expect(state.status).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.summary.totalPnL).toBe(0);
  });
});

// ============================================
// computePlanState — Agrupamento Diário
// ============================================

describe('computePlanState — Diário', () => {
  it('trades no mesmo dia ficam no mesmo período', () => {
    const trades = [
      makeTrade({ date: '2026-03-04', result: 100, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ date: '2026-03-04', result: 200, entryTime: '2026-03-04T11:00:00' }),
    ];
    const config = makePlanConfig();
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-04T12:00:00') });

    expect(state.availablePeriods).toHaveLength(1);
    expect(state.availablePeriods[0]).toBe('2026-03-04');
    expect(state.cycleState.periods.get('2026-03-04').summary.tradesCount).toBe(2);
  });

  it('trades em dias diferentes → períodos separados', () => {
    const trades = [
      makeTrade({ date: '2026-03-03', result: 100 }),
      makeTrade({ date: '2026-03-04', result: -50 }),
      makeTrade({ date: '2026-03-05', result: 200 }),
    ];
    const config = makePlanConfig();
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-05T12:00:00') });

    expect(state.availablePeriods).toHaveLength(3);
    expect(state.cycleState.summary.totalPnL).toBe(250);
  });

  it('filtra trades fora do ciclo', () => {
    const trades = [
      makeTrade({ date: '2026-02-28', result: 999 }), // Fevereiro — fora do ciclo de março
      makeTrade({ date: '2026-03-04', result: 100 }),
    ];
    const config = makePlanConfig();
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-04T12:00:00') });

    expect(state.cycleState.summary.tradesCount).toBe(1);
    expect(state.cycleState.summary.totalPnL).toBe(100);
  });
});

// ============================================
// computePlanState — Agrupamento Semanal
// ============================================

describe('computePlanState — Semanal', () => {
  it('trades de segunda a sexta ficam na mesma semana', () => {
    // 2026-03-02 = segunda, 2026-03-06 = sexta
    const trades = [
      makeTrade({ date: '2026-03-02', result: 100 }),
      makeTrade({ date: '2026-03-04', result: 200 }),
      makeTrade({ date: '2026-03-06', result: -50 }),
    ];
    const config = makePlanConfig({ operationPeriod: 'Semanal' });
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-06T12:00:00') });

    expect(state.availablePeriods).toHaveLength(1);
    // Chave da semana = segunda-feira
    expect(state.availablePeriods[0]).toBe('2026-03-02');
  });

  it('semana que cruza mês se divide no boundary do ciclo', () => {
    // 2026-03-30 = segunda, 2026-03-31 = terça (fim do mês), 2026-04-01 = quarta (novo ciclo)
    const trades = [
      makeTrade({ date: '2026-03-30', result: 100 }),
      makeTrade({ date: '2026-03-31', result: 200 }),
      makeTrade({ date: '2026-04-01', result: 300 }), // Novo ciclo
    ];
    const config = makePlanConfig({ operationPeriod: 'Semanal' });

    // Ciclo de março — usar T12:00:00 para evitar problema de TZ (UTC midnight = dia anterior em BRT)
    const stateMar = computePlanState(trades, config, { targetDate: new Date('2026-03-31T12:00:00') });
    expect(stateMar.cycleState.summary.totalPnL).toBe(300); // Apenas março
    expect(stateMar.cycleState.summary.tradesCount).toBe(2);

    // Ciclo de abril
    const stateApr = computePlanState(trades, config, { targetDate: new Date('2026-04-01T12:00:00') });
    expect(stateApr.cycleState.summary.totalPnL).toBe(300); // Apenas abril
    expect(stateApr.cycleState.summary.tradesCount).toBe(1);
  });
});

// ============================================
// computePlanState — Ciclo State Machine
// ============================================

describe('computePlanState — Cycle states', () => {
  it('ciclo com 3 períodos calcula estado do ciclo corretamente', () => {
    const trades = [
      makeTrade({ date: '2026-03-03', result: 500 }),
      makeTrade({ date: '2026-03-04', result: 500 }),
      makeTrade({ date: '2026-03-05', result: 500 }),
    ];
    const config = makePlanConfig(); // cycleGoal = 8% = R$ 1600
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-05T12:00:00') });

    expect(state.cycleState.summary.totalPnL).toBe(1500);
    expect(state.cycleState.status).toBe(PERIOD_STATES.IN_PROGRESS);
    expect(state.cycleState.summary.periodsCount).toBe(3);
  });

  it('ciclo atinge goal', () => {
    const trades = [
      makeTrade({ date: '2026-03-03', result: 800 }),
      makeTrade({ date: '2026-03-04', result: 900 }), // acum = 1700 >= 1600
    ];
    const config = makePlanConfig();
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-04T12:00:00') });

    expect(state.cycleState.status).toBe(PERIOD_STATES.GOAL_HIT);
    expect(state.cycleState.events).toHaveLength(1);
    expect(state.cycleState.events[0].type).toBe('CYCLE_GOAL_HIT');
  });

  it('ciclo atinge stop', () => {
    const trades = [
      makeTrade({ date: '2026-03-03', result: -700 }),
      makeTrade({ date: '2026-03-04', result: -600 }), // acum = -1300 <= -1200
    ];
    const config = makePlanConfig();
    const state = computePlanState(trades, config, { targetDate: new Date('2026-03-04T12:00:00') });

    expect(state.cycleState.status).toBe(PERIOD_STATES.STOP_HIT);
    expect(state.cycleState.events[0].type).toBe('CYCLE_STOP_HIT');
  });
});

// ============================================
// getCycleStartDate / getCycleEndDate
// ============================================

describe('Cycle date helpers', () => {
  it('Mensal: março 2026', () => {
    const ref = new Date('2026-03-15T12:00:00');
    const start = getCycleStartDate('Mensal', ref);
    const end = getCycleEndDate('Mensal', ref);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2); // março = 2
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(31);
  });

  it('Trimestral: Q1 2026 (jan-mar)', () => {
    const ref = new Date('2026-02-10T12:00:00');
    const start = getCycleStartDate('Trimestral', ref);
    const end = getCycleEndDate('Trimestral', ref);
    expect(start.getMonth()).toBe(0); // janeiro
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2); // março
    expect(end.getDate()).toBe(31);
  });

  it('Trimestral: Q2 2026 (abr-jun)', () => {
    const ref = new Date('2026-05-20T12:00:00');
    const start = getCycleStartDate('Trimestral', ref);
    const end = getCycleEndDate('Trimestral', ref);
    expect(start.getMonth()).toBe(3); // abril
    expect(end.getMonth()).toBe(5);   // junho
    expect(end.getDate()).toBe(30);
  });
});

// ============================================
// getPeriodKey
// ============================================

describe('getPeriodKey', () => {
  const cycleStart = new Date('2026-03-01T00:00:00');
  const cycleEnd = new Date('2026-03-31T23:59:59.999');

  it('Diário retorna a data do trade', () => {
    expect(getPeriodKey('2026-03-04', 'Diário', cycleStart, cycleEnd)).toBe('2026-03-04');
  });

  it('Semanal retorna a segunda-feira', () => {
    // 2026-03-04 = quarta → segunda = 2026-03-02
    expect(getPeriodKey('2026-03-04', 'Semanal', cycleStart, cycleEnd)).toBe('2026-03-02');
  });

  it('Semanal trunca no início do ciclo se segunda é do mês anterior', () => {
    // 2026-03-01 = domingo. Segunda da semana ISO = 2026-02-23 (fev)
    // Como cycleStart = 01/mar, deve usar 01/mar como chave
    expect(getPeriodKey('2026-03-01', 'Semanal', cycleStart, cycleEnd)).toBe('2026-03-01');
  });
});

// ============================================
// classifyPeriodBadge
// ============================================

describe('classifyPeriodBadge', () => {
  it('IN_PROGRESS → Em Andamento', () => {
    const state = computePeriodState([makeTrade({ result: 100 })], 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('IN_PROGRESS');
    expect(badge.colorClass).toBe('slate');
  });

  it('GOAL_HIT sem POST → GOAL_DISCIPLINED', () => {
    const state = computePeriodState([makeTrade({ result: 500 })], 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('GOAL_DISCIPLINED');
    expect(badge.icon).toBe('Check');
    expect(badge.colorClass).toBe('emerald');
  });

  it('POST_GOAL com gain → POST_GOAL_GAIN', () => {
    const trades = [
      makeTrade({ result: 500, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: 50, entryTime: '2026-03-04T11:00:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('POST_GOAL_GAIN');
  });

  it('POST_GOAL que devolveu meta → POST_GOAL_LOSS', () => {
    const trades = [
      makeTrade({ result: 500, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: -400, entryTime: '2026-03-04T11:00:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('POST_GOAL_LOSS');
    expect(badge.label).toBe('Devolveu Meta');
  });

  it('POST_GOAL que foi ao stop → GOAL_TO_STOP (Catástrofe)', () => {
    const trades = [
      makeTrade({ result: 500, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: -600, entryTime: '2026-03-04T11:00:00' }),
      makeTrade({ result: -400, entryTime: '2026-03-04T11:30:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('GOAL_TO_STOP');
    expect(badge.animate).toBe(true);
  });

  it('STOP_HIT → Stop Atingido', () => {
    const state = computePeriodState([makeTrade({ result: -500 })], 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('STOP_HIT');
    expect(badge.colorClass).toBe('red');
  });

  it('POST_STOP que recuperou → LOSS_TO_GOAL', () => {
    const trades = [
      makeTrade({ result: -500, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: 600, entryTime: '2026-03-04T11:00:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('LOSS_TO_GOAL');
    expect(badge.label).toBe('Recuperação');
  });

  it('POST_STOP que piorou → STOP_WORSENED', () => {
    const trades = [
      makeTrade({ result: -500, entryTime: '2026-03-04T10:00:00' }),
      makeTrade({ result: -100, entryTime: '2026-03-04T11:00:00' }),
    ];
    const state = computePeriodState(trades, 400, 400);
    const badge = classifyPeriodBadge(state);
    expect(badge.badge).toBe('STOP_WORSENED');
    expect(badge.animate).toBe(true);
  });
});

// ============================================
// getSentimentFromState
// ============================================

describe('getSentimentFromState', () => {
  it('GOAL_HIT → Trophy dourado', () => {
    const s = getSentimentFromState(PERIOD_STATES.GOAL_HIT, 500);
    expect(s.icon).toBe('Trophy');
    expect(s.colorClass).toContain('yellow');
  });

  it('STOP_HIT → Skull vermelho', () => {
    const s = getSentimentFromState(PERIOD_STATES.STOP_HIT, -500);
    expect(s.icon).toBe('Skull');
    expect(s.colorClass).toContain('red');
  });

  it('IN_PROGRESS positivo → Smile verde', () => {
    const s = getSentimentFromState(PERIOD_STATES.IN_PROGRESS, 100);
    expect(s.icon).toBe('Smile');
    expect(s.colorClass).toContain('emerald');
  });

  it('IN_PROGRESS negativo → Frown vermelho', () => {
    const s = getSentimentFromState(PERIOD_STATES.IN_PROGRESS, -100);
    expect(s.icon).toBe('Frown');
    expect(s.colorClass).toContain('red');
  });

  it('IN_PROGRESS zero → Meh cinza', () => {
    const s = getSentimentFromState(PERIOD_STATES.IN_PROGRESS, 0);
    expect(s.icon).toBe('Meh');
    expect(s.colorClass).toContain('slate');
  });

  it('null status (fallback legacy) → comportamento por pnl', () => {
    expect(getSentimentFromState(null, 100).icon).toBe('Smile');
    expect(getSentimentFromState(null, -100).icon).toBe('Frown');
    expect(getSentimentFromState(null, 0).icon).toBe('Meh');
  });
});
