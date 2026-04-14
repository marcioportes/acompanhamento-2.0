/**
 * Shadow Behavior Analysis Engine v1.0
 *
 * Analyzes behavioral patterns per trade using _partials + adjacent trades context.
 * Layer 1: All trades (partials + inter-trade context) — no external dependency
 * Layer 2: When orders exist (enrichment from broker data)
 *
 * @module shadowBehaviorAnalysis
 * @see Issue #129 — Shadow Trade + Padrões Comportamentais
 * @see Epic #128 — Pipeline Unificado de Import de Ordens
 */

import { getInstrument } from '../constants/instrumentsTable.js';

// ============================================
// CONSTANTS & CONFIG
// ============================================

export const SHADOW_VERSION = '1.0';

export const RESOLUTION = {
  HIGH: 'HIGH',     // orders brutas disponíveis
  MEDIUM: 'MEDIUM', // parciais enriquecidas, sem orders brutas
  LOW: 'LOW'        // só parciais estáticas + contexto inter-trade
};

export const SEVERITY = {
  NONE: 'NONE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

export const PATTERN_CODES = {
  // Layer 1 — all trades
  HOLD_ASYMMETRY: 'HOLD_ASYMMETRY',
  REVENGE_CLUSTER: 'REVENGE_CLUSTER',
  GREED_CLUSTER: 'GREED_CLUSTER',
  OVERTRADING: 'OVERTRADING',
  IMPULSE_CLUSTER: 'IMPULSE_CLUSTER',
  CLEAN_EXECUTION: 'CLEAN_EXECUTION',
  TARGET_HIT: 'TARGET_HIT',
  DIRECTION_FLIP: 'DIRECTION_FLIP',
  UNDERSIZED_TRADE: 'UNDERSIZED_TRADE',
  // Layer 2 — when orders exist
  HESITATION: 'HESITATION',
  STOP_PANIC: 'STOP_PANIC',
  FOMO_ENTRY: 'FOMO_ENTRY',
  EARLY_EXIT: 'EARLY_EXIT',
  LATE_EXIT: 'LATE_EXIT',
  AVERAGING_DOWN: 'AVERAGING_DOWN'
};

export const EMOTION_MAPPING = {
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

export const DEFAULT_CONFIG = {
  holdAsymmetry: {
    multiplier: 3.0,         // loss duration > 3x win average
    minSampleSize: 3         // minimum trades to calculate average
  },
  revengeCluster: {
    maxIntervalMinutes: 5,   // 2+ trades within 5min after loss
    minTrades: 2
  },
  greedCluster: {
    maxIntervalMinutes: 10,  // 3+ trades within 10min after win
    minTrades: 3
  },
  overtrading: {
    windowMinutes: 60,       // configurable window (DEC-048)
    maxTradesInWindow: 5
  },
  impulseCluster: {
    maxIntervalMinutes: 2,   // 2+ trades within 2min
    minTrades: 2
  },
  targetHit: {
    tolerancePct: 0.05       // exit within ±5% of target
  },
  earlyExit: {
    rrThresholdPct: 0.50     // exit < 50% of RR target
  },
  directionFlip: {
    maxIntervalMinutes: 120  // flip direction dentro de 2h após loss → viés/narrativa
  },
  undersizedTrade: {
    ratioThreshold: 0.50,    // riskPercent < 50% do plan.riskPerOperation → flag
    highRatio: 0.25,         // < 25% = HIGH (4x menor que planejado)
    mediumRatio: 0.40        // < 40% = MEDIUM
  },
  hesitation: {
    minCancels: 2            // 2+ cancels before fill
  },
  stopPanic: {
    maxExitMinutes: 5        // widened + exit < 5min
  },
  fomoEntry: {
    minDelayMinutes: 10,     // creation→execution > 10min
    orderType: 'MARKET'
  },
  lateExit: {
    minDelayMinutes: 15      // exit > 15min after stop removed
  },
  lowResolutionPenalty: 0.3  // confidence reduced by 30% for minute-only timestamps
};

// ============================================
// HELPERS
// ============================================

const getMinutesBetween = (tradeA, tradeB) => {
  const timeA = new Date(tradeA.exitTime || tradeA.entryTime || tradeA.date);
  const timeB = new Date(tradeB.entryTime || tradeB.date);
  return Math.abs(timeB - timeA) / 60000;
};

const getMinutesBetweenTimestamps = (tsA, tsB) => {
  const a = new Date(tsA);
  const b = new Date(tsB);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.abs(b - a) / 60000;
};

const sortTradesChronologically = (trades) => {
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

const getTradeResult = (trade) => {
  return Number(trade.result) || 0;
};

const applyConfidencePenalty = (baseConfidence, trade, config) => {
  if (trade.lowResolution) {
    return Math.max(0, baseConfidence - (config.lowResolutionPenalty ?? DEFAULT_CONFIG.lowResolutionPenalty));
  }
  return baseConfidence;
};

const determineSession = (trade) => {
  const entryTime = trade.entryTime;
  if (!entryTime) return null;
  const d = new Date(entryTime);
  if (isNaN(d)) return null;
  const hour = d.getUTCHours();
  // EST = UTC-5 (approximate, ignoring DST for simplicity)
  const estHour = (hour - 5 + 24) % 24;
  if (estHour >= 18 || estHour < 1) return 'ASIA';
  if (estHour >= 1 && estHour < 8) return 'LONDON';
  return 'NY';
};

const buildMarketContext = (trade) => {
  const ticker = trade.ticker || trade.instrument;
  const instrument = ticker ? getInstrument(ticker) : null;
  return {
    atr: instrument?.atr ?? null,
    session: determineSession(trade),
    instrument: instrument?.symbol ?? ticker ?? null
  };
};

// ============================================
// LAYER 1 DETECTORS — all trades
// ============================================

export const detectHoldAsymmetry = (trade, adjacentTrades, config = DEFAULT_CONFIG.holdAsymmetry) => {
  const duration = getTradeDurationMinutes(trade);
  if (duration == null || duration <= 0) return null;

  const result = getTradeResult(trade);
  if (result >= 0) return null; // only flag losses held too long

  // Calculate average win duration from adjacent trades
  const winDurations = adjacentTrades
    .map(t => ({ duration: getTradeDurationMinutes(t), result: getTradeResult(t) }))
    .filter(t => t.duration != null && t.duration > 0 && t.result > 0)
    .map(t => t.duration);

  if (winDurations.length < config.minSampleSize) return null;

  const avgWinDuration = winDurations.reduce((a, b) => a + b, 0) / winDurations.length;
  if (avgWinDuration <= 0) return null;

  const ratio = duration / avgWinDuration;
  if (ratio <= config.multiplier) return null;

  const severity = ratio >= 6 ? SEVERITY.HIGH : ratio >= 4 ? SEVERITY.MEDIUM : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.HOLD_ASYMMETRY,
    severity,
    confidence: applyConfidencePenalty(Math.min(0.95, 0.6 + (ratio - config.multiplier) * 0.1), trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.HOLD_ASYMMETRY,
    layer: 1,
    evidence: {
      tradeDurationMinutes: Math.round(duration * 10) / 10,
      avgWinDurationMinutes: Math.round(avgWinDuration * 10) / 10,
      ratio: Math.round(ratio * 10) / 10,
      sampleSize: winDurations.length
    }
  };
};

export const detectRevengeCluster = (trade, adjacentTrades, config = DEFAULT_CONFIG.revengeCluster) => {
  if (!trade.entryTime) return null;

  const sorted = sortTradesChronologically([...adjacentTrades, trade]);
  const tradeIndex = sorted.findIndex(t => t.id === trade.id);
  if (tradeIndex <= 0) return null;

  // Look for a preceding loss
  const prevTrade = sorted[tradeIndex - 1];
  if (getTradeResult(prevTrade) >= 0) return null;

  const interval = getMinutesBetween(prevTrade, trade);
  if (interval > config.maxIntervalMinutes) return null;

  // Count rapid trades after the loss (including this one)
  let clusterCount = 1;
  for (let i = tradeIndex + 1; i < sorted.length; i++) {
    const gap = getMinutesBetween(sorted[i - 1], sorted[i]);
    if (gap <= config.maxIntervalMinutes) {
      clusterCount++;
    } else {
      break;
    }
  }

  if (clusterCount < config.minTrades) return null;

  const severity = clusterCount >= 4 ? SEVERITY.HIGH : clusterCount >= 3 ? SEVERITY.MEDIUM : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.REVENGE_CLUSTER,
    severity,
    confidence: applyConfidencePenalty(Math.min(0.95, 0.7 + clusterCount * 0.05), trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.REVENGE_CLUSTER,
    layer: 1,
    evidence: {
      previousLoss: getTradeResult(prevTrade),
      intervalMinutes: Math.round(interval * 10) / 10,
      clusterCount,
      previousTradeId: prevTrade.id
    }
  };
};

export const detectGreedCluster = (trade, adjacentTrades, config = DEFAULT_CONFIG.greedCluster) => {
  if (!trade.entryTime) return null;

  const sorted = sortTradesChronologically([...adjacentTrades, trade]);
  const tradeIndex = sorted.findIndex(t => t.id === trade.id);
  if (tradeIndex <= 0) return null;

  // Look for preceding consecutive wins
  let consecutiveWins = 0;
  for (let i = tradeIndex - 1; i >= 0; i--) {
    if (getTradeResult(sorted[i]) > 0) {
      consecutiveWins++;
    } else {
      break;
    }
  }
  if (consecutiveWins === 0) return null;

  // Count rapid trades in window after the win streak started
  const windowStart = sorted[tradeIndex - consecutiveWins];
  let rapidCount = 0;
  for (let i = tradeIndex - consecutiveWins; i <= tradeIndex; i++) {
    const interval = getMinutesBetween(windowStart, sorted[i]);
    if (interval <= config.maxIntervalMinutes) {
      rapidCount++;
    }
  }

  if (rapidCount < config.minTrades) return null;

  const severity = rapidCount >= 5 ? SEVERITY.HIGH : rapidCount >= 4 ? SEVERITY.MEDIUM : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.GREED_CLUSTER,
    severity,
    confidence: applyConfidencePenalty(Math.min(0.90, 0.6 + rapidCount * 0.05), trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.GREED_CLUSTER,
    layer: 1,
    evidence: {
      consecutiveWinsBefore: consecutiveWins,
      rapidTradesInWindow: rapidCount,
      windowMinutes: config.maxIntervalMinutes
    }
  };
};

export const detectOvertrading = (trade, adjacentTrades, config = DEFAULT_CONFIG.overtrading) => {
  if (!trade.entryTime) return null;

  // Filter trades on the same day
  const sameDayTrades = adjacentTrades.filter(t => t.date === trade.date);
  const allDayTrades = [...sameDayTrades, trade];

  if (allDayTrades.length <= config.maxTradesInWindow) return null;

  // Check clustering in temporal window around this trade
  const tradeTime = new Date(trade.entryTime);
  const tradesInWindow = allDayTrades.filter(t => {
    if (!t.entryTime) return false;
    const delta = Math.abs(new Date(t.entryTime) - tradeTime) / 60000;
    return delta <= config.windowMinutes;
  });

  if (tradesInWindow.length <= config.maxTradesInWindow) return null;

  const severity = tradesInWindow.length >= config.maxTradesInWindow * 2
    ? SEVERITY.HIGH
    : tradesInWindow.length >= config.maxTradesInWindow * 1.5
      ? SEVERITY.MEDIUM
      : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.OVERTRADING,
    severity,
    confidence: applyConfidencePenalty(0.85, trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.OVERTRADING,
    layer: 1,
    evidence: {
      tradesInWindow: tradesInWindow.length,
      windowMinutes: config.windowMinutes,
      threshold: config.maxTradesInWindow,
      totalDayTrades: allDayTrades.length
    }
  };
};

export const detectImpulseCluster = (trade, adjacentTrades, config = DEFAULT_CONFIG.impulseCluster) => {
  if (!trade.entryTime) return null;

  const sorted = sortTradesChronologically([...adjacentTrades, trade]);
  const tradeIndex = sorted.findIndex(t => t.id === trade.id);

  // Check if there's a trade within impulse window before or after
  let clusterCount = 1;
  const clusterTrades = [trade.id];

  // Look backward
  for (let i = tradeIndex - 1; i >= 0; i--) {
    const gap = getMinutesBetween(sorted[i], sorted[i + 1]);
    if (gap <= config.maxIntervalMinutes) {
      clusterCount++;
      clusterTrades.push(sorted[i].id);
    } else {
      break;
    }
  }

  // Look forward
  for (let i = tradeIndex + 1; i < sorted.length; i++) {
    const gap = getMinutesBetween(sorted[i - 1], sorted[i]);
    if (gap <= config.maxIntervalMinutes) {
      clusterCount++;
      clusterTrades.push(sorted[i].id);
    } else {
      break;
    }
  }

  if (clusterCount < config.minTrades) return null;

  return {
    code: PATTERN_CODES.IMPULSE_CLUSTER,
    severity: clusterCount >= 4 ? SEVERITY.HIGH : clusterCount >= 3 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: applyConfidencePenalty(
      Math.min(0.85, 0.6 + clusterCount * 0.08),
      trade,
      DEFAULT_CONFIG
    ),
    emotionMapping: EMOTION_MAPPING.IMPULSE_CLUSTER,
    layer: 1,
    evidence: {
      clusterCount,
      maxIntervalMinutes: config.maxIntervalMinutes,
      clusterTradeIds: clusterTrades
    }
  };
};

export const detectCleanExecution = (trade, adjacentTrades, otherPatterns = []) => {
  // Clean execution = no negative patterns detected + stop present + RR respected
  const hasNegativePattern = otherPatterns.some(p =>
    p != null && p.code !== PATTERN_CODES.CLEAN_EXECUTION && p.code !== PATTERN_CODES.TARGET_HIT
  );
  if (hasNegativePattern) return null;

  const hasStop = trade.stopLoss != null && trade.stopLoss > 0;
  const result = getTradeResult(trade);
  if (result <= 0) return null; // must be a winner

  const rrRatio = trade.rrRatio ?? null;
  const rrRespected = rrRatio != null && rrRatio >= 1.0;

  if (!hasStop) return null; // stop is required for clean execution

  const confidence = rrRespected ? 0.90 : 0.70;

  return {
    code: PATTERN_CODES.CLEAN_EXECUTION,
    severity: SEVERITY.NONE, // positive pattern — no severity
    confidence: applyConfidencePenalty(confidence, trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.CLEAN_EXECUTION,
    layer: 1,
    evidence: {
      hasStop,
      rrRatio,
      rrRespected,
      result
    }
  };
};

export const detectTargetHit = (trade, _adjacentTrades, config = DEFAULT_CONFIG.targetHit) => {
  const result = getTradeResult(trade);
  if (result <= 0) return null;

  const rrRatio = trade.rrRatio ?? null;
  if (rrRatio == null) return null;

  // Check if the exit was close to the planned RR target
  // Target RR comes from the plan; if rrAssumed we don't know the real target
  if (trade.rrAssumed) return null;

  const stopLoss = trade.stopLoss;
  const entry = trade.entry;
  const exit = trade.exit;
  if (stopLoss == null || entry == null || exit == null) return null;

  const riskDistance = Math.abs(entry - stopLoss);
  if (riskDistance <= 0) return null;

  // Planned target based on plan RR (minimum 2:1 default)
  const planRR = trade.planRR ?? 2.0;
  const side = trade.side === 'SHORT' ? -1 : 1;
  const targetPrice = entry + (side * riskDistance * planRR);
  const tolerance = riskDistance * planRR * config.tolerancePct;

  if (Math.abs(exit - targetPrice) <= tolerance) {
    return {
      code: PATTERN_CODES.TARGET_HIT,
      severity: SEVERITY.NONE, // positive pattern
      confidence: applyConfidencePenalty(0.85, trade, DEFAULT_CONFIG),
      emotionMapping: EMOTION_MAPPING.TARGET_HIT,
      layer: 1,
      evidence: {
        exitPrice: exit,
        targetPrice: Math.round(targetPrice * 100) / 100,
        tolerancePrice: Math.round(tolerance * 100) / 100,
        planRR,
        actualRR: rrRatio
      }
    };
  }

  return null;
};

/**
 * DIRECTION_FLIP — virada de direção no mesmo instrumento após loss.
 * Sinaliza viés/narrativa quebrada: trader não entendeu direção do mercado,
 * não aceitou o erro do primeiro setup, ou está operando por reação.
 * Janela 120min (2h) — além disso, é um novo setup legítimo.
 */
export const detectDirectionFlip = (trade, adjacentTrades, config = DEFAULT_CONFIG.directionFlip) => {
  if (!trade.entryTime || !trade.side) return null;

  const sorted = sortTradesChronologically([...adjacentTrades, trade]);
  const tradeIndex = sorted.findIndex(t => t.id === trade.id);
  if (tradeIndex <= 0) return null;

  const prev = sorted[tradeIndex - 1];
  // Gate 1: trade anterior foi loss
  if (getTradeResult(prev) >= 0) return null;
  // Gate 2: mesmo instrumento
  const prevTicker = prev.ticker || prev.instrument;
  const currTicker = trade.ticker || trade.instrument;
  if (!prevTicker || !currTicker || prevTicker !== currTicker) return null;
  // Gate 3: side oposto
  if (!prev.side || prev.side === trade.side) return null;
  // Gate 4: janela temporal
  const interval = getMinutesBetween(prev, trade);
  if (interval > config.maxIntervalMinutes) return null;

  const severity = interval <= 15 ? SEVERITY.HIGH
    : interval <= 60 ? SEVERITY.MEDIUM
      : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.DIRECTION_FLIP,
    severity,
    confidence: applyConfidencePenalty(0.90, trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.DIRECTION_FLIP,
    layer: 1,
    evidence: {
      previousSide: prev.side,
      previousResult: getTradeResult(prev),
      currentSide: trade.side,
      instrument: currTicker,
      intervalMinutes: Math.round(interval * 10) / 10,
      previousTradeId: prev.id
    }
  };
};

/**
 * UNDERSIZED_TRADE — operacao com risco real muito abaixo do RO planejado.
 * Sinaliza disfuncao financeira: trader teme o plano e silenciosamente subdimensiona,
 * inflando RR estatistico mas escondendo desalinhamento com o plano de capital.
 * Se ha medo do RO, o ajuste correto e renegociar o plano — nao subdimensionar a operacao.
 *
 * Pre-requisito: caller enriquece trade com `planRoPct` (do plan.riskPerOperation).
 * Sem planRoPct ou riskPercent → detector silencioso (retorna null).
 */
export const detectUndersizedTrade = (trade, _adjacentTrades, config = DEFAULT_CONFIG.undersizedTrade) => {
  const actualPct = trade.riskPercent;
  const planPct = trade.planRoPct;

  if (actualPct == null || planPct == null) return null;
  if (planPct <= 0 || actualPct <= 0) return null;

  const ratio = actualPct / planPct;
  if (ratio >= config.ratioThreshold) return null;

  const severity = ratio < config.highRatio ? SEVERITY.HIGH
    : ratio < config.mediumRatio ? SEVERITY.MEDIUM
      : SEVERITY.LOW;

  return {
    code: PATTERN_CODES.UNDERSIZED_TRADE,
    severity,
    confidence: applyConfidencePenalty(0.90, trade, DEFAULT_CONFIG),
    emotionMapping: EMOTION_MAPPING.UNDERSIZED_TRADE,
    layer: 1,
    evidence: {
      actualRiskPct: Math.round(actualPct * 100) / 100,
      planRoPct: Math.round(planPct * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      utilizationPct: Math.round(ratio * 10000) / 100  // ex: 25.00 = usou 25% do RO
    }
  };
};

// ============================================
// LAYER 2 DETECTORS — when orders exist
// ============================================

export const detectHesitation = (trade, orders, config = DEFAULT_CONFIG.hesitation) => {
  if (!orders || orders.length === 0) return null;

  // Find cancelled orders before the trade entry
  const entryTime = new Date(trade.entryTime);
  if (isNaN(entryTime)) return null;

  const cancelledBefore = orders.filter(o => {
    if (o.status !== 'CANCELLED') return false;
    const cancelTime = new Date(o.cancelledAt || o.submittedAt);
    return !isNaN(cancelTime) && cancelTime < entryTime;
  });

  if (cancelledBefore.length < config.minCancels) return null;

  // Calculate hesitation time: first cancel to actual entry
  const firstCancelTime = cancelledBefore
    .map(o => new Date(o.submittedAt))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b)[0];

  const hesitationMinutes = firstCancelTime
    ? (entryTime - firstCancelTime) / 60000
    : null;

  return {
    code: PATTERN_CODES.HESITATION,
    severity: cancelledBefore.length >= 4 ? SEVERITY.HIGH : cancelledBefore.length >= 3 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: 0.90,
    emotionMapping: EMOTION_MAPPING.HESITATION,
    layer: 2,
    evidence: {
      cancelledOrdersCount: cancelledBefore.length,
      hesitationMinutes: hesitationMinutes != null ? Math.round(hesitationMinutes * 10) / 10 : null,
      cancelledOrderIds: cancelledBefore.map(o => o.externalOrderId)
    }
  };
};

export const detectStopPanic = (trade, orders, config = DEFAULT_CONFIG.stopPanic) => {
  if (!orders || orders.length === 0) return null;

  // Look for stop movement analysis data — WIDENED flags
  const stopOrders = orders.filter(o => o.isStopOrder);
  if (stopOrders.length === 0) return null;

  // Check if any stop was widened
  const widenedOrders = orders.filter(o =>
    o.status === 'MODIFIED' || o.status === 'CANCELLED'
  ).filter(o => o.isStopOrder);

  if (widenedOrders.length === 0) return null;

  // Check for rapid exit after widening
  const exitTime = new Date(trade.exitTime);
  if (isNaN(exitTime)) return null;

  const lastWiden = widenedOrders
    .map(o => new Date(o.lastUpdatedAt || o.cancelledAt || o.submittedAt))
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a)[0];

  if (!lastWiden) return null;

  const exitAfterWidenMinutes = (exitTime - lastWiden) / 60000;
  if (exitAfterWidenMinutes < 0 || exitAfterWidenMinutes > config.maxExitMinutes) return null;

  return {
    code: PATTERN_CODES.STOP_PANIC,
    severity: exitAfterWidenMinutes <= 1 ? SEVERITY.HIGH : exitAfterWidenMinutes <= 3 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: 0.85,
    emotionMapping: EMOTION_MAPPING.STOP_PANIC,
    layer: 2,
    evidence: {
      widenedStopCount: widenedOrders.length,
      exitAfterWidenMinutes: Math.round(exitAfterWidenMinutes * 10) / 10
    }
  };
};

export const detectFomoEntry = (trade, orders, config = DEFAULT_CONFIG.fomoEntry) => {
  if (!orders || orders.length === 0) return null;

  // Find the entry orders (filled, same side as trade)
  const entryOrders = orders.filter(o =>
    (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') &&
    !o.isStopOrder &&
    o.orderType === config.orderType
  );

  if (entryOrders.length === 0) return null;

  // Check creation→execution delay
  const delays = entryOrders
    .map(o => {
      const submitted = new Date(o.submittedAt);
      const filled = new Date(o.filledAt || o.submittedAt);
      if (isNaN(submitted) || isNaN(filled)) return null;
      return (filled - submitted) / 60000;
    })
    .filter(d => d != null && d > 0);

  if (delays.length === 0) return null;

  const maxDelay = Math.max(...delays);
  if (maxDelay < config.minDelayMinutes) return null;

  return {
    code: PATTERN_CODES.FOMO_ENTRY,
    severity: maxDelay >= 30 ? SEVERITY.HIGH : maxDelay >= 20 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: 0.75,
    emotionMapping: EMOTION_MAPPING.FOMO_ENTRY,
    layer: 2,
    evidence: {
      marketOrderCount: entryOrders.length,
      maxDelayMinutes: Math.round(maxDelay * 10) / 10,
      avgDelayMinutes: Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10
    }
  };
};

export const detectEarlyExit = (trade, orders, config = DEFAULT_CONFIG.earlyExit) => {
  const result = getTradeResult(trade);
  if (result <= 0) return null; // must be a winner that exited early

  const rrRatio = trade.rrRatio ?? null;
  if (rrRatio == null || trade.rrAssumed) return null;

  const planRR = trade.planRR ?? 2.0;
  if (rrRatio >= planRR * config.rrThresholdPct) return null; // exit was close enough to target

  // With orders: check that the stop was NOT hit (exit was voluntary)
  if (orders && orders.length > 0) {
    const stopHit = orders.some(o => o.isStopOrder && o.status === 'FILLED');
    if (stopHit) return null; // stop hit is not early exit, it's controlled loss
  }

  return {
    code: PATTERN_CODES.EARLY_EXIT,
    severity: rrRatio < planRR * 0.25 ? SEVERITY.HIGH : rrRatio < planRR * 0.40 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: orders && orders.length > 0 ? 0.85 : 0.65,
    emotionMapping: EMOTION_MAPPING.EARLY_EXIT,
    layer: orders && orders.length > 0 ? 2 : 1,
    evidence: {
      actualRR: rrRatio,
      planRR,
      rrAchievedPct: Math.round((rrRatio / planRR) * 100),
      hasOrderData: orders != null && orders.length > 0
    }
  };
};

export const detectLateExit = (trade, orders, config = DEFAULT_CONFIG.lateExit) => {
  if (!orders || orders.length === 0) return null;

  const result = getTradeResult(trade);
  if (result >= 0) return null; // flag losses where trader held after stop removed

  // Find cancelled stop orders
  const cancelledStops = orders.filter(o =>
    o.isStopOrder && (o.status === 'CANCELLED')
  );

  if (cancelledStops.length === 0) return null;

  const exitTime = new Date(trade.exitTime);
  if (isNaN(exitTime)) return null;

  // Time between last stop cancellation and actual exit
  const lastCancel = cancelledStops
    .map(o => new Date(o.cancelledAt || o.lastUpdatedAt || o.submittedAt))
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a)[0];

  if (!lastCancel) return null;

  const delayMinutes = (exitTime - lastCancel) / 60000;
  if (delayMinutes < config.minDelayMinutes) return null;

  return {
    code: PATTERN_CODES.LATE_EXIT,
    severity: delayMinutes >= 60 ? SEVERITY.HIGH : delayMinutes >= 30 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: 0.85,
    emotionMapping: EMOTION_MAPPING.LATE_EXIT,
    layer: 2,
    evidence: {
      delayMinutes: Math.round(delayMinutes * 10) / 10,
      cancelledStopCount: cancelledStops.length,
      tradeResult: result
    }
  };
};

export const detectAveragingDown = (trade, orders) => {
  if (!orders || orders.length === 0) return null;

  const side = trade.side;
  if (!side) return null;

  // Find filled orders in the same direction as the trade
  const sameDirection = orders.filter(o =>
    (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') &&
    !o.isStopOrder &&
    o.side === (side === 'LONG' ? 'BUY' : 'SELL')
  ).sort((a, b) => new Date(a.filledAt || a.submittedAt) - new Date(b.filledAt || b.submittedAt));

  if (sameDirection.length < 2) return null;

  // Detect worsening prices (buying higher for LONG or selling lower for SHORT)
  let averagingCount = 0;
  for (let i = 1; i < sameDirection.length; i++) {
    const prevPrice = Number(sameDirection[i - 1].filledPrice || sameDirection[i - 1].price);
    const currPrice = Number(sameDirection[i].filledPrice || sameDirection[i].price);
    if (isNaN(prevPrice) || isNaN(currPrice)) continue;

    // For LONG: adding at higher price after it moved against = averaging down (buying lower)
    // For SHORT: adding at lower price after it moved against = averaging down (selling higher)
    const isWorse = side === 'LONG' ? currPrice < prevPrice : currPrice > prevPrice;
    if (isWorse) averagingCount++;
  }

  if (averagingCount === 0) return null;

  return {
    code: PATTERN_CODES.AVERAGING_DOWN,
    severity: averagingCount >= 3 ? SEVERITY.HIGH : averagingCount >= 2 ? SEVERITY.MEDIUM : SEVERITY.LOW,
    confidence: 0.85,
    emotionMapping: EMOTION_MAPPING.AVERAGING_DOWN,
    layer: 2,
    evidence: {
      averagingCount,
      totalSameDirectionOrders: sameDirection.length,
      side
    }
  };
};

// ============================================
// MAIN ENGINE
// ============================================

const resolveResolution = (trade, orders) => {
  if (orders && orders.length > 0) return RESOLUTION.HIGH;
  if (trade.enrichedByImport) return RESOLUTION.MEDIUM;
  return RESOLUTION.LOW;
};

/**
 * Analyzes shadow behavior for a single trade.
 *
 * @param {Object} trade - The trade document (must include _partials, id, entryTime, exitTime, etc.)
 * @param {Array} adjacentTrades - Other trades from the same student, sorted chronologically
 * @param {Array|null} orders - Optional: orders from collection `orders` correlated to this trade
 * @param {Object} config - Optional: override default detection config
 * @returns {Object} shadowBehavior object ready to be written to trade doc
 */
export const analyzeShadowForTrade = (trade, adjacentTrades = [], orders = null, config = DEFAULT_CONFIG) => {
  if (!trade || !trade.id) return null;

  const patterns = [];

  // --- Layer 1: all trades ---
  const holdAsymmetry = detectHoldAsymmetry(trade, adjacentTrades, config.holdAsymmetry);
  if (holdAsymmetry) patterns.push(holdAsymmetry);

  const revenge = detectRevengeCluster(trade, adjacentTrades, config.revengeCluster);
  if (revenge) patterns.push(revenge);

  const greed = detectGreedCluster(trade, adjacentTrades, config.greedCluster);
  if (greed) patterns.push(greed);

  const overtrading = detectOvertrading(trade, adjacentTrades, config.overtrading);
  if (overtrading) patterns.push(overtrading);

  const impulse = detectImpulseCluster(trade, adjacentTrades, config.impulseCluster);
  if (impulse) patterns.push(impulse);

  const targetHit = detectTargetHit(trade, adjacentTrades, config.targetHit);
  if (targetHit) patterns.push(targetHit);

  const directionFlip = detectDirectionFlip(trade, adjacentTrades, config.directionFlip);
  if (directionFlip) patterns.push(directionFlip);

  const undersized = detectUndersizedTrade(trade, adjacentTrades, config.undersizedTrade);
  if (undersized) patterns.push(undersized);

  // Early exit can work with or without orders (confidence differs)
  const earlyExit = detectEarlyExit(trade, orders, config.earlyExit);
  if (earlyExit) patterns.push(earlyExit);

  // --- Layer 2: when orders exist ---
  if (orders && orders.length > 0) {
    const hesitation = detectHesitation(trade, orders, config.hesitation);
    if (hesitation) patterns.push(hesitation);

    const stopPanic = detectStopPanic(trade, orders, config.stopPanic);
    if (stopPanic) patterns.push(stopPanic);

    const fomo = detectFomoEntry(trade, orders, config.fomoEntry);
    if (fomo) patterns.push(fomo);

    const lateExit = detectLateExit(trade, orders, config.lateExit);
    if (lateExit) patterns.push(lateExit);

    const averaging = detectAveragingDown(trade, orders);
    if (averaging) patterns.push(averaging);
  }

  // Clean execution is evaluated last — depends on absence of negative patterns
  const clean = detectCleanExecution(trade, adjacentTrades, patterns);
  if (clean) patterns.push(clean);

  return {
    patterns,
    resolution: resolveResolution(trade, orders),
    marketContext: buildMarketContext(trade),
    analyzedAt: new Date().toISOString(),
    orderCount: orders ? orders.length : 0,
    version: SHADOW_VERSION
  };
};

/**
 * Batch analysis for multiple trades (e.g., mentor triggers for a period).
 * Groups by student + day for adjacent trade context.
 *
 * @param {Array} trades - All trades to analyze
 * @param {Object} ordersByTradeId - Map of tradeId → orders[] (optional)
 * @param {Object} config - Optional: override default detection config
 * @returns {Map} Map of tradeId → shadowBehavior
 */
export const analyzeShadowBatch = (trades, ordersByTradeId = {}, config = DEFAULT_CONFIG) => {
  if (!trades || trades.length === 0) return new Map();

  const sorted = sortTradesChronologically(trades);
  const results = new Map();

  for (const trade of sorted) {
    // Adjacent trades = same student, same day (excluding this trade)
    const adjacent = sorted.filter(t =>
      t.id !== trade.id &&
      t.studentId === trade.studentId &&
      t.date === trade.date
    );

    const orders = ordersByTradeId[trade.id] ?? null;
    const shadow = analyzeShadowForTrade(trade, adjacent, orders, config);
    if (shadow) {
      results.set(trade.id, shadow);
    }
  }

  return results;
};
