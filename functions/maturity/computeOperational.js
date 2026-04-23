// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/computeOperational.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { norm, computeStrategyConsistencyWeeks } = require('./helpers');

const FLOOR_TRADES = 5;
const MED_CEILING = FLOOR_TRADES + 30;
const NEUTRAL_SCORE = 50;

const STRAT_MAX_WEEKS = 12;

const WEIGHT_COMPLIANCE = 0.40;
const WEIGHT_STRAT = 0.20;
const WEIGHT_JOURNAL = 0.20;
const WEIGHT_PLAN = 0.20;

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function resolveConfidence(n) {
  if (n >= MED_CEILING) return 'HIGH';
  if (n >= FLOOR_TRADES) return 'MED';
  return 'LOW';
}

function hasJournal(t) {
  const notesLen = typeof t?.notes === 'string' ? t.notes.trim().length : 0;
  if (notesLen >= 10) return true;
  return !!t?.emotionEntry;
}

function computeOperational({ trades, plans, complianceRate } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const N = safeTrades.length;

  if (N === 0) {
    return {
      score: NEUTRAL_SCORE,
      breakdown: {
        complianceRate: NEUTRAL_SCORE,
        stratScore: NEUTRAL_SCORE,
        jScore: NEUTRAL_SCORE,
        planAdherence: NEUTRAL_SCORE,
      },
      confidence: 'LOW',
      neutralFallback: 'operational:empty-window',
    };
  }

  const flags = [];

  const complianceMissing = !isFiniteNum(complianceRate);
  const complianceComp = complianceMissing ? NEUTRAL_SCORE : complianceRate;
  if (complianceMissing) flags.push('operational:compliance');

  const safePlans = Array.isArray(plans) ? plans : [];
  const strategyConsWks = computeStrategyConsistencyWeeks(safeTrades, safePlans);
  const stratScore = norm(strategyConsWks, 0, STRAT_MAX_WEEKS);

  const journalCount = safeTrades.filter(hasJournal).length;
  const jScore = (journalCount / N) * 100;

  const planLinkedCount = safeTrades.filter((t) => !!t?.planId).length;
  const planAdherence = (planLinkedCount / N) * 100;

  const score =
    WEIGHT_COMPLIANCE * complianceComp +
    WEIGHT_STRAT * stratScore +
    WEIGHT_JOURNAL * jScore +
    WEIGHT_PLAN * planAdherence;

  return {
    score,
    breakdown: { complianceRate: complianceComp, stratScore, jScore, planAdherence },
    confidence: resolveConfidence(N),
    neutralFallback: flags.length === 0 ? null : flags.join(';'),
  };
}

module.exports = { computeOperational };
