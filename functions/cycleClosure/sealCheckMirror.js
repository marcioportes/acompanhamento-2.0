/**
 * sealCheckMirror.js — Hard seal helper (CJS mirror)
 *
 * Espelho exato de `src/utils/cycleClosure/sealCheck.js` (ESM). Paridade obrigatória.
 * Qualquer divergência quebra a suite de mirror tests.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

const isInRange = (date, start, end) => date >= start && date <= end;

function findSealingRange(plan, tradeDate) {
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

function isTradeInSealedRange(plan, tradeDate) {
  return findSealingRange(plan, tradeDate) !== null;
}

function buildSealedError(range, tradeDate) {
  return (
    `Trade em ${tradeDate} não pode ser escrito: ciclo ${range.cycleStart} → ` +
    `${range.cycleEnd} foi fechado (closure ${range.closureId}). ` +
    `Para editar, reabra o ciclo via "Reabrir fechamento" — a versão original ` +
    `fica preservada em originalSnapshot.`
  );
}

module.exports = {
  findSealingRange,
  isTradeInSealedRange,
  buildSealedError,
};
