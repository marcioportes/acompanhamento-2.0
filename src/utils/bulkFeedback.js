/**
 * Bulk Feedback — Validação e helpers
 * @version 1.0.0
 * 
 * Lógica de validação extraída para permitir testes unitários.
 * Usado por useTrades.addBulkFeedback antes de executar o batch write.
 */

/**
 * Valida inputs do feedback em massa.
 * 
 * Regras:
 * - Pelo menos 1 trade selecionado
 * - Conteúdo não vazio
 * - Máximo 50 trades por vez (limite conservador para batch)
 * - Todos do mesmo aluno
 * - Todos em status OPEN (QUESTION precisa resposta individual)
 * 
 * @param {string[]} tradeIds - IDs dos trades selecionados
 * @param {string} content - Texto do feedback
 * @param {Array<{id: string, studentEmail: string, status: string}>} trades - Trades disponíveis para lookup
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateBulkFeedback = (tradeIds, content, trades) => {
  const errors = [];

  if (!tradeIds || tradeIds.length === 0) {
    errors.push('Nenhum trade selecionado');
  }

  if (!content || !content.trim()) {
    errors.push('Feedback vazio');
  }

  if (tradeIds && tradeIds.length > 50) {
    errors.push('Máximo 50 trades por vez');
  }

  if (tradeIds && tradeIds.length > 0 && trades) {
    const selectedTrades = trades.filter(t => tradeIds.includes(t.id));

    // Verifica se todos são do mesmo aluno
    const students = new Set(selectedTrades.map(t => t.studentEmail));
    if (students.size > 1) {
      errors.push('Trades de alunos diferentes não podem receber feedback em massa');
    }

    // Verifica se todos são OPEN
    const nonOpen = selectedTrades.filter(t => t.status !== 'OPEN');
    if (nonOpen.length > 0) {
      errors.push(`${nonOpen.length} trade(s) não estão em status OPEN`);
    }

    // Verifica se todos os IDs foram encontrados
    if (selectedTrades.length !== tradeIds.length) {
      const missing = tradeIds.length - selectedTrades.length;
      errors.push(`${missing} trade(s) não encontrado(s)`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export default { validateBulkFeedback };
