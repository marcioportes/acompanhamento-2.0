// ============================================
// EMOTIONAL ANALYSIS MIRROR (CommonJS)
// ============================================
//
// Mirror determinístico de `src/utils/emotionalAnalysisV2.js` (ESM) — issue #189.
// Issue #221: respeita `mentorClearedViolations` no calculatePeriodScore via
// effectiveEmotionalEventsForPeriod do violationFilter mirror.

const { effectiveEmotionalEventsForPeriod } = require('./violationFilter');
// Substitui o stub `{ periodScore: 50, tiltCount: 0, revengeCount: 0 }` em
// `preComputeShapes.js:129` (DEC-AUTO-119-task07-02 declarado como TODO).
//
// Paridade obrigatória com o source ESM: qualquer mudança aqui exige refletir
// `src/utils/emotionalAnalysisV2.js` e vice-versa. Testes de paridade ESM↔CommonJS
// em `__tests__/utils/emotionalAnalysisMirror.parity.test.js`.
//
// Escopo do mirror — apenas o que `preComputeShapes` consome:
//   - calculatePeriodScore  → { score } (0-100)
//   - detectTiltV2          → { totalTiltTrades }
//   - detectRevengeV2       → { count }
//   - buildGetEmotionConfig → fábrica equivalente ao useMasterData.getEmotionConfig
//
// Demais funções (analyzeEmotionsV2, detectOvertradingV2, calculateStudentStatus,
// calculateDailyScores, analyzeComplianceEmotional) NÃO são mirroradas — não consumidas
// pela engine de maturidade.

const DEFAULT_DETECTION_CONFIG = {
  tilt: {
    enabled: true,
    consecutiveTrades: 3,
    maxIntervalMinutes: 60,
    requireNegativeResult: true,
    emotionCategories: ['NEGATIVE', 'CRITICAL'],
  },
  revenge: {
    enabled: true,
    tradesInWindow: 3,
    windowMinutes: 15,
    afterLossOnly: true,
    qtyMultiplier: 1.5,
  },
};

const SCORE_WEIGHTS = {
  entryWeight: 0.6,
  exitWeight: 0.4,
  consistencyBonus: 0.5,
  worsenPenaltyFactor: 0.3,
};

// Issue #208 — adicionados 5 eventos de execução produzidos por
// `executionBehaviorMirror.detectExecutionEvents`. Pesos heurísticos
// (DEC-AUTO-208-04) — calibração empírica obrigatória 90 dias.
const EVENT_PENALTIES = {
  TILT_DETECTED: 20,
  REVENGE_DETECTED: 15,
  STOP_WORSENED: 10,
  GOAL_TO_STOP: 25,
  STOP_TAMPERING: 20,
  STOP_PARTIAL_SIZING: 10,
  RAPID_REENTRY_POST_STOP: 15,
  HESITATION_PRE_ENTRY: 5,
  CHASE_REENTRY: 10,
};

const UNKNOWN_EMOTION_CONFIG = {
  id: 'UNKNOWN',
  name: 'Não Informado',
  emoji: '❓',
  category: 'neutral',
  score: 0,
  analysisCategory: 'NEUTRAL',
  behavioralPattern: 'OTHER',
  riskLevel: 'MEDIUM',
};

// ============================================
// HELPERS INTERNOS (paridade com ESM linhas 84-118)
// ============================================

function getTradeEmotionName(trade, type = 'entry') {
  if (type === 'entry') {
    return trade.emotionEntry || trade.emotion || null;
  }
  return trade.emotionExit || null;
}

function getMinutesBetween(tradeA, tradeB) {
  const timeA = new Date(tradeA.exitTime || tradeA.entryTime || tradeA.date);
  const timeB = new Date(tradeB.entryTime || tradeB.date);
  return Math.abs(timeB - timeA) / 60000;
}

function getSeverity(count) {
  if (count >= 5) return 'CRITICAL';
  if (count >= 4) return 'HIGH';
  return 'MEDIUM';
}

function sortTradesChronologically(trades) {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.exitTime || a.entryTime || a.date);
    const dateB = new Date(b.exitTime || b.entryTime || b.date);
    return dateA - dateB;
  });
}

// ============================================
// FACTORY: getEmotionConfig (paridade com useMasterData.js:462-477)
// ============================================

/**
 * Constrói um `getEmotionConfig(nameOrId)` a partir do array de emoções carregado
 * da collection Firestore `emotions`. Comportamento idêntico ao hook do front-end:
 *   - input null/undefined         → UNKNOWN_EMOTION_CONFIG
 *   - encontra por name OU id      → config com defaults preenchidos
 *   - não encontra                 → UNKNOWN com nameOrId como name
 */
function buildGetEmotionConfig(emotions) {
  const list = Array.isArray(emotions) ? emotions : [];
  return function getEmotionConfig(nameOrId) {
    if (!nameOrId) return { ...UNKNOWN_EMOTION_CONFIG };
    const found = list.find((e) => e.name === nameOrId || e.id === nameOrId);
    if (found) {
      return {
        ...found,
        score: found.score ?? 0,
        analysisCategory: found.analysisCategory ?? 'NEUTRAL',
        behavioralPattern: found.behavioralPattern ?? 'OTHER',
        riskLevel: found.riskLevel ?? 'MEDIUM',
      };
    }
    return { ...UNKNOWN_EMOTION_CONFIG, name: nameOrId };
  };
}

// ============================================
// SCORES (paridade com ESM linhas 136-222)
// ============================================

function calculateTradeEmotionalScore(trade, getEmotionConfig) {
  const entryName = getTradeEmotionName(trade, 'entry');
  const exitName = getTradeEmotionName(trade, 'exit');

  const entryConfig = getEmotionConfig(entryName);
  const exitConfig = exitName ? getEmotionConfig(exitName) : entryConfig;

  const entryScore = entryConfig.score;
  const exitScore = exitConfig.score;

  const baseScore = (entryScore * SCORE_WEIGHTS.entryWeight)
    + (exitScore * SCORE_WEIGHTS.exitWeight);

  const consistent = entryConfig.analysisCategory === exitConfig.analysisCategory;
  const consistencyBonus = consistent ? SCORE_WEIGHTS.consistencyBonus : 0;

  const worsened = exitScore < entryScore;
  const worsenPenalty = worsened
    ? (entryScore - exitScore) * SCORE_WEIGHTS.worsenPenaltyFactor
    : 0;

  const finalScore = baseScore + consistencyBonus - worsenPenalty;

  return {
    score: Math.round(finalScore * 100) / 100,
    entryConfig,
    exitConfig,
    flags: {
      consistent,
      worsened,
      improved: exitScore > entryScore,
      critical: entryConfig.analysisCategory === 'CRITICAL'
        || exitConfig.analysisCategory === 'CRITICAL',
    },
  };
}

function calculatePeriodScore(trades, getEmotionConfig, complianceEvents = []) {
  if (!trades || trades.length === 0) {
    return { score: 100, rawAverage: 0, normalized: 100, penalties: 0, details: [] };
  }

  const details = trades.map((trade) => ({
    tradeId: trade.id,
    date: trade.date,
    ...calculateTradeEmotionalScore(trade, getEmotionConfig),
  }));

  const totalScore = details.reduce((sum, d) => sum + d.score, 0);
  const rawAverage = totalScore / details.length;

  // Normaliza de [-4, +3.5] para [0, 100] (paridade com ESM linha 206)
  const normalized = Math.round(((rawAverage + 4) / 7.5) * 100);

  // Issue #221: filtra eventos cleared pelo mentor (mentorClearedViolations).
  const safeEvents = Array.isArray(complianceEvents) ? complianceEvents : [];
  const effectiveEvents = effectiveEmotionalEventsForPeriod(trades, safeEvents);
  const penalties = effectiveEvents.reduce(
    (sum, event) => sum + (EVENT_PENALTIES[event.type] || 0),
    0,
  );

  const finalScore = Math.max(0, Math.min(100, normalized - penalties));

  return {
    score: finalScore,
    rawAverage: Math.round(rawAverage * 100) / 100,
    normalized: Math.max(0, Math.min(100, normalized)),
    penalties,
    details,
  };
}

// ============================================
// DETECÇÃO TILT (paridade com ESM linhas 241-308)
// ============================================

function detectTiltV2(trades, getEmotionConfig, config = DEFAULT_DETECTION_CONFIG.tilt, executionEvents = []) {
  // Issue #208 — STOP_TAMPERING + STOP_PARTIAL_SIZING contam como tilt.
  const TILT_EXEC_TYPES = new Set(['STOP_TAMPERING', 'STOP_PARTIAL_SIZING']);
  const executionTiltCount = (executionEvents || [])
    .filter((e) => e && TILT_EXEC_TYPES.has(e.type)).length;

  if (!config.enabled || !trades || trades.length < config.consecutiveTrades) {
    return {
      detected: executionTiltCount > 0,
      sequences: [],
      totalTiltTrades: 0,
      executionTiltCount,
    };
  }

  const sorted = sortTradesChronologically(trades);
  const sequences = [];
  let currentSequence = [];

  function flush() {
    if (currentSequence.length >= config.consecutiveTrades) {
      sequences.push({
        trades: [...currentSequence],
        severity: getSeverity(currentSequence.length),
        startTime: currentSequence[0].entryTime || currentSequence[0].date,
        endTime: currentSequence[currentSequence.length - 1].exitTime
          || currentSequence[currentSequence.length - 1].date,
      });
    }
    currentSequence = [];
  }

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const emotionName = getTradeEmotionName(trade, 'entry');
    const emotionConfig = getEmotionConfig(emotionName);
    const category = emotionConfig.analysisCategory;

    const isNegativeEmotion = config.emotionCategories.includes(category);
    const isNegativeResult = !config.requireNegativeResult || (trade.result < 0);

    if (isNegativeEmotion && isNegativeResult) {
      if (currentSequence.length > 0) {
        const prevTrade = currentSequence[currentSequence.length - 1];
        const interval = getMinutesBetween(prevTrade, trade);
        if (interval > config.maxIntervalMinutes) {
          flush();
        }
      }
      currentSequence.push(trade);
    } else {
      flush();
    }
  }

  flush();

  return {
    detected: sequences.length > 0 || executionTiltCount > 0,
    sequences,
    totalTiltTrades: sequences.reduce((sum, s) => sum + s.trades.length, 0),
    executionTiltCount,
  };
}

// ============================================
// DETECÇÃO REVENGE (paridade com ESM linhas 325-421)
// ============================================

function detectRevengeV2(trades, getEmotionConfig, config = DEFAULT_DETECTION_CONFIG.revenge, executionEvents = []) {
  // Issue #208 — RAPID_REENTRY_POST_STOP + CHASE_REENTRY contam como revenge.
  const REVENGE_EXEC_TYPES = new Set(['RAPID_REENTRY_POST_STOP', 'CHASE_REENTRY']);
  const executionRevengeCount = (executionEvents || [])
    .filter((e) => e && REVENGE_EXEC_TYPES.has(e.type)).length;

  if (!config.enabled || !trades || trades.length < 2) {
    return {
      detected: executionRevengeCount > 0,
      instances: [],
      count: 0,
      executionRevengeCount,
    };
  }

  const sorted = sortTradesChronologically(trades);
  const instances = [];

  const validQtys = sorted.map((t) => parseFloat(t.qty || 0)).filter((q) => q > 0);
  const avgQty = validQtys.length > 0
    ? validQtys.reduce((sum, q) => sum + q, 0) / validQtys.length
    : 1;

  // Detecção 1: aumento de qty após loss
  for (let i = 1; i < sorted.length; i++) {
    const prevTrade = sorted[i - 1];
    const currTrade = sorted[i];

    if (config.afterLossOnly && prevTrade.result >= 0) continue;

    const prevExit = new Date(prevTrade.exitTime || prevTrade.entryTime || prevTrade.date);
    const currEntry = new Date(currTrade.entryTime || currTrade.date);
    const interval = (currEntry - prevExit) / 60000;
    if (interval <= 0 || interval > config.windowMinutes) continue;

    const currQty = parseFloat(currTrade.qty || 0);
    if (currQty > avgQty * config.qtyMultiplier) {
      const emotionConfig = getEmotionConfig(getTradeEmotionName(currTrade, 'entry'));
      instances.push({
        type: 'QTY_INCREASE',
        trade: currTrade,
        previousLoss: prevTrade.result,
        qtyIncrease: `${((currQty / avgQty - 1) * 100).toFixed(0)}%`,
        intervalMinutes: Math.round(interval),
        emotion: emotionConfig.name,
        behavioralPattern: emotionConfig.behavioralPattern,
        severity: emotionConfig.analysisCategory === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      });
    }
  }

  // Detecção 2: sequência rápida após loss
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].result >= 0) continue;

    const lossTime = new Date(sorted[i].exitTime || sorted[i].date);
    const tradesAfter = sorted.slice(i + 1).filter((t) => {
      const tradeTime = new Date(t.entryTime || t.date);
      const diffMinutes = (tradeTime - lossTime) / 60000;
      return diffMinutes > 0 && diffMinutes <= config.windowMinutes;
    });

    if (tradesAfter.length >= config.tradesInWindow) {
      instances.push({
        type: 'RAPID_SEQUENCE',
        triggerTrade: sorted[i],
        tradesAfter: tradesAfter.length,
        tradeIdsAfter: tradesAfter.map((t) => t.id).filter(Boolean),
        windowMinutes: config.windowMinutes,
        severity: 'HIGH',
      });
    }
  }

  // Detecção 3: emoção REVENGE explícita
  sorted.forEach((trade) => {
    const emotionConfig = getEmotionConfig(getTradeEmotionName(trade, 'entry'));
    if (emotionConfig.behavioralPattern === 'REVENGE') {
      const alreadyDetected = instances.some((inst) => (
        inst.trade?.id === trade.id || inst.triggerTrade?.id === trade.id
      ));
      if (!alreadyDetected) {
        instances.push({
          type: 'EXPLICIT_EMOTION',
          trade,
          emotion: emotionConfig.name,
          severity: 'CRITICAL',
        });
      }
    }
  });

  return {
    detected: instances.length > 0 || executionRevengeCount > 0,
    instances,
    count: instances.length,
    executionRevengeCount,
  };
}

// ============================================
// SHAPE BUILDER — entrada de preComputeShapes (issue #189)
// ============================================

/**
 * Computa o shape `{ periodScore, tiltCount, revengeCount }` consumido por
 * `computeEmotional` (DEC-AUTO-119-03). Substitui o stub neutro hardcoded.
 *
 * @param {{
 *   trades: Array<object>,
 *   emotions: Array<object>|undefined,   // collection `emotions` snapshot
 *   getEmotionConfig?: Function,         // alternativa: injetar pronto (testes)
 * }} input
 * @returns {{ periodScore: number, tiltCount: number, revengeCount: number }}
 */
function computeEmotionalAnalysisShape({ trades, emotions, getEmotionConfig } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const cfg = typeof getEmotionConfig === 'function'
    ? getEmotionConfig
    : buildGetEmotionConfig(emotions);

  if (safeTrades.length === 0) {
    return { periodScore: 50, tiltCount: 0, revengeCount: 0 };
  }

  const periodScore = calculatePeriodScore(safeTrades, cfg).score;
  const tilt = detectTiltV2(safeTrades, cfg);
  const revenge = detectRevengeV2(safeTrades, cfg);

  return {
    periodScore,
    tiltCount: tilt.totalTiltTrades,
    revengeCount: revenge.count,
  };
}

module.exports = {
  DEFAULT_DETECTION_CONFIG,
  EVENT_PENALTIES,
  SCORE_WEIGHTS,
  UNKNOWN_EMOTION_CONFIG,
  buildGetEmotionConfig,
  calculateTradeEmotionalScore,
  calculatePeriodScore,
  detectTiltV2,
  detectRevengeV2,
  computeEmotionalAnalysisShape,
};
