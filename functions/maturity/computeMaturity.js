// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/computeMaturity.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { computeSelfAwareness } = require('./helpers');
const { STAGE_BASES } = require('./constants');

const NEUTRAL_DIM = 50;
const GATE_WEIGHT = 14;
const SELF_AWARE_WEIGHT = 6;
const VALID_STAGES = new Set([1, 2, 3, 4, 5]);

const CONF_RANK = { LOW: 0, MED: 1, HIGH: 2 };
const CONF_BY_RANK = ['LOW', 'MED', 'HIGH'];

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function rankOf(label) {
  return CONF_RANK[label] ?? CONF_RANK.MED;
}

function minConfidence(a, b, c) {
  return CONF_BY_RANK[Math.min(rankOf(a), rankOf(b), rankOf(c))];
}

function computeMaturity({
  stageCurrent,
  gatesMet,
  gatesTotal,
  baseline,
  currentDims,
  sourceConfidences,
} = {}) {
  const flags = [];

  let effectiveStage = stageCurrent;
  if (!VALID_STAGES.has(effectiveStage)) {
    flags.push('maturity:invalid-stage');
    effectiveStage = 1;
  }
  const stageBase = STAGE_BASES[effectiveStage] ?? 0;

  let gateBoost;
  if (!isFiniteNum(gatesTotal) || gatesTotal === 0) {
    gateBoost = 0;
    flags.push('maturity:gates-pending');
  } else {
    const safeMet = isFiniteNum(gatesMet) ? gatesMet : 0;
    const ratio = safeMet / gatesTotal;
    gateBoost = GATE_WEIGHT * Math.max(0, Math.min(1, ratio));
  }

  let dims = currentDims;
  if (dims == null || typeof dims !== 'object') {
    dims = { emotional: NEUTRAL_DIM, financial: NEUTRAL_DIM, operational: NEUTRAL_DIM };
    flags.push('maturity:dims-unavailable');
  }

  const selfAware = computeSelfAwareness(baseline, dims);

  const score = Math.min(100, stageBase + gateBoost + (SELF_AWARE_WEIGHT * selfAware) / 100);

  const sc = sourceConfidences ?? {};
  const confidence =
    sc.E == null && sc.F == null && sc.O == null
      ? 'MED'
      : minConfidence(sc.E, sc.F, sc.O);

  return {
    score,
    breakdown: { stageBase, gateBoost, selfAware },
    confidence,
    neutralFallback: flags.length === 0 ? null : flags.join(';'),
  };
}

module.exports = { computeMaturity };
