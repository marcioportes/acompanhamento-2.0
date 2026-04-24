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
//
// Stubs neutros (TODO mirror):
//   emotionalAnalysis (CHUNK-06 emotionalAnalysisV2.calculatePeriodScore) — neutro 50
//   evLeakage         (depende de plans com pl/riskPerOperation/rrTarget) — null
//   advancedMetricsPresent — false (depende de MFE/MAE tracking)
//   complianceRate100 — null (variante de calculateComplianceRate sobre últimos 100)

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

function calcComplianceRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return null;
  const withFlags = trades.filter(
    (t) => t.hasRedFlags || (Array.isArray(t.redFlags) && t.redFlags.length > 0),
  ).length;
  const compliant = trades.length - withFlags;
  return (compliant / trades.length) * 100;
}

function preComputeShapes({ trades, plans }) {
  void plans;
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safePlans = Array.isArray(plans) ? plans : [];
  const initialBalance = safePlans[0]?.initialBalance ?? 0;

  const stats = calcStats(safeTrades);
  const payoff = calcPayoff(stats);
  const maxDrawdown = calcMaxDrawdown(safeTrades, initialBalance);
  const consistencyCV = calcConsistencyCV(safeTrades);
  const complianceRate = calcComplianceRate(safeTrades);

  // Stubs neutros (DEC-AUTO-119-task07-02): aguardam mirror dedicado.
  const emotionalAnalysis = { periodScore: 50, tiltCount: 0, revengeCount: 0 };
  const evLeakage = null;
  const advancedMetricsPresent = false;
  const complianceRate100 = complianceRate;

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
  };
}

module.exports = {
  preComputeShapes,
  calcStats,
  calcPayoff,
  calcMaxDrawdown,
  calcConsistencyCV,
  calcComplianceRate,
};
