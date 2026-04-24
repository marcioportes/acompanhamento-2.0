/**
 * src/utils/maturityEngine/computeOperational.js
 *
 * Dimensão O (Operational) do motor de maturidade 4D (issue #119 task 03).
 *
 * Função pura: zero Firestore, zero I/O. A engine consome shapes
 * pré-computados — o caller invoca `calculateComplianceRate` (CHUNK-05) e
 * passa `complianceRate` JÁ EM ESCALA 0-100 (verificado: o util retorna
 * `{ rate: (compliant/total)*100 }`, então o caller passa `result.rate`).
 * Isto preserva INV-02/03 e a testabilidade sem mocks.
 *
 * Fórmula (§3.1 D3, com DEC-AUTO-119-03 aplicada):
 *   strategyConsWks = computeStrategyConsistencyWeeks(trades, plans)  // helper A1
 *   stratScore      = norm(strategyConsWks, 0, 12)                    // já 0-100
 *   journalRate     = trades.filter(hasJournal).length / trades.length // 0-1
 *   jScore          = journalRate · 100                                // 0-100 (·100 ratio→%)
 *   planAdherence   = (trades.filter(t => !!t.planId).length / trades.length) · 100
 *   O = 0.40·complianceRate + 0.20·stratScore + 0.20·jScore + 0.20·planAdherence
 *
 * `hasJournal(t)` (§3.1 D4): notes ≥10 chars OU emotionEntry preenchido.
 *
 * Política "evolução sempre visível" (§3.1 D6):
 *   trades.length === 0          → 50, LOW, 'operational:empty-window'
 *   complianceRate ausente       → componente neutro 50 + flag 'operational:compliance'
 *   plans ausente/vazio          → strategyConsWks=0 é esperado, SEM flag
 *
 * Confidence por trades.length (floor=5):
 *   ≥ 35 HIGH · 5..34 MED · < 5 LOW
 */

import { norm, computeStrategyConsistencyWeeks } from './helpers.js';

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

/**
 * @param {{
 *   trades: Array<object>,
 *   plans?: Array<object>,
 *   complianceRate?: number,   // ESCALA 0-100 — caller passa calculateComplianceRate(trades).rate
 * }} input
 * @returns {{
 *   score: number,
 *   breakdown: { complianceRate: number, stratScore: number, jScore: number, planAdherence: number },
 *   confidence: 'HIGH'|'MED'|'LOW',
 *   neutralFallback: string|null,
 * }}
 */
export function computeOperational({ trades, plans, complianceRate } = {}) {
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
