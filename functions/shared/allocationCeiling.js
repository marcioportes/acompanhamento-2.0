/**
 * functions/shared/allocationCeiling.js
 * @version 1.0.0 (v1.92.15 — issue #480)
 * @description Teto do capital que o plano pode assumir no fechamento do ciclo, lado
 *   servidor. Espelho CJS de `src/utils/cycleClosure/allocationCeiling.js` — manter o
 *   CORPO IDÊNTICO (paridade testada em
 *   `src/__tests__/functions/shared/allocationCeilingMirror.test.js`). A memória de
 *   cálculo está no cabeçalho do ESM.
 *
 * Consumido por `closeCycle`.
 */

/** Folga do gate, em moeda — absorve arredondamento de centavos. */
const ALLOCATION_TOLERANCE = 0.1;

const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Teto do capital que o plano pode assumir no fechamento do ciclo.
 *
 * @param {Object} args
 * @param {number} args.cycleEquity — PL inicial do ciclo + resultado do ciclo
 * @param {number|null} [args.accountBalance] — saldo atual da conta; null/ilegível → sem lastro
 * @param {number} [args.otherPlansPl] — Σ pl dos OUTROS planos ativos da mesma conta
 * @param {number} [args.postCycleResult] — Σ result dos trades deste plano com date > cycleEnd
 * @returns {{ceiling:number|null, cycleEquity:number|null, accountBacking:number|null, source:'account'|'cycle'|null}}
 */
function computeAllocationCeiling({ cycleEquity, accountBalance, otherPlansPl, postCycleResult } = {}) {
  const equity = finiteOrNull(cycleEquity);
  const balance = finiteOrNull(accountBalance);
  const accountBacking = balance === null
    ? null
    : balance - (finiteOrNull(otherPlansPl) || 0) - (finiteOrNull(postCycleResult) || 0);
  // Equity ausente ou não-positivo: sem gate, como antes do #480.
  if (equity === null || equity <= 0) {
    return { ceiling: null, cycleEquity: equity, accountBacking, source: null };
  }
  if (accountBacking !== null && accountBacking > equity) {
    return { ceiling: accountBacking, cycleEquity: equity, accountBacking, source: 'account' };
  }
  return { ceiling: equity, cycleEquity: equity, accountBacking, source: 'cycle' };
}

/** O PL pedido passa do teto? Teto null = sem gate. */
function exceedsAllocationCeiling(pl, ceiling) {
  const value = Number(pl);
  if (ceiling === null || ceiling === undefined || !Number.isFinite(value)) return false;
  return value > ceiling + ALLOCATION_TOLERANCE;
}

/**
 * PL que o plano assume depois do fechamento: o ajuste explícito do aluno, senão o
 * equity do ciclo, senão o PL que já estava.
 *
 * @param {Object} args
 * @param {Object|null} [args.adjustment] — forward.planAdjustment ({changed, newPl})
 * @param {number} args.cycleEquity
 * @param {number} args.currentPl — plan.pl antes do fechamento
 * @returns {number}
 */
function resolveNextCyclePl({ adjustment, cycleEquity, currentPl } = {}) {
  if (adjustment?.changed && typeof adjustment.newPl === 'number' && adjustment.newPl > 0) {
    return adjustment.newPl;
  }
  const equity = finiteOrNull(cycleEquity);
  if (equity !== null && equity > 0) return equity;
  return Number(currentPl) || 0;
}

module.exports = {
  ALLOCATION_TOLERANCE,
  computeAllocationCeiling,
  exceedsAllocationCeiling,
  resolveNextCyclePl,
};
