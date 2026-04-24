// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/computeEmotional.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { normInverted } = require('./helpers');

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

function computeEmotional({ trades, emotionConfig, emotionalAnalysis } = {}) {
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

module.exports = { computeEmotional };
