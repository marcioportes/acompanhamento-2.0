/**
 * orderCrossCheck.js
 * @version 1.0.0 (v1.20.0)
 * @description Cálculo das 8 métricas de cross-check comportamental derivadas de ordens.
 *   Compara dados de ordens brutas (fonte objetiva) com trades registrados (fonte subjetiva).
 *
 * MÉTRICAS:
 *   1. stopOrderRate — % de ordens que são stop/stop_limit
 *   2. modifyRate — % de ordens modificadas
 *   3. cancelRate — % de ordens canceladas
 *   4. marketOrderPct — % de ordens market vs limit
 *   5. avgHoldTimeWin / avgHoldTimeLoss — tempo médio por resultado
 *   6. holdTimeAsymmetry — ratio loss/win (>3 = red flag)
 *   7. averagingDownCount — ordens adicionais na mesma direção após adverse move
 *   8. ghostOrderCount — ordens executadas sem trade registrado
 *   9. orderToTradeRatio — total ordens / total trades
 *
 * EXPORTS:
 *   calculateCrossCheckMetrics(orders, trades, correlations) → CrossCheckMetrics
 *   calculateHoldTimeMetrics(trades) → { avgHoldTimeWin, avgHoldTimeLoss, holdTimeAsymmetry }
 *   detectAveragingDown(orders) → { count, instances[] }
 */

// ============================================
// HELPERS
// ============================================

/**
 * Extrai timestamp em ms.
 * @param {*} value
 * @returns {number|null}
 */
const toMs = (value) => {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (value.toMillis) return value.toMillis();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Safe division — retorna 0 se divisor é 0.
 * @param {number} num
 * @param {number} den
 * @returns {number}
 */
const safeDiv = (num, den) => (den === 0 ? 0 : num / den);

// ============================================
// STOP ORDER RATE
// ============================================

/**
 * Calcula taxa de ordens de proteção (stop/stop_limit).
 * @param {Object[]} orders
 * @returns {number} 0.0 a 1.0
 */
const calcStopOrderRate = (orders) => {
  if (!orders.length) return 0;
  const stopCount = orders.filter(o => o.isStopOrder).length;
  return Math.round(safeDiv(stopCount, orders.length) * 1000) / 1000;
};

// ============================================
// MODIFY RATE
// ============================================

/**
 * Calcula taxa de ordens modificadas.
 * @param {Object[]} orders
 * @returns {number} 0.0 a 1.0
 */
const calcModifyRate = (orders) => {
  if (!orders.length) return 0;
  const modified = orders.filter(o => o.status === 'MODIFIED').length;
  return Math.round(safeDiv(modified, orders.length) * 1000) / 1000;
};

// ============================================
// CANCEL RATE
// ============================================

/**
 * Calcula taxa de ordens canceladas.
 * @param {Object[]} orders
 * @returns {number} 0.0 a 1.0
 */
const calcCancelRate = (orders) => {
  if (!orders.length) return 0;
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
  return Math.round(safeDiv(cancelled, orders.length) * 1000) / 1000;
};

// ============================================
// MARKET ORDER PCT
// ============================================

/**
 * Calcula % de ordens market vs limit (excluindo stop orders).
 * @param {Object[]} orders
 * @returns {number} 0.0 a 1.0
 */
const calcMarketOrderPct = (orders) => {
  // Considerar apenas ordens de entrada (não stop orders de proteção)
  const entryOrders = orders.filter(o => !o.isStopOrder && (o.orderType === 'MARKET' || o.orderType === 'LIMIT'));
  if (!entryOrders.length) return 0;
  const marketCount = entryOrders.filter(o => o.orderType === 'MARKET').length;
  return Math.round(safeDiv(marketCount, entryOrders.length) * 1000) / 1000;
};

// ============================================
// HOLD TIME METRICS
// ============================================

/**
 * Calcula tempo médio de holding por resultado (win vs loss).
 * Usa dados dos TRADES (não ordens) — entry/exitTime + result.
 *
 * @param {Object[]} trades — trades com entryTime, exitTime, result
 * @returns {{ avgHoldTimeWin: number, avgHoldTimeLoss: number, holdTimeAsymmetry: number }}
 *   Tempos em minutos. Asymmetry = loss/win ratio.
 */
export const calculateHoldTimeMetrics = (trades) => {
  const winTimes = [];
  const lossTimes = [];

  for (const trade of trades) {
    const entryMs = toMs(trade.entryTime);
    const exitMs = toMs(trade.exitTime);
    if (!entryMs || !exitMs) continue;

    const durationMinutes = (exitMs - entryMs) / (60 * 1000);
    if (durationMinutes <= 0) continue; // inválido

    const result = Number(trade.result) || 0;
    if (result > 0) {
      winTimes.push(durationMinutes);
    } else if (result < 0) {
      lossTimes.push(durationMinutes);
    }
    // breakeven (result === 0) ignorado
  }

  const avgHoldTimeWin = winTimes.length > 0
    ? Math.round((winTimes.reduce((a, b) => a + b, 0) / winTimes.length) * 100) / 100
    : 0;

  const avgHoldTimeLoss = lossTimes.length > 0
    ? Math.round((lossTimes.reduce((a, b) => a + b, 0) / lossTimes.length) * 100) / 100
    : 0;

  const holdTimeAsymmetry = avgHoldTimeWin > 0
    ? Math.round(safeDiv(avgHoldTimeLoss, avgHoldTimeWin) * 100) / 100
    : 0;

  return { avgHoldTimeWin, avgHoldTimeLoss, holdTimeAsymmetry };
};

// ============================================
// AVERAGING DOWN DETECTION
// ============================================

/**
 * Detecta padrões de averaging down: ordens adicionais na mesma direção
 * e mesmo instrumento em janela temporal curta.
 *
 * Heurística: agrupar ordens FILLED por instrumento+side, ordenar por timestamp.
 * Se há 2+ ordens no mesmo instrumento, mesma direção, em janela de 30min → averaging.
 *
 * @param {Object[]} orders — ordens normalizadas
 * @returns {{ count: number, instances: Array<{ instrument: string, side: string, orderCount: number, timeSpan: number }> }}
 */
export const detectAveragingDown = (orders) => {
  const WINDOW_MS = 30 * 60 * 1000; // 30 minutos

  // Filtrar apenas FILLED com timestamp
  const filled = orders
    .filter(o => (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && !o.isStopOrder)
    .map(o => ({
      ...o,
      _ts: toMs(o.filledAt || o.submittedAt),
    }))
    .filter(o => o._ts != null)
    .sort((a, b) => a._ts - b._ts);

  // Agrupar por instrumento + side
  const groups = {};
  for (const order of filled) {
    const key = `${order.instrument}|${order.side}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
  }

  const instances = [];
  let totalCount = 0;

  for (const [key, groupOrders] of Object.entries(groups)) {
    if (groupOrders.length < 2) continue;

    // Sliding window: detectar clusters
    let clusterStart = 0;
    for (let i = 1; i < groupOrders.length; i++) {
      const delta = groupOrders[i]._ts - groupOrders[clusterStart]._ts;

      if (delta > WINDOW_MS) {
        // Verificar cluster anterior
        const clusterSize = i - clusterStart;
        if (clusterSize >= 2) {
          const [instrument, side] = key.split('|');
          const timeSpan = Math.round((groupOrders[i - 1]._ts - groupOrders[clusterStart]._ts) / (60 * 1000));
          instances.push({ instrument, side, orderCount: clusterSize, timeSpanMinutes: timeSpan });
          totalCount += clusterSize - 1; // -1 porque a primeira ordem é legítima
        }
        clusterStart = i;
      }
    }

    // Último cluster
    const lastClusterSize = groupOrders.length - clusterStart;
    if (lastClusterSize >= 2) {
      const [instrument, side] = key.split('|');
      const timeSpan = Math.round((groupOrders[groupOrders.length - 1]._ts - groupOrders[clusterStart]._ts) / (60 * 1000));
      instances.push({ instrument, side, orderCount: lastClusterSize, timeSpanMinutes: timeSpan });
      totalCount += lastClusterSize - 1;
    }
  }

  return { count: totalCount, instances };
};

// ============================================
// GHOST ORDER COUNT
// ============================================

/**
 * Conta ordens FILLED sem trade correlacionado.
 * @param {Object[]} correlations — output de correlateOrders
 * @returns {number}
 */
const calcGhostOrderCount = (correlations) => {
  return correlations.filter(c => c.matchType === 'ghost').length;
};

// ============================================
// ORDER TO TRADE RATIO
// ============================================

/**
 * Calcula ratio ordens/trades.
 * @param {number} totalOrders
 * @param {number} totalTrades
 * @returns {number}
 */
const calcOrderToTradeRatio = (totalOrders, totalTrades) => {
  return Math.round(safeDiv(totalOrders, totalTrades) * 100) / 100;
};

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Calcula todas as métricas de cross-check.
 *
 * @param {Object[]} orders — ordens normalizadas
 * @param {Object[]} trades — trades do período
 * @param {Object[]} correlations — output de correlateOrders().correlations
 * @returns {Object} CrossCheckMetrics
 */
export const calculateCrossCheckMetrics = (orders, trades, correlations) => {
  const holdTime = calculateHoldTimeMetrics(trades);
  const averaging = detectAveragingDown(orders);

  return {
    stopOrderRate: calcStopOrderRate(orders),
    modifyRate: calcModifyRate(orders),
    cancelRate: calcCancelRate(orders),
    marketOrderPct: calcMarketOrderPct(orders),
    avgHoldTimeWin: holdTime.avgHoldTimeWin,
    avgHoldTimeLoss: holdTime.avgHoldTimeLoss,
    holdTimeAsymmetry: holdTime.holdTimeAsymmetry,
    averagingDownCount: averaging.count,
    averagingDownInstances: averaging.instances,
    ghostOrderCount: calcGhostOrderCount(correlations),
    orderToTradeRatio: calcOrderToTradeRatio(orders.length, trades.length),
  };
};
