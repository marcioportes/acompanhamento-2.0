/**
 * Cloud Function: analyzeShadowBehavior
 *
 * CF callable que analisa shadow behavior para trades de um aluno em um período.
 * Disparo: mentor via UI.
 * Layer 1: todos os trades (parciais + contexto inter-trade).
 * Layer 2: trades com ordens correlacionadas (enriquecimento).
 *
 * @see Issue #129 — Shadow Trade + Padrões Comportamentais
 *
 * Export em functions/index.js:
 *   exports.analyzeShadowBehavior = require("./analyzeShadowBehavior");
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ============================================
// Shadow behavior analysis — inlined for CF
// (Same logic as src/utils/shadowBehaviorAnalysis.js)
// ============================================

const SHADOW_VERSION = '1.0';

const RESOLUTION = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };
const SEVERITY = { NONE: 'NONE', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

const EMOTION_MAPPING = {
  HOLD_ASYMMETRY: 'FEAR',
  REVENGE_CLUSTER: 'REVENGE',
  GREED_CLUSTER: 'GREED',
  OVERTRADING: 'ANXIETY',
  IMPULSE_CLUSTER: 'IMPULSIVITY',
  CLEAN_EXECUTION: 'DISCIPLINE',
  TARGET_HIT: 'PATIENCE',
  DIRECTION_FLIP: 'CONFUSION',
  UNDERSIZED_TRADE: 'AVOIDANCE',
  HESITATION: 'FEAR',
  STOP_PANIC: 'PANIC',
  FOMO_ENTRY: 'FOMO',
  EARLY_EXIT: 'FEAR',
  LATE_EXIT: 'HOPE',
  AVERAGING_DOWN: 'DENIAL'
};

const DEFAULT_CONFIG = {
  holdAsymmetry: { multiplier: 3.0, minSampleSize: 3 },
  revengeCluster: { maxIntervalMinutes: 5, minTrades: 2 },
  greedCluster: { maxIntervalMinutes: 10, minTrades: 3 },
  overtrading: { windowMinutes: 60, maxTradesInWindow: 5 },
  impulseCluster: { maxIntervalMinutes: 2, minTrades: 2 },
  targetHit: { tolerancePct: 0.05 },
  earlyExit: { rrThresholdPct: 0.50 },
  directionFlip: { maxIntervalMinutes: 120 },
  undersizedTrade: { ratioThreshold: 0.50, highRatio: 0.25, mediumRatio: 0.40 },
  hesitation: { minCancels: 2 },
  stopPanic: { maxExitMinutes: 5 },
  fomoEntry: { minDelayMinutes: 10, orderType: 'MARKET' },
  lateExit: { minDelayMinutes: 15 },
  lowResolutionPenalty: 0.3
};

// --- Helpers ---

const getMinutesBetween = (tradeA, tradeB) => {
  const timeA = new Date(tradeA.exitTime || tradeA.entryTime || tradeA.date);
  const timeB = new Date(tradeB.entryTime || tradeB.date);
  return Math.abs(timeB - timeA) / 60000;
};

const sortChronologically = (trades) => {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.entryTime || a.date);
    const dateB = new Date(b.entryTime || b.date);
    return dateA - dateB;
  });
};

const getTradeDurationMinutes = (trade) => {
  if (!trade.entryTime || !trade.exitTime) return null;
  const entry = new Date(trade.entryTime);
  const exit = new Date(trade.exitTime);
  if (isNaN(entry) || isNaN(exit)) return null;
  return (exit - entry) / 60000;
};

const getResult = (trade) => Number(trade.result) || 0;

const applyPenalty = (confidence, trade) => {
  if (trade.lowResolution) return Math.max(0, confidence - DEFAULT_CONFIG.lowResolutionPenalty);
  return confidence;
};

// --- Layer 1 detectors (simplified for CF — same logic as client) ---

const detectHoldAsymmetry = (trade, adjacent) => {
  const duration = getTradeDurationMinutes(trade);
  if (duration == null || duration <= 0 || getResult(trade) >= 0) return null;
  const winDurations = adjacent
    .map(t => ({ d: getTradeDurationMinutes(t), r: getResult(t) }))
    .filter(t => t.d > 0 && t.r > 0).map(t => t.d);
  if (winDurations.length < DEFAULT_CONFIG.holdAsymmetry.minSampleSize) return null;
  const avg = winDurations.reduce((a, b) => a + b, 0) / winDurations.length;
  if (avg <= 0) return null;
  const ratio = duration / avg;
  if (ratio <= DEFAULT_CONFIG.holdAsymmetry.multiplier) return null;
  return {
    code: 'HOLD_ASYMMETRY',
    severity: ratio >= 6 ? 'HIGH' : ratio >= 4 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.95, 0.6 + (ratio - 3) * 0.1), trade),
    emotionMapping: EMOTION_MAPPING.HOLD_ASYMMETRY,
    layer: 1,
    evidence: { tradeDurationMinutes: Math.round(duration * 10) / 10, avgWinDurationMinutes: Math.round(avg * 10) / 10, ratio: Math.round(ratio * 10) / 10 }
  };
};

const detectRevengeCluster = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  if (getResult(prev) >= 0) return null;
  const interval = getMinutesBetween(prev, trade);
  if (interval > DEFAULT_CONFIG.revengeCluster.maxIntervalMinutes) return null;
  let count = 1;
  for (let i = idx + 1; i < sorted.length; i++) {
    if (getMinutesBetween(sorted[i - 1], sorted[i]) <= DEFAULT_CONFIG.revengeCluster.maxIntervalMinutes) count++;
    else break;
  }
  if (count < DEFAULT_CONFIG.revengeCluster.minTrades) return null;
  return {
    code: 'REVENGE_CLUSTER', severity: count >= 4 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.95, 0.7 + count * 0.05), trade),
    emotionMapping: EMOTION_MAPPING.REVENGE_CLUSTER, layer: 1,
    evidence: { previousLoss: getResult(prev), intervalMinutes: Math.round(interval * 10) / 10, clusterCount: count }
  };
};

const detectOvertrading = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const cfg = DEFAULT_CONFIG.overtrading;
  const sameDayAll = [...adjacent.filter(t => t.date === trade.date), trade];
  if (sameDayAll.length <= cfg.maxTradesInWindow) return null;
  const tradeTime = new Date(trade.entryTime);
  const inWindow = sameDayAll.filter(t => t.entryTime && Math.abs(new Date(t.entryTime) - tradeTime) / 60000 <= cfg.windowMinutes);
  if (inWindow.length <= cfg.maxTradesInWindow) return null;
  return {
    code: 'OVERTRADING',
    severity: inWindow.length >= cfg.maxTradesInWindow * 2 ? 'HIGH' : inWindow.length >= cfg.maxTradesInWindow * 1.5 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.85, trade), emotionMapping: EMOTION_MAPPING.OVERTRADING, layer: 1,
    evidence: { tradesInWindow: inWindow.length, threshold: cfg.maxTradesInWindow }
  };
};

const detectImpulseCluster = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const cfg = DEFAULT_CONFIG.impulseCluster;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  let count = 1;
  for (let i = idx - 1; i >= 0; i--) {
    if (getMinutesBetween(sorted[i], sorted[i + 1]) <= cfg.maxIntervalMinutes) count++;
    else break;
  }
  for (let i = idx + 1; i < sorted.length; i++) {
    if (getMinutesBetween(sorted[i - 1], sorted[i]) <= cfg.maxIntervalMinutes) count++;
    else break;
  }
  if (count < cfg.minTrades) return null;
  return {
    code: 'IMPULSE_CLUSTER',
    severity: count >= 4 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.85, 0.6 + count * 0.08), trade),
    emotionMapping: EMOTION_MAPPING.IMPULSE_CLUSTER, layer: 1,
    evidence: { clusterCount: count }
  };
};

const detectCleanExecution = (trade, otherPatterns) => {
  if (otherPatterns.some(p => p && p.code !== 'CLEAN_EXECUTION' && p.code !== 'TARGET_HIT')) return null;
  if (!trade.stopLoss || trade.stopLoss <= 0 || getResult(trade) <= 0) return null;
  const rrRespected = trade.rrRatio != null && trade.rrRatio >= 1.0;
  return {
    code: 'CLEAN_EXECUTION', severity: 'NONE',
    confidence: applyPenalty(rrRespected ? 0.90 : 0.70, trade),
    emotionMapping: EMOTION_MAPPING.CLEAN_EXECUTION, layer: 1,
    evidence: { hasStop: true, rrRatio: trade.rrRatio, result: getResult(trade) }
  };
};

const detectTargetHit = (trade) => {
  if (getResult(trade) <= 0 || trade.rrRatio == null || trade.rrAssumed) return null;
  const { stopLoss, entry, exit } = trade;
  if (!stopLoss || !entry || !exit) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return null;
  const planRR = trade.planRR || 2.0;
  const side = trade.side === 'SHORT' ? -1 : 1;
  const target = entry + (side * risk * planRR);
  const tolerance = risk * planRR * DEFAULT_CONFIG.targetHit.tolerancePct;
  if (Math.abs(exit - target) > tolerance) return null;
  return {
    code: 'TARGET_HIT', severity: 'NONE',
    confidence: applyPenalty(0.85, trade),
    emotionMapping: EMOTION_MAPPING.TARGET_HIT, layer: 1,
    evidence: { exitPrice: exit, targetPrice: Math.round(target * 100) / 100, planRR }
  };
};

const detectDirectionFlip = (trade, adjacent) => {
  if (!trade.entryTime || !trade.side) return null;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  if (getResult(prev) >= 0) return null;
  const prevTicker = prev.ticker || prev.instrument;
  const currTicker = trade.ticker || trade.instrument;
  if (!prevTicker || !currTicker || prevTicker !== currTicker) return null;
  if (!prev.side || prev.side === trade.side) return null;
  const interval = getMinutesBetween(prev, trade);
  if (interval > DEFAULT_CONFIG.directionFlip.maxIntervalMinutes) return null;
  return {
    code: 'DIRECTION_FLIP',
    severity: interval <= 15 ? 'HIGH' : interval <= 60 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.90, trade),
    emotionMapping: EMOTION_MAPPING.DIRECTION_FLIP, layer: 1,
    evidence: {
      previousSide: prev.side, previousResult: getResult(prev),
      currentSide: trade.side, instrument: currTicker,
      intervalMinutes: Math.round(interval * 10) / 10
    }
  };
};

const detectUndersizedTrade = (trade) => {
  const actualPct = trade.riskPercent;
  const planPct = trade.planRoPct;
  if (actualPct == null || planPct == null || planPct <= 0 || actualPct <= 0) return null;
  const cfg = DEFAULT_CONFIG.undersizedTrade;
  const ratio = actualPct / planPct;
  if (ratio >= cfg.ratioThreshold) return null;
  return {
    code: 'UNDERSIZED_TRADE',
    severity: ratio < cfg.highRatio ? 'HIGH' : ratio < cfg.mediumRatio ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.90, trade),
    emotionMapping: EMOTION_MAPPING.UNDERSIZED_TRADE,
    layer: 1,
    evidence: {
      actualRiskPct: Math.round(actualPct * 100) / 100,
      planRoPct: Math.round(planPct * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      utilizationPct: Math.round(ratio * 10000) / 100
    }
  };
};

// --- Layer 2 detectors ---

const detectHesitation = (trade, orders) => {
  if (!orders || !orders.length || !trade.entryTime) return null;
  const entryTime = new Date(trade.entryTime);
  const cancels = orders.filter(o => o.status === 'CANCELLED' && new Date(o.cancelledAt || o.submittedAt) < entryTime);
  if (cancels.length < DEFAULT_CONFIG.hesitation.minCancels) return null;
  return {
    code: 'HESITATION',
    severity: cancels.length >= 4 ? 'HIGH' : cancels.length >= 3 ? 'MEDIUM' : 'LOW',
    confidence: 0.90, emotionMapping: EMOTION_MAPPING.HESITATION, layer: 2,
    evidence: { cancelledOrdersCount: cancels.length }
  };
};

const detectEarlyExit = (trade, orders) => {
  if (getResult(trade) <= 0 || trade.rrRatio == null || trade.rrAssumed) return null;
  const planRR = trade.planRR || 2.0;
  if (trade.rrRatio >= planRR * DEFAULT_CONFIG.earlyExit.rrThresholdPct) return null;
  if (orders && orders.some(o => o.isStopOrder && o.status === 'FILLED')) return null;
  return {
    code: 'EARLY_EXIT',
    severity: trade.rrRatio < planRR * 0.25 ? 'HIGH' : trade.rrRatio < planRR * 0.40 ? 'MEDIUM' : 'LOW',
    confidence: orders && orders.length > 0 ? 0.85 : 0.65,
    emotionMapping: EMOTION_MAPPING.EARLY_EXIT, layer: orders && orders.length > 0 ? 2 : 1,
    evidence: { actualRR: trade.rrRatio, planRR, rrAchievedPct: Math.round((trade.rrRatio / planRR) * 100) }
  };
};

// --- Main analyzer (CF version) ---

const analyzeShadowForTradeCF = (trade, adjacent, orders) => {
  if (!trade || !trade.id) return null;
  const patterns = [];

  const h = detectHoldAsymmetry(trade, adjacent);
  if (h) patterns.push(h);
  const r = detectRevengeCluster(trade, adjacent);
  if (r) patterns.push(r);
  const o = detectOvertrading(trade, adjacent);
  if (o) patterns.push(o);
  const imp = detectImpulseCluster(trade, adjacent);
  if (imp) patterns.push(imp);
  const t = detectTargetHit(trade);
  if (t) patterns.push(t);
  const df = detectDirectionFlip(trade, adjacent);
  if (df) patterns.push(df);
  const us = detectUndersizedTrade(trade);
  if (us) patterns.push(us);
  const e = detectEarlyExit(trade, orders);
  if (e) patterns.push(e);

  if (orders && orders.length > 0) {
    const hes = detectHesitation(trade, orders);
    if (hes) patterns.push(hes);
  }

  const clean = detectCleanExecution(trade, patterns);
  if (clean) patterns.push(clean);

  const resolution = (orders && orders.length > 0) ? RESOLUTION.HIGH
    : trade.enrichedByImport ? RESOLUTION.MEDIUM : RESOLUTION.LOW;

  return {
    patterns,
    resolution,
    marketContext: {
      instrument: trade.ticker || null,
      session: null,
      atr: null
    },
    analyzedAt: new Date().toISOString(),
    orderCount: orders ? orders.length : 0,
    version: SHADOW_VERSION
  };
};

// ============================================
// CF callable
// ============================================

module.exports = onCall({ maxInstances: 10 }, async (request) => {
  const { studentId, dateFrom, dateTo } = request.data || {};

  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId é obrigatório');
  }

  const db = getFirestore();

  // Fetch trades for student in period
  // Query single-field por studentId (nao requer indice composto novo).
  // Filtro por periodo aplicado client-side — sem orderBy na query para evitar
  // dependencia de indice ASC especifico (o existente `studentId + date DESC`
  // nao serve para range query sem orderBy correspondente).
  const tradesSnap = await db.collection('trades').where('studentId', '==', studentId).get();
  if (tradesSnap.empty) {
    return { analyzed: 0, total: 0, ordersFound: 0, message: 'Nenhum trade encontrado para o aluno.' };
  }

  const allStudentTrades = tradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const trades = allStudentTrades.filter(t => {
    if (dateFrom && (t.date || '') < dateFrom) return false;
    if (dateTo && (t.date || '') > dateTo) return false;
    return true;
  });

  if (trades.length === 0) {
    return { analyzed: 0, total: 0, ordersFound: 0, message: 'Nenhum trade encontrado no período.' };
  }

  const sorted = sortChronologically(trades);

  // Enrich trades with planRoPct (for UNDERSIZED_TRADE detector)
  const planIds = [...new Set(sorted.map(t => t.planId).filter(Boolean))];
  const plansById = {};
  await Promise.all(planIds.map(async (pid) => {
    const planDoc = await db.collection('plans').doc(pid).get();
    if (planDoc.exists) {
      plansById[pid] = planDoc.data();
    }
  }));
  for (const trade of sorted) {
    if (trade.planId && plansById[trade.planId]) {
      trade.planRoPct = plansById[trade.planId].riskPerOperation ?? null;
    }
  }

  // Fetch orders by studentId (single-field, nao requer indice composto).
  // orders docs nao tem campo `date` canonico — so submittedAt/filledAt/importedAt.
  // Amarramos ao periodo via correlatedTradeId x trades do periodo.
  const ordersSnap = await db.collection('orders').where('studentId', '==', studentId).get();
  const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const tradeIdsInPeriod = new Set(trades.map(t => t.id));
  const ordersByTradeId = {};
  for (const order of allOrders) {
    const tradeId = order.correlatedTradeId;
    if (tradeId && tradeIdsInPeriod.has(tradeId)) {
      if (!ordersByTradeId[tradeId]) ordersByTradeId[tradeId] = [];
      ordersByTradeId[tradeId].push(order);
    }
  }

  // Analyze each trade
  const batch = db.batch();
  let analyzed = 0;

  for (const trade of sorted) {
    const adjacent = sorted.filter(t =>
      t.id !== trade.id && t.studentId === trade.studentId && t.date === trade.date
    );
    const orders = ordersByTradeId[trade.id] || null;
    const shadow = analyzeShadowForTradeCF(trade, adjacent, orders);

    if (shadow) {
      const tradeRef = db.collection('trades').doc(trade.id);
      batch.update(tradeRef, { shadowBehavior: shadow, updatedAt: FieldValue.serverTimestamp() });
      analyzed++;
    }
  }

  if (analyzed > 0) {
    await batch.commit();
  }

  console.log(`[analyzeShadowBehavior] ${analyzed}/${trades.length} trades analisados para ${studentId} (${dateFrom || '*'} a ${dateTo || '*'})`);

  return {
    analyzed,
    total: trades.length,
    ordersFound: allOrders.length,
    message: `${analyzed} trades analisados com shadow behavior.`
  };
});
