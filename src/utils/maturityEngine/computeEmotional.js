/**
 * src/utils/maturityEngine/computeEmotional.js
 *
 * Dimensão E (Emocional) do motor de maturidade 4D (issue #119 task 02).
 *
 * Função pura: zero Firestore, zero I/O. O chamador invoca
 * `emotionalAnalysisV2.calculatePeriodScore` (CHUNK-06) e passa o shape
 * pré-computado em `emotionalAnalysis` — a engine NÃO importa esse módulo
 * diretamente (preserva testabilidade sem mocks pesados + INV-02/03).
 *
 * Fórmula (§3.1 D3, com DEC-AUTO-119-03 aplicada):
 *   periodScore = emotionalAnalysis.periodScore  (0-100)
 *   tiltRate    = tiltCount    / trades.length
 *   revengeRate = revengeCount / trades.length
 *   E = 0.60·periodScore
 *     + 0.25·normInverted(tiltRate,    0, 0.30)
 *     + 0.15·normInverted(revengeRate, 0, 0.20)
 *
 * Política "evolução sempre visível" (§3.1 D6):
 *   trades.length === 0            → 50, LOW, neutralFallback='emotional:empty-window'
 *   periodScore ausente            → 50 (neutro) + neutralFallback='emotional:periodScore'
 *   tiltCount/revengeCount ausente → tratar como 0 (sem flag)
 *
 * Confidence por trades.length (floor=5):
 *   ≥ 35 HIGH · 5..34 MED · < 5 LOW
 */

import { normInverted } from './helpers.js';

const FLOOR_TRADES = 5;
const MED_CEILING = FLOOR_TRADES + 30;
const NEUTRAL_SCORE = 50;

const TILT_MAX = 0.30;
const REVENGE_MAX = 0.20;

function resolveConfidence(n) {
  if (n >= MED_CEILING) return 'HIGH';
  if (n >= FLOOR_TRADES) return 'MED';
  return 'LOW';
}

/**
 * @param {{
 *   trades: Array<object>,
 *   emotionConfig?: object,
 *   emotionalAnalysis?: { periodScore?: number, tiltCount?: number, revengeCount?: number },
 * }} input
 * @returns {{
 *   score: number,
 *   breakdown: { periodScore: number, tiltRate: number, revengeRate: number },
 *   confidence: 'HIGH'|'MED'|'LOW',
 *   neutralFallback: string|null,
 * }}
 */
export function computeEmotional({ trades, emotionConfig, emotionalAnalysis } = {}) {
  void emotionConfig;

  const safeTrades = Array.isArray(trades) ? trades : [];
  const N = safeTrades.length;

  if (N === 0) {
    return {
      score: NEUTRAL_SCORE,
      breakdown: { periodScore: NEUTRAL_SCORE, tiltRate: 0, revengeRate: 0 },
      confidence: 'LOW',
      neutralFallback: 'emotional:empty-window',
    };
  }

  const ea = emotionalAnalysis ?? {};
  const rawPeriod = ea.periodScore;
  const periodScoreMissing = typeof rawPeriod !== 'number' || !Number.isFinite(rawPeriod);
  const periodScore = periodScoreMissing ? NEUTRAL_SCORE : rawPeriod;

  const tiltCount = typeof ea.tiltCount === 'number' && Number.isFinite(ea.tiltCount) ? ea.tiltCount : 0;
  const revengeCount = typeof ea.revengeCount === 'number' && Number.isFinite(ea.revengeCount) ? ea.revengeCount : 0;

  const tiltRate = tiltCount / N;
  const revengeRate = revengeCount / N;

  const score =
    0.60 * periodScore +
    0.25 * normInverted(tiltRate, 0, TILT_MAX) +
    0.15 * normInverted(revengeRate, 0, REVENGE_MAX);

  return {
    score,
    breakdown: { periodScore, tiltRate, revengeRate },
    confidence: resolveConfidence(N),
    neutralFallback: periodScoreMissing ? 'emotional:periodScore' : null,
  };
}
