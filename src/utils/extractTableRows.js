/**
 * extractTableRows.js
 * @version 1.0.0 (v1.33.0)
 * @description Monta as rows da ExtractTable a partir do planState.
 *   Duas visões de acumulado por row:
 *     - cumPnL: acumulado do CICLO (carry + running total do ciclo)
 *     - periodCumPnL: acumulado do PERÍODO (reseta a cada periodKey)
 *
 *   Assim o mentor vê simultaneamente progresso no ciclo e no período.
 */

/**
 * @param {Object|null} planState - Retorno de computePlanState
 * @param {string|null} selectedPeriod - periodKey selecionado; null = visão ciclo
 * @returns {{ tableRows: Array, carryOver: number }}
 */
export const buildTableRows = (planState, selectedPeriod) => {
  if (!planState) return { tableRows: [], carryOver: 0 };

  const cycleGoalVal = planState.cycleState?.summary?.goalVal ?? 0;
  const cycleStopVal = planState.cycleState?.summary?.stopVal ?? 0;

  if (selectedPeriod === null) {
    // Visão ciclo: runningTotal acumula o ciclo inteiro; periodRunningTotal reseta por periodKey.
    const allRows = [];
    let runningTotal = 0;
    let cycleTriggered = false;
    let currentPeriodKey = null;
    let periodRunningTotal = 0;

    for (const periodKey of planState.availablePeriods) {
      const period = planState.cycleState.periods.get(periodKey);
      if (!period) continue;
      if (periodKey !== currentPeriodKey) {
        currentPeriodKey = periodKey;
        periodRunningTotal = 0;
      }
      for (const row of period.rows) {
        runningTotal += row.result;
        periodRunningTotal += row.result;
        let cycleEvent = null;
        if (!cycleTriggered) {
          if (cycleGoalVal > 0 && runningTotal >= cycleGoalVal) {
            cycleEvent = 'CYCLE_GOAL_HIT';
            cycleTriggered = true;
          } else if (cycleStopVal > 0 && runningTotal <= -cycleStopVal) {
            cycleEvent = 'CYCLE_STOP_HIT';
            cycleTriggered = true;
          }
        }
        allRows.push({
          ...row,
          cumPnL: runningTotal,
          periodCumPnL: periodRunningTotal,
          cycleEvent,
        });
      }
    }
    return { tableRows: allRows, carryOver: 0 };
  }

  // Visão período: carry = soma dos períodos anteriores; periodCumPnL = row.cumPnL original.
  let carry = 0;
  for (const periodKey of planState.availablePeriods) {
    if (periodKey === selectedPeriod) break;
    const period = planState.cycleState.periods.get(periodKey);
    if (period) carry += period.summary.totalPnL;
  }

  const periodState = planState.cycleState.periods.get(selectedPeriod);
  const periodRows = periodState?.rows || [];
  const adjustedRows = periodRows.map(row => ({
    ...row,
    cumPnL: carry + row.cumPnL,
    periodCumPnL: row.cumPnL,
    cycleEvent: null,
  }));

  return { tableRows: adjustedRows, carryOver: carry };
};
