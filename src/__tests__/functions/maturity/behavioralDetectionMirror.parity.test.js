/**
 * Paridade ESM≡CJS do motor unificado (CHUNK-11 Fase 1, issue #301).
 *
 * Compara a SUPERFÍCIE COMPARTILHADA entre `src/utils/behavioralDetection` (ESM)
 * e `functions/maturity/behavioralDetectionMirror` (CJS):
 *   - events (dual-emit) — idênticos
 *   - aggregates.scoreInputs (emocional) — idênticos
 *   - dedupeByFamily (algoritmo puro) — idêntico sobre detecções sintéticas
 *
 * `byTrade` (shadow) é ESM-only por design (DEC-AUTO-301-01) — NÃO comparado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import * as esm from '../../../utils/behavioralDetection';

const require = createRequire(import.meta.url);
const cjs = require('../../../../functions/maturity/behavioralDetectionMirror.js');

const EMOTIONS = [
  { name: 'Calmo', score: 2, analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
  { name: 'Ansioso', score: -2, analysisCategory: 'NEGATIVE', behavioralPattern: 'ANXIETY' },
  { name: 'Revanche', score: -3, analysisCategory: 'CRITICAL', behavioralPattern: 'REVENGE' },
];
const getEmotionConfig = (name) =>
  EMOTIONS.find((e) => e.name === name) ||
  { name: name || 'Desconhecida', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };

const TRADES = [
  { id: 'T1', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 1, entry: 5100, result: -50, emotionEntry: 'Ansioso',
    entryTime: '2026-04-22T10:00:00', exitTime: '2026-04-22T10:05:00' },
  { id: 'T2', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 2, entry: 5095, result: -40, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:08:00', exitTime: '2026-04-22T10:12:00' },
  { id: 'T3', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 4, entry: 5090, result: -30, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:14:00', exitTime: '2026-04-22T10:18:00' },
  { id: 'T4', studentId: 'S1', date: '2026-04-22', side: 'SHORT', qty: 1, entry: 5080, result: 60, emotionEntry: 'Calmo',
    entryTime: '2026-04-22T11:30:00', exitTime: '2026-04-22T11:45:00' },
];
const ORDERS = [
  { externalOrderId: 'O1', side: 'BUY', quantity: 1, status: 'FILLED', correlatedTradeId: 'T1',
    isStopOrder: false, filledAt: '2026-04-22T10:00:00', _ts: Date.parse('2026-04-22T10:00:00Z'), _price: 5100 },
  { externalOrderId: 'O2', side: 'SELL', quantity: 1, status: 'FILLED', correlatedTradeId: 'T1',
    isStopOrder: true, stopPrice: 5090, filledAt: '2026-04-22T10:01:00', _ts: Date.parse('2026-04-22T10:01:00Z'), _price: 5090 },
  { externalOrderId: 'O3', side: 'SELL', quantity: 1, status: 'FILLED', correlatedTradeId: 'T1',
    isStopOrder: true, stopPrice: 5080, filledAt: '2026-04-22T10:03:00', _ts: Date.parse('2026-04-22T10:03:00Z'), _price: 5080 },
];

describe('behavioralDetection — paridade ESM≡CJS (superfície compartilhada)', () => {
  it('events (dual-emit) idênticos', () => {
    const e = esm.detectBehavior({ trades: TRADES, orders: ORDERS }).events;
    const c = cjs.detectBehavior({ trades: TRADES, orders: ORDERS }).events;
    expect(c).toEqual(e);
  });

  it('aggregates.scoreInputs idênticos', () => {
    const e = esm.detectBehavior({ trades: TRADES, orders: ORDERS, getEmotionConfig }).aggregates.scoreInputs;
    const c = cjs.detectBehavior({ trades: TRADES, orders: ORDERS, getEmotionConfig }).aggregates.scoreInputs;
    expect(c).toEqual(e);
  });

  it('scoreInputs null em ambos sem getEmotionConfig', () => {
    expect(esm.detectBehavior({ trades: TRADES, orders: ORDERS }).aggregates.scoreInputs).toBeNull();
    expect(cjs.detectBehavior({ trades: TRADES, orders: ORDERS }).aggregates.scoreInputs).toBeNull();
  });

  it('dedupeByFamily idêntico (colapso + precedência DEC-074)', () => {
    const detections = [
      { tradeId: 'T1', family: 'STOP_PANIC', source: 'events', resolutionLayer: 'HIGH', canonicalCode: 'STOP_PANIC' },
      { tradeId: 'T1', family: 'STOP_PANIC', source: 'shadow', resolutionLayer: 'HIGH', canonicalCode: 'STOP_PANIC' },
      { tradeId: 'T1', family: 'LOSS_CHASING', source: 'events', resolutionLayer: 'LOW', canonicalCode: 'LOSS_CHASING' },
      { tradeId: 'T1', family: 'LOSS_CHASING', source: 'shadow', resolutionLayer: 'HIGH', canonicalCode: 'LOSS_CHASING' },
      { tradeId: 'T2', family: 'OVERTRADING', source: 'shadow', resolutionLayer: 'LOW', canonicalCode: 'OVERTRADING' },
    ];
    const e = esm.dedupeByFamily(detections);
    const c = cjs.dedupeByFamily(detections);
    expect([...c.byFamily.entries()]).toEqual([...e.byFamily.entries()]);
    expect(c.gateInputs).toEqual(e.gateInputs);
  });

  it('byTrade é ESM-only: populado em ESM, vazio em CJS (intencional)', () => {
    const e = esm.detectBehavior({ trades: TRADES, orders: ORDERS }).byTrade;
    const c = cjs.detectBehavior({ trades: TRADES, orders: ORDERS }).byTrade;
    expect(e.size).toBeGreaterThan(0);
    expect(c.size).toBe(0);
  });

  it('versão do mirror bate com a do ESM', () => {
    expect(cjs.BEHAVIORAL_DETECTION_VERSION).toBe(esm.BEHAVIORAL_DETECTION_VERSION);
  });
});
