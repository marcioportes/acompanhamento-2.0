/**
 * feedbackSealException.js — espelho da exceção #497 em firestore.rules.
 *
 * Depois que o ciclo é selado (#259), o aluno dono do trade ainda pode conversar
 * sobre o feedback: mandar dúvida, comentar ou encerrar. Só a conversa — os dados
 * do trade continuam travados, e trade DISCUSSED segue imutável (INV-30).
 *
 * A rule é a fonte de verdade; este módulo existe para ser testado e para o
 * teste de paridade conferir que as listas abaixo são as mesmas da rule.
 */

export const SEALED_CONVERSATION_FIELDS = Object.freeze(['feedbackHistory', 'status', 'updatedAt']);
export const SEALED_CONVERSATION_FROM = 'REVIEWED';
export const SEALED_CONVERSATION_TO = Object.freeze(['REVIEWED', 'QUESTION', 'CLOSED']);

/**
 * @param {string|undefined} fromStatus  status gravado no trade
 * @param {string|undefined} toStatus    status depois do update
 * @param {string[]} changedKeys         campos alterados pelo update
 * @returns {boolean} true se o update é só conversa, permitido em ciclo selado
 */
export function isSealedConversationUpdate(fromStatus, toStatus, changedKeys) {
  if (!Array.isArray(changedKeys)) return false;
  const from = fromStatus ?? 'OPEN';
  const to = toStatus ?? 'OPEN';
  return (
    changedKeys.every((k) => SEALED_CONVERSATION_FIELDS.includes(k)) &&
    from === SEALED_CONVERSATION_FROM &&
    SEALED_CONVERSATION_TO.includes(to)
  );
}
