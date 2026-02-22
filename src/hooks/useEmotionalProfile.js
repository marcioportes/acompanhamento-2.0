import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMasterData } from './useMasterData';
import {
  analyzeEmotionsV2,
  calculatePeriodScore,
  calculateStudentStatus,
  calculateDailyScores,
  analyzeComplianceEmotional,
  DEFAULT_DETECTION_CONFIG
} from '../utils/emotionalAnalysisV2';

/**
 * Hook para Perfil Emocional do Aluno
 * @version 1.0.0 (Fase 1.3.1 - Fundação)
 * 
 * RESPONSABILIDADES:
 * - Executa análise emocional V2 sobre trades de um período
 * - Calcula score, distribuição, tendência e status do aluno
 * - Detecta TILT, REVENGE, OVERTRADING
 * - Correlaciona compliance financeiro com emocional
 * - Fornece dados prontos para componentes de UI
 * 
 * NOTA: Na Fase 1.4.0, este hook também irá:
 * - Persistir emotionalProfile no Firestore
 * - Carregar histórico de ciclos anteriores
 * - Calcular comparação entre ciclos
 * 
 * COMO USAR:
 * ```jsx
 * const { analysis, status, dailyScores, isAnalyzing } = useEmotionalProfile({
 *   trades: filteredTrades,
 *   complianceResult: planCompliance
 * });
 * ```
 * 
 * @param {Object} options
 * @param {Array} options.trades - Trades a analisar
 * @param {Object} options.complianceResult - Resultado do analyzePlanCompliance() (opcional)
 * @param {Object} options.detectionConfig - Config personalizada de detecção (opcional)
 * @param {Object} options.statusThresholds - Thresholds personalizados (opcional)
 * @returns {Object} Perfil emocional completo
 */
export const useEmotionalProfile = ({
  trades = [],
  complianceResult = null,
  detectionConfig = DEFAULT_DETECTION_CONFIG,
  statusThresholds = {}
} = {}) => {
  const { getEmotionConfig, emotions } = useMasterData();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ==================== ANÁLISE PRINCIPAL ====================

  /**
   * Análise emocional completa (memoizada)
   * Recalcula apenas quando trades ou emotions mudam
   */
  const analysis = useMemo(() => {
    if (!trades || trades.length === 0 || emotions.length === 0) {
      return null;
    }

    return analyzeEmotionsV2(trades, getEmotionConfig, detectionConfig);
  }, [trades, emotions, getEmotionConfig, detectionConfig]);

  // ==================== STATUS DO ALUNO ====================

  /**
   * Status calculado do aluno (HEALTHY | ATTENTION | WARNING | CRITICAL)
   */
  const status = useMemo(() => {
    if (!analysis) {
      return {
        status: 'HEALTHY',
        adjustedScore: 100,
        label: 'Saudável',
        color: '#22c55e',
        emoji: '🟢',
        penalty: 0
      };
    }

    return calculateStudentStatus(
      analysis.periodScore.score,
      analysis.complianceEvents,
      statusThresholds
    );
  }, [analysis, statusThresholds]);

  // ==================== SCORES DIÁRIOS ====================

  /**
   * Scores por dia (para gráficos de evolução)
   */
  const dailyScores = useMemo(() => {
    if (!trades || trades.length === 0 || emotions.length === 0) {
      return [];
    }
    return calculateDailyScores(trades, getEmotionConfig);
  }, [trades, emotions, getEmotionConfig]);

  // ==================== CORRELAÇÃO COMPLIANCE ====================

  /**
   * Correlação entre compliance financeiro e emocional
   * Depende do resultado do analyzePlanCompliance() passado como prop
   */
  const complianceEmotional = useMemo(() => {
    if (!complianceResult || !trades || trades.length === 0 || emotions.length === 0) {
      return null;
    }
    return analyzeComplianceEmotional(complianceResult, trades, getEmotionConfig);
  }, [complianceResult, trades, emotions, getEmotionConfig]);

  // ==================== MÉTRICAS RESUMIDAS ====================

  /**
   * Métricas resumidas prontas para cards de dashboard
   */
  const metrics = useMemo(() => {
    if (!analysis) {
      return {
        score: 100,
        tradesCount: 0,
        positivePercent: 0,
        negativePercent: 0,
        criticalPercent: 0,
        tiltCount: 0,
        revengeCount: 0,
        trend: 'STABLE',
        topEmotion: null
      };
    }

    const total = analysis.tradesCount;
    const dist = analysis.distribution;

    return {
      score: analysis.periodScore.score,
      tradesCount: total,
      positivePercent: total > 0 ? Math.round((dist.POSITIVE / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round(((dist.NEGATIVE + dist.CRITICAL) / total) * 100) : 0,
      criticalPercent: total > 0 ? Math.round((dist.CRITICAL / total) * 100) : 0,
      tiltCount: analysis.tilt.sequences?.length || 0,
      revengeCount: analysis.revenge.count || 0,
      trend: analysis.emotionalTrend,
      topEmotion: analysis.topEmotions?.[0] || null,
      overtradingDays: analysis.overtrading.days?.length || 0
    };
  }, [analysis]);

  // ==================== ALERTAS CONSOLIDADOS ====================

  /**
   * Lista unificada de alertas (compliance + emocional)
   * Ordenados por severidade (CRITICAL primeiro)
   */
  const alerts = useMemo(() => {
    const allAlerts = [];

    // Alertas de TILT
    if (analysis?.tilt?.detected) {
      analysis.tilt.sequences.forEach((seq, i) => {
        allAlerts.push({
          id: `tilt_${i}`,
          type: 'TILT_DETECTED',
          severity: seq.severity,
          message: `TILT detectado: ${seq.trades.length} trades consecutivos com emoção negativa`,
          timestamp: seq.startTime,
          details: seq
        });
      });
    }

    // Alertas de REVENGE
    if (analysis?.revenge?.detected) {
      analysis.revenge.instances.forEach((inst, i) => {
        allAlerts.push({
          id: `revenge_${i}`,
          type: 'REVENGE_DETECTED',
          severity: inst.severity,
          message: inst.type === 'RAPID_SEQUENCE'
            ? `Revenge: ${inst.tradesAfter} trades em ${inst.windowMinutes}min após loss`
            : inst.type === 'EXPLICIT_EMOTION'
              ? `Emoção "Revanche" detectada`
              : `Revenge: posição aumentada ${inst.qtyIncrease} após loss`,
          timestamp: inst.trade?.entryTime || inst.triggerTrade?.entryTime,
          details: inst
        });
      });
    }

    // Alertas de compliance emocional
    if (complianceEmotional?.alerts) {
      complianceEmotional.alerts.forEach((alert, i) => {
        allAlerts.push({
          id: `compliance_${i}`,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.trade?.entryTime,
          details: alert
        });
      });
    }

    // Alerta de status crítico
    if (status.status === 'CRITICAL') {
      allAlerts.push({
        id: 'status_critical',
        type: 'STATUS_CRITICAL',
        severity: 'CRITICAL',
        message: `Score emocional crítico: ${status.adjustedScore}/100`,
        timestamp: new Date().toISOString(),
        details: status
      });
    }

    // Ordena por severidade
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    allAlerts.sort((a, b) => 
      (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3)
    );

    return allAlerts;
  }, [analysis, complianceEmotional, status]);

  // ==================== RETORNO ====================

  return {
    // Análise completa (para componentes que precisam de tudo)
    analysis,
    
    // Status do aluno (HEALTHY/ATTENTION/WARNING/CRITICAL)
    status,
    
    // Scores por dia (para gráficos)
    dailyScores,
    
    // Correlação compliance + emocional
    complianceEmotional,
    
    // Métricas resumidas (para cards)
    metrics,
    
    // Alertas consolidados
    alerts,
    
    // Estado de processamento
    isAnalyzing,
    
    // Flag: dados disponíveis para análise
    hasData: trades.length > 0 && emotions.length > 0,
    
    // Flag: análise concluída com dados
    isReady: !!analysis && emotions.length > 0
  };
};

export default useEmotionalProfile;
