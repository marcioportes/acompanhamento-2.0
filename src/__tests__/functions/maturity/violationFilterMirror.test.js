/**
 * violationFilterMirror.test.js — paridade ESM↔CJS para issue #221.
 * Verifica que o mirror CJS produz exatamente os mesmos resultados do ESM.
 */

import { describe, it, expect } from 'vitest';
import {
  effectiveRedFlags as esmEffectiveRedFlags,
  effectiveEmotionalEventsForPeriod as esmEffectiveEmotionalEventsForPeriod,
  getEventKey as esmGetEventKey,
} from '../../../utils/violationFilter';

const cjs = require('../../../../functions/maturity/violationFilter');

describe('violationFilter — paridade ESM↔CJS', () => {
  it('effectiveRedFlags: mesma saída para mesma entrada', () => {
    const trade = {
      redFlags: [{ type: 'NO_STOP' }, { type: 'RR_BELOW_MINIMUM' }],
      mentorClearedViolations: ['NO_STOP'],
    };
    expect(cjs.effectiveRedFlags(trade)).toEqual(esmEffectiveRedFlags(trade));
  });

  it('effectiveEmotionalEventsForPeriod: exclui quando TODOS limparam', () => {
    const trades = [
      { id: 'T1', mentorClearedViolations: ['REVENGE:T1'] },
      { id: 'T2', mentorClearedViolations: ['REVENGE:T2'] },
    ];
    const events = [{ type: 'REVENGE', tradeIds: ['T1', 'T2'] }];
    expect(cjs.effectiveEmotionalEventsForPeriod(trades, events))
      .toEqual(esmEffectiveEmotionalEventsForPeriod(trades, events));
  });

  it('effectiveEmotionalEventsForPeriod: mantém quando algum não limpou', () => {
    const trades = [
      { id: 'T1', mentorClearedViolations: ['REVENGE:T1'] },
      { id: 'T2' },
    ];
    const events = [{ type: 'REVENGE', tradeIds: ['T1', 'T2'] }];
    expect(cjs.effectiveEmotionalEventsForPeriod(trades, events))
      .toEqual(esmEffectiveEmotionalEventsForPeriod(trades, events));
  });

  it('getEventKey: formato idêntico', () => {
    expect(cjs.getEventKey({ type: 'TILT' }, 'T1'))
      .toBe(esmGetEventKey({ type: 'TILT' }, 'T1'));
    expect(cjs.getEventKey(null, 'T1'))
      .toBe(esmGetEventKey(null, 'T1'));
  });
});
