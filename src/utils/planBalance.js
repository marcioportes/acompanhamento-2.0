/**
 * planBalance.js — saldo do plano derivado, não persistido (contrato C2 #259)
 *
 * O saldo dinâmico do plano (currentPl) deixou de ser persistido pra evitar
 * divergência entre o número gravado e a soma real dos trades. Toda leitura
 * de saldo passa por este helper.
 *
 * Semântica do C2:
 *   - PL inicial do ciclo = plan.pl (capital alocado, imutável durante o ciclo)
 *   - Saldo do ciclo = Σ trades com date > último-ciclo-fechado-cycleEnd
 *   - Capital atual = pl + saldo do ciclo
 *
 * Sem ciclo fechado prévio: ciclo aberto começa em plan.createdAt
 * (todos os trades do plano entram).
 */

/**
 * Identifica o início do ciclo aberto do plano.
 * Retorna ISO string (YYYY-MM-DD) ou null se nenhum ciclo foi fechado ainda.
 */
export function getOpenCycleStart(plan) {
  if (!plan) return null;
  const last = plan.lastClosedCycleEnd;
  if (!last || typeof last !== 'string') return null;
  // cycleEnd é o último dia do ciclo (inclusivo); ciclo aberto começa no dia seguinte.
  const d = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Soma resultados dos trades dentro do ciclo aberto do plano.
 * Saldo do ciclo é zerado a cada fechamento — só conta trades pós o último cycleEnd fechado.
 */
export function computeCycleBalance(plan, trades) {
  if (!plan || !Array.isArray(trades)) return 0;
  const openStart = getOpenCycleStart(plan);
  const planTrades = trades.filter((t) => t.planId === plan.id);
  const inCycle = openStart === null
    ? planTrades
    : planTrades.filter((t) => typeof t.date === 'string' && t.date >= openStart);
  return inCycle.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
}

/**
 * Capital atual do plano = PL alocado + saldo do ciclo aberto.
 * Substitui o uso direto de plan.currentPl em qualquer leitura de UI.
 */
export function computeCurrentPl(plan, trades) {
  if (!plan) return 0;
  const basePl = Number(plan.pl) || 0;
  return basePl + computeCycleBalance(plan, trades);
}
