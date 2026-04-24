/**
 * src/utils/maturityEngine/computeFinancial.js
 *
 * Dimensão F (Financial) do motor de maturidade 4D (issue #119 task 02).
 *
 * Função pura: zero Firestore, zero I/O. A engine é **consumidora de shapes
 * pré-computados** — o chamador invoca os utils financeiros e passa os
 * resultados aqui. Isso preserva INV-02/03 e mantém a engine testável sem
 * mocks pesados.
 *
 * Utils esperados (invocados pelo caller em Fase B, NÃO aqui):
 *   - `calculateStats(trades)`                → src/utils/calculations.js
 *   - `calculateEVLeakage(trades, plans)`     → src/utils/dashboardMetrics.js
 *   - `calculatePayoff(stats)`                → src/utils/dashboardMetrics.js
 *   - `calculateConsistencyCV(trades)`        → src/utils/dashboardMetrics.js
 *   - `calculateMaxDrawdown(trades, balance)` → src/utils/dashboardMetrics.js
 *
 * Fórmula (§3.1 D3, com DEC-AUTO-119-03 aplicada):
 *   expT    = evLeakage?.evTheoretical ?? stats?.expectancy ?? 0
 *   expR    = evLeakage?.evReal        ?? stats?.expectancy ?? 0
 *   eScore  = norm(expR / max(expT, EPS), 0, 1.0)
 *   pScore  = norm(payoff?.ratio ?? 0, 0.8, 3.0)
 *   cvScore = normInverted(consistencyCV?.cv ?? 2.0, 0.3, 2.0)
 *   ddScore = normInverted(maxDrawdown?.maxDDPercent ?? 0, 0, 25)
 *   F = 0.30·eScore + 0.25·pScore + 0.20·cvScore + 0.25·ddScore
 *
 * Política "evolução sempre visível" (§3.1 D6):
 *   trades.length === 0                                    → 50, LOW, 'financial:empty-window'
 *   evLeakage E stats ambos ausentes                       → eScore=50 + flag 'financial:eScore'
 *   payoff E stats.payoffRatio ambos ausentes              → pScore=50 + flag 'financial:pScore'
 *   consistencyCV ausente                                  → usa default 2.0 (sem flag)
 *   maxDrawdown ausente                                    → ddScore=50 + flag 'financial:ddScore'
 *
 * Confidence por trades.length (floor=5):
 *   ≥ 35 HIGH · 5..34 MED · < 5 LOW
 *
 * `neutralFallback`: string com flags separados por `;`, ou null se nenhum.
 */

import { norm, normInverted } from './helpers.js';

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

/**
 * @param {{
 *   trades: Array<object>,
 *   initialBalance?: number,
 *   stats?: { expectancy?: number, payoffRatio?: number } & object,
 *   evLeakage?: { evTheoretical?: number, evReal?: number } | null,
 *   payoff?: { ratio?: number } | null,
 *   consistencyCV?: { cv?: number } | null,
 *   maxDrawdown?: { maxDDPercent?: number } | null,
 * }} input
 * @returns {{
 *   score: number,
 *   breakdown: { eScore: number, pScore: number, cvScore: number, ddScore: number },
 *   confidence: 'HIGH'|'MED'|'LOW',
 *   neutralFallback: string|null,
 * }}
 */
export function computeFinancial({
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

  // ---------- eScore ----------
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

  // ---------- pScore ----------
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

  // ---------- cvScore (sem flag — default é sinal legítimo) ----------
  const cvV = isFiniteNum(consistencyCV?.cv) ? consistencyCV.cv : 2.0;
  const cvScore = normInverted(cvV, CV_MIN, CV_MAX);

  // ---------- ddScore ----------
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
