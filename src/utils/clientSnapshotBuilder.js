/**
 * clientSnapshotBuilder
 * @description Monta o `frozenSnapshot` da revisão semanal no cliente (mentor-only)
 *              a partir de trades do período + plan + emotional metrics.
 *              É o payload enviado à CF createWeeklyReview.
 *
 * Shape A1 (kpis explícito) + A2 (topTrades/bottomTrades inline via
 * buildWeeklyReviewSnapshot). Mentor é trusted → compute feito no client
 * evita replicar engine emotional/compliance no servidor.
 */

import { calculateTradeCompliance } from './compliance';
import { buildWeeklyReviewSnapshot, pickPeriodTrades } from './weeklyReviewSnapshot';
import { computeCVNormalized } from './cycleConsistency/computeCVNormalized';

const round1 = (n) => Math.round(Number(n) * 10) / 10;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const pctRate = (count, total) => (total > 0 ? round1((count / total) * 100) : 0);

const computeMaxDrawdown = (sortedTrades) => {
  let running = 0;
  let peak = 0;
  let maxDD = 0;
  for (const t of sortedTrades) {
    running += Number(t.result) || 0;
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDD) maxDD = dd;
  }
  return round2(maxDD);
};

const sortByExit = (trades) =>
  [...trades].sort((a, b) => {
    const ta = new Date(a.exitTime || a.entryTime || a.date).getTime();
    const tb = new Date(b.exitTime || b.entryTime || b.date).getTime();
    return ta - tb;
  });

// === KPIs adicionais exigidos pelo mockup-revisao-semanal-102.html (Subitem 2) ===

// Payoff = |média dos wins| / |média dos losses|. Retorna 0 se não houver losses.
const computePayoff = (trades) => {
  const wins = trades.filter(t => Number(t.result) > 0).map(t => Number(t.result));
  const losses = trades.filter(t => Number(t.result) < 0).map(t => Math.abs(Number(t.result)));
  if (wins.length === 0 || losses.length === 0) return 0;
  const avgWin = wins.reduce((a, b) => a + b, 0) / wins.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  if (avgLoss === 0) return 0;
  return round2(avgWin / avgLoss);
};

// Profit Factor = Σ wins / |Σ losses|.
const computeProfitFactor = (trades) => {
  let sumWins = 0, sumLosses = 0;
  for (const t of trades) {
    const r = Number(t.result) || 0;
    if (r > 0) sumWins += r;
    else if (r < 0) sumLosses += Math.abs(r);
  }
  if (sumLosses === 0) return 0;
  return round2(sumWins / sumLosses);
};

// EV por trade = P&L total / número de trades.
const computeEvPerTrade = (trades, totalPL) => {
  if (!trades?.length) return 0;
  return round2(totalPL / trades.length);
};

// Coeficiente de variação = desvio-padrão / |média dos results|.
// Métrica de consistência — menor é melhor (retornos menos voláteis).
const computeCoefVariation = (trades) => {
  const results = trades.map(t => Number(t.result) || 0);
  if (results.length < 2) return 0;
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const variance = results.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / results.length;
  const stdev = Math.sqrt(variance);
  const absMean = Math.abs(mean);
  if (absMean === 0) return 0;
  return round2(stdev / absMean);
};

// Tempo médio de cada trade (minutos) — geral + win/loss breakdown.
const computeHoldTimes = (trades) => {
  const minutesOf = (t) => {
    if (!t.entryTime || !t.exitTime) return null;
    const entry = new Date(t.entryTime).getTime();
    const exit = new Date(t.exitTime).getTime();
    if (!Number.isFinite(entry) || !Number.isFinite(exit)) return null;
    const min = (exit - entry) / 60000;
    return min >= 0 ? min : null;
  };
  const all = [], wins = [], losses = [];
  for (const t of trades) {
    const m = minutesOf(t);
    if (m == null) continue;
    all.push(m);
    const r = Number(t.result) || 0;
    if (r > 0) wins.push(m);
    else if (r < 0) losses.push(m);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  return {
    avgHoldTimeMin: avg(all),
    avgHoldTimeWinMin: avg(wins),
    avgHoldTimeLossMin: avg(losses),
  };
};

const computeComplianceAggregate = (trades, plan) => {
  let total = 0, stopOk = 0, rrEvalTotal = 0, rrOk = 0, roEvalTotal = 0, roOk = 0;
  for (const trade of trades) {
    total += 1;
    if (trade.stopLoss != null) stopOk += 1;
    const c = calculateTradeCompliance(trade, plan);
    if (c.riskPercent != null) {
      roEvalTotal += 1;
      if (c.compliance.roStatus === 'CONFORME') roOk += 1;
    }
    if (c.rrRatio != null) {
      rrEvalTotal += 1;
      if (c.compliance.rrStatus === 'CONFORME') rrOk += 1;
    }
  }
  const stopRespected = { count: stopOk, total, rate: pctRate(stopOk, total) };
  const rrRespected = { count: rrOk, total: rrEvalTotal, rate: pctRate(rrOk, rrEvalTotal) };
  const roRespected = { count: roOk, total: roEvalTotal, rate: pctRate(roOk, roEvalTotal) };
  // Overall: média simples dos 3 rates (todos reportados em 0-100).
  const overall = Math.round((stopRespected.rate + rrRespected.rate + roRespected.rate) / 3);
  return { stopRespected, rrRespected, roRespected, overall };
};

const computeAvgRR = (trades, plan) => {
  const rrs = [];
  for (const trade of trades) {
    const c = calculateTradeCompliance(trade, plan);
    if (c.rrRatio != null && Number.isFinite(c.rrRatio)) rrs.push(c.rrRatio);
  }
  if (rrs.length === 0) return 0;
  return round2(rrs.reduce((a, b) => a + b, 0) / rrs.length);
};

const projectEmotionalMetrics = (metrics) => {
  if (!metrics) {
    return {
      compositeScore: 100,
      positivePercent: 0, negativePercent: 0, criticalPercent: 0,
      tiltCount: 0, revengeCount: 0, overtradingDays: 0,
      topEmotion: null,
    };
  }
  const top = metrics.topEmotion;
  return {
    compositeScore: Number(metrics.score) || 100,
    positivePercent: Number(metrics.positivePercent) || 0,
    negativePercent: Number(metrics.negativePercent) || 0,
    criticalPercent: Number(metrics.criticalPercent) || 0,
    tiltCount: Number(metrics.tiltCount) || 0,
    revengeCount: Number(metrics.revengeCount) || 0,
    overtradingDays: Number(metrics.overtradingDays) || 0,
    topEmotion: top
      ? {
          name: top.name || String(top),
          category: top.category || null,
          count: Number(top.count) || 0,
        }
      : null,
  };
};

// Cópia rasa do doc maturity/current sem timestamps voláteis do Firestore.
// `frozenAt` ISO marca o instante em que a foto foi tirada — fonte de verdade temporal.
const freezeMaturity = (maturity) => {
  if (!maturity || typeof maturity !== 'object' || Array.isArray(maturity)) return null;
  // eslint-disable-next-line no-unused-vars
  const { computedAt, asOf, aiGeneratedAt, ...rest } = maturity;
  return { ...rest, frozenAt: new Date().toISOString() };
};

/**
 * @param {Object}  params
 * @param {Object}  params.plan         — {id, adjustmentCycle, pl, riskPerOperation, rrTarget, ...}
 * @param {Array}   params.trades       — trades filtrados pelo período da revisão
 * @param {Array}   [params.extraTrades] — trades incluídos manualmente (`review.includedTradeIds`),
 *                  pode estar fora do período. Mesclado e deduplicado por id com `trades`.
 * @param {string}  [params.cycleKey]   — chave do ciclo ativo (ex: '2026-04')
 * @param {string}  [params.cycleStart] — ISO `YYYY-MM-DD` (inclusive). Quando presente
 *                  com `cycleEnd`, popula `kpis.cvNormalized` via computeCVNormalized
 *                  (issue #235 F3.1 — alinha snapshot ao card do dashboard).
 * @param {string}  [params.cycleEnd]   — ISO `YYYY-MM-DD` (inclusive). Ver `cycleStart`.
 * @param {Object}  [params.emotionalMetrics] — metrics de useEmotionalProfile
 * @param {Object}  [params.maturity]   — doc students/{uid}/maturity/current ou null.
 *                  Quando presente, congela como `maturitySnapshot` (Fase E — issue #119 task 15).
 * @returns {Object} frozenSnapshot (planContext, kpis, topTrades, bottomTrades, periodTrades, maturitySnapshot)
 */
export const buildClientSnapshot = ({
  plan,
  trades,
  extraTrades = [],
  cycleKey = null,
  cycleStart = null,
  cycleEnd = null,
  emotionalMetrics = null,
  maturity = null,
}) => {
  if (!plan?.id) throw new Error('buildClientSnapshot: plan.id é obrigatório');
  const baseTrades = Array.isArray(trades) ? trades : [];
  const extras = Array.isArray(extraTrades) ? extraTrades : [];
  // Dedup por id: trades do período prevalecem (mesmo shape), extras entram só se id novo.
  const seenIds = new Set(baseTrades.map(t => t.id).filter(Boolean));
  const mergedTrades = [...baseTrades];
  for (const t of extras) {
    if (t?.id && !seenIds.has(t.id)) {
      seenIds.add(t.id);
      mergedTrades.push(t);
    }
  }
  const safeTrades = mergedTrades;
  const sorted = sortByExit(safeTrades);

  const pl = safeTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
  const wins = safeTrades.filter(t => (Number(t.result) || 0) > 0).length;
  const wr = safeTrades.length > 0 ? round1((wins / safeTrades.length) * 100) : 0;
  const avgRR = computeAvgRR(safeTrades, plan);
  const maxDD = computeMaxDrawdown(sorted);
  const compliance = computeComplianceAggregate(safeTrades, plan);
  const emotional = projectEmotionalMetrics(emotionalMetrics);
  // Novos KPIs para mockup-revisao-semanal-102.html (Subitem 2)
  const payoff = computePayoff(safeTrades);
  const profitFactor = computeProfitFactor(safeTrades);
  const evPerTrade = computeEvPerTrade(safeTrades, pl);
  const coefVariation = computeCoefVariation(safeTrades);
  const holdTimes = computeHoldTimes(safeTrades);

  // CV normalizado per-ciclo (issue #235 F3.1). Coexiste com `coefVariation`
  // (compat reversa, DEC-AUTO-235-T10): UIs novas leem `cvNormalized.value`,
  // antigas seguem em `coefVariation`. Só popula com janela do ciclo presente.
  let cvNormalized = null;
  if (cycleStart && cycleEnd) {
    const result = computeCVNormalized(safeTrades, plan, cycleStart, cycleEnd);
    cvNormalized = {
      value: result.value,
      cvObs: result.cvObs,
      cvExp: result.cvExp,
      daysWithTrade: result.daysWithTrade,
      insufficientReason: result.insufficientReason ?? null,
    };
  }

  const kpis = {
    pl: round2(pl),
    trades: safeTrades.length,
    wr,
    avgRR,
    maxDD,
    payoff,
    profitFactor,
    evPerTrade,
    coefVariation,
    cvNormalized,
    avgHoldTimeMin: holdTimes.avgHoldTimeMin,
    avgHoldTimeWinMin: holdTimes.avgHoldTimeWinMin,
    avgHoldTimeLossMin: holdTimes.avgHoldTimeLossMin,
    compliance,
    emotional,
  };

  const baseSnapshot = buildWeeklyReviewSnapshot({ plan, trades: safeTrades, kpis, cycleKey });
  // periodTrades: todos os trades do período inline, para o Subitem 1 da nova tela.
  return {
    ...baseSnapshot,
    periodTrades: pickPeriodTrades(safeTrades),
    maturitySnapshot: freezeMaturity(maturity),
  };
};
