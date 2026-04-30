// ============================================
// MATURITY ENGINE — Pre-compute shapes (CF orchestrator)
// ============================================
//
// Adapta inputs crus (trades, plans) para os shapes que `evaluateMaturity` espera.
//
// Onde o util já existe em src/utils/, esta é uma ESPELHO LIGEIRO (idênticos ou
// subset funcional). Para utils ainda não-mirrored, retornamos default neutro
// (registrado em DEC-AUTO-119-task07).
//
// Mirrors (manter sincronizado):
//   calculateStats          → src/utils/calculations.js (versão simplificada — só campos usados)
//   calculatePayoff         → src/utils/dashboardMetrics.js
//   calculateMaxDrawdown    → src/utils/dashboardMetrics.js
//   calculateConsistencyCV  → src/utils/dashboardMetrics.js
//   calculateComplianceRate → src/utils/dashboardMetrics.js
//   emotionalAnalysis        → ./emotionalAnalysisMirror (issue #189, sub de
//                              src/utils/emotionalAnalysisV2.js)
//
// Stubs neutros remanescentes (TODO mirror):
//   evLeakage         (depende de plans com pl/riskPerOperation/rrTarget) — null
//
// Issue #187 (DEC-AUTO-187-04): advancedMetricsPresent agora deriva de mepPrice/menPrice
// nos trades. Política:
//   - amostra < 10 trades → null (insuficiente; gate marca METRIC_UNAVAILABLE)
//   - ≥ 80% dos trades têm mepPrice E menPrice não-null → true (rastreamento habitual)
//   - < 80% → null (NÃO bloqueia — DEC-AUTO-187-03; gate fica insuficiente até aluno preencher)
// Nunca retorna false: gate Stage 3→4 é opcional/condicional, sem dado o aluno
// não progride além do Metódico, mas tampouco rebaixa.
//
// Issue #191: complianceRate100 agora usa janela de ciclos ativos do trader
// (computeCycleBasedComplianceRate). Quando a janela é insuficiente (<20 trades
// mesmo após esgotar histórico), retorna null → evaluateGates marca o gate
// compliance-100 como METRIC_UNAVAILABLE (pendente, não promove e não rebaixa).
//
// Issue #189: emotionalAnalysis agora consome `computeEmotionalAnalysisShape` quando
// o caller injetar `emotions` ou `getEmotionConfig` no input. Sem esses inputs (ex.:
// testes legados, callers ainda não atualizados), mantém o fallback histórico
// { 50, 0, 0 } — preserva D6 "evolução sempre visível" (NUNCA null).

const { computeCycleBasedComplianceRate } = require('./computeCycleBasedComplianceRate');
const { computeEmotionalAnalysisShape } = require('./emotionalAnalysisMirror');
const { detectExecutionEvents } = require('./executionBehaviorMirror');

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function calcStats(trades) {
  const safe = Array.isArray(trades) ? trades : [];
  if (safe.length === 0) {
    return { totalTrades: 0, winTrades: 0, lossTrades: 0, totalPL: 0, winRate: 0, payoffRatio: 0, expectancy: 0 };
  }
  const wins = safe.filter((t) => (t.result ?? 0) > 0);
  const losses = safe.filter((t) => (t.result ?? 0) < 0);
  const totalWins = wins.reduce((s, t) => s + (t.result ?? 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.result ?? 0), 0));
  const totalPL = safe.reduce((s, t) => s + (t.result ?? 0), 0);
  const winRate = (wins.length / safe.length) * 100;
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const expectancy = ((winRate / 100) * avgWin) - (((100 - winRate) / 100) * avgLoss);
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  return {
    totalTrades: safe.length,
    winTrades: wins.length,
    lossTrades: losses.length,
    totalPL,
    winRate: parseFloat(winRate.toFixed(2)),
    avgWin,
    avgLoss,
    payoffRatio: parseFloat(payoffRatio.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
  };
}

function calcPayoff(stats) {
  if (!stats || stats.avgWin == null || stats.avgLoss == null) return null;
  if (stats.avgWin === 0 && stats.avgLoss === 0) return null;
  const avgWin = Math.abs(stats.avgWin);
  const avgLoss = Math.abs(stats.avgLoss);
  const ratio = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : null;
  return { ratio, avgWin, avgLoss };
}

function calcMaxDrawdown(trades, initialBalance = 0) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { maxDD: 0, maxDDPercent: 0, maxDDDate: null };
  }
  const sorted = [...trades].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  let cumPnL = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDDate = null;
  for (const trade of sorted) {
    cumPnL += Number(trade.result) || 0;
    if (cumPnL > peak) peak = cumPnL;
    const dd = peak - cumPnL;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDDate = trade.date;
    }
  }
  const maxDDPercent = initialBalance > 0 ? (maxDD / initialBalance) * 100 : 0;
  return { maxDD, maxDDPercent, maxDDDate };
}

function calcConsistencyCV(trades) {
  if (!Array.isArray(trades) || trades.length < 2) return null;
  const results = trades
    .filter((t) => t && t.result != null && isNum(Number(t.result)))
    .map((t) => Number(t.result));
  if (results.length < 2) return null;
  const mean = results.reduce((s, v) => s + v, 0) / results.length;
  if (mean === 0) return null;
  const variance = results.reduce((s, v) => s + (v - mean) ** 2, 0) / results.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / Math.abs(mean);
  return { cv: Math.round(cv * 100) / 100, mean, stdDev, count: results.length };
}

// Issue #187 — DEC-AUTO-187-04
const ADVANCED_METRICS_MIN_TRADES = 10;
const ADVANCED_METRICS_MIN_RATIO = 0.8;

function deriveAdvancedMetricsPresent(trades) {
  if (!Array.isArray(trades) || trades.length < ADVANCED_METRICS_MIN_TRADES) return null;
  const tracked = trades.filter(
    (t) => t && t.mepPrice != null && t.menPrice != null,
  ).length;
  const ratio = tracked / trades.length;
  return ratio >= ADVANCED_METRICS_MIN_RATIO ? true : null;
}

function calcComplianceRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return null;
  const withFlags = trades.filter(
    (t) => t.hasRedFlags || (Array.isArray(t.redFlags) && t.redFlags.length > 0),
  ).length;
  const compliant = trades.length - withFlags;
  return (compliant / trades.length) * 100;
}

function preComputeShapes({ trades, plans, now, emotions, getEmotionConfig, orders } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safePlans = Array.isArray(plans) ? plans : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const initialBalance = safePlans[0]?.initialBalance ?? 0;
  const refNow = now instanceof Date ? now : (now ? new Date(now) : new Date());

  const stats = calcStats(safeTrades);
  const payoff = calcPayoff(stats);
  const maxDrawdown = calcMaxDrawdown(safeTrades, initialBalance);
  const consistencyCV = calcConsistencyCV(safeTrades);
  const complianceRate = calcComplianceRate(safeTrades);

  // Issue #189: shape real quando o caller injeta emotions/getEmotionConfig;
  // sem isso, fallback neutro { 50, 0, 0 } preserva D6 (NUNCA null).
  const hasEmotionInputs = (Array.isArray(emotions) && emotions.length > 0)
    || typeof getEmotionConfig === 'function';
  const emotionalAnalysis = hasEmotionInputs
    ? computeEmotionalAnalysisShape({ trades: safeTrades, emotions, getEmotionConfig })
    : { periodScore: 50, tiltCount: 0, revengeCount: 0 };

  const evLeakage = null;
  const advancedMetricsPresent = deriveAdvancedMetricsPresent(safeTrades);
  const complianceRate100 = computeCycleBasedComplianceRate({
    trades: safeTrades,
    plans: safePlans,
    now: refNow,
  });

  // Issue #208 — Option C (DEC-AUTO-208-02): compute on-the-fly. Sem persistir
  // events em collection nova. Eventos derivados de orders já correlacionadas
  // (campo `correlatedTradeId` populado pela pipeline Order Import).
  const executionEvents = detectExecutionEvents({
    trades: safeTrades,
    orders: safeOrders,
  });
  const tradeIdsWithOrders = new Set(
    safeOrders
      .filter((o) => o && o.correlatedTradeId)
      .map((o) => o.correlatedTradeId)
  );
  const tradesWithOrderData = safeTrades.filter(
    (t) => t && t.id && tradeIdsWithOrders.has(t.id)
  ).length;

  return {
    stats,
    payoff,
    maxDrawdown,
    consistencyCV,
    complianceRate,
    emotionalAnalysis,
    evLeakage,
    advancedMetricsPresent,
    complianceRate100,
    executionEvents,
    tradesWithOrderData,
  };
}

module.exports = {
  preComputeShapes,
  calcStats,
  calcPayoff,
  calcMaxDrawdown,
  calcConsistencyCV,
  calcComplianceRate,
  computeCycleBasedComplianceRate,
  deriveAdvancedMetricsPresent,
  ADVANCED_METRICS_MIN_TRADES,
  ADVANCED_METRICS_MIN_RATIO,
};
