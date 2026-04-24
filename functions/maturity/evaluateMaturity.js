// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/evaluateMaturity.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { COMPOSITE_WEIGHTS, ENGINE_VERSION } = require('./constants');
const {
  resolveWindow,
  computeStrategyConsistencyWeeks,
  computeStrategyConsistencyMonths,
  computeStopUsageRate,
  computeDailyReturns,
  computeSharpe,
  computeAnnualizedReturn,
  computeConfidence,
} = require('./helpers');
const { computeEmotional } = require('./computeEmotional');
const { computeFinancial } = require('./computeFinancial');
const { computeOperational } = require('./computeOperational');
const { computeMaturity } = require('./computeMaturity');
const { evaluateGates } = require('./evaluateGates');
const { detectRegressionSignal } = require('./detectRegressionSignal');
const { proposeStageTransition } = require('./proposeStageTransition');

function evaluateMaturity({
  trades,
  plans,
  now,
  stageCurrent,
  baseline,
  emotionalAnalysis,
  complianceRate,
  stats,
  evLeakage,
  payoff,
  consistencyCV,
  maxDrawdown,
  advancedMetricsPresent,
  complianceRate100,
} = {}) {
  const { window: W, windowSize, sparseSample } = resolveWindow(trades, stageCurrent, now);

  const safePlans = Array.isArray(plans) ? plans : [];
  const initialBalance = safePlans[0]?.initialBalance ?? 0;

  const emotional = computeEmotional({ trades: W, emotionConfig: null, emotionalAnalysis });
  const financial = computeFinancial({
    trades: W,
    initialBalance,
    stats,
    evLeakage,
    payoff,
    consistencyCV,
    maxDrawdown,
  });
  const operational = computeOperational({ trades: W, plans: safePlans, complianceRate });

  const strategyConsWks = computeStrategyConsistencyWeeks(W, safePlans);
  const strategyConsMonths = computeStrategyConsistencyMonths(W, safePlans);
  const stopUsageRate = computeStopUsageRate(W);
  const dailyReturns = computeDailyReturns(W, initialBalance);
  const monthlySharpe = computeSharpe(dailyReturns, { periodicity: 'monthly' });
  const annualSharpe = computeSharpe(dailyReturns, { periodicity: 'annual' });
  const annualizedReturnFrac = computeAnnualizedReturn(dailyReturns);
  const annualizedReturnPct = annualizedReturnFrac == null ? null : annualizedReturnFrac * 100;
  const tiltRevengeCount = (emotionalAnalysis?.tiltCount ?? 0) + (emotionalAnalysis?.revengeCount ?? 0);
  const journalRate = operational.breakdown.jScore / 100;
  const planAdherence = operational.breakdown.planAdherence;
  const winRate = stats?.winRate ?? null;
  const payoffRatio = payoff?.ratio ?? stats?.payoffRatio ?? null;
  const maxDDPercent = maxDrawdown?.maxDDPercent ?? null;
  const cv = consistencyCV?.cv ?? null;

  const metrics = {
    maxDDPercent,
    complianceRate,
    E: emotional.score,
    journalRate,
    stopUsageRate,
    planAdherence,
    F: financial.score,
    O: operational.score,
    strategyConsWks,
    strategyConsMonths,
    complianceRate100,
    advancedMetricsPresent,
    winRate,
    payoff: payoffRatio,
    monthlySharpe,
    cv,
    tiltRevengeCount,
    annualizedReturn: annualizedReturnPct,
    annualSharpe,
  };

  const gatesResult = evaluateGates(stageCurrent, metrics);

  const currentDims = {
    emotional: emotional.score,
    financial: financial.score,
    operational: operational.score,
  };
  const gatesMetForM = gatesResult.mastery ? 1 : gatesResult.gatesMet;
  const gatesTotalForM = gatesResult.mastery ? 1 : gatesResult.gatesTotal;
  const maturity = computeMaturity({
    stageCurrent,
    gatesMet: gatesMetForM,
    gatesTotal: gatesTotalForM,
    baseline,
    currentDims,
    sourceConfidences: { E: emotional.confidence, F: financial.confidence, O: operational.confidence },
  });

  const composite =
    COMPOSITE_WEIGHTS.emotional * emotional.score +
    COMPOSITE_WEIGHTS.financial * financial.score +
    COMPOSITE_WEIGHTS.operational * operational.score +
    COMPOSITE_WEIGHTS.maturity * maturity.score;

  const signalRegression = detectRegressionSignal({
    composite,
    stageCurrent,
    E: emotional.score,
    F: financial.score,
    baseline,
    metrics,
  });

  const confidence = computeConfidence({
    E: emotional.confidence,
    F: financial.confidence,
    O: operational.confidence,
    M: maturity.confidence,
  });

  const proposedTransition = proposeStageTransition({
    stageCurrent,
    gatesResult,
    signalRegression,
    confidence,
  });

  const neutralFallbacks = [
    emotional.neutralFallback,
    financial.neutralFallback,
    operational.neutralFallback,
    maturity.neutralFallback,
  ].filter(Boolean);

  return {
    dimensionScores: {
      emotional: emotional.score,
      financial: financial.score,
      operational: operational.score,
      maturity: maturity.score,
      composite,
    },
    gates: gatesResult.gates,
    gatesMet: gatesResult.gatesMet,
    gatesTotal: gatesResult.gatesTotal,
    gatesRatio: gatesResult.gatesRatio,
    proposedTransition,
    signalRegression,
    windowSize,
    confidence,
    sparseSample,
    engineVersion: ENGINE_VERSION,
    breakdown: {
      emotional: emotional.breakdown,
      financial: financial.breakdown,
      operational: operational.breakdown,
      maturity: maturity.breakdown,
    },
    neutralFallbacks,
  };
}

module.exports = { evaluateMaturity };
