/**
 * planMechanicsCheck.js — issue #402
 *
 * Coerência aritmética do plano. `DEC-069`: **plano é mecânica, não estatística** —
 * `periodStop = maxTrades × RO`. Nada validava essa relação, e o resultado foi um
 * plano que se contradiz.
 *
 * O CASO REAL (Ago-Plano, 25/08/2026):
 *   pl 30.000 · RO 0,84% = R$ 252/operação · stop do período 1,67% = R$ 501
 *   501 / 252 = **1,99 operações**
 *
 *   Duas operações no tamanho autorizado somam R$ 504 — R$ 3 acima do que o
 *   próprio plano permite perder no período. Depois da primeira operação restavam
 *   R$ 251 de folga contra uma autorização de R$ 252: **não existia segunda
 *   operação legal**. O aluno foi acusado por não fazer algo aritmeticamente
 *   impossível. Na base há 4 planos assim, um deles autorizando 0,50 operação.
 *
 * Os avisos NÃO BLOQUEIAM o formulário: bloquear inviabilizaria a edição de todos
 * os planos existentes fora de conformidade. O objetivo é o plano se denunciar
 * enquanto está sendo escrito, não impedir o aluno de mexer nele.
 */

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cents = (v) => Math.round(v * 100) / 100;

export const PLAN_ISSUE = {
  /** O stop do período não comporta nem uma operação inteira. */
  PERIOD_STOP_BELOW_RO: 'PERIOD_STOP_BELOW_RO',
  /** Comporta N,xx operações — DEC-069 pede múltiplo inteiro. */
  PERIOD_STOP_NOT_MULTIPLE_OF_RO: 'PERIOD_STOP_NOT_MULTIPLE_OF_RO',
  /** O período pode perder mais que o ciclo inteiro. */
  PERIOD_STOP_ABOVE_CYCLE_STOP: 'PERIOD_STOP_ABOVE_CYCLE_STOP',
  /** Meta do período incompatível com stop × alvo de R:R (DEC-069). */
  PERIOD_GOAL_VS_RR: 'PERIOD_GOAL_VS_RR',
};

const pct = (v) => `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * @param {Object} plan — { pl, riskPerOperation, periodStop, periodGoal, cycleStop, rrTarget, operationPeriod }
 * @returns {{
 *   roAmount: number|null, stopAmount: number|null, goalAmount: number|null,
 *   tradesImplied: number|null, maxAuthorizedTrades: number|null,
 *   issues: Array<{ code: string, severity: 'error'|'warning', message: string }>,
 * }}
 */
export function checkPlanCoherence(plan) {
  const out = {
    roAmount: null,
    stopAmount: null,
    goalAmount: null,
    tradesImplied: null,
    maxAuthorizedTrades: null,
    issues: [],
  };
  if (!plan) return out;

  const pl = num(plan.pl) ?? num(plan.currentPl);
  const roPct = num(plan.riskPerOperation);
  const stopPct = num(plan.periodStop);
  const goalPct = num(plan.periodGoal);
  const cycleStopPct = num(plan.cycleStop);
  const rrTarget = num(plan.rrTarget);

  if (pl != null && pl > 0) {
    if (roPct != null && roPct > 0) out.roAmount = cents(pl * (roPct / 100));
    if (stopPct != null && stopPct > 0) out.stopAmount = cents(pl * (stopPct / 100));
    if (goalPct != null && goalPct > 0) out.goalAmount = cents(pl * (goalPct / 100));
  }

  // --- relação stop × RO (o coração do DEC-069) ---
  if (roPct != null && roPct > 0 && stopPct != null && stopPct > 0) {
    const n = stopPct / roPct;
    out.tradesImplied = Math.round(n * 100) / 100;
    out.maxAuthorizedTrades = Math.floor(n);

    if (n < 1) {
      out.issues.push({
        code: PLAN_ISSUE.PERIOD_STOP_BELOW_RO,
        severity: 'error',
        message: `O stop do período (${pct(stopPct)}) é menor que o risco por operação (${pct(roPct)}) — o plano não autoriza nenhuma operação inteira.`,
      });
    } else if (Math.abs(n - Math.round(n)) > 0.01) {
      const abaixo = Math.floor(n);
      const acima = abaixo + 1;
      out.issues.push({
        code: PLAN_ISSUE.PERIOD_STOP_NOT_MULTIPLE_OF_RO,
        severity: 'warning',
        message:
          `Seu stop do período comporta ${out.tradesImplied.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} operações. ` +
          `Para ${abaixo}, use ${pct(roPct * abaixo)}; para ${acima}, use ${pct(roPct * acima)}. ` +
          `Sobra fracionária vira operação que o plano autoriza tomar e proíbe perder.`,
      });
    }
  }

  // --- período não pode perder mais que o ciclo (validação que estava inline no modal) ---
  if (stopPct != null && cycleStopPct != null && stopPct > cycleStopPct) {
    out.issues.push({
      code: PLAN_ISSUE.PERIOD_STOP_ABOVE_CYCLE_STOP,
      severity: 'error',
      message: `O stop do período (${pct(stopPct)}) não pode ser maior que o stop do ciclo (${pct(cycleStopPct)}).`,
    });
  }

  // --- meta coerente com o R:R declarado (DEC-069: goal = maxTrades × RO × RR) ---
  if (goalPct != null && goalPct > 0 && stopPct != null && stopPct > 0 && rrTarget != null && rrTarget > 0) {
    const esperado = stopPct * rrTarget;
    // Tolerância de 20%: a meta é intenção, não obrigação aritmética.
    if (Math.abs(goalPct - esperado) / esperado > 0.2) {
      out.issues.push({
        code: PLAN_ISSUE.PERIOD_GOAL_VS_RR,
        severity: 'warning',
        message: `Com stop de ${pct(stopPct)} e alvo de ${rrTarget}:1, a meta coerente do período seria ~${pct(esperado)} — a sua está em ${pct(goalPct)}.`,
      });
    }
  }

  return out;
}

/**
 * Frase curta e legível para exibir junto do resumo do plano.
 * @returns {string|null}
 */
export function authorizedTradesLabel(plan) {
  const { maxAuthorizedTrades, roAmount, stopAmount } = checkPlanCoherence(plan);
  if (maxAuthorizedTrades == null || roAmount == null || stopAmount == null) return null;
  const periodo = plan?.operationPeriod === 'Semanal' ? 'por semana' : 'por dia';
  if (maxAuthorizedTrades === 0) return `Não autoriza nenhuma operação ${periodo}`;
  return `Autoriza ${maxAuthorizedTrades} ${maxAuthorizedTrades === 1 ? 'operação' : 'operações'} ${periodo}`;
}
