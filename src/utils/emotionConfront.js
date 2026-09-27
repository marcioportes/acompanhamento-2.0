/**
 * emotionConfront.js — issue #477
 *
 * Regras do confronto emocional, lado cliente. Espelho ESM de
 * `functions/shared/emotionConfront.js`: o CORPO é idêntico (paridade testada em
 * `src/__tests__/functions/shared/issue477Mirror.test.js`). O cliente reaplica as regras na
 * leitura de perfis gravados antes do #477 — inclusive de trade discutido, que não é
 * regravado (INV-30: filtra na leitura, nunca backfill).
 */

/** ---- corpo espelhado (#477) ---- */

const CONFRONT_VERDICT = Object.freeze({
  ALIGNED: 'ALIGNED',
  ATTENTION: 'ATTENTION',
  MISALIGNED: 'MISALIGNED',
  NO_DECLARED: 'NO_DECLARED',
  // #477 — declaração positiva que a execução CONFIRMA (entrada protegida desde o envio,
  // cada adição com proteção própria). Confirmação, não contradição.
  CONFIRMED: 'CONFIRMED',
});

const CONFRONT_SEVERITY_RANK = Object.freeze({ HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 });

/**
 * Padrão de gravidade BAIXA não gera confronto (Marcio, 27/09/2026): um sinal fraco não
 * sustenta dizer ao aluno que ele sentiu outra coisa. Só MÉDIA e ALTA confrontam.
 */
const CONFRONT_MIN_RANK = CONFRONT_SEVERITY_RANK.MEDIUM;

/**
 * A família pode ser eleita "a emoção que a execução sugere"? Negativa (a valência
 * VIGENTE — aviso neutro de montagem de posição nunca entra), com emoção, e com
 * severidade MÉDIA ou ALTA (a vigente, com o teto de leitura já aplicado pelo chamador).
 */
function isConfrontable(valence, emotion, severity) {
  if (valence !== 'negative') return false;
  if (!emotion) return false;
  return (CONFRONT_SEVERITY_RANK[severity] || 0) >= CONFRONT_MIN_RANK;
}

/**
 * Matriz aprovada (categoria da emoção declarada × severidade do padrão dominante).
 * 'CLEAN' = nenhum padrão confrontável.
 */
function confrontVerdictFor(declaredCategory, detSeverity) {
  if (!declaredCategory) return CONFRONT_VERDICT.NO_DECLARED;
  switch (declaredCategory) {
    case 'POSITIVE':
      if (detSeverity === 'CLEAN') return CONFRONT_VERDICT.ALIGNED;
      if (detSeverity === 'LOW') return CONFRONT_VERDICT.ATTENTION;
      return CONFRONT_VERDICT.MISALIGNED; // MEDIUM/HIGH
    case 'NEUTRAL':
      if (detSeverity === 'CLEAN' || detSeverity === 'LOW') return CONFRONT_VERDICT.ALIGNED;
      if (detSeverity === 'MEDIUM') return CONFRONT_VERDICT.ATTENTION;
      return CONFRONT_VERDICT.MISALIGNED; // HIGH
    case 'NEGATIVE':
      return detSeverity === 'HIGH' ? CONFRONT_VERDICT.ATTENTION : CONFRONT_VERDICT.ALIGNED;
    case 'CRITICAL':
      return detSeverity === 'CLEAN' ? CONFRONT_VERDICT.ATTENTION : CONFRONT_VERDICT.ALIGNED;
    default:
      return CONFRONT_VERDICT.ALIGNED;
  }
}

/**
 * Declaração positiva CONFIRMADA pela execução: nada confrontável, nenhum gate travado e
 * toda leva de entrada nasceu com proteção própria (`positionBuildOf(...).allProtected`).
 * @param {string|null} declaredCategory
 * @param {string} detSeverity — 'CLEAN' | severidade do dominante
 * @param {{allProtected?:boolean, hasGate?:boolean}|null} execution
 */
function confirmsDeclared(declaredCategory, detSeverity, execution) {
  if (declaredCategory !== 'POSITIVE' || detSeverity !== 'CLEAN') return false;
  if (!execution || execution.hasGate) return false;
  return execution.allProtected === true;
}

/** ---- fim do corpo espelhado ---- */

export {
  CONFRONT_VERDICT,
  CONFRONT_SEVERITY_RANK,
  CONFRONT_MIN_RANK,
  isConfrontable,
  confrontVerdictFor,
  confirmsDeclared,
};
