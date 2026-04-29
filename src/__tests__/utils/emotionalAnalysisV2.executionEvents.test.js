/**
 * Issue #208 — integração de execution events em emotionalAnalysisV2.
 *
 * Cobre:
 *   - EVENT_PENALTIES respeita os 5 novos tipos via calculatePeriodScore
 *   - detectTiltV2 conta STOP_TAMPERING + STOP_PARTIAL_SIZING como tilt
 *   - detectRevengeV2 conta RAPID_REENTRY_POST_STOP + CHASE_REENTRY como revenge
 *   - Backward compat: ausência do parâmetro mantém shape antigo
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodScore,
  detectTiltV2,
  detectRevengeV2,
  DEFAULT_DETECTION_CONFIG,
} from '../../utils/emotionalAnalysisV2';

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

const makeTrade = (overrides = {}) => ({
  id: `T${Math.random().toString(36).slice(2, 8)}`,
  result: 100,
  qty: 1,
  emotionEntry: 'Calmo',
  entryTime: '2026-04-22T10:00:00Z',
  exitTime: '2026-04-22T10:30:00Z',
  ...overrides,
});

describe('calculatePeriodScore — penalidades dos 5 eventos de execução', () => {
  const trades = [makeTrade(), makeTrade(), makeTrade()];

  it('STOP_TAMPERING penaliza 20 pontos', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvent = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'STOP_TAMPERING' },
    ]).score;
    expect(baseline - withEvent).toBe(20);
  });

  it('STOP_PARTIAL_SIZING penaliza 10', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvent = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'STOP_PARTIAL_SIZING' },
    ]).score;
    expect(baseline - withEvent).toBe(10);
  });

  it('RAPID_REENTRY_POST_STOP penaliza 15', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvent = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'RAPID_REENTRY_POST_STOP' },
    ]).score;
    expect(baseline - withEvent).toBe(15);
  });

  it('HESITATION_PRE_ENTRY penaliza 5', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvent = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'HESITATION_PRE_ENTRY' },
    ]).score;
    expect(baseline - withEvent).toBe(5);
  });

  it('CHASE_REENTRY penaliza 10', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvent = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'CHASE_REENTRY' },
    ]).score;
    expect(baseline - withEvent).toBe(10);
  });

  it('múltiplos eventos somam penalidades', () => {
    const baseline = calculatePeriodScore(trades, getEmotionConfig).score;
    const withEvents = calculatePeriodScore(trades, getEmotionConfig, [
      { type: 'STOP_TAMPERING' },
      { type: 'CHASE_REENTRY' },
    ]).score;
    expect(baseline - withEvents).toBe(30);
  });

  it('score mínimo é 0 (não fica negativo)', () => {
    const trades5 = [makeTrade({ result: -200 }), makeTrade({ result: -200 }), makeTrade({ result: -200 })];
    const result = calculatePeriodScore(trades5, getEmotionConfig, [
      { type: 'STOP_TAMPERING' },
      { type: 'STOP_TAMPERING' },
      { type: 'STOP_TAMPERING' },
      { type: 'STOP_TAMPERING' },
      { type: 'STOP_TAMPERING' },
    ]);
    expect(result.score).toBe(0);
  });
});

describe('detectTiltV2 — execution events somam ao tilt', () => {
  const trades = [makeTrade(), makeTrade(), makeTrade()];

  it('sem executionEvents retorna shape antigo + executionTiltCount=0', () => {
    const result = detectTiltV2(trades, getEmotionConfig);
    expect(result.executionTiltCount).toBe(0);
    expect(result.detected).toBe(false);
  });

  it('STOP_TAMPERING incrementa executionTiltCount e marca detected', () => {
    const result = detectTiltV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.tilt, [
      { type: 'STOP_TAMPERING' },
    ]);
    expect(result.executionTiltCount).toBe(1);
    expect(result.detected).toBe(true);
  });

  it('STOP_PARTIAL_SIZING incrementa executionTiltCount', () => {
    const result = detectTiltV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.tilt, [
      { type: 'STOP_PARTIAL_SIZING' },
      { type: 'STOP_TAMPERING' },
    ]);
    expect(result.executionTiltCount).toBe(2);
  });

  it('RAPID_REENTRY_POST_STOP NÃO conta como tilt (é revenge)', () => {
    const result = detectTiltV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.tilt, [
      { type: 'RAPID_REENTRY_POST_STOP' },
    ]);
    expect(result.executionTiltCount).toBe(0);
    expect(result.detected).toBe(false);
  });

  it('config disabled mas execution events presentes ainda marca detected', () => {
    const result = detectTiltV2(trades, getEmotionConfig,
      { ...DEFAULT_DETECTION_CONFIG.tilt, enabled: false },
      [{ type: 'STOP_TAMPERING' }]);
    expect(result.executionTiltCount).toBe(1);
    expect(result.detected).toBe(true);
  });
});

describe('detectRevengeV2 — execution events somam ao revenge', () => {
  const trades = [makeTrade(), makeTrade()];

  it('sem executionEvents retorna shape antigo + executionRevengeCount=0', () => {
    const result = detectRevengeV2(trades, getEmotionConfig);
    expect(result.executionRevengeCount).toBe(0);
    expect(result.detected).toBe(false);
  });

  it('RAPID_REENTRY_POST_STOP incrementa executionRevengeCount e marca detected', () => {
    const result = detectRevengeV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.revenge, [
      { type: 'RAPID_REENTRY_POST_STOP' },
    ]);
    expect(result.executionRevengeCount).toBe(1);
    expect(result.detected).toBe(true);
  });

  it('CHASE_REENTRY incrementa executionRevengeCount', () => {
    const result = detectRevengeV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.revenge, [
      { type: 'CHASE_REENTRY' },
      { type: 'RAPID_REENTRY_POST_STOP' },
    ]);
    expect(result.executionRevengeCount).toBe(2);
  });

  it('STOP_TAMPERING NÃO conta como revenge (é tilt)', () => {
    const result = detectRevengeV2(trades, getEmotionConfig, DEFAULT_DETECTION_CONFIG.revenge, [
      { type: 'STOP_TAMPERING' },
    ]);
    expect(result.executionRevengeCount).toBe(0);
    expect(result.detected).toBe(false);
  });
});
