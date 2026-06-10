/**
 * src/utils/tradeReviewConfront.js
 *
 * Auto-revisão de trade (issue #308) — lógica pura, zero I/O.
 *
 * Dois derivados (NÃO persistidos):
 *   1. classifyTrade(result, wouldRepeat) → quadrante good/bad win/loss (2×2 processo × resultado).
 *   2. reviewVerdict(wouldRepeat, families) → confronto declarado × detectado (espelho determinístico).
 *
 * `declared`  = wouldRepeat (SIM aprova o processo / NÃO reprova).
 * `detected`  = severidade do padrão negativo dominante de behaviorProfile.families
 *               (espelha functions/behavior/buildBehaviorProfile.js:dominantNegativeFamily).
 *
 * Matriz (memória de cálculo, issue #308):
 *   wouldRepeat | CLEAN     | LOW     | MEDIUM    | HIGH
 *   SIM         | ALIGNED   | ALIGNED | ATTENTION | MISALIGNED  (ponto cego)
 *   NÃO         | ATTENTION | ALIGNED | ALIGNED   | ALIGNED     (reconheceu o furo)
 *   (NÃO + CLEAN = ATTENTION → possível viés de resultado: bom processo julgado pelo desfecho.)
 *
 * Tom: espelho, não acusação.
 */

const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export const REVIEW_VERDICT = Object.freeze({
  ALIGNED: 'ALIGNED',
  ATTENTION: 'ATTENTION',
  MISALIGNED: 'MISALIGNED',
});

/**
 * Severidade do padrão negativo dominante. 'CLEAN' quando não há padrão negativo.
 * @param {Array<{valence?:string, severity?:string, isGate?:boolean}>} families
 * @returns {'CLEAN'|'LOW'|'MEDIUM'|'HIGH'}
 */
export function dominantNegativeSeverity(families) {
  if (!Array.isArray(families)) return 'CLEAN';
  let best = null;
  for (const f of families) {
    if (!f || f.valence === 'positive') continue;
    if (!best) { best = f; continue; }
    const d = (SEVERITY_RANK[f.severity] ?? 0) - (SEVERITY_RANK[best.severity] ?? 0);
    if (d > 0 || (d === 0 && f.isGate && !best.isGate)) best = f;
  }
  return best ? (best.severity || 'LOW') : 'CLEAN';
}

/**
 * Quadrante derivado (não persistido). result <= 0 conta como perda.
 * @param {number} result
 * @param {boolean} wouldRepeat
 * @returns {'good_win'|'bad_win'|'good_loss'|'bad_loss'}
 */
export function classifyTrade(result, wouldRepeat) {
  const outcome = Number(result) > 0 ? 'win' : 'loss';
  const process = wouldRepeat ? 'good' : 'bad';
  return `${process}_${outcome}`;
}

/**
 * Confronto declarado × detectado. Retorna null quando não há declaração (sem auto-revisão).
 * @param {boolean|null|undefined} wouldRepeat
 * @param {Array} families  — trade.behaviorProfile.families
 * @returns {{ verdict:string, declared:boolean, detected:string } | null}
 */
export function reviewVerdict(wouldRepeat, families) {
  if (typeof wouldRepeat !== 'boolean') return null;
  const detected = dominantNegativeSeverity(families);
  let verdict;
  if (wouldRepeat) {
    if (detected === 'HIGH') verdict = REVIEW_VERDICT.MISALIGNED;
    else if (detected === 'MEDIUM') verdict = REVIEW_VERDICT.ATTENTION;
    else verdict = REVIEW_VERDICT.ALIGNED; // CLEAN | LOW
  } else {
    verdict = detected === 'CLEAN' ? REVIEW_VERDICT.ATTENTION : REVIEW_VERDICT.ALIGNED;
  }
  return { verdict, declared: wouldRepeat, detected };
}
