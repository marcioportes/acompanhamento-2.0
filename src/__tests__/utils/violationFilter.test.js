/**
 * violationFilter.test.js — issue #221 (Phase B).
 * Cobre helpers puros de filtro por mentorClearedViolations.
 */

import { describe, it, expect } from 'vitest';
import {
  getEventKey,
  isViolationCleared,
  effectiveRedFlags,
  hasEffectiveRedFlags,
  effectiveEmotionalEventsForTrade,
  effectiveEmotionalEventsForPeriod,
} from '../../utils/violationFilter';

describe('getEventKey', () => {
  it('formata como "type:tradeId"', () => {
    expect(getEventKey({ type: 'TILT' }, 'T1')).toBe('TILT:T1');
  });

  it('vazio para entradas inválidas', () => {
    expect(getEventKey(null, 'T1')).toBe('');
    expect(getEventKey({ type: 'TILT' }, null)).toBe('');
    expect(getEventKey({}, 'T1')).toBe('');
  });
});

describe('isViolationCleared', () => {
  it('true quando key está em mentorClearedViolations', () => {
    const trade = { mentorClearedViolations: ['NO_STOP', 'TILT:T1'] };
    expect(isViolationCleared(trade, 'NO_STOP')).toBe(true);
    expect(isViolationCleared(trade, 'TILT:T1')).toBe(true);
  });

  it('false quando array ausente, vazio, ou key não bate', () => {
    expect(isViolationCleared({}, 'NO_STOP')).toBe(false);
    expect(isViolationCleared({ mentorClearedViolations: [] }, 'NO_STOP')).toBe(false);
    expect(isViolationCleared({ mentorClearedViolations: ['RR_BELOW_MINIMUM'] }, 'NO_STOP')).toBe(false);
  });

  it('false para input inválido', () => {
    expect(isViolationCleared(null, 'NO_STOP')).toBe(false);
    expect(isViolationCleared({}, '')).toBe(false);
  });
});

describe('effectiveRedFlags', () => {
  it('retorna todas quando nada cleared', () => {
    const trade = {
      redFlags: [{ type: 'NO_STOP' }, { type: 'RR_BELOW_MINIMUM' }],
    };
    expect(effectiveRedFlags(trade)).toHaveLength(2);
  });

  it('filtra cleared pelo type', () => {
    const trade = {
      redFlags: [{ type: 'NO_STOP' }, { type: 'RR_BELOW_MINIMUM' }],
      mentorClearedViolations: ['NO_STOP'],
    };
    const out = effectiveRedFlags(trade);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('RR_BELOW_MINIMUM');
  });

  it('filtra ambos quando ambos cleared', () => {
    const trade = {
      redFlags: [{ type: 'NO_STOP' }, { type: 'RR_BELOW_MINIMUM' }],
      mentorClearedViolations: ['NO_STOP', 'RR_BELOW_MINIMUM'],
    };
    expect(effectiveRedFlags(trade)).toEqual([]);
  });

  it('vazio quando trade ausente ou sem redFlags', () => {
    expect(effectiveRedFlags(null)).toEqual([]);
    expect(effectiveRedFlags({})).toEqual([]);
  });

  it('idempotente — múltiplas chamadas produzem mesmo resultado', () => {
    const trade = {
      redFlags: [{ type: 'NO_STOP' }],
      mentorClearedViolations: ['NO_STOP'],
    };
    expect(effectiveRedFlags(trade)).toEqual(effectiveRedFlags(trade));
  });
});

describe('hasEffectiveRedFlags', () => {
  it('true quando há flag não cleared (redFlags array)', () => {
    expect(hasEffectiveRedFlags({
      redFlags: [{ type: 'NO_STOP' }],
    })).toBe(true);
  });

  it('false quando todas cleared (redFlags array)', () => {
    expect(hasEffectiveRedFlags({
      redFlags: [{ type: 'NO_STOP' }],
      mentorClearedViolations: ['NO_STOP'],
    })).toBe(false);
  });

  it('false quando sem flags', () => {
    expect(hasEffectiveRedFlags({ redFlags: [] })).toBe(false);
    expect(hasEffectiveRedFlags({})).toBe(false);
    expect(hasEffectiveRedFlags(null)).toBe(false);
  });

  it('true para hasRedFlags boolean legacy (sem redFlags array)', () => {
    expect(hasEffectiveRedFlags({ hasRedFlags: true })).toBe(true);
  });

  it('false para hasRedFlags=false boolean legacy', () => {
    expect(hasEffectiveRedFlags({ hasRedFlags: false })).toBe(false);
  });
});

describe('effectiveEmotionalEventsForTrade', () => {
  const T1 = 'trade-1';
  const T2 = 'trade-2';

  it('retorna eventos do trade quando nada cleared', () => {
    const trade = { id: T1 };
    const events = [
      { type: 'TILT', tradeIds: [T1] },
      { type: 'REVENGE', tradeIds: [T1, T2] },
    ];
    expect(effectiveEmotionalEventsForTrade(trade, events)).toHaveLength(2);
  });

  it('exclui apenas evento limpo no trade-alvo', () => {
    const trade = { id: T1, mentorClearedViolations: [`TILT:${T1}`] };
    const events = [
      { type: 'TILT', tradeIds: [T1] },
      { type: 'REVENGE', tradeIds: [T1, T2] },
    ];
    const out = effectiveEmotionalEventsForTrade(trade, events);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('REVENGE');
  });

  it('ignora eventos cujo trade-alvo não está em tradeIds', () => {
    const trade = { id: T1 };
    const events = [{ type: 'TILT', tradeIds: [T2] }];
    expect(effectiveEmotionalEventsForTrade(trade, events)).toEqual([]);
  });

  it('vazio para inputs inválidos', () => {
    expect(effectiveEmotionalEventsForTrade(null, [])).toEqual([]);
    expect(effectiveEmotionalEventsForTrade({ id: T1 }, null)).toEqual([]);
  });
});

describe('effectiveEmotionalEventsForPeriod', () => {
  const T1 = 'trade-1';
  const T2 = 'trade-2';
  const T3 = 'trade-3';

  it('mantém todos quando nenhum trade limpou', () => {
    const trades = [{ id: T1 }, { id: T2 }];
    const events = [
      { type: 'TILT', tradeIds: [T1] },
      { type: 'REVENGE', tradeIds: [T1, T2] },
    ];
    expect(effectiveEmotionalEventsForPeriod(trades, events)).toHaveLength(2);
  });

  it('mantém evento se ALGUM trade vinculado ainda não limpou', () => {
    const trades = [
      { id: T1, mentorClearedViolations: [`REVENGE:${T1}`] },
      { id: T2 }, // T2 não limpou
    ];
    const events = [{ type: 'REVENGE', tradeIds: [T1, T2] }];
    // T1 limpou mas T2 não → evento ainda penaliza
    expect(effectiveEmotionalEventsForPeriod(trades, events)).toHaveLength(1);
  });

  it('exclui evento quando TODOS os trades vinculados limparam', () => {
    const trades = [
      { id: T1, mentorClearedViolations: [`REVENGE:${T1}`] },
      { id: T2, mentorClearedViolations: [`REVENGE:${T2}`] },
    ];
    const events = [{ type: 'REVENGE', tradeIds: [T1, T2] }];
    expect(effectiveEmotionalEventsForPeriod(trades, events)).toEqual([]);
  });

  it('mantém evento legacy sem tradeIds (day-level)', () => {
    const trades = [];
    const events = [{ type: 'STATUS_CRITICAL', date: '2026-04-15' }];
    expect(effectiveEmotionalEventsForPeriod(trades, events)).toHaveLength(1);
  });

  it('trade fora da janela é tratado como não-cleared (mantém evento)', () => {
    const trades = [{ id: T1 }]; // T2 não está no array (fora da janela)
    const events = [{ type: 'TILT', tradeIds: [T1, T2] }];
    expect(effectiveEmotionalEventsForPeriod(trades, events)).toHaveLength(1);
  });

  it('vazio quando events vazios', () => {
    expect(effectiveEmotionalEventsForPeriod([], [])).toEqual([]);
  });
});
