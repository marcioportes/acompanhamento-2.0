/**
 * openingBalance.js
 * @description Saldo de abertura (patrimônio) de uma janela temporal do Dashboard-Aluno,
 *              com carry-over entre ciclos. Bug 2 / issue #267.
 *
 * Problema: a curva de patrimônio de um ciclo deve abrir no patrimônio de FECHAMENTO
 * do ciclo anterior, não no aporte original. Antes, EquityCurve recebia o aporte
 * agregado → ciclos após o 1º começavam defasados e desalinhados da curva ideal.
 *
 * Fórmula (forward-sum — agrega multi-conta/plano naturalmente):
 *   abertura(janela) = Σ aporteInicial(contas)
 *                    + Σ result(trades com date  <  janela.start)
 *                    + Σ ajusteNaoTrade(closures com cycleEnd  <  janela.start)
 *
 *   - janela.start == null  → "todo o histórico" → só o aporte inicial.
 *   - ajusteNaoTrade(closure) = rollPL(closure) − cycleBaseline.plFinal
 *       rollPL = forward.planAdjustment.newPl (se aplicado e > 0) senão plFinal.
 *     Captura aporte/saque MANUAL aplicado no ritual de fechamento (#259, Step6Adjust),
 *     que não é um trade. Onde não houve fechamento o termo é 0 → "aporte + Σ trades"
 *     é exato por construção (ajuste não-trade só nasce dentro do ritual).
 *
 * Por que forward-sum e não placeholder-snap (alternativa 3a): o placeholder poluiria
 * `cycleClosures` (alimenta inbox do mentor + fila sequencial de ciclos vencidos) e
 * exigiria escrita nova (INV-15/AP-06). Aqui tudo é derivado, sem schema novo.
 * Ver docs/dev/issues/issue-267-tactical-bugs.md (Memória de Cálculo) + DEC-AUTO-267-03.
 *
 * @see functions/cycleClosure/closeCycle.js — roll de plan.pl no fechamento
 * @see src/components/EquityCurve.jsx — consumidor (buildEquityCurve)
 * @see src/utils/equityCurveIdeal.js — base do corredor ideal (mesma abertura)
 */

/** Normaliza Date | 'YYYY-MM-DD...' para 'YYYY-MM-DD' (comparável lexicograficamente). */
export const toISODay = (input) => {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  return null;
};

/**
 * PL que rola para o ciclo SEGUINTE após um fechamento (vira o plInicial do próximo).
 * Espelha closeCycle.js: ajuste explícito do aluno tem prioridade, senão é o plFinal.
 * @returns {number|null} null quando não há dado suficiente.
 */
export const rollPL = (closure) => {
  if (!closure) return null;
  const adj = closure.forward?.planAdjustment;
  if (adj?.changed && typeof adj.newPl === 'number' && adj.newPl > 0) return adj.newPl;

  const plFinal = Number(closure.cycleBaseline?.plFinal);
  if (Number.isFinite(plFinal)) return plFinal;

  // Fallback pre-C3 (schemaVersion 2): sem cycleBaseline, reconstrói do snapshot.
  const plStart = Number(closure.snapshot?.plStart);
  const result = Number(closure.snapshot?.result) || 0;
  if (Number.isFinite(plStart)) return plStart + result;

  return null;
};

/**
 * Injeção/retirada de capital não-trade aplicada no fechamento (delta entre o que
 * rolou e o plFinal natural). 0 quando não há ajuste ou não dá pra determinar.
 */
export const closureAdjustmentDelta = (closure) => {
  const roll = rollPL(closure);
  const plFinal = Number(closure?.cycleBaseline?.plFinal);
  if (roll == null || !Number.isFinite(plFinal)) return 0;
  return roll - plFinal;
};

/**
 * Saldo de abertura (patrimônio) no início de uma janela.
 *
 * @param {Object} args
 * @param {Date|string|null} args.windowStart - início da janela; null → todo histórico.
 * @param {number} args.initialBalance - Σ aporte inicial das contas no escopo.
 * @param {Array<{date:string, result:number}>} [args.trades] - trades do escopo (NÃO filtrados por janela/granular).
 * @param {Array} [args.closures] - cycleClosures do escopo (qualquer status; só CLOSED conta).
 * @returns {number}
 */
export const computeOpeningBalance = ({ windowStart, initialBalance, trades = [], closures = [] }) => {
  const base = Number(initialBalance) || 0;
  const startISO = toISODay(windowStart);
  if (!startISO) return base; // todo o histórico → abre no aporte

  let tradesPrefix = 0;
  for (const t of trades) {
    const d = toISODay(t?.date);
    if (d && d < startISO) tradesPrefix += Number(t?.result) || 0;
  }

  let adjustments = 0;
  for (const c of closures) {
    if (c?.status !== 'CLOSED') continue;
    const end = toISODay(c?.cycleEnd);
    if (end && end < startISO) adjustments += closureAdjustmentDelta(c);
  }

  return base + tradesPrefix + adjustments;
};

export default computeOpeningBalance;
