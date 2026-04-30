/**
 * Issue #208 — paridade ESM↔CJS para integração de execution events
 * em emotionalAnalysisV2.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodScore as esmPeriodScore,
  detectTiltV2 as esmTilt,
  detectRevengeV2 as esmRevenge,
  DEFAULT_DETECTION_CONFIG as ESM_CFG,
} from '../../../utils/emotionalAnalysisV2.js';
import {
  calculatePeriodScore as cjsPeriodScore,
  detectTiltV2 as cjsTilt,
  detectRevengeV2 as cjsRevenge,
  DEFAULT_DETECTION_CONFIG as CJS_CFG,
} from '../../../../functions/maturity/emotionalAnalysisMirror.js';

const EMOTIONS = [
  { id: 'e_calm', name: 'Calmo', score: 2, analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
];
const getEmotionConfig = (name) =>
  EMOTIONS.find((e) => e.name === name) || {
    name: name || 'Desconhecida',
    score: 0,
    analysisCategory: 'NEUTRAL',
    behavioralPattern: 'OTHER',
  };

const trade = (overrides = {}) => ({
  id: 'T1',
  result: 100,
  qty: 1,
  emotionEntry: 'Calmo',
  entryTime: '2026-04-22T10:00:00Z',
  exitTime: '2026-04-22T10:30:00Z',
  ...overrides,
});

const trades = [trade({ id: 'T1' }), trade({ id: 'T2' }), trade({ id: 'T3' })];

describe('emotionalAnalysisMirror — execution events parity', () => {
  it('penalty STOP_TAMPERING idêntica ESM/CJS', () => {
    const events = [{ type: 'STOP_TAMPERING' }];
    expect(cjsPeriodScore(trades, getEmotionConfig, events).score)
      .toBe(esmPeriodScore(trades, getEmotionConfig, events).score);
  });

  it('penalty mix idêntica ESM/CJS', () => {
    const events = [
      { type: 'STOP_PARTIAL_SIZING' },
      { type: 'CHASE_REENTRY' },
      { type: 'HESITATION_PRE_ENTRY' },
    ];
    expect(cjsPeriodScore(trades, getEmotionConfig, events).score)
      .toBe(esmPeriodScore(trades, getEmotionConfig, events).score);
  });

  it('detectTiltV2 — executionTiltCount idêntico', () => {
    const events = [
      { type: 'STOP_TAMPERING' },
      { type: 'STOP_PARTIAL_SIZING' },
      { type: 'RAPID_REENTRY_POST_STOP' }, // não conta
    ];
    const esm = esmTilt(trades, getEmotionConfig, ESM_CFG.tilt, events);
    const cjs = cjsTilt(trades, getEmotionConfig, CJS_CFG.tilt, events);
    expect(cjs.executionTiltCount).toBe(esm.executionTiltCount);
    expect(cjs.executionTiltCount).toBe(2);
  });

  it('detectRevengeV2 — executionRevengeCount idêntico', () => {
    const events = [
      { type: 'CHASE_REENTRY' },
      { type: 'RAPID_REENTRY_POST_STOP' },
      { type: 'STOP_TAMPERING' }, // não conta
    ];
    const esm = esmRevenge(trades, getEmotionConfig, ESM_CFG.revenge, events);
    const cjs = cjsRevenge(trades, getEmotionConfig, CJS_CFG.revenge, events);
    expect(cjs.executionRevengeCount).toBe(esm.executionRevengeCount);
    expect(cjs.executionRevengeCount).toBe(2);
  });

  it('backward compat: 3 args (sem executionEvents) preserva shape antigo', () => {
    const esm = esmTilt(trades, getEmotionConfig);
    const cjs = cjsTilt(trades, getEmotionConfig);
    expect(cjs.totalTiltTrades).toBe(esm.totalTiltTrades);
    expect(cjs.executionTiltCount).toBe(0);
  });
});
