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

// ============================================================================
// PL inicial do ciclo EXIBIDO — issue #432
// ============================================================================
//
// `plan.pl` é sempre o capital do ciclo CORRENTE: no fechamento ele rola para o
// próximo (contrato C1/C2 do #259). Para um ciclo passado, o PL inicial verdadeiro
// está congelado no documento de fechamento — usar `plan.pl` mostraria o capital de
// hoje ancorando um resultado de julho.
//
// Por que não `account.initialBalance`: são coisas diferentes. `initialBalance` é o
// depósito na CORRETORA; `plan.pl` é o capital ALOCADO àquele plano — na base real a
// conta abre com 1.997 enquanto o plano opera 100.000. O painel Financeiro só existe
// com plano selecionado, então a base dele é a do plano, e é assim que ele passa a
// concordar com o card do plano logo acima em vez de contar outra história.

/** Fechamento CLOSED/REOPENED daquele plano naquele ciclo. */
export function findCycleClosure(closures, planId, cycleStartISO) {
  if (!Array.isArray(closures) || !planId || !cycleStartISO) return null;
  return closures.find((c) => (
    c?.planId === planId
    && c?.cycleStart === cycleStartISO
    && (c?.status === 'CLOSED' || c?.status === 'REOPENED')
  )) || null;
}

/** Fechamento mais antigo do plano — carrega o capital com que a vida do plano começou. */
export function earliestClosure(closures, planId) {
  if (!Array.isArray(closures) || !planId) return null;
  return closures
    .filter((c) => c?.planId === planId && typeof c?.cycleStart === 'string')
    .sort((a, b) => a.cycleStart.localeCompare(b.cycleStart))[0] || null;
}

/**
 * PL inicial do ciclo. Precedência idêntica à do PlanLedgerExtract (C3 #259):
 * `cycleBaseline.plInicial` é o ground truth gravado na transaction do servidor;
 * closures pré-C3 (schemaVersion=2) não têm cycleBaseline mas têm `snapshot.plStart`;
 * sem fechamento (ciclo aberto) é `plan.pl`.
 */
export function resolveCycleInitialPl(closure, plan) {
  if (closure) {
    const fromBaseline = Number(closure.cycleBaseline?.plInicial);
    if (Number.isFinite(fromBaseline) && fromBaseline > 0) return fromBaseline;
    const fromSnapshot = Number(closure.snapshot?.plStart);
    if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) return fromSnapshot;
  }
  return Number(plan?.pl) || 0;
}

/**
 * Abertura da janela para um PLANO.
 *
 *   abertura = PL inicial do ciclo exibido
 *            + Σ trades do plano entre o início do ciclo e o início da janela
 *
 * O segundo termo só existe quando a janela é menor que o ciclo (dia/semana dentro
 * do mês): aí a janela não abre no capital do ciclo, e sim no que ele já tinha
 * rendido até ali. Janela == ciclo → termo zero por construção.
 *
 * Sem ciclo selecionado ("Todos os ciclos"), a base é o PL inicial do fechamento mais
 * ANTIGO do plano — o capital com que ele começou — e não `plan.pl`, que já incorporou
 * todos os ajustes desde então e faria a soma contar duas vezes.
 *
 * @returns {number|null} null quando não há plano — o caller cai no caminho por conta.
 */
export function computePlanWindowOpening({ plan, trades = [], closures = [], cycleStartISO = null, windowStartISO = null }) {
  if (!plan?.id) return null;

  const closure = cycleStartISO
    ? findCycleClosure(closures, plan.id, cycleStartISO)
    : earliestClosure(closures, plan.id);

  const base = resolveCycleInitialPl(closure, plan);

  if (!cycleStartISO || !windowStartISO || windowStartISO <= cycleStartISO) return base;

  let prefixo = 0;
  for (const t of trades) {
    if (t?.planId !== plan.id) continue;
    const d = typeof t?.date === 'string' ? t.date.slice(0, 10) : null;
    if (d && d >= cycleStartISO && d < windowStartISO) prefixo += Number(t?.result) || 0;
  }
  return base + prefixo;
}
