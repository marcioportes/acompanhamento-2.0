/**
 * propPlanDefaults
 * @description Deriva os defaults do PlanManagementModal a partir do attackPlan de uma conta PROP.
 *
 * Regra semântica crítica (issue #136):
 * - Stop do período do PLANO = maxTrades × RO (derivado do attack plan)
 * - NÃO é o dailyLossLimit da mesa — esse é hard limit, não parâmetro do plano
 * - Contas sem dailyLossLimit (ex: Ylos Challenge) usam o mesmo cálculo
 *
 * Fallback chain para periodStopPct quando cálculo derivado não é possível:
 *   1. plannedDailyLoss = roPerTrade × maxTradesPerDay  (caminho feliz)
 *   2. dailyLossLimit da mesa  (modo abstract com mesa que tem hard limit)
 *   3. 2.0%  (modo abstract Ylos — aluno edita manualmente)
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

  const cycleGoalPct = toPct(attackPlan.profitTarget, pl) || DEFAULT_CYCLE_GOAL_PCT;
  const cycleStopPct = toPct(attackPlan.drawdownMax, pl) || DEFAULT_CYCLE_STOP_PCT;
  const periodGoalPct = toPct(attackPlan.dailyTarget, pl) || DEFAULT_PERIOD_GOAL_PCT;

  const plannedDailyLossUsd =
    (attackPlan.roPerTrade ?? 0) * (attackPlan.maxTradesPerDay ?? 0);
  const periodStopPct =
    toPct(plannedDailyLossUsd, pl) ||
    toPct(attackPlan.dailyLossLimit, pl) ||
    DEFAULT_PERIOD_STOP_PCT;

  const riskPctPerOp = isExecution
    ? toPct(attackPlan.roPerTrade, pl) || DEFAULT_RISK_PCT
    : DEFAULT_RISK_PCT;

  const rrTarget = attackPlan.rrMinimum ?? DEFAULT_RR_TARGET;

  return {
    cycleGoalPct,
    cycleStopPct,
    periodGoalPct,
    periodStopPct,
    riskPctPerOp,
    rrTarget,
  };
}
