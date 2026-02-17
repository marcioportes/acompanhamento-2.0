/**
 * emotionalAnalysis.js
 * @version 1.0.0
 * @description Funções de análise emocional para trades
 */

// ============================================
// CATEGORIZAÇÃO DE EMOÇÕES
// ============================================

export const EMOTION_CATEGORIES = {
  POSITIVE: ['Confiante', 'Calmo', 'Focado', 'Disciplinado', 'Paciente', 'Otimista'],
  NEUTRAL: ['Neutro', 'Cauteloso', 'Atento', 'Analítico'],
  NEGATIVE: ['Ansioso', 'Medo', 'Ganância', 'FOMO', 'Frustrado', 'Impaciente', 'Inseguro'],
  CRITICAL: ['Tilt', 'Vingança', 'Desespero', 'Euforia']
};

export const EMOTION_RISK_LEVEL = {
  LOW: ['Calmo', 'Disciplinado', 'Paciente', 'Analítico'],
  MEDIUM: ['Confiante', 'Focado', 'Cauteloso', 'Neutro', 'Atento', 'Otimista'],
  HIGH: ['Ansioso', 'Medo', 'Ganância', 'FOMO', 'Impaciente', 'Inseguro'],
  CRITICAL: ['Tilt', 'Vingança', 'Desespero', 'Euforia', 'Frustrado']
};

export const EMOTION_COLORS = {
  Confiante: '#10b981',
  Calmo: '#3b82f6',
  Focado: '#8b5cf6',
  Disciplinado: '#06b6d4',
  Paciente: '#14b8a6',
  Neutro: '#64748b',
  Cauteloso: '#f59e0b',
  Ansioso: '#ef4444',
  Medo: '#dc2626',
  Ganância: '#f97316',
  FOMO: '#ea580c',
  Tilt: '#991b1b',
  Vingança: '#7f1d1d',
  Frustrado: '#b91c1c',
  Euforia: '#c026d3'
};

// ============================================
// FUNÇÕES DE CATEGORIZAÇÃO
// ============================================

/**
 * Retorna a categoria de uma emoção
 */
export const getEmotionCategory = (emotion) => {
  if (!emotion) return 'NEUTRAL';
  const normalized = emotion.trim();
  
  for (const [category, emotions] of Object.entries(EMOTION_CATEGORIES)) {
    if (emotions.some(e => e.toLowerCase() === normalized.toLowerCase())) {
      return category;
    }
  }
  return 'NEUTRAL';
};

/**
 * Retorna o nível de risco de uma emoção
 */
export const getEmotionRiskLevel = (emotion) => {
  if (!emotion) return 'MEDIUM';
  const normalized = emotion.trim();
  
  for (const [level, emotions] of Object.entries(EMOTION_RISK_LEVEL)) {
    if (emotions.some(e => e.toLowerCase() === normalized.toLowerCase())) {
      return level;
    }
  }
  return 'MEDIUM';
};

/**
 * Verifica se emoção é de alto risco
 */
export const isHighRiskEmotion = (emotion) => {
  const level = getEmotionRiskLevel(emotion);
  return level === 'HIGH' || level === 'CRITICAL';
};

// ============================================
// ANÁLISE POR TRADE
// ============================================

/**
 * Analisa consistência emocional de um trade (entry vs exit)
 */
export const analyzeTradeEmotionalConsistency = (trade) => {
  const entryEmotion = trade.emotionEntry || trade.emotion;
  const exitEmotion = trade.emotionExit || trade.emotion;
  
  if (!entryEmotion || !exitEmotion) {
    return { consistent: null, transition: null };
  }

  const entryCategory = getEmotionCategory(entryEmotion);
  const exitCategory = getEmotionCategory(exitEmotion);
  
  const consistent = entryCategory === exitCategory;
  
  let transitionType = 'STABLE';
  if (!consistent) {
    const categoryOrder = { POSITIVE: 3, NEUTRAL: 2, NEGATIVE: 1, CRITICAL: 0 };
    const diff = categoryOrder[exitCategory] - categoryOrder[entryCategory];
    
    if (diff > 0) transitionType = 'IMPROVED';
    else if (diff < 0) transitionType = 'WORSENED';
  }

  return {
    consistent,
    transition: transitionType,
    entryCategory,
    exitCategory,
    entryEmotion,
    exitEmotion
  };
};

/**
 * Calcula score emocional de um trade (0-100)
 */
export const calculateTradeEmotionalScore = (trade) => {
  const entryEmotion = trade.emotionEntry || trade.emotion;
  const exitEmotion = trade.emotionExit || entryEmotion;
  
  const riskScores = { LOW: 100, MEDIUM: 70, HIGH: 40, CRITICAL: 10 };
  
  const entryScore = riskScores[getEmotionRiskLevel(entryEmotion)] || 50;
  const exitScore = riskScores[getEmotionRiskLevel(exitEmotion)] || 50;
  
  // Consistência adiciona pontos
  const consistency = analyzeTradeEmotionalConsistency(trade);
  const consistencyBonus = consistency.consistent ? 10 : 0;
  const transitionBonus = consistency.transition === 'IMPROVED' ? 5 : 
                          consistency.transition === 'WORSENED' ? -10 : 0;
  
  const baseScore = (entryScore + exitScore) / 2;
  return Math.max(0, Math.min(100, baseScore + consistencyBonus + transitionBonus));
};

// ============================================
// ANÁLISE DE SEQUÊNCIA (TILT DETECTION)
// ============================================

/**
 * Detecta sequências de tilt (3+ trades com emoções negativas/críticas)
 */
export const detectTiltSequences = (trades) => {
  if (!trades || trades.length < 3) return [];
  
  const sortedTrades = [...trades].sort((a, b) => 
    (a.entryTime || a.date || '').localeCompare(b.entryTime || b.date || '')
  );
  
  const sequences = [];
  let currentSequence = [];
  
  for (const trade of sortedTrades) {
    const emotion = trade.emotionEntry || trade.emotion;
    const category = getEmotionCategory(emotion);
    
    if (category === 'NEGATIVE' || category === 'CRITICAL') {
      currentSequence.push(trade);
    } else {
      if (currentSequence.length >= 3) {
        sequences.push({
          trades: [...currentSequence],
          length: currentSequence.length,
          totalLoss: currentSequence.reduce((sum, t) => sum + (t.result || 0), 0),
          startDate: currentSequence[0].date,
          endDate: currentSequence[currentSequence.length - 1].date
        });
      }
      currentSequence = [];
    }
  }
  
  // Verifica sequência final
  if (currentSequence.length >= 3) {
    sequences.push({
      trades: [...currentSequence],
      length: currentSequence.length,
      totalLoss: currentSequence.reduce((sum, t) => sum + (t.result || 0), 0),
      startDate: currentSequence[0].date,
      endDate: currentSequence[currentSequence.length - 1].date
    });
  }
  
  return sequences;
};

/**
 * Verifica se está em tilt ativo (últimos 3 trades)
 */
export const isInTilt = (trades) => {
  if (!trades || trades.length < 3) return false;
  
  const lastThree = [...trades]
    .sort((a, b) => (b.entryTime || b.date || '').localeCompare(a.entryTime || a.date || ''))
    .slice(0, 3);
  
  return lastThree.every(t => {
    const emotion = t.emotionEntry || t.emotion;
    const category = getEmotionCategory(emotion);
    return category === 'NEGATIVE' || category === 'CRITICAL';
  });
};

// ============================================
// ANÁLISE AGREGADA (LISTA DE TRADES)
// ============================================

/**
 * Análise emocional completa de uma lista de trades
 */
export const analyzeEmotions = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      byEmotion: [],
      byCategory: {},
      consistencyRate: 0,
      avgEmotionalScore: 0,
      tiltSequences: [],
      isCurrentlyInTilt: false,
      bestEmotion: null,
      worstEmotion: null,
      recommendations: []
    };
  }

  // Agrupa por emoção
  const emotionGroups = {};
  let consistentCount = 0;
  let totalScore = 0;
  
  trades.forEach(trade => {
    const emotion = trade.emotionEntry || trade.emotion || 'Não Informado';
    
    if (!emotionGroups[emotion]) {
      emotionGroups[emotion] = {
        emotion,
        category: getEmotionCategory(emotion),
        riskLevel: getEmotionRiskLevel(emotion),
        count: 0,
        wins: 0,
        losses: 0,
        totalPL: 0,
        trades: []
      };
    }
    
    const group = emotionGroups[emotion];
    group.count++;
    group.totalPL += trade.result || 0;
    group.trades.push(trade);
    
    if ((trade.result || 0) > 0) group.wins++;
    else if ((trade.result || 0) < 0) group.losses++;
    
    // Consistência
    const consistency = analyzeTradeEmotionalConsistency(trade);
    if (consistency.consistent) consistentCount++;
    
    // Score
    totalScore += calculateTradeEmotionalScore(trade);
  });

  // Calcula métricas por emoção
  const byEmotion = Object.values(emotionGroups)
    .map(g => ({
      ...g,
      winRate: g.count > 0 ? (g.wins / g.count) * 100 : 0,
      avgPL: g.count > 0 ? g.totalPL / g.count : 0
    }))
    .sort((a, b) => b.totalPL - a.totalPL);

  // Agrupa por categoria
  const byCategory = {
    POSITIVE: byEmotion.filter(e => e.category === 'POSITIVE'),
    NEUTRAL: byEmotion.filter(e => e.category === 'NEUTRAL'),
    NEGATIVE: byEmotion.filter(e => e.category === 'NEGATIVE'),
    CRITICAL: byEmotion.filter(e => e.category === 'CRITICAL')
  };

  // Tilt detection
  const tiltSequences = detectTiltSequences(trades);
  const isCurrentlyInTilt = isInTilt(trades);

  // Best/Worst emotions
  const validEmotions = byEmotion.filter(e => e.count >= 3 && e.emotion !== 'Não Informado');
  const bestEmotion = validEmotions.length > 0 
    ? validEmotions.reduce((best, curr) => curr.winRate > best.winRate ? curr : best)
    : null;
  const worstEmotion = validEmotions.length > 0
    ? validEmotions.reduce((worst, curr) => curr.winRate < worst.winRate ? curr : worst)
    : null;

  // Recomendações
  const recommendations = generateRecommendations({
    byEmotion,
    byCategory,
    consistencyRate: trades.length > 0 ? (consistentCount / trades.length) * 100 : 0,
    isCurrentlyInTilt,
    bestEmotion,
    worstEmotion
  });

  return {
    totalTrades: trades.length,
    byEmotion,
    byCategory,
    consistencyRate: trades.length > 0 ? (consistentCount / trades.length) * 100 : 0,
    avgEmotionalScore: trades.length > 0 ? totalScore / trades.length : 0,
    tiltSequences,
    isCurrentlyInTilt,
    bestEmotion,
    worstEmotion,
    recommendations
  };
};

// ============================================
// ANÁLISE POR PLANO (PERÍODO/CICLO)
// ============================================

/**
 * Análise emocional para um período/ciclo específico do plano
 */
export const analyzePlanEmotions = (trades, plan, periodType = 'period') => {
  const baseAnalysis = analyzeEmotions(trades);
  
  // Métricas específicas do plano
  const criticalTradesCount = trades.filter(t => {
    const emotion = t.emotionEntry || t.emotion;
    return getEmotionCategory(emotion) === 'CRITICAL';
  }).length;

  const criticalRate = trades.length > 0 ? (criticalTradesCount / trades.length) * 100 : 0;

  // Compliance emocional (% de trades em estados positivos/neutros)
  const safeTradesCount = trades.filter(t => {
    const emotion = t.emotionEntry || t.emotion;
    const category = getEmotionCategory(emotion);
    return category === 'POSITIVE' || category === 'NEUTRAL';
  }).length;

  const emotionalComplianceRate = trades.length > 0 ? (safeTradesCount / trades.length) * 100 : 0;

  // Score de risco emocional do período (0-100, menor = melhor)
  const periodRiskScore = calculatePeriodRiskScore(trades);

  // Tendência emocional (comparando primeira e segunda metade)
  const emotionalTrend = calculateEmotionalTrend(trades);

  return {
    ...baseAnalysis,
    periodType,
    planName: plan?.name,
    criticalTradesCount,
    criticalRate,
    emotionalComplianceRate,
    periodRiskScore,
    emotionalTrend,
    alerts: generatePlanAlerts({
      criticalRate,
      emotionalComplianceRate,
      isCurrentlyInTilt: baseAnalysis.isCurrentlyInTilt,
      tiltSequences: baseAnalysis.tiltSequences
    })
  };
};

/**
 * Calcula score de risco emocional do período
 */
const calculatePeriodRiskScore = (trades) => {
  if (!trades || trades.length === 0) return 0;
  
  let totalRisk = 0;
  trades.forEach(trade => {
    const emotion = trade.emotionEntry || trade.emotion;
    const level = getEmotionRiskLevel(emotion);
    const riskValues = { LOW: 0, MEDIUM: 25, HIGH: 50, CRITICAL: 100 };
    totalRisk += riskValues[level] || 25;
  });
  
  return totalRisk / trades.length;
};

/**
 * Calcula tendência emocional (melhorando ou piorando)
 */
const calculateEmotionalTrend = (trades) => {
  if (!trades || trades.length < 4) return 'STABLE';
  
  const sorted = [...trades].sort((a, b) => 
    (a.entryTime || a.date || '').localeCompare(b.entryTime || b.date || '')
  );
  
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  
  const firstScore = firstHalf.reduce((sum, t) => sum + calculateTradeEmotionalScore(t), 0) / firstHalf.length;
  const secondScore = secondHalf.reduce((sum, t) => sum + calculateTradeEmotionalScore(t), 0) / secondHalf.length;
  
  const diff = secondScore - firstScore;
  
  if (diff > 10) return 'IMPROVING';
  if (diff < -10) return 'WORSENING';
  return 'STABLE';
};

// ============================================
// RECOMENDAÇÕES
// ============================================

const generateRecommendations = ({ byCategory, consistencyRate, isCurrentlyInTilt, bestEmotion, worstEmotion }) => {
  const recommendations = [];
  
  // Alerta de tilt
  if (isCurrentlyInTilt) {
    recommendations.push({
      type: 'CRITICAL',
      icon: '🚨',
      title: 'Possível Tilt Detectado',
      message: 'Seus últimos 3 trades foram em estados emocionais negativos. Considere pausar e revisar sua estratégia.',
      action: 'Pause e respire antes do próximo trade'
    });
  }

  // Muitos trades em estado crítico
  const criticalTrades = byCategory.CRITICAL?.reduce((sum, e) => sum + e.count, 0) || 0;
  const totalTrades = Object.values(byCategory).flat().reduce((sum, e) => sum + e.count, 0);
  
  if (totalTrades > 0 && (criticalTrades / totalTrades) > 0.2) {
    recommendations.push({
      type: 'WARNING',
      icon: '⚠️',
      title: 'Alto Índice de Estados Críticos',
      message: `${((criticalTrades / totalTrades) * 100).toFixed(0)}% dos seus trades foram em estados emocionais críticos.`,
      action: 'Desenvolva rotinas de preparação mental antes de operar'
    });
  }

  // Baixa consistência
  if (consistencyRate < 50 && totalTrades >= 5) {
    recommendations.push({
      type: 'INFO',
      icon: '💡',
      title: 'Oscilação Emocional',
      message: 'Sua emoção muda significativamente entre entrada e saída dos trades.',
      action: 'Pratique técnicas de controle emocional durante a operação'
    });
  }

  // Melhor estado emocional
  if (bestEmotion && bestEmotion.winRate > 60) {
    recommendations.push({
      type: 'SUCCESS',
      icon: '✨',
      title: `Seu Melhor Estado: ${bestEmotion.emotion}`,
      message: `Win rate de ${bestEmotion.winRate.toFixed(0)}% quando está ${bestEmotion.emotion.toLowerCase()}.`,
      action: `Busque replicar esse estado emocional antes de operar`
    });
  }

  // Pior estado emocional
  if (worstEmotion && worstEmotion.winRate < 40 && worstEmotion.count >= 3) {
    recommendations.push({
      type: 'WARNING',
      icon: '🔴',
      title: `Evite Operar: ${worstEmotion.emotion}`,
      message: `Win rate de apenas ${worstEmotion.winRate.toFixed(0)}% quando está ${worstEmotion.emotion.toLowerCase()}.`,
      action: `Considere pausar quando perceber esse estado emocional`
    });
  }

  return recommendations;
};

const generatePlanAlerts = ({ criticalRate, emotionalComplianceRate, isCurrentlyInTilt, tiltSequences }) => {
  const alerts = [];

  if (isCurrentlyInTilt) {
    alerts.push({
      severity: 'critical',
      message: 'Tilt ativo detectado - Recomendado pausar operações'
    });
  }

  if (criticalRate > 30) {
    alerts.push({
      severity: 'high',
      message: `${criticalRate.toFixed(0)}% dos trades em estados críticos`
    });
  }

  if (emotionalComplianceRate < 50) {
    alerts.push({
      severity: 'medium',
      message: 'Compliance emocional abaixo de 50%'
    });
  }

  if (tiltSequences.length > 0) {
    alerts.push({
      severity: 'info',
      message: `${tiltSequences.length} sequência(s) de tilt no período`
    });
  }

  return alerts;
};

// ============================================
// EXPORTS
// ============================================

export default {
  EMOTION_CATEGORIES,
  EMOTION_RISK_LEVEL,
  EMOTION_COLORS,
  getEmotionCategory,
  getEmotionRiskLevel,
  isHighRiskEmotion,
  analyzeTradeEmotionalConsistency,
  calculateTradeEmotionalScore,
  detectTiltSequences,
  isInTilt,
  analyzeEmotions,
  analyzePlanEmotions
};
