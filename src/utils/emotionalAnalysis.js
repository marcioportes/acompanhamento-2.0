/**
 * Análise Emocional Avançada
 * @version 1.3.0
 * @description Sistema de estados psicológicos baseado em evidências para trading
 * 
 * FUNDAMENTAÇÃO:
 * - Mark Douglas - "Trading in the Zone"
 * - Brett Steenbarger - "The Psychology of Trading"
 * - Van Tharp - R-Multiples e Expectancy
 * - Pesquisas pós-COVID sobre comportamento de traders retail
 * 
 * CHANGELOG:
 * - 1.3.0: Set de 15 emoções, detecção de TILT/REVENGE/FOMO, padrões comportamentais
 * - 1.2.0: Versão anterior com categorização básica
 */

// ============================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================

/**
 * Categorias de Emoção por Score
 */
export const EMOTION_CATEGORIES = {
  POSITIVE: { min: 1, max: 3, label: 'Positiva', color: '#10b981' },
  NEUTRAL: { min: 0, max: 0, label: 'Neutra', color: '#64748b' },
  NEGATIVE: { min: -2, max: -1, label: 'Negativa', color: '#f59e0b' },
  CRITICAL: { min: -4, max: -3, label: 'Crítica', color: '#ef4444' }
};

/**
 * Set de 15 Emoções Pré-Definidas
 * Score: +3 (melhor) a -4 (pior)
 */
export const EMOTIONS = {
  // POSITIVAS (+1 a +3)
  DISCIPLINADO: {
    id: 'DISCIPLINADO',
    label: 'Disciplinado',
    emoji: '🎯',
    score: 3,
    category: 'POSITIVE',
    description: 'Seguiu o plano rigorosamente',
    indicators: ['Respeitou stop/alvo', 'Sizing correto', 'Setup documentado']
  },
  CONFIANTE: {
    id: 'CONFIANTE',
    label: 'Confiante',
    emoji: '💪',
    score: 2,
    category: 'POSITIVE',
    description: 'Executou sem hesitação',
    indicators: ['Entrada precisa', 'Sem ajustes de stop', 'Posição adequada']
  },
  FOCADO: {
    id: 'FOCADO',
    label: 'Focado',
    emoji: '🧘',
    score: 2,
    category: 'POSITIVE',
    description: 'Concentrado e presente',
    indicators: ['Horário ideal', 'Sem distrações', 'Uma coisa de cada vez']
  },
  PACIENTE: {
    id: 'PACIENTE',
    label: 'Paciente',
    emoji: '⏳',
    score: 1,
    category: 'POSITIVE',
    description: 'Aguardou confirmação',
    indicators: ['Esperou setup formar', 'Não antecipou entrada', 'Timing correto']
  },

  // NEUTRAS (0)
  NEUTRO: {
    id: 'NEUTRO',
    label: 'Neutro',
    emoji: '😐',
    score: 0,
    category: 'NEUTRAL',
    description: 'Sem emoção dominante',
    indicators: ['Estado base', 'Sem viés', 'Execução mecânica']
  },
  CAUTELOSO: {
    id: 'CAUTELOSO',
    label: 'Cauteloso',
    emoji: '🛡️',
    score: 0,
    category: 'NEUTRAL',
    description: 'Operando com cuidado extra',
    indicators: ['Posição menor', 'Stop mais curto', 'Conservador']
  },
  ANALITICO: {
    id: 'ANALITICO',
    label: 'Analítico',
    emoji: '🔍',
    score: 0,
    category: 'NEUTRAL',
    description: 'Processo racional',
    indicators: ['Muita análise', 'Anotações detalhadas', 'Possível paralisia']
  },

  // NEGATIVAS (-1 a -2)
  ANSIOSO: {
    id: 'ANSIOSO',
    label: 'Ansioso',
    emoji: '😰',
    score: -1,
    category: 'NEGATIVE',
    description: 'Nervosismo afetando decisões',
    indicators: ['Entrada antecipada', 'Verificação frequente', 'Stop movido']
  },
  HESITANTE: {
    id: 'HESITANTE',
    label: 'Hesitante',
    emoji: '🤔',
    score: -1,
    category: 'NEGATIVE',
    description: 'Dúvida na execução',
    indicators: ['Corte prematuro', 'Entrada tardia', 'Segunda adivinhação']
  },
  FRUSTRADO: {
    id: 'FRUSTRADO',
    label: 'Frustrado',
    emoji: '😤',
    score: -2,
    category: 'NEGATIVE',
    description: 'Resultado anterior afetando',
    indicators: ['Após loss', 'Irritabilidade', 'Foco no resultado']
  },
  IMPACIENTE: {
    id: 'IMPACIENTE',
    label: 'Impaciente',
    emoji: '⚡',
    score: -2,
    category: 'NEGATIVE',
    description: 'Forçando oportunidades',
    indicators: ['Trade fora de horário', 'Sem setup claro', 'Pressa']
  },

  // CRÍTICAS (-3 a -4)
  FOMO: {
    id: 'FOMO',
    label: 'FOMO',
    emoji: '🔥',
    score: -3,
    category: 'CRITICAL',
    description: 'Medo de ficar de fora',
    indicators: ['Entrada tardia', 'Preço esticado', 'Sem plano']
  },
  REVENGE: {
    id: 'REVENGE',
    label: 'Revenge',
    emoji: '👊',
    score: -3,
    category: 'CRITICAL',
    description: 'Tentando recuperar loss',
    indicators: ['Após loss grande', 'Posição aumentada', 'Sem setup']
  },
  TILT: {
    id: 'TILT',
    label: 'Tilt',
    emoji: '🌀',
    score: -4,
    category: 'CRITICAL',
    description: 'Perda de controle emocional',
    indicators: ['Trades consecutivos', 'Sem pausa', 'Regras ignoradas']
  },
  PANICO: {
    id: 'PANICO',
    label: 'Pânico',
    emoji: '😱',
    score: -4,
    category: 'CRITICAL',
    description: 'Decisão irracional',
    indicators: ['Saída antes do stop', 'Fechar sem motivo', 'Medo extremo']
  }
};

/**
 * Cores por emoção para gráficos
 */
export const EMOTION_COLORS = {
  'Disciplinado': '#10b981',
  'Confiante': '#34d399',
  'Focado': '#6ee7b7',
  'Paciente': '#a7f3d0',
  'Neutro': '#64748b',
  'Cauteloso': '#94a3b8',
  'Analítico': '#cbd5e1',
  'Ansioso': '#fcd34d',
  'Hesitante': '#fbbf24',
  'Frustrado': '#f59e0b',
  'Impaciente': '#d97706',
  'FOMO': '#f87171',
  'Revenge': '#ef4444',
  'Tilt': '#dc2626',
  'Pânico': '#b91c1c'
};

/**
 * Lista de emoções para dropdown
 */
export const EMOTION_OPTIONS = Object.values(EMOTIONS).map(e => ({
  value: e.id,
  label: `${e.emoji} ${e.label}`,
  score: e.score,
  category: e.category
}));

// ============================================
// FUNÇÕES DE ANÁLISE
// ============================================

/**
 * Obtém configuração da emoção pelo nome
 */
export const getEmotionConfig = (emotionName) => {
  if (!emotionName) return null;
  
  const normalized = emotionName.toUpperCase().replace(/\s+/g, '_');
  return EMOTIONS[normalized] || null;
};

/**
 * Obtém score de uma emoção
 */
export const getEmotionScore = (emotionName) => {
  const config = getEmotionConfig(emotionName);
  return config?.score ?? 0;
};

/**
 * Obtém categoria de uma emoção
 */
export const getEmotionCategory = (emotionName) => {
  const config = getEmotionConfig(emotionName);
  return config?.category ?? 'NEUTRAL';
};

/**
 * Calcula score emocional de um trade
 * Considera: emotionEntry, emotionExit, consistência
 */
export const calculateTradeEmotionalScore = (trade) => {
  const entryScore = getEmotionScore(trade.emotionEntry || trade.emotion);
  const exitScore = getEmotionScore(trade.emotionExit);
  
  // Se não tem exit, usa entry
  if (!trade.emotionExit) {
    return entryScore;
  }
  
  // Média ponderada (entry 60%, exit 40%)
  return entryScore * 0.6 + exitScore * 0.4;
};

/**
 * Verifica consistência emocional (entry vs exit)
 */
export const checkEmotionalConsistency = (trade) => {
  if (!trade.emotionEntry || !trade.emotionExit) {
    return { consistent: true, reason: 'Dados incompletos' };
  }
  
  const entryScore = getEmotionScore(trade.emotionEntry);
  const exitScore = getEmotionScore(trade.emotionExit);
  const diff = Math.abs(entryScore - exitScore);
  
  if (diff <= 1) {
    return { consistent: true, reason: 'Estável' };
  } else if (diff <= 2) {
    return { consistent: false, reason: 'Variação moderada' };
  } else {
    return { consistent: false, reason: 'Instabilidade emocional' };
  }
};

// ============================================
// DETECÇÃO DE PADRÕES COMPORTAMENTAIS
// ============================================

/**
 * Detecta sequência de TILT
 * Critérios: 3+ trades consecutivos com emoção negativa/crítica + resultado negativo
 */
export const detectTilt = (trades, options = {}) => {
  const {
    minSequence = 3,
    maxIntervalMinutes = 30,
    requireNegativeResult = true
  } = options;
  
  if (!trades || trades.length < minSequence) {
    return { detected: false, sequences: [] };
  }
  
  // Ordena por data/hora
  const sorted = [...trades].sort((a, b) => {
    const timeA = a.exitTime || a.entryTime || a.date;
    const timeB = b.exitTime || b.entryTime || b.date;
    return new Date(timeA) - new Date(timeB);
  });
  
  const sequences = [];
  let currentSequence = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const category = getEmotionCategory(trade.emotionEntry || trade.emotion);
    const isNegativeEmotion = category === 'NEGATIVE' || category === 'CRITICAL';
    const isNegativeResult = !requireNegativeResult || (trade.result < 0);
    
    if (isNegativeEmotion && isNegativeResult) {
      // Verifica intervalo com trade anterior
      if (currentSequence.length > 0) {
        const prevTrade = currentSequence[currentSequence.length - 1];
        const prevTime = new Date(prevTrade.exitTime || prevTrade.entryTime || prevTrade.date);
        const currTime = new Date(trade.entryTime || trade.date);
        const intervalMin = (currTime - prevTime) / 60000;
        
        if (intervalMin > maxIntervalMinutes) {
          // Intervalo muito grande, reseta sequência
          if (currentSequence.length >= minSequence) {
            sequences.push([...currentSequence]);
          }
          currentSequence = [];
        }
      }
      
      currentSequence.push(trade);
    } else {
      // Trade positivo/neutro, finaliza sequência
      if (currentSequence.length >= minSequence) {
        sequences.push([...currentSequence]);
      }
      currentSequence = [];
    }
  }
  
  // Verifica última sequência
  if (currentSequence.length >= minSequence) {
    sequences.push([...currentSequence]);
  }
  
  return {
    detected: sequences.length > 0,
    sequences,
    totalTiltTrades: sequences.reduce((sum, seq) => sum + seq.length, 0),
    severity: sequences.length > 1 ? 'CRITICAL' : sequences.length === 1 ? 'HIGH' : 'NONE'
  };
};

/**
 * Detecta Revenge Trading
 * Critérios: Trade após loss com posição > média * 1.5
 */
export const detectRevenge = (trades, options = {}) => {
  const {
    sizeMultiplier = 1.5,
    maxIntervalMinutes = 15
  } = options;
  
  if (!trades || trades.length < 2) {
    return { detected: false, instances: [] };
  }
  
  // Ordena por data/hora
  const sorted = [...trades].sort((a, b) => {
    const timeA = a.exitTime || a.entryTime || a.date;
    const timeB = b.exitTime || b.entryTime || b.date;
    return new Date(timeA) - new Date(timeB);
  });
  
  // Calcula qty média
  const avgQty = sorted.reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0) / sorted.length;
  
  const instances = [];
  
  for (let i = 1; i < sorted.length; i++) {
    const prevTrade = sorted[i - 1];
    const currTrade = sorted[i];
    
    // Verifica se trade anterior foi loss
    if (prevTrade.result >= 0) continue;
    
    // Verifica intervalo
    const prevTime = new Date(prevTrade.exitTime || prevTrade.entryTime || prevTrade.date);
    const currTime = new Date(currTrade.entryTime || currTrade.date);
    const intervalMin = (currTime - prevTime) / 60000;
    
    if (intervalMin > maxIntervalMinutes) continue;
    
    // Verifica se qty aumentou significativamente
    const currQty = parseFloat(currTrade.qty) || 0;
    if (currQty > avgQty * sizeMultiplier) {
      instances.push({
        trade: currTrade,
        previousLoss: prevTrade.result,
        qtyIncrease: ((currQty / avgQty - 1) * 100).toFixed(0) + '%',
        intervalMinutes: intervalMin.toFixed(0)
      });
    }
  }
  
  return {
    detected: instances.length > 0,
    instances,
    count: instances.length,
    severity: instances.length >= 3 ? 'CRITICAL' : instances.length >= 1 ? 'HIGH' : 'NONE'
  };
};

/**
 * Detecta FOMO
 * Critérios: Emoção FOMO/Ansioso + entrada sem setup claro
 */
export const detectFomo = (trades) => {
  if (!trades || trades.length === 0) {
    return { detected: false, instances: [] };
  }
  
  const fomoEmotions = ['FOMO', 'Ansioso', 'Impaciente'];
  
  const instances = trades.filter(trade => {
    const emotion = trade.emotionEntry || trade.emotion || '';
    const isFomoEmotion = fomoEmotions.some(e => 
      emotion.toLowerCase().includes(e.toLowerCase())
    );
    const hasNoSetup = !trade.setup || trade.setup.toLowerCase() === 'sem setup';
    
    return isFomoEmotion || (isFomoEmotion && hasNoSetup);
  });
  
  return {
    detected: instances.length > 0,
    instances,
    count: instances.length,
    percentage: trades.length > 0 ? (instances.length / trades.length * 100).toFixed(1) : 0,
    totalLoss: instances.reduce((sum, t) => sum + (t.result < 0 ? t.result : 0), 0)
  };
};

/**
 * Detecta Overtrading
 * Critérios: Trades/dia > limite
 */
export const detectOvertrading = (trades, dailyLimit = 5) => {
  if (!trades || trades.length === 0) {
    return { detected: false, days: [] };
  }
  
  // Agrupa por dia
  const byDay = {};
  trades.forEach(trade => {
    const day = trade.date?.split('T')[0] || trade.date;
    if (!day) return;
    
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(trade);
  });
  
  const overtradingDays = Object.entries(byDay)
    .filter(([, dayTrades]) => dayTrades.length > dailyLimit)
    .map(([date, dayTrades]) => ({
      date,
      tradesCount: dayTrades.length,
      excess: dayTrades.length - dailyLimit,
      totalPL: dayTrades.reduce((sum, t) => sum + (t.result || 0), 0)
    }));
  
  return {
    detected: overtradingDays.length > 0,
    days: overtradingDays,
    avgExcess: overtradingDays.length > 0 
      ? (overtradingDays.reduce((sum, d) => sum + d.excess, 0) / overtradingDays.length).toFixed(1)
      : 0
  };
};

/**
 * Detecta estado "In The Zone"
 * Critérios: Últimos N trades com emoção positiva/neutra + win rate alto
 */
export const detectZoneState = (trades, windowSize = 5) => {
  if (!trades || trades.length < windowSize) {
    return { inZone: false, confidence: 0 };
  }
  
  // Pega últimos N trades
  const sorted = [...trades].sort((a, b) => {
    const timeA = a.exitTime || a.entryTime || a.date;
    const timeB = b.exitTime || b.entryTime || b.date;
    return new Date(timeB) - new Date(timeA); // Mais recentes primeiro
  });
  
  const recentTrades = sorted.slice(0, windowSize);
  
  // Verifica emoções positivas/neutras
  const positiveEmotions = recentTrades.filter(t => {
    const category = getEmotionCategory(t.emotionEntry || t.emotion);
    return category === 'POSITIVE' || category === 'NEUTRAL';
  }).length;
  
  // Verifica win rate
  const wins = recentTrades.filter(t => (t.result || 0) > 0).length;
  const winRate = wins / windowSize;
  
  // Verifica seguimento do plano
  const followedPlan = recentTrades.filter(t => {
    const emotion = (t.emotionEntry || t.emotion || '').toLowerCase();
    return emotion.includes('disciplinado') || emotion.includes('focado');
  }).length;
  
  const emotionScore = positiveEmotions / windowSize;
  const planScore = followedPlan / windowSize;
  const confidence = (emotionScore * 0.4 + winRate * 0.4 + planScore * 0.2) * 100;
  
  return {
    inZone: confidence >= 70,
    confidence: confidence.toFixed(0),
    metrics: {
      positiveEmotions,
      winRate: (winRate * 100).toFixed(0) + '%',
      followedPlan,
      windowSize
    }
  };
};

// ============================================
// ANÁLISE AGREGADA
// ============================================

/**
 * Análise emocional completa de um conjunto de trades
 */
export const analyzeEmotionalPatterns = (trades, plan = null) => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      avgEmotionalScore: 0,
      emotionDistribution: {},
      patterns: {
        tilt: { detected: false },
        revenge: { detected: false },
        fomo: { detected: false },
        overtrading: { detected: false },
        zone: { inZone: false }
      },
      alerts: [],
      recommendations: []
    };
  }
  
  // Distribuição de emoções
  const emotionDistribution = {};
  let totalScore = 0;
  let consistentCount = 0;
  
  trades.forEach(trade => {
    const emotion = trade.emotionEntry || trade.emotion || 'Não Informado';
    const normalizedEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();
    
    if (!emotionDistribution[normalizedEmotion]) {
      emotionDistribution[normalizedEmotion] = {
        emotion: normalizedEmotion,
        count: 0,
        wins: 0,
        losses: 0,
        totalPL: 0,
        avgScore: 0
      };
    }
    
    const group = emotionDistribution[normalizedEmotion];
    group.count++;
    group.totalPL += trade.result || 0;
    if ((trade.result || 0) > 0) group.wins++;
    else if ((trade.result || 0) < 0) group.losses++;
    
    totalScore += calculateTradeEmotionalScore(trade);
    
    const consistency = checkEmotionalConsistency(trade);
    if (consistency.consistent) consistentCount++;
  });
  
  // Calcula win rate por emoção
  Object.values(emotionDistribution).forEach(group => {
    group.winRate = group.count > 0 ? (group.wins / group.count * 100) : 0;
    group.avgPL = group.count > 0 ? group.totalPL / group.count : 0;
  });
  
  // Ordena por count
  const byEmotion = Object.values(emotionDistribution)
    .sort((a, b) => b.count - a.count);
  
  // Detecta padrões
  const tilt = detectTilt(trades);
  const revenge = detectRevenge(trades);
  const fomo = detectFomo(trades);
  const overtrading = detectOvertrading(trades, plan?.maxDailyTrades || 5);
  const zone = detectZoneState(trades);
  
  // Gera alertas
  const alerts = [];
  
  if (tilt.detected) {
    alerts.push({
      type: 'TILT',
      severity: tilt.severity,
      message: `Tilt detectado: ${tilt.totalTiltTrades} trades em sequência negativa`,
      recommendation: 'Pausar operações por pelo menos 1 hora'
    });
  }
  
  if (revenge.detected) {
    alerts.push({
      type: 'REVENGE',
      severity: revenge.severity,
      message: `Revenge trading: ${revenge.count} ocorrência(s)`,
      recommendation: 'Retornar ao sizing padrão após loss'
    });
  }
  
  if (fomo.detected && parseFloat(fomo.percentage) > 20) {
    alerts.push({
      type: 'FOMO',
      severity: 'MEDIUM',
      message: `FOMO em ${fomo.percentage}% dos trades`,
      recommendation: 'Aguardar setups confirmados'
    });
  }
  
  if (overtrading.detected) {
    alerts.push({
      type: 'OVERTRADING',
      severity: 'MEDIUM',
      message: `Overtrading em ${overtrading.days.length} dia(s)`,
      recommendation: 'Respeitar limite diário de trades'
    });
  }
  
  if (zone.inZone) {
    alerts.push({
      type: 'ZONE',
      severity: 'POSITIVE',
      message: `In The Zone! Confiança: ${zone.confidence}%`,
      recommendation: 'Manter ritmo e disciplina'
    });
  }
  
  // Calcula métricas agregadas
  const avgEmotionalScore = trades.length > 0 ? totalScore / trades.length : 0;
  const consistencyRate = trades.length > 0 ? (consistentCount / trades.length * 100) : 0;
  
  // Categorias agregadas
  const categoryCount = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, CRITICAL: 0 };
  trades.forEach(trade => {
    const category = getEmotionCategory(trade.emotionEntry || trade.emotion);
    categoryCount[category]++;
  });
  
  const complianceRate = trades.length > 0
    ? ((categoryCount.POSITIVE + categoryCount.NEUTRAL) / trades.length * 100)
    : 0;
  
  // Melhor e pior emoção
  const sortedByPL = byEmotion.filter(e => e.count >= 2).sort((a, b) => b.avgPL - a.avgPL);
  const bestEmotion = sortedByPL[0]?.emotion || '-';
  const worstEmotion = sortedByPL[sortedByPL.length - 1]?.emotion || '-';
  
  return {
    totalTrades: trades.length,
    avgEmotionalScore: parseFloat(avgEmotionalScore.toFixed(2)),
    consistencyRate: parseFloat(consistencyRate.toFixed(1)),
    complianceRate: parseFloat(complianceRate.toFixed(1)),
    emotionDistribution: categoryCount,
    byEmotion,
    bestEmotion,
    worstEmotion,
    patterns: {
      tilt,
      revenge,
      fomo,
      overtrading,
      zone
    },
    alerts,
    recommendations: alerts.map(a => a.recommendation).filter(Boolean)
  };
};

/**
 * Análise de emoções específica para um plano (período/ciclo)
 */
export const analyzePlanEmotions = (trades, plan, scope = 'period') => {
  const analysis = analyzeEmotionalPatterns(trades, plan);
  
  // Adiciona contexto do plano
  const scopeLabel = scope === 'period' ? plan.operationPeriod : plan.adjustmentCycle;
  
  // Calcula tendência emocional (comparando primeira e segunda metade)
  let emotionalTrend = 'STABLE';
  if (trades.length >= 4) {
    const sorted = [...trades].sort((a, b) => {
      const timeA = a.exitTime || a.entryTime || a.date;
      const timeB = b.exitTime || b.entryTime || b.date;
      return new Date(timeA) - new Date(timeB);
    });
    
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    
    const firstScore = firstHalf.reduce((sum, t) => sum + calculateTradeEmotionalScore(t), 0) / firstHalf.length;
    const secondScore = secondHalf.reduce((sum, t) => sum + calculateTradeEmotionalScore(t), 0) / secondHalf.length;
    
    if (secondScore > firstScore + 0.5) emotionalTrend = 'IMPROVING';
    else if (secondScore < firstScore - 0.5) emotionalTrend = 'WORSENING';
  }
  
  // Score de risco do período
  const periodRiskScore = Math.min(100, Math.max(0,
    (analysis.patterns.tilt.detected ? 30 : 0) +
    (analysis.patterns.revenge.detected ? 25 : 0) +
    (analysis.patterns.fomo.detected ? 15 : 0) +
    (analysis.patterns.overtrading.detected ? 10 : 0) +
    (analysis.avgEmotionalScore < 0 ? Math.abs(analysis.avgEmotionalScore) * 10 : 0)
  ));
  
  return {
    ...analysis,
    scopeLabel,
    emotionalTrend,
    periodRiskScore,
    emotionalComplianceRate: analysis.complianceRate
  };
};

// ============================================
// EXPORTS
// ============================================

export default {
  EMOTIONS,
  EMOTION_OPTIONS,
  EMOTION_COLORS,
  EMOTION_CATEGORIES,
  getEmotionConfig,
  getEmotionScore,
  getEmotionCategory,
  calculateTradeEmotionalScore,
  checkEmotionalConsistency,
  detectTilt,
  detectRevenge,
  detectFomo,
  detectOvertrading,
  detectZoneState,
  analyzeEmotionalPatterns,
  analyzePlanEmotions
};
