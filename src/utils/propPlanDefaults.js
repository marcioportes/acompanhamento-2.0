/**
 * propPlanDefaults
 * @description Deriva os defaults do PlanManagementModal a partir do attackPlan de uma conta PROP.
 *
 * Regra semântica crítica (issue #136):
 * - Plano é MECÂNICA de risco/retorno, NÃO média estatística de acumulação.
 * - periodStop (diário) = maxTrades × RO                       → pior caso: todos trades batem stop
 * - periodGoal (diário) = maxTrades × RO × rrMinimum           → melhor caso: todos trades batem target
 * - O day RR resultante === rrMinimum por construção (simetria mecânica com o per-trade RR).
 * - O EV/dailyTarget ($72/dia no exemplo Apex) é CONTEXTO estatístico de acumulação, nunca meta do plano.
 *
 * Fallback chain para period*Pct quando cálculo derivado não é possível:
 *   1. maxTrades × RO (× RR para goal)                          — caminho feliz
 *   2. dailyLossLimit (stop) / periodStopPct × RR (goal)        — abstract mode com dados parciais
 *   3. defaults fixos (stop 2%, goal 1%)                        — último fallback
 */

const DEFAULT_CYCLE_GOAL_PCT = 10;
const DEFAULT_CYCLE_STOP_PCT = 10;
const DEFAULT_PERIOD_GOAL_PCT = 1;
const DEFAULT_PERIOD_STOP_PCT = 2;
const DEFAULT_RISK_PCT = 0.5;
const DEFAULT_RR_TARGET = 1.5;

const toPct = (absValue, pl) =>
  pl > 0 && absValue > 0
    ? Math.round((absValue / pl) * 1000) / 10
    : 0;

export function computePropPlanDefaults(attackPlan, initialBalance) {
  const pl = Number(initialBalance) || 0;
  const isExecution = attackPlan.mode === 'execution' && !attackPlan.incompatible;
  const rrMinimum = attackPlan.rrMinimum ?? DEFAULT_RR_TARGET;

  const cycleGoalPct = toPct(attackPlan.profitTarget, pl) || DEFAULT_CYCLE_GOAL_PCT;
  const cycleStopPct = toPct(attackPlan.drawdownMax, pl) || DEFAULT_CYCLE_STOP_PCT;

  // periodStop: risco máximo do dia se todos os trades planejados baterem stop
  const plannedDailyLossUsd =
    (attackPlan.roPerTrade ?? 0) * (attackPlan.maxTradesPerDay ?? 0);
  const periodStopPct =
    toPct(plannedDailyLossUsd, pl) ||
    toPct(attackPlan.dailyLossLimit, pl) ||
    DEFAULT_PERIOD_STOP_PCT;

  // periodGoal: meta do dia se todos os trades planejados baterem target
  // Simetria mecânica: periodGoal === periodStop × rrMinimum
  const plannedDailyGainUsd = plannedDailyLossUsd * rrMinimum;
  const periodGoalPct =
    toPct(plannedDailyGainUsd, pl) ||
    (periodStopPct * rrMinimum) ||
    DEFAULT_PERIOD_GOAL_PCT;

  // RO% por trade = teto diário (periodStopPct), não o sizing mínimo de 1 contrato.
  // Permite Path A (2 trades × 0.6%) e Path B (1 trade × 1.2%) sem flagrar compliance.
  const riskPctPerOp = periodStopPct || DEFAULT_RISK_PCT;

  const rrTarget = rrMinimum;

  return {
    cycleGoalPct,
    cycleStopPct,
    periodGoalPct,
    periodStopPct,
    riskPctPerOp,
    rrTarget,
  };
}
