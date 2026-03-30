/**
 * probingUtils.js
 * 
 * Funções puras para lógica de sondagem adaptativa.
 * Sem dependências de React ou Firebase — testável diretamente.
 * 
 * @version 1.21.5
 */

/**
 * Calcula o índice de retomada do probing baseado nas perguntas já respondidas.
 * @param {Array} savedQuestions - perguntas salvas no Firestore
 * @returns {number} índice da próxima pergunta não respondida
 */
export function calculateRehydrationIndex(savedQuestions) {
  if (!savedQuestions || savedQuestions.length === 0) return 0;
  return savedQuestions.filter((q) => q.response?.text).length;
}
