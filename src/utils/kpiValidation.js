/**
 * kpiValidation.js
 * @version 1.0.0 (v1.20.0)
 * @description Validação de KPIs reportados vs dados reais de ordens.
 *   Detecta inflação de KPIs — caso real: aluno com 80+ trades/dia,
 *   win rate aparente 75%+ porque nunca toma stop e só fecha winners.
 *
 * REGRAS:
 *   1. KPI Inflation: stopOrderRate < 20% + reportedWinRate > 60% → flag
 *   2. Hold Time Asymmetry: avgHoldTimeLoss / avgHoldTimeWin > 3.0 → alert
 *   3. Averaging Down + No Stop: averaging > 0 + stopOrderRate < 50% → alert
 *   4. Ghost Orders: ghostOrderCount / totalOrders > 10% → alert
 *
 * EXPORTS:
 *   validateKPIs(crossCheckMetrics, tradeMetrics) → KPIValidationResult
 *   generateAlerts(crossCheckMetrics, tradeMetrics) → Alert[]
 */

// ============================================
// CONSTANTS
// ============================================

/** Thresholds para detecção de KPI inflation */
export const THRESHOLDS = {
  /** Stop usage abaixo disso + win rate alta = flag */
  STOP_USAGE_LOW: 0.20,
  /** Win rate acima disso com stop usage baixo = suspeito */
  WIN_RATE_HIGH: 0.60,
  /** Delta entre win rate reportado e ajustado acima disso = flag */
  WIN_RATE_DELTA: 0.10,
  /** Hold time asymmetry acima disso = red flag */
  HOLD_TIME_ASYMMETRY: 3.0,
  /** Stop usage abaixo disso com averaging = risco de ruína */
  STOP_USAGE_AVERAGING: 0.50,
  /** Ghost order rate acima disso = sub-registro significativo */
  GHOST_RATE: 0.10,
  /** Modify rate acima disso = hesitação excessiva */
  MODIFY_RATE_HIGH: 0.30,
  /** Cancel rate acima disso = indecisão excessiva */
  CANCEL_RATE_HIGH: 0.40,
  /** Market order % acima disso = impulsividade */
  MARKET_ORDER_HIGH: 0.80,
  /** Order to trade ratio acima disso = hiperatividade */
  ORDER_TRADE_RATIO_HIGH: 5.0,
};

/** Severity levels */
export const SEVERITY = {
  NONE: 'NONE',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
};

// ============================================
// WIN RATE ADJUSTMENT
// ============================================

/**
 * Calcula win rate ajustado incluindo ghost orders como perdedores.
 * Lógica: ghost orders são posições que o aluno não registrou.
 * Premissa conservadora: ordens sem trade = trades não reportados (provável negativos).
 *
 * @param {number} reportedWinRate — win rate do trade ledger (0-1)
 * @param {number} totalTrades — trades registrados
 * @param {number} ghostOrderCount — ordens sem correlação
 * @returns {number} adjusted win rate (0-1)
 */
const adjustWinRate = (reportedWinRate, totalTrades, ghostOrderCount) => {
  if (totalTrades === 0 && ghostOrderCount === 0) return 0;
  const reportedWins = Math.round(reportedWinRate * totalTrades);
  const adjustedTotal = totalTrades + ghostOrderCount;
  if (adjustedTotal === 0) return 0;
  return Math.round((reportedWins / adjustedTotal) * 1000) / 1000;
};

// ============================================
// ALERT GENERATION
// ============================================

/**
 * Gera alertas comportamentais baseados nas métricas de cross-check.
 *
 * @param {Object} metrics — output de calculateCrossCheckMetrics
 * @param {Object} tradeMetrics — { winRate, totalTrades } do trade ledger
 * @returns {Array<{ type: string, message: string, severity: string }>}
 */
export const generateAlerts = (metrics, tradeMetrics) => {
  const alerts = [];
  const wr = tradeMetrics?.winRate ?? 0;
  const totalTrades = tradeMetrics?.totalTrades ?? 0;

  // 1. KPI Inflation: no stops + high win rate
  if (metrics.stopOrderRate < THRESHOLDS.STOP_USAGE_LOW && wr > THRESHOLDS.WIN_RATE_HIGH) {
    const severity = metrics.stopOrderRate === 0 ? SEVERITY.SEVERE : SEVERITY.MODERATE;
    alerts.push({
      type: 'KPI_INFLATION',
      message: `Win rate ${(wr * 100).toFixed(0)}% com apenas ${(metrics.stopOrderRate * 100).toFixed(0)}% de ordens com stop — KPI possivelmente inflado por ausência de proteção`,
      severity,
    });
  }

  // 2. Hold Time Asymmetry
  if (metrics.holdTimeAsymmetry > THRESHOLDS.HOLD_TIME_ASYMMETRY) {
    const severity = metrics.holdTimeAsymmetry > 5.0 ? SEVERITY.SEVERE : SEVERITY.MODERATE;
    alerts.push({
      type: 'HOLD_TIME_ASYMMETRY',
      message: `Aluno segura perdedores ${metrics.holdTimeAsymmetry.toFixed(1)}× mais que vencedores (${metrics.avgHoldTimeLoss.toFixed(0)}min vs ${metrics.avgHoldTimeWin.toFixed(0)}min)`,
      severity,
    });
  }

  // 3. Averaging Down + No Stop
  if (metrics.averagingDownCount > 0 && metrics.stopOrderRate < THRESHOLDS.STOP_USAGE_AVERAGING) {
    alerts.push({
      type: 'AVERAGING_NO_STOP',
      message: `${metrics.averagingDownCount} instância(s) de averaging down detectada(s) com ${(metrics.stopOrderRate * 100).toFixed(0)}% stop usage — risco de ruína`,
      severity: SEVERITY.SEVERE,
    });
  }

  // 4. Ghost Orders
  const totalFilledOrders = metrics.ghostOrderCount + (totalTrades > 0 ? totalTrades : 0);
  const ghostRate = totalFilledOrders > 0 ? metrics.ghostOrderCount / totalFilledOrders : 0;
  if (ghostRate > THRESHOLDS.GHOST_RATE && metrics.ghostOrderCount > 2) {
    alerts.push({
      type: 'GHOST_ORDERS',
      message: `${metrics.ghostOrderCount} ordens executadas sem trade registrado (${(ghostRate * 100).toFixed(0)}% das ordens) — possível sub-registro intencional`,
      severity: ghostRate > 0.25 ? SEVERITY.SEVERE : SEVERITY.MODERATE,
    });
  }

  // 5. Modify Rate alta (hesitação)
  if (metrics.modifyRate > THRESHOLDS.MODIFY_RATE_HIGH) {
    alerts.push({
      type: 'HIGH_MODIFY_RATE',
      message: `${(metrics.modifyRate * 100).toFixed(0)}% das ordens foram modificadas — indica hesitação ou ansiedade`,
      severity: SEVERITY.MODERATE,
    });
  }

  // 6. Cancel Rate alta (indecisão)
  if (metrics.cancelRate > THRESHOLDS.CANCEL_RATE_HIGH) {
    alerts.push({
      type: 'HIGH_CANCEL_RATE',
      message: `${(metrics.cancelRate * 100).toFixed(0)}% das ordens foram canceladas — indica indecisão`,
      severity: SEVERITY.MODERATE,
    });
  }

  // 7. Market Order % alta (impulsividade)
  if (metrics.marketOrderPct > THRESHOLDS.MARKET_ORDER_HIGH) {
    alerts.push({
      type: 'HIGH_MARKET_ORDER_PCT',
      message: `${(metrics.marketOrderPct * 100).toFixed(0)}% das ordens de entrada são market — indica operação impulsiva vs planejada`,
      severity: SEVERITY.MODERATE,
    });
  }

  // 8. Order/Trade ratio alta (hiperatividade)
  if (metrics.orderToTradeRatio > THRESHOLDS.ORDER_TRADE_RATIO_HIGH) {
    alerts.push({
      type: 'HIGH_ORDER_TRADE_RATIO',
      message: `${metrics.orderToTradeRatio.toFixed(1)} ordens por trade — hiperatividade operacional`,
      severity: SEVERITY.MODERATE,
    });
  }

  return alerts;
};

// ============================================
// MAIN VALIDATION
// ============================================

/**
 * Validação completa de KPIs do trade ledger contra dados de ordens.
 *
 * @param {Object} crossCheckMetrics — output de calculateCrossCheckMetrics
 * @param {Object} tradeMetrics — { winRate: number (0-1), totalTrades: number }
 * @returns {{
 *   reportedWinRate: number,
 *   adjustedWinRate: number,
 *   winRateDelta: number,
 *   stopUsageRate: number,
 *   kpiInflationFlag: boolean,
 *   kpiInflationSeverity: 'NONE'|'MODERATE'|'SEVERE',
 *   alerts: Array,
 * }}
 */
export const validateKPIs = (crossCheckMetrics, tradeMetrics) => {
  const reportedWinRate = tradeMetrics?.winRate ?? 0;
  const totalTrades = tradeMetrics?.totalTrades ?? 0;
  const ghostCount = crossCheckMetrics?.ghostOrderCount ?? 0;

  // Win rate ajustado
  const adjustedWinRate = adjustWinRate(reportedWinRate, totalTrades, ghostCount);
  const winRateDelta = Math.round(Math.abs(reportedWinRate - adjustedWinRate) * 1000) / 1000;

  // KPI inflation detection
  const stopUsageRate = crossCheckMetrics?.stopOrderRate ?? 0;
  let kpiInflationFlag = false;
  let kpiInflationSeverity = SEVERITY.NONE;

  // Rule 1: win rate delta > 10%
  if (winRateDelta > THRESHOLDS.WIN_RATE_DELTA) {
    kpiInflationFlag = true;
    kpiInflationSeverity = winRateDelta > 0.20 ? SEVERITY.SEVERE : SEVERITY.MODERATE;
  }

  // Rule 2: stop usage < 20% (override severity se pior)
  if (stopUsageRate < THRESHOLDS.STOP_USAGE_LOW) {
    kpiInflationFlag = true;
    if (stopUsageRate === 0) {
      kpiInflationSeverity = SEVERITY.SEVERE;
    } else if (kpiInflationSeverity !== SEVERITY.SEVERE) {
      kpiInflationSeverity = SEVERITY.MODERATE;
    }
  }

  // Rule 3: combination — low stops + high win rate
  if (stopUsageRate < THRESHOLDS.STOP_USAGE_LOW && reportedWinRate > THRESHOLDS.WIN_RATE_HIGH) {
    kpiInflationFlag = true;
    kpiInflationSeverity = SEVERITY.SEVERE;
  }

  // Generate alerts
  const alerts = generateAlerts(crossCheckMetrics, tradeMetrics);

  return {
    reportedWinRate: Math.round(reportedWinRate * 1000) / 1000,
    adjustedWinRate,
    winRateDelta,
    stopUsageRate,
    kpiInflationFlag,
    kpiInflationSeverity,
    alerts,
  };
};
