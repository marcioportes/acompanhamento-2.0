/**
 * Emotional Analysis V2 - Sistema Emocional v2.0
 * @version 2.0.0 (Fase 1.3.1)
 * 
 * DIFERENÇAS DO V1:
 * - NÃO usa listas hardcoded (EMOTION_CATEGORIES)
 * - Recebe `emotions` do Firestore via parâmetro
 * - Usa campos score, analysisCategory, behavioralPattern do Firestore
 * - Fallbacks seguros para backward compatibility
 * - Detecção de TILT e REVENGE com configuração (prepara Fase 1.3.2)
 * 
 * COMO USAR:
 * ```jsx
 * import { useMasterData } from '../hooks/useMasterData';
 * import { analyzeEmotionsV2, detectTiltV2 } from '../utils/emotionalAnalysisV2';
 * 
 * const { emotions, getEmotionConfig } = useMasterData();
 * const analysis = analyzeEmotionsV2(trades, getEmotionConfig);
 * ```
 * 
 * COMPATIBILIDADE:
 * - emotionalAnalysis.js (V1) PERMANECE intocado
 * - Componentes migram gradualmente de V1 → V2
 * - V2 aceita trades com `emotionEntry` ou `emotion` (legado)
 */

// ============================================
// CONSTANTES E DEFAULTS
// ============================================

/**
 * Configuração padrão para detecção de padrões
 * Será substituída pela collection complianceRules na Fase 1.3.2
 */
export const DEFAULT_DETECTION_CONFIG = {
  tilt: {
    enabled: true,
    consecutiveTrades: 3,
    maxIntervalMinutes: 60,
    requireNegativeResult: true,
    emotionCategories: ['NEGATIVE', 'CRITICAL']
  },
  revenge: {
    enabled: true,
    tradesInWindow: 3,
    windowMinutes: 15,
    afterLossOnly: true,
    qtyMultiplier: 1.5
  },
  overtrading: {
    enabled: true,
    maxTradesPerDay: 10,
    warningThreshold: 0.8
  }
};

/**
 * Pesos para cálculo do score emocional do trade
 */
const SCORE_WEIGHTS = {
  entryWeight: 0.6,
  exitWeight: 0.4,
  consistencyBonus: 0.5,
  worsenPenaltyFactor: 0.3
};

/**
 * Penalidades por eventos de compliance (pontos debitados do score 0-100)
 *
 * Issue #208 — adicionados 5 eventos comportamentais de execução produzidos por
 * `executionBehaviorEngine.detectExecutionEvents`. Pesos heurísticos iniciais
 * (DEC-AUTO-208-04) — calibração empírica obrigatória 90 dias antes de
 * promover gates 3→4 a bloqueantes.
 */
const EVENT_PENALTIES = {
  TILT_DETECTED: 20,
  REVENGE_DETECTED: 15,
  STOP_WORSENED: 10,
  GOAL_TO_STOP: 25,
  // Issue #208 — eventos de execução
  STOP_TAMPERING: 20,
  STOP_PARTIAL_SIZING: 10,
  RAPID_REENTRY_POST_STOP: 15,
  HESITATION_PRE_ENTRY: 5,
  CHASE_REENTRY: 10,
};

// ============================================
// HELPERS INTERNOS
// ============================================

/**
 * Extrai o nome da emoção do trade (compatível com V1 e V2)
 */
const getTradeEmotionName = (trade, type = 'entry') => {
  if (type === 'entry') {
    return trade.emotionEntry || trade.emotion || null;
  }
  return trade.emotionExit || null;
};

/**
 * Calcula minutos entre dois trades
 */
const getMinutesBetween = (tradeA, tradeB) => {
  const timeA = new Date(tradeA.exitTime || tradeA.entryTime || tradeA.date);
  const timeB = new Date(tradeB.entryTime || tradeB.date);
  return Math.abs(timeB - timeA) / 60000;
};

/**
 * Determina severidade com base no número de trades na sequência
 */
const getSeverity = (count) => {
  if (count >= 5) return 'CRITICAL';
  if (count >= 4) return 'HIGH';
  return 'MEDIUM';
};

/**
 * Ordena trades cronologicamente
 */
const sortTradesChronologically = (trades) => {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.exitTime || a.entryTime || a.date);
    const dateB = new Date(b.exitTime || b.entryTime || b.date);
    return dateA - dateB;
  });
};

// ============================================
// CÁLCULOS DE SCORE
// ============================================

/**
 * Calcula o score emocional de um trade individual
 * 
 * Fórmula:
 *   baseScore = (entryScore * 0.6) + (exitScore * 0.4)
 *   + bônus por consistência (entrada e saída na mesma categoria)
 *   - penalidade por piora (saída pior que entrada)
 * 
 * @param {Object} trade - Trade com emotionEntry/emotionExit
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @returns {Object} { score, entryConfig, exitConfig, flags }
 */
export const calculateTradeEmotionalScore = (trade, getEmotionConfig) => {
  const entryName = getTradeEmotionName(trade, 'entry');
  const exitName = getTradeEmotionName(trade, 'exit');
  
  const entryConfig = getEmotionConfig(entryName);
  const exitConfig = exitName ? getEmotionConfig(exitName) : entryConfig;

  const entryScore = entryConfig.score;
  const exitScore = exitConfig.score;

  // Score base ponderado
  const baseScore = (entryScore * SCORE_WEIGHTS.entryWeight) + 
                    (exitScore * SCORE_WEIGHTS.exitWeight);

  // Bônus por consistência (entrada e saída mesma categoria)
  const consistent = entryConfig.analysisCategory === exitConfig.analysisCategory;
  const consistencyBonus = consistent ? SCORE_WEIGHTS.consistencyBonus : 0;

  // Penalidade por piora emocional
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
      critical: entryConfig.analysisCategory === 'CRITICAL' || exitConfig.analysisCategory === 'CRITICAL'
    }
  };
};

/**
 * Calcula o score emocional de um período/ciclo (normalizado 0-100)
 * 
 * Fórmula:
 *   1. Média dos scores individuais dos trades
 *   2. Normaliza de [-4, +3] para [0, 100]
 *   3. Subtrai penalidades por eventos de compliance
 * 
 * @param {Array} trades - Lista de trades do período
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @param {Array} complianceEvents - Eventos detectados (TILT, REVENGE, etc)
 * @returns {Object} { score, rawAverage, normalized, penalties, details }
 */
export const calculatePeriodScore = (trades, getEmotionConfig, complianceEvents = []) => {
  if (!trades || trades.length === 0) {
    return { score: 100, rawAverage: 0, normalized: 100, penalties: 0, details: [] };
  }

  // Calcula score de cada trade
  const details = trades.map(trade => ({
    tradeId: trade.id,
    date: trade.date,
    ...calculateTradeEmotionalScore(trade, getEmotionConfig)
  }));

  // Média dos scores
  const totalScore = details.reduce((sum, d) => sum + d.score, 0);
  const rawAverage = totalScore / details.length;

  // Normaliza de [-4, +3.5] para [0, 100]
  // +3.5 = score máximo possível (3 + 0.5 bônus consistência)
  const normalized = Math.round(((rawAverage + 4) / 7.5) * 100);

  // Penalidades por eventos
  const penalties = complianceEvents.reduce((sum, event) => {
    return sum + (EVENT_PENALTIES[event.type] || 0);
  }, 0);

  const finalScore = Math.max(0, Math.min(100, normalized - penalties));

  return {
    score: finalScore,
    rawAverage: Math.round(rawAverage * 100) / 100,
    normalized: Math.max(0, Math.min(100, normalized)),
    penalties,
    details
  };
};

// ============================================
// DETECÇÃO DE PADRÕES
// ============================================

/**
 * Detecta sequências de TILT
 * 
 * TILT = N trades consecutivos com:
 *   - Emoção NEGATIVE ou CRITICAL
 *   - Resultado negativo (opcional, configurável)
 *   - Intervalo entre trades <= maxIntervalMinutes
 * 
 * @param {Array} trades - Trades do período
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @param {Object} config - Configuração de detecção (default: DEFAULT_DETECTION_CONFIG.tilt)
 * @returns {Object} { detected, sequences, totalTiltTrades }
 */
export const detectTiltV2 = (trades, getEmotionConfig, config = DEFAULT_DETECTION_CONFIG.tilt, executionEvents = []) => {
  // Issue #208 — STOP_TAMPERING + STOP_PARTIAL_SIZING contam como tilt
  // (loss aversion + disposition effect indicam descontrole emocional sobre
  // proteção). Sumarizados aqui mas devolvidos no shape original para não
  // quebrar consumidores; campo `executionTiltCount` adicionado.
  const TILT_EXEC_TYPES = new Set(['STOP_TAMPERING', 'STOP_PARTIAL_SIZING']);
  const executionTiltCount = (executionEvents || [])
    .filter(e => e && TILT_EXEC_TYPES.has(e.type)).length;

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

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const emotionName = getTradeEmotionName(trade, 'entry');
    const emotionConfig = getEmotionConfig(emotionName);
    const category = emotionConfig.analysisCategory;

    const isNegativeEmotion = config.emotionCategories.includes(category);
    const isNegativeResult = !config.requireNegativeResult || (trade.result < 0);

    if (isNegativeEmotion && isNegativeResult) {
      // Verifica intervalo com trade anterior na sequência
      if (currentSequence.length > 0) {
        const prevTrade = currentSequence[currentSequence.length - 1];
        const interval = getMinutesBetween(prevTrade, trade);

        if (interval > config.maxIntervalMinutes) {
          // Intervalo muito grande, avalia sequência atual e reinicia
          if (currentSequence.length >= config.consecutiveTrades) {
            sequences.push({
              trades: [...currentSequence],
              severity: getSeverity(currentSequence.length),
              startTime: currentSequence[0].entryTime || currentSequence[0].date,
              endTime: currentSequence[currentSequence.length - 1].exitTime || currentSequence[currentSequence.length - 1].date
            });
          }
          currentSequence = [];
        }
      }
      currentSequence.push(trade);
    } else {
      // Trade positivo/neutro, avalia sequência e reinicia
      if (currentSequence.length >= config.consecutiveTrades) {
        sequences.push({
          trades: [...currentSequence],
          severity: getSeverity(currentSequence.length),
          startTime: currentSequence[0].entryTime || currentSequence[0].date,
          endTime: currentSequence[currentSequence.length - 1].exitTime || currentSequence[currentSequence.length - 1].date
        });
      }
      currentSequence = [];
    }
  }

  // Verifica última sequência
  if (currentSequence.length >= config.consecutiveTrades) {
    sequences.push({
      trades: [...currentSequence],
      severity: getSeverity(currentSequence.length),
      startTime: currentSequence[0].entryTime || currentSequence[0].date,
      endTime: currentSequence[currentSequence.length - 1].exitTime || currentSequence[currentSequence.length - 1].date
    });
  }

  return {
    detected: sequences.length > 0 || executionTiltCount > 0,
    sequences,
    totalTiltTrades: sequences.reduce((sum, s) => sum + s.trades.length, 0),
    executionTiltCount,
  };
};

/**
 * Detecta comportamento de REVENGE trading
 * 
 * REVENGE = Trade que ocorre:
 *   - Após um loss
 *   - Dentro de janela de tempo curta
 *   - Com aumento significativo de posição (qty)
 *   OU
 *   - Sequência rápida de N trades após loss
 * 
 * @param {Array} trades - Trades do período
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @param {Object} config - Configuração de detecção
 * @returns {Object} { detected, instances, count }
 */
export const detectRevengeV2 = (trades, getEmotionConfig, config = DEFAULT_DETECTION_CONFIG.revenge, executionEvents = []) => {
  // Issue #208 — RAPID_REENTRY_POST_STOP + CHASE_REENTRY contam como revenge
  // (loss-chasing direto após perda; overtrading agregado).
  const REVENGE_EXEC_TYPES = new Set(['RAPID_REENTRY_POST_STOP', 'CHASE_REENTRY']);
  const executionRevengeCount = (executionEvents || [])
    .filter(e => e && REVENGE_EXEC_TYPES.has(e.type)).length;

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

  // Calcula média de qty para referência
  const validQtys = sorted.map(t => parseFloat(t.qty || 0)).filter(q => q > 0);
  const avgQty = validQtys.length > 0 
    ? validQtys.reduce((sum, q) => sum + q, 0) / validQtys.length 
    : 1;

  // Detecção 1: Aumento de posição após loss
  for (let i = 1; i < sorted.length; i++) {
    const prevTrade = sorted[i - 1];
    const currTrade = sorted[i];

    // Só após loss?
    if (config.afterLossOnly && prevTrade.result >= 0) continue;

    // currTrade precisa ter sido ENTRADO depois do prevTrade ter SAÍDO (loss realizado).
    // Trade concorrente (entrada anterior ao exit do trigger) não é revenge.
    const prevExit = new Date(prevTrade.exitTime || prevTrade.entryTime || prevTrade.date);
    const currEntry = new Date(currTrade.entryTime || currTrade.date);
    const interval = (currEntry - prevExit) / 60000;
    if (interval <= 0 || interval > config.windowMinutes) continue;

    // Qty aumentou significativamente?
    const currQty = parseFloat(currTrade.qty || 0);
    if (currQty > avgQty * config.qtyMultiplier) {
      const emotionConfig = getEmotionConfig(getTradeEmotionName(currTrade, 'entry'));
      instances.push({
        type: 'QTY_INCREASE',
        trade: currTrade,
        previousLoss: prevTrade.result,
        qtyIncrease: ((currQty / avgQty - 1) * 100).toFixed(0) + '%',
        intervalMinutes: Math.round(interval),
        emotion: emotionConfig.name,
        behavioralPattern: emotionConfig.behavioralPattern,
        severity: emotionConfig.analysisCategory === 'CRITICAL' ? 'CRITICAL' : 'HIGH'
      });
    }
  }

  // Detecção 2: Sequência rápida de trades após loss
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].result >= 0) continue; // Ignora wins

    const lossTime = new Date(sorted[i].exitTime || sorted[i].date);
    const tradesAfter = sorted.slice(i + 1).filter(t => {
      const tradeTime = new Date(t.entryTime || t.date);
      const diffMinutes = (tradeTime - lossTime) / 60000;
      // Trade precisa ter sido ENTRADO estritamente depois do loss ter saído.
      // Sem essa guarda, trades concorrentes (exit posterior mas entry anterior)
      // caem em slice(i+1) e são falsamente classificados como revenge.
      return diffMinutes > 0 && diffMinutes <= config.windowMinutes;
    });

    if (tradesAfter.length >= config.tradesInWindow) {
      instances.push({
        type: 'RAPID_SEQUENCE',
        triggerTrade: sorted[i],
        tradesAfter: tradesAfter.length,
        tradeIdsAfter: tradesAfter.map(t => t.id).filter(Boolean),
        windowMinutes: config.windowMinutes,
        severity: 'HIGH'
      });
    }
  }

  // Detecção 3: Emoção de Revanche explícita
  sorted.forEach(trade => {
    const emotionConfig = getEmotionConfig(getTradeEmotionName(trade, 'entry'));
    if (emotionConfig.behavioralPattern === 'REVENGE') {
      // Evita duplicar se já detectado acima
      const alreadyDetected = instances.some(inst => 
        inst.trade?.id === trade.id || inst.triggerTrade?.id === trade.id
      );
      if (!alreadyDetected) {
        instances.push({
          type: 'EXPLICIT_EMOTION',
          trade,
          emotion: emotionConfig.name,
          severity: 'CRITICAL'
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
};

/**
 * Detecta overtrading (excesso de operações no dia)
 * 
 * @param {Array} trades - Trades do período
 * @param {Object} config - Configuração
 * @returns {Object} { detected, days, maxTradesInDay }
 */
export const detectOvertradingV2 = (trades, config = DEFAULT_DETECTION_CONFIG.overtrading) => {
  if (!config.enabled || !trades || trades.length === 0) {
    return { detected: false, days: [], maxTradesInDay: 0 };
  }

  // Agrupa por dia
  const byDay = {};
  trades.forEach(trade => {
    const day = trade.date;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(trade);
  });

  const days = Object.entries(byDay)
    .map(([date, dayTrades]) => ({
      date,
      count: dayTrades.length,
      isWarning: dayTrades.length >= config.maxTradesPerDay * config.warningThreshold,
      isExceeded: dayTrades.length > config.maxTradesPerDay
    }))
    .filter(d => d.isWarning || d.isExceeded);

  const maxTradesInDay = Math.max(...Object.values(byDay).map(d => d.length), 0);

  return {
    detected: days.some(d => d.isExceeded),
    warning: days.some(d => d.isWarning && !d.isExceeded),
    days,
    maxTradesInDay
  };
};

// ============================================
// ANÁLISE CONSOLIDADA
// ============================================

/**
 * Análise emocional completa de um conjunto de trades
 * Substitui `analyzeEmotions()` do V1
 * 
 * @param {Array} trades - Trades a analisar
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @param {Object} detectionConfig - Config de detecção (opcional)
 * @returns {Object} Análise completa
 */
export const analyzeEmotionsV2 = (trades, getEmotionConfig, detectionConfig = DEFAULT_DETECTION_CONFIG) => {
  if (!trades || trades.length === 0) {
    return {
      tradesCount: 0,
      periodScore: { score: 100, rawAverage: 0, normalized: 100, penalties: 0, details: [] },
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, CRITICAL: 0 },
      tilt: { detected: false, sequences: [], totalTiltTrades: 0 },
      revenge: { detected: false, instances: [], count: 0 },
      overtrading: { detected: false, days: [], maxTradesInDay: 0 },
      complianceEvents: [],
      topEmotions: [],
      emotionalTrend: 'STABLE'
    };
  }

  // Distribuição por categoria de análise
  const distribution = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, CRITICAL: 0 };
  const emotionCounts = {};

  trades.forEach(trade => {
    const entryName = getTradeEmotionName(trade, 'entry');
    const config = getEmotionConfig(entryName);
    const cat = config.analysisCategory;
    distribution[cat] = (distribution[cat] || 0) + 1;

    // Contagem por emoção individual
    const name = config.name;
    emotionCounts[name] = (emotionCounts[name] || 0) + 1;
  });

  // Top emoções (mais frequentes)
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / trades.length) * 100),
      config: getEmotionConfig(name)
    }));

  // Detecção de padrões
  const tilt = detectTiltV2(trades, getEmotionConfig, detectionConfig.tilt);
  const revenge = detectRevengeV2(trades, getEmotionConfig, detectionConfig.revenge);
  const overtrading = detectOvertradingV2(trades, detectionConfig.overtrading);

  // Consolida eventos de compliance
  const complianceEvents = [];
  if (tilt.detected) {
    tilt.sequences.forEach(seq => {
      complianceEvents.push({
        type: 'TILT_DETECTED',
        severity: seq.severity,
        startTime: seq.startTime,
        endTime: seq.endTime,
        tradesCount: seq.trades.length
      });
    });
  }
  if (revenge.detected) {
    revenge.instances.forEach(inst => {
      complianceEvents.push({
        type: 'REVENGE_DETECTED',
        severity: inst.severity,
        trade: inst.trade || inst.triggerTrade,
        details: inst.type
      });
    });
  }

  // Score do período (com penalidades)
  const periodScore = calculatePeriodScore(trades, getEmotionConfig, complianceEvents);

  // Tendência emocional (compara 1ª metade vs 2ª metade)
  const mid = Math.floor(trades.length / 2);
  const emotionalTrend = calculateTrend(trades, mid, getEmotionConfig);

  return {
    tradesCount: trades.length,
    periodScore,
    distribution,
    tilt,
    revenge,
    overtrading,
    complianceEvents,
    topEmotions,
    emotionalTrend
  };
};

/**
 * Calcula tendência emocional comparando primeira metade vs segunda metade dos trades
 */
const calculateTrend = (trades, midpoint, getEmotionConfig) => {
  if (trades.length < 4) return 'STABLE';
  
  const sorted = sortTradesChronologically(trades);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const avgFirst = firstHalf.reduce((sum, t) => {
    return sum + calculateTradeEmotionalScore(t, getEmotionConfig).score;
  }, 0) / firstHalf.length;

  const avgSecond = secondHalf.reduce((sum, t) => {
    return sum + calculateTradeEmotionalScore(t, getEmotionConfig).score;
  }, 0) / secondHalf.length;

  const delta = avgSecond - avgFirst;
  
  if (delta > 0.5) return 'IMPROVING';
  if (delta < -0.5) return 'WORSENING';
  return 'STABLE';
};

// ============================================
// CORRELAÇÃO COMPLIANCE FINANCEIRO + EMOCIONAL
// ============================================

/**
 * Analisa correlação entre compliance financeiro e estado emocional
 * 
 * Cenários detectados:
 * - REVENGE_CONFIRMED: operou com emoção "Revanche" após atingir stop
 * - GREED_CONFIRMED: operou com emoção de ganância após atingir meta
 * - TILT_AFTER_STOP: TILT detectado nos trades pós-stop
 * - EMOTIONAL_RECOVERY: piora emocional seguida de recuperação
 * 
 * @param {Object} complianceResult - Resultado do analyzePlanCompliance()
 * @param {Array} trades - Trades do período
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @returns {Object} { financialStatus, alerts, emotionalCorrelation }
 */
export const analyzeComplianceEmotional = (complianceResult, trades, getEmotionConfig) => {
  const { status, stopBreachIndex, goalReachIndex, history } = complianceResult || {};
  
  const analysis = {
    financialStatus: status || 'UNKNOWN',
    emotionalCorrelation: null,
    alerts: []
  };

  if (!trades || trades.length === 0 || !history) return analysis;

  // Se atingiu STOP e continuou operando
  if (stopBreachIndex !== undefined && stopBreachIndex !== -1) {
    const tradesAfterStop = (history || []).filter(t => t.isAfterStop);
    
    tradesAfterStop.forEach(t => {
      const emotionConfig = getEmotionConfig(t.emotionEntry || t.emotion);
      
      if (emotionConfig.behavioralPattern === 'REVENGE') {
        analysis.alerts.push({
          type: 'REVENGE_CONFIRMED',
          message: `Trade com emoção "Revanche" após atingir stop`,
          severity: 'CRITICAL',
          trade: t
        });
      }
      
      if (emotionConfig.analysisCategory === 'CRITICAL') {
        analysis.alerts.push({
          type: 'CRITICAL_EMOTION_AFTER_STOP',
          message: `Emoção crítica "${emotionConfig.name}" após stop`,
          severity: 'HIGH',
          trade: t
        });
      }
    });
  }

  // Se atingiu GOAL e devolveu
  if (status === 'GOAL_GAVE_BACK' || status === 'GOAL_TO_STOP') {
    const tradesAfterGoal = (history || []).filter(t => t.isAfterGoal);
    
    tradesAfterGoal.forEach(t => {
      const emotionConfig = getEmotionConfig(t.emotionEntry || t.emotion);
      
      if (['GREED', 'EUPHORIA', 'FOMO'].includes(emotionConfig.behavioralPattern)) {
        analysis.alerts.push({
          type: 'GREED_CONFIRMED',
          message: `"${emotionConfig.name}" detectada: continuou operando após meta`,
          severity: status === 'GOAL_TO_STOP' ? 'CRITICAL' : 'HIGH',
          trade: t
        });
      }
    });
  }

  // Determina correlação geral
  if (analysis.alerts.length > 0) {
    const hasCritical = analysis.alerts.some(a => a.severity === 'CRITICAL');
    analysis.emotionalCorrelation = hasCritical ? 'STRONG_NEGATIVE' : 'MODERATE_NEGATIVE';
  } else {
    const overallCategory = getOverallEmotionalCategory(trades, getEmotionConfig);
    if (overallCategory === 'POSITIVE') {
      analysis.emotionalCorrelation = status?.includes('GOAL') ? 'STRONG_POSITIVE' : 'MODERATE_POSITIVE';
    } else {
      analysis.emotionalCorrelation = 'NEUTRAL';
    }
  }

  return analysis;
};

/**
 * Determina a categoria emocional predominante de um conjunto de trades
 */
const getOverallEmotionalCategory = (trades, getEmotionConfig) => {
  const counts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, CRITICAL: 0 };
  
  trades.forEach(trade => {
    const name = getTradeEmotionName(trade, 'entry');
    const config = getEmotionConfig(name);
    counts[config.analysisCategory] = (counts[config.analysisCategory] || 0) + 1;
  });

  const total = trades.length;
  if ((counts.POSITIVE / total) > 0.5) return 'POSITIVE';
  if ((counts.CRITICAL / total) > 0.2) return 'CRITICAL';
  if ((counts.NEGATIVE / total) > 0.4) return 'NEGATIVE';
  return 'NEUTRAL';
};

// ============================================
// STATUS DO ALUNO
// ============================================

/**
 * Calcula o status do aluno com base no score e eventos
 * Prepara para Fase 1.4.0 (Perfil Emocional)
 * 
 * @param {number} periodScore - Score 0-100 do período
 * @param {Array} complianceEvents - Eventos detectados
 * @param {Object} thresholds - Thresholds configuráveis (default)
 * @returns {Object} { status, adjustedScore, label, color }
 */
export const calculateStudentStatus = (periodScore, complianceEvents = [], thresholds = {}) => {
  const {
    healthyMinScore = 70,
    attentionMinScore = 50,
    warningMinScore = 30
  } = thresholds;

  // Penalidades por eventos
  const penalty = complianceEvents.reduce((sum, event) => {
    return sum + (EVENT_PENALTIES[event.type] || 0);
  }, 0);

  const adjustedScore = Math.max(0, periodScore - penalty);

  let status, label, color, emoji;
  if (adjustedScore >= healthyMinScore) {
    status = 'HEALTHY'; label = 'Saudável'; color = '#22c55e'; emoji = '🟢';
  } else if (adjustedScore >= attentionMinScore) {
    status = 'ATTENTION'; label = 'Atenção'; color = '#eab308'; emoji = '🟡';
  } else if (adjustedScore >= warningMinScore) {
    status = 'WARNING'; label = 'Alerta'; color = '#f97316'; emoji = '🟠';
  } else {
    status = 'CRITICAL'; label = 'Crítico'; color = '#ef4444'; emoji = '🔴';
  }

  return { status, adjustedScore, label, color, emoji, penalty };
};

// ============================================
// ANÁLISE POR DIA (para gráficos)
// ============================================

/**
 * Calcula scores emocionais agrupados por dia
 * Útil para gráficos de evolução emocional
 * 
 * @param {Array} trades - Trades do período
 * @param {Function} getEmotionConfig - Função do useMasterData
 * @returns {Array} [ { date, score, tradesCount, dominant }, ... ]
 */
export const calculateDailyScores = (trades, getEmotionConfig) => {
  if (!trades || trades.length === 0) return [];

  // Agrupa por dia
  const byDay = {};
  trades.forEach(trade => {
    const day = trade.date;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(trade);
  });

  return Object.entries(byDay)
    .map(([date, dayTrades]) => {
      const scores = dayTrades.map(t => calculateTradeEmotionalScore(t, getEmotionConfig));
      const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
      const normalized = Math.round(((avgScore + 4) / 7.5) * 100);

      // Emoção dominante do dia
      const emotionCounts = {};
      dayTrades.forEach(t => {
        const name = getTradeEmotionName(t, 'entry');
        emotionCounts[name] = (emotionCounts[name] || 0) + 1;
      });
      const dominant = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        date,
        score: Math.max(0, Math.min(100, normalized)),
        rawAverage: Math.round(avgScore * 100) / 100,
        tradesCount: dayTrades.length,
        dominant: dominant ? { name: dominant[0], count: dominant[1] } : null
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ============================================
// UTILITÁRIOS DE FORMATAÇÃO
// ============================================

/**
 * Formata score emocional para exibição
 */
export const formatEmotionalScore = (score) => {
  if (score === null || score === undefined) return '—';
  return `${Math.round(score)}/100`;
};

/**
 * Retorna cor do score para UI
 */
export const getScoreColor = (score) => {
  if (score >= 70) return '#22c55e'; // green
  if (score >= 50) return '#eab308'; // yellow
  if (score >= 30) return '#f97316'; // orange
  return '#ef4444'; // red
};

/**
 * Retorna cor e label do trend
 */
export const getTrendInfo = (trend) => {
  switch (trend) {
    case 'IMPROVING': return { label: 'Melhorando', color: '#22c55e', icon: '📈' };
    case 'WORSENING': return { label: 'Piorando', color: '#ef4444', icon: '📉' };
    default: return { label: 'Estável', color: '#6b7280', icon: '➡️' };
  }
};
