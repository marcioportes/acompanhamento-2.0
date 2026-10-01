/**
 * allocationCeiling.js — issue #480
 *
 * Quanto capital o plano pode assumir no fechamento do ciclo. Espelho ESM de
 * `functions/shared/allocationCeiling.js` — o CORPO é idêntico, só mudam cabeçalho e
 * export (paridade testada em `src/__tests__/functions/shared/allocationCeilingMirror.test.js`).
 *
 * POR QUE EXISTE: `plan.pl` é imutável fora do fechamento (C1, DEC-AUTO-259-20), e o gate
 * do fechamento só aceitava PL ≤ equity do ciclo — a única rota de mudança permitia
 * reduzir, nunca aportar. O lastro do aporte é o saldo da conta:
 *
 *   equityDoCiclo = PL inicial do ciclo + resultado do ciclo
 *   lastroConta   = saldo da conta − Σ pl(outros planos ativos) − Σ result(trades pós-ciclo)
 *   teto          = max(equityDoCiclo, lastroConta)
 *
 * `max` porque o gate nunca fica mais rígido que o anterior: só abre a rota do aporte.
 * Os trades posteriores ao ciclo saem do lastro porque já contam no saldo do ciclo
 * aberto (C2) — sem isso entrariam duas vezes no capital.
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

export {
  ALLOCATION_TOLERANCE,
  computeAllocationCeiling,
  exceedsAllocationCeiling,
  resolveNextCyclePl,
};
