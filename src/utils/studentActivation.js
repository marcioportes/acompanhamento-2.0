/**
 * studentActivation
 * @description Helpers puros para o fluxo "1º login do aluno → marca doc como
 *              ativo". A política de quando escrever vive aqui (testável); o
 *              side-effect (updateDoc) fica no AuthContext.
 *
 *              DEC-AUTO-271-02 (#271): a decisão de ativar baseia-se em
 *              `accessStatus !== 'active'`, não em `status === 'pending'`.
 *              Antes, alunos com doc inconsistente (status='active' por outro
 *              caminho, accessStatus='pending') ficavam fora da auto-recuperação.
 */

/**
 * @param {Object|null} student  doc real-time do Firestore com {id, accessStatus, ...}
 * @returns {boolean}            true → o caller deve disparar o update
 */
export const shouldActivateStudent = (student) => {
  if (!student?.id) return false;
  return student.accessStatus !== 'active';
};

/**
 * Payload exato escrito em /students/{id} no 1º login.
 * Os 3 campos coincidem com a allowlist do `isOwner` em firestore.rules
 * (DEC-AUTO-271-01). Mudar a lista aqui = atualizar a regra junto.
 *
 * @param {*} serverTimestampValue  resultado de `serverTimestamp()` do SDK
 * @returns {Object}
 */
export const buildActivatePayload = (serverTimestampValue) => ({
  status: 'active',
  accessStatus: 'active',
  firstLoginAt: serverTimestampValue,
});
