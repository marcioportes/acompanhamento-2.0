/**
 * src/utils/maturityEngine/computeMaturity.js
 *
 * Dimensão M (Maturidade) do motor de maturidade 4D (issue #119 task 03).
 *
 * Função pura: zero Firestore, zero I/O. M é EMERGENTE (§3.1 D5):
 * deriva de stage atual + gates atingidos + auto-percepção (baseline vs atual).
 *
 * Fórmula (§3.1 D3):
 *   stageBase  = STAGE_BASES[stageCurrent]   // {1:0, 2:20, 3:40, 4:60, 5:80}
 *   gatesRatio = gatesMet / gatesTotal
 *   gateBoost  = 14 · gatesRatio
 *   selfAware  = computeSelfAwareness(baseline, currentDims)  // 0-100
 *   M          = min(100, stageBase + gateBoost + 6·selfAware/100)
 *
 * Política de fallback:
 *   stageCurrent inválido (≠ 1..5) → fallback para 1 + 'maturity:invalid-stage'
 *   gatesTotal === 0/ausente       → gateBoost = 0 + 'maturity:gates-pending'
 *   currentDims ausente            → usa {50,50,50} + 'maturity:dims-unavailable'
 *   baseline ausente               → computeSelfAwareness retorna 50 (sem flag, esperado)
 *
 * Confidence emergente: min(E, F, O) usando ordem LOW < MED < HIGH.
 *   sourceConfidences ausente → MED.
 */

import { computeSelfAwareness } from './helpers.js';
import { STAGE_BASES } from './constants.js';

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

/**
 * @param {{
 *   stageCurrent: 1|2|3|4|5,
 *   gatesMet?: number,
 *   gatesTotal?: number,
 *   baseline?: { emotional?: number, financial?: number, operational?: number },
 *   currentDims?: { emotional?: number, financial?: number, operational?: number },
 *   sourceConfidences?: { E?: 'HIGH'|'MED'|'LOW', F?: 'HIGH'|'MED'|'LOW', O?: 'HIGH'|'MED'|'LOW' },
 * }} input
 * @returns {{
 *   score: number,
 *   breakdown: { stageBase: number, gateBoost: number, selfAware: number },
 *   confidence: 'HIGH'|'MED'|'LOW',
 *   neutralFallback: string|null,
 * }}
 */
export function computeMaturity({
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
