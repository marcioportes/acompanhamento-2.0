/**
 * maturitySemaphore
 * @description Classifica o estado de maturidade de um aluno em 3 cores
 *              (🟢 GREEN · 🟡 AMBER · 🔴 RED) + UNKNOWN para MentorDashboard.
 *
 * Ref: issue #119 task 17 — Fase F (Mentor).
 *      D15 §3.1 (cores do semáforo) — MVP simplificado sem componente temporal
 *      "últimos 30 dias" / "stagnation > 30 dias" (follow-up: exige query de
 *      history buckets; ver DEC-AUTO-119-17 no doc do issue).
 *
 * Regra (ordem de precedência):
 *   1. signalRegression.detected === true            → RED   (precedência absoluta)
 *   2. proposedTransition.proposed === 'UP'          → GREEN
 *   3. demais casos (STAY / DOWN_DETECTED sem regressão ativa / sem proposal) → AMBER
 *   4. maturity === null/undefined                   → UNKNOWN
 */

/**
 * @param {Object|null|undefined} maturity - doc de students/{uid}/maturity/current ou null
 * @returns {'GREEN'|'AMBER'|'RED'|'UNKNOWN'}
 */
export function getMaturitySemaphore(maturity) {
  if (!maturity) return 'UNKNOWN';

  if (maturity.signalRegression?.detected === true) return 'RED';
  if (maturity.proposedTransition?.proposed === 'UP') return 'GREEN';
  return 'AMBER';
}

export const SEMAPHORE_LABELS = {
  GREEN: 'Pronto para subir',
  AMBER: 'Estagnado',
  RED: 'Regressão detectada',
  UNKNOWN: 'Sem dados',
};

export const SEMAPHORE_COLORS = {
  GREEN: 'bg-emerald-500',
  AMBER: 'bg-amber-400',
  RED: 'bg-red-500',
  UNKNOWN: 'bg-slate-500',
};

export default getMaturitySemaphore;
