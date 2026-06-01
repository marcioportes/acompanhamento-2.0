/**
 * Baseline snapshot (CHUNK-11 Fase 0) — rede de segurança de NÃO-REGRESSÃO.
 *
 * Congela os outputs ATUAIS dos motores comportamentais (execução + emocional)
 * para um conjunto determinístico de fixtures. As Fases 1/3/5 do motor unificado
 * devem reproduzir estes snapshots bit a bit (modo compat); a Fase 2 (re-baseline
 * deliberado) regrava com aprovação.
 *
 * Fixtures sintéticas e determinísticas (CI-safe — não dependem da massa Elza
 * em /mnt/c). Cobrem: stop tampering (orders), reentrada rápida pós-loss,
 * sequência de tilt e revenge por aumento de qty.
 */
import { describe, it, expect } from 'vitest';
import { detectExecutionEvents } from '../../utils/executionBehaviorEngine';
import {
  calculatePeriodScore,
  detectTiltV2,
  detectRevengeV2,
  DEFAULT_DETECTION_CONFIG,
} from '../../utils/emotionalAnalysisV2';

const EMOTIONS = [
  { name: 'Calmo', score: 2, analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
  { name: 'Ansioso', score: -2, analysisCategory: 'NEGATIVE', behavioralPattern: 'ANXIETY' },
  { name: 'Revanche', score: -3, analysisCategory: 'CRITICAL', behavioralPattern: 'REVENGE' },
];
const getEmotionConfig = (name) =>
  EMOTIONS.find((e) => e.name === name) ||
  { name: name || 'Desconhecida', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };

// ---- Fixtures determinísticas ----
const TRADES = [
  { id: 'T1', side: 'LONG', qty: 1, entry: 5100, result: -50, emotionEntry: 'Ansioso',
    entryTime: '2026-04-22T10:00:00', exitTime: '2026-04-22T10:05:00' },
  { id: 'T2', side: 'LONG', qty: 2, entry: 5095, result: -40, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:08:00', exitTime: '2026-04-22T10:12:00' },
  { id: 'T3', side: 'LONG', qty: 4, entry: 5090, result: -30, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:14:00', exitTime: '2026-04-22T10:18:00' },
  { id: 'T4', side: 'SHORT', qty: 1, entry: 5080, result: 60, emotionEntry: 'Calmo',
    entryTime: '2026-04-22T11:30:00', exitTime: '2026-04-22T11:45:00' },
];

// Orders: T1 com stop tampering (stop reemitido mais largo); T1 reentrada rápida coberta por T2.
const ORDERS = [
  { externalOrderId: 'O1', instrument: 'ESH6', side: 'BUY', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: false, filledAt: '2026-04-22T10:00:00',
    _ts: Date.parse('2026-04-22T10:00:00Z'), _price: 5100 },
  { externalOrderId: 'O2', instrument: 'ESH6', side: 'SELL', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: true, stopPrice: 5090, filledAt: '2026-04-22T10:01:00',
    _ts: Date.parse('2026-04-22T10:01:00Z'), _price: 5090 },
  { externalOrderId: 'O3', instrument: 'ESH6', side: 'SELL', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: true, stopPrice: 5080, filledAt: '2026-04-22T10:03:00',
    _ts: Date.parse('2026-04-22T10:03:00Z'), _price: 5080 },
];

const simplifyEvents = (events) =>
  events.map((e) => ({ type: e.type, severity: e.severity, tradeId: e.tradeId ?? null }))
        .sort((a, b) => (a.type + a.tradeId).localeCompare(b.type + b.tradeId));

describe('Baseline comportamental (Fase 0) — contrato de não-regressão', () => {
  it('executionBehaviorEngine: eventos por trade [congelado]', () => {
    expect(simplifyEvents(detectExecutionEvents({ trades: TRADES, orders: ORDERS }))).toMatchSnapshot();
  });

  it('emotionalAnalysisV2: periodScore [congelado]', () => {
    const { score } = calculatePeriodScore(TRADES, getEmotionConfig);
    expect(Math.round(score * 100) / 100).toMatchSnapshot();
  });

  it('emotionalAnalysisV2: tilt [congelado]', () => {
    const tilt = detectTiltV2(TRADES, getEmotionConfig, DEFAULT_DETECTION_CONFIG.tilt);
    expect({ detected: tilt.detected, sequences: tilt.sequences?.length ?? 0,
             totalTiltTrades: tilt.totalTiltTrades ?? 0 }).toMatchSnapshot();
  });

  it('emotionalAnalysisV2: revenge [congelado]', () => {
    const rev = detectRevengeV2(TRADES, getEmotionConfig, DEFAULT_DETECTION_CONFIG.revenge);
    expect({ detected: rev.detected, count: rev.count ?? rev.instances?.length ?? 0 }).toMatchSnapshot();
  });
});
