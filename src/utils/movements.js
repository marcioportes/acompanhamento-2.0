/**
 * Movement Helpers — Cálculos puros
 * @version 1.0.0
 * 
 * Lógica extraída de functions/index.js (onMovementCreated/onMovementDeleted)
 * para permitir testes unitários no frontend.
 * 
 * IMPORTANTE: Manter sincronizado com functions/index.js.
 * TODO: Fase futura — unificar em módulo shared.
 */

/**
 * Normaliza o amount de um movement conforme seu tipo.
 * Regra contábil:
 *   WITHDRAWAL → sempre negativo
 *   DEPOSIT / INITIAL_BALANCE → sempre positivo
 *   TRADE_RESULT → preserva sinal original (pode ser + ou -)
 * 
 * @param {string} type - Tipo do movement ('WITHDRAWAL', 'DEPOSIT', 'INITIAL_BALANCE', 'TRADE_RESULT', 'ADJUSTMENT')
 * @param {number} amount - Valor bruto do movement
 * @returns {number} Valor normalizado
 */
export const normalizeMovementAmount = (type, amount) => {
  switch (type) {
    case 'WITHDRAWAL':
      return -Math.abs(amount);
    case 'DEPOSIT':
    case 'INITIAL_BALANCE':
      return Math.abs(amount);
    case 'TRADE_RESULT':
    case 'ADJUSTMENT':
    default:
      return amount;
  }
};

/**
 * Verifica se um movement deve ser ignorado no delete (guard do onMovementDeleted).
 * INITIAL_BALANCE não é revertido ao deletar — o saldo inicial é imutável.
 * 
 * @param {string} type - Tipo do movement
 * @returns {boolean} true se deve ser ignorado no delete
 */
export const shouldSkipDeleteReversal = (type) => {
  return type === 'INITIAL_BALANCE';
};

export default {
  normalizeMovementAmount,
  shouldSkipDeleteReversal
};
