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
import { buildWeeklyReviewSnapshot } from './weeklyReviewSnapshot';

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

/**
 * @param {Object}  params
 * @param {Object}  params.plan         — {id, adjustmentCycle, pl, riskPerOperation, rrTarget, ...}
 * @param {Array}   params.trades       — trades filtrados pelo período da revisão
 * @param {string}  [params.cycleKey]   — chave do ciclo ativo (ex: '2026-04')
 * @param {Object}  [params.emotionalMetrics] — metrics de useEmotionalProfile
 * @returns {Object} frozenSnapshot (planContext, kpis, topTrades, bottomTrades)
 */
export const buildClientSnapshot = ({
  plan,
  trades,
  cycleKey = null,
  emotionalMetrics = null,
}) => {
  if (!plan?.id) throw new Error('buildClientSnapshot: plan.id é obrigatório');
  const safeTrades = Array.isArray(trades) ? trades : [];
  const sorted = sortByExit(safeTrades);

  const pl = safeTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
  const wins = safeTrades.filter(t => (Number(t.result) || 0) > 0).length;
  const wr = safeTrades.length > 0 ? round1((wins / safeTrades.length) * 100) : 0;
  const avgRR = computeAvgRR(safeTrades, plan);
  const maxDD = computeMaxDrawdown(sorted);
  const compliance = computeComplianceAggregate(safeTrades, plan);
  const emotional = projectEmotionalMetrics(emotionalMetrics);

  const kpis = {
    pl: round2(pl),
    trades: safeTrades.length,
    wr,
    avgRR,
    maxDD,
    compliance,
    emotional,
  };

  return buildWeeklyReviewSnapshot({ plan, trades: safeTrades, kpis, cycleKey });
};
