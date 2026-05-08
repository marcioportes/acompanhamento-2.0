/**
 * sealCheck.js — Hard seal helper (ESM)
 *
 * Verifica se uma data de trade cai em algum cycleClosure CLOSED do plano.
 * Fonte canônica de verdade: `plan.sealedCycleRanges` (array de {closureId, cycleStart, cycleEnd}).
 *
 * Mantido idêntico ao mirror CJS em `functions/cycleClosure/sealCheckMirror.js` (paridade
 * obrigatória — qualquer drift quebra suite de testes mirror).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

/**
 * Compara duas datas em formato YYYY-MM-DD lexicograficamente.
 * Equivalente a comparação cronológica enquanto formato é ISO.
 */
const isInRange = (date, start, end) => date >= start && date <= end;

/**
 * Verifica se `tradeDate` (YYYY-MM-DD) está dentro de algum range em `plan.sealedCycleRanges`.
 *
 * @param {object} plan - Documento do plano com (opcional) `sealedCycleRanges`
 * @param {string} tradeDate - Data ISO 'YYYY-MM-DD'
 * @returns {object|null} Range que cobre a data, ou null se livre
 */
export function findSealingRange(plan, tradeDate) {
  if (!plan || typeof plan !== 'object') return null;
  if (typeof tradeDate !== 'string' || tradeDate.length === 0) return null;

  const ranges = Array.isArray(plan.sealedCycleRanges) ? plan.sealedCycleRanges : [];
  for (const r of ranges) {
    if (!r || typeof r !== 'object') continue;
    if (!r.cycleStart || !r.cycleEnd) continue;
    if (isInRange(tradeDate, r.cycleStart, r.cycleEnd)) {
      return r;
    }
  }
  return null;
}

/**
 * Bool wrapper sobre findSealingRange.
 */
export function isTradeInSealedRange(plan, tradeDate) {
  return findSealingRange(plan, tradeDate) !== null;
}

/**
 * Constrói mensagem de erro user-facing quando uma escrita é bloqueada por hard seal.
 */
export function buildSealedError(range, tradeDate) {
  return (
    `Trade em ${tradeDate} não pode ser escrito: ciclo ${range.cycleStart} → ` +
    `${range.cycleEnd} foi fechado (closure ${range.closureId}). ` +
    `Para editar, reabra o ciclo via "Reabrir fechamento" — a versão original ` +
    `fica preservada em originalSnapshot.`
  );
}
