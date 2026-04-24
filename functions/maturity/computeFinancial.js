// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/computeFinancial.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { norm, normInverted } = require('./helpers');

const FLOOR_TRADES = 5;
const MED_CEILING = FLOOR_TRADES + 30;
const NEUTRAL_SCORE = 50;
const EPS = 1e-9;

const WEIGHT_E = 0.30;
const WEIGHT_P = 0.25;
const WEIGHT_CV = 0.20;
const WEIGHT_DD = 0.25;

const E_MAX = 1.0;
const P_MIN = 0.8;
const P_MAX = 3.0;
const CV_MIN = 0.3;
const CV_MAX = 2.0;
const DD_MAX_PCT = 25;

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function resolveConfidence(n) {
  if (n >= MED_CEILING) return 'HIGH';
  if (n >= FLOOR_TRADES) return 'MED';
  return 'LOW';
}

function computeFinancial({
  trades,
  initialBalance,
  stats,
  evLeakage,
  payoff,
  consistencyCV,
  maxDrawdown,
} = {}) {
  void initialBalance;

  const safeTrades = Array.isArray(trades) ? trades : [];
  const N = safeTrades.length;

  if (N === 0) {
    return {
      score: NEUTRAL_SCORE,
      breakdown: { eScore: NEUTRAL_SCORE, pScore: NEUTRAL_SCORE, cvScore: NEUTRAL_SCORE, ddScore: NEUTRAL_SCORE },
      confidence: 'LOW',
      neutralFallback: 'financial:empty-window',
    };
  }

  const flags = [];

  const hasEV = evLeakage != null && (isFiniteNum(evLeakage.evTheoretical) || isFiniteNum(evLeakage.evReal));
  const hasStats = stats != null && isFiniteNum(stats.expectancy);
  let eScore;
  if (!hasEV && !hasStats) {
    eScore = NEUTRAL_SCORE;
    flags.push('financial:eScore');
  } else {
    const expT = isFiniteNum(evLeakage?.evTheoretical) ? evLeakage.evTheoretical : (isFiniteNum(stats?.expectancy) ? stats.expectancy : 0);
    const expR = isFiniteNum(evLeakage?.evReal)        ? evLeakage.evReal        : (isFiniteNum(stats?.expectancy) ? stats.expectancy : 0);
    const ratio = expR / Math.max(expT, EPS);
    eScore = norm(ratio, 0, E_MAX);
  }

  const hasPayoff = payoff != null && isFiniteNum(payoff.ratio);
  const hasStatsPayoff = stats != null && isFiniteNum(stats.payoffRatio);
  let pScore;
  if (!hasPayoff && !hasStatsPayoff) {
    pScore = NEUTRAL_SCORE;
    flags.push('financial:pScore');
  } else {
    const payoffV = hasPayoff ? payoff.ratio : stats.payoffRatio;
    pScore = norm(payoffV, P_MIN, P_MAX);
  }

  const cvV = isFiniteNum(consistencyCV?.cv) ? consistencyCV.cv : 2.0;
  const cvScore = normInverted(cvV, CV_MIN, CV_MAX);

  let ddScore;
  if (maxDrawdown == null || !isFiniteNum(maxDrawdown.maxDDPercent)) {
    ddScore = NEUTRAL_SCORE;
    flags.push('financial:ddScore');
  } else {
    ddScore = normInverted(maxDrawdown.maxDDPercent, 0, DD_MAX_PCT);
  }

  const score =
    WEIGHT_E * eScore +
    WEIGHT_P * pScore +
    WEIGHT_CV * cvScore +
    WEIGHT_DD * ddScore;

  return {
    score,
    breakdown: { eScore, pScore, cvScore, ddScore },
    confidence: resolveConfidence(N),
    neutralFallback: flags.length === 0 ? null : flags.join(';'),
  };
}

module.exports = { computeFinancial };
