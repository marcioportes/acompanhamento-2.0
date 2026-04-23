/**
 * src/utils/maturityEngine/evaluateMaturity.js
 *
 * Orquestrador do motor de maturidade 4D × 5 stages (issue #119 task 05).
 *
 * Fecha a Fase A (Engine puro): consome shapes pré-computados pelo caller
 * (stats/evLeakage/payoff/consistencyCV/maxDrawdown/complianceRate/emotionalAnalysis)
 * e produz um snapshot aderente ao schema §3.1 D10. Zero Firestore, zero I/O.
 *
 * Fluxo:
 *   1. resolveWindow(trades, stageCurrent, now) → janela W + sparseSample
 *   2. computeEmotional / computeFinancial / computeOperational sobre W
 *   3. Monta `metrics` para evaluateGates (nomes alinhados a GATES_BY_TRANSITION)
 *   4. evaluateGates → gates + mastery flag
 *   5. computeMaturity (com hack mastery: gatesMet=gatesTotal=1 para gateBoost=14)
 *   6. composite = ΣCOMPOSITE_WEIGHTS·score_dim
 *   7. detectRegressionSignal
 *   8. computeConfidence (MIN E/F/O/M)
 *   9. proposeStageTransition
 *   10. Monta snapshot
 */

import { COMPOSITE_WEIGHTS, ENGINE_VERSION } from './constants.js';
import {
  resolveWindow,
  computeStrategyConsistencyWeeks,
  computeStrategyConsistencyMonths,
  computeStopUsageRate,
  computeDailyReturns,
  computeSharpe,
  computeAnnualizedReturn,
  computeConfidence,
} from './helpers.js';
import { computeEmotional } from './computeEmotional.js';
import { computeFinancial } from './computeFinancial.js';
import { computeOperational } from './computeOperational.js';
import { computeMaturity } from './computeMaturity.js';
import { evaluateGates } from './evaluateGates.js';
import { detectRegressionSignal } from './detectRegressionSignal.js';
import { proposeStageTransition } from './proposeStageTransition.js';

/**
 * @param {{
 *   trades: Array<object>,
 *   plans?: Array<object>,
 *   now: Date|string,
 *   stageCurrent: 1|2|3|4|5,
 *   baseline?: { emotional?: number, financial?: number, operational?: number } | null,
 *   emotionalAnalysis?: { periodScore?: number, tiltCount?: number, revengeCount?: number },
 *   complianceRate?: number,           // 0-100
 *   stats?: object,
 *   evLeakage?: object|null,
 *   payoff?: { ratio?: number } | null,
 *   consistencyCV?: { cv?: number } | null,
 *   maxDrawdown?: { maxDDPercent?: number } | null,
 *   advancedMetricsPresent?: boolean,
 *   complianceRate100?: number,
 * }} input
 * @returns {object} snapshot §3.1 D10 (campos da engine, sem computedAt/asOf).
 */
export function evaluateMaturity({
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
  // 1. Janela
  const { window: W, windowSize, sparseSample } = resolveWindow(trades, stageCurrent, now);

  const safePlans = Array.isArray(plans) ? plans : [];
  const initialBalance = safePlans[0]?.initialBalance ?? 0;

  // 2. Dimensões
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

  // 3. Métricas para gates
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

  // 4. Gates
  const gatesResult = evaluateGates(stageCurrent, metrics);

  // 5. Maturidade emergente (hack mastery: força gateBoost=14 no stage 5)
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

  // 6. Composite
  const composite =
    COMPOSITE_WEIGHTS.emotional * emotional.score +
    COMPOSITE_WEIGHTS.financial * financial.score +
    COMPOSITE_WEIGHTS.operational * operational.score +
    COMPOSITE_WEIGHTS.maturity * maturity.score;

  // 7. Regressão
  const signalRegression = detectRegressionSignal({
    composite,
    stageCurrent,
    E: emotional.score,
    F: financial.score,
    baseline,
    metrics,
  });

  // 8. Confidence agregado
  const confidence = computeConfidence({
    E: emotional.confidence,
    F: financial.confidence,
    O: operational.confidence,
    M: maturity.confidence,
  });

  // 9. Transição proposta
  const proposedTransition = proposeStageTransition({
    stageCurrent,
    gatesResult,
    signalRegression,
    confidence,
  });

  // 10. Snapshot (apenas campos da engine — Fase B adiciona computedAt/asOf/etc.)
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
