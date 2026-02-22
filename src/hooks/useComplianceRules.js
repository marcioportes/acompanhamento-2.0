/**
 * useComplianceRules
 * @version 1.0.0 (Fase 1.3.2)
 * @description CRUD para regras de compliance emocional do mentor
 * 
 * PATH FIRESTORE: mentorConfig/{mentorId}/complianceRules (documento único)
 * 
 * RESPONSABILIDADES:
 * - Carrega config do mentor logado (realtime listener)
 * - Salva configuração com merge (não sobrescreve campos ausentes)
 * - Reseta para defaults
 * - Fornece config pronta para emotionalAnalysisV2
 * 
 * COMO USAR:
 * ```jsx
 * const { config, detectionConfig, save, reset, loading } = useComplianceRules();
 * 
 * // Para UI de configuração:
 * await save({ tilt: { ...config.tilt, consecutiveTrades: 5 } });
 * 
 * // Para passar ao emotionalAnalysisV2:
 * const analysis = analyzeEmotionsV2(trades, getEmotionConfig, detectionConfig);
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_DETECTION_CONFIG } from '../utils/emotionalAnalysisV2';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_COMPLIANCE_RULES = {
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
  },
  studentStatus: {
    healthyMinScore: 70,
    attentionMinScore: 50,
    warningMinScore: 30,
    criticalBelowScore: 30
  },
  notifications: {
    notifyOnCritical: true,
    notifyOnTilt: true,
    notifyOnRevenge: true,
    notifyDailyDigest: false
  }
};

// ============================================
// HOOK
// ============================================

export const useComplianceRules = () => {
  const { user, isMentor } = useAuth();
  const [config, setConfig] = useState(DEFAULT_COMPLIANCE_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  // Documento path: mentorConfig/{userId}
  const docPath = user?.uid ? `mentorConfig/${user.uid}` : null;

  // ==================== LISTENER REALTIME ====================

  useEffect(() => {
    if (!docPath) {
      setConfig(DEFAULT_COMPLIANCE_RULES);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, docPath);

    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Merge com defaults para garantir que campos novos existam
        setConfig({
          tilt: { ...DEFAULT_COMPLIANCE_RULES.tilt, ...data.tilt },
          revenge: { ...DEFAULT_COMPLIANCE_RULES.revenge, ...data.revenge },
          overtrading: { ...DEFAULT_COMPLIANCE_RULES.overtrading, ...data.overtrading },
          studentStatus: { ...DEFAULT_COMPLIANCE_RULES.studentStatus, ...data.studentStatus },
          notifications: { ...DEFAULT_COMPLIANCE_RULES.notifications, ...data.notifications }
        });
        setLastSaved(data.updatedAt);
      } else {
        setConfig(DEFAULT_COMPLIANCE_RULES);
      }
      setLoading(false);
    }, (err) => {
      console.error('useComplianceRules listener error:', err);
      setError(err.message);
      setConfig(DEFAULT_COMPLIANCE_RULES);
      setLoading(false);
    });

    return () => unsub();
  }, [docPath]);

  // ==================== SAVE ====================

  const save = useCallback(async (partialConfig) => {
    if (!docPath) throw new Error('Usuário não autenticado');
    
    setSaving(true);
    setError(null);

    try {
      const merged = {
        tilt: { ...config.tilt, ...partialConfig.tilt },
        revenge: { ...config.revenge, ...partialConfig.revenge },
        overtrading: { ...config.overtrading, ...partialConfig.overtrading },
        studentStatus: { ...config.studentStatus, ...partialConfig.studentStatus },
        notifications: { ...config.notifications, ...partialConfig.notifications },
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      };

      await setDoc(doc(db, docPath), merged, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error('useComplianceRules save error:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [docPath, config, user]);

  // ==================== RESET ====================

  const reset = useCallback(async () => {
    if (!docPath) return;
    
    setSaving(true);
    try {
      await setDoc(doc(db, docPath), {
        ...DEFAULT_COMPLIANCE_RULES,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      });
    } catch (err) {
      console.error('useComplianceRules reset error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [docPath, user]);

  // ==================== DETECTION CONFIG ====================

  /**
   * Config formatada para passar ao emotionalAnalysisV2
   * Mapeia a estrutura do Firestore para o formato esperado pela engine
   */
  const detectionConfig = useMemo(() => ({
    tilt: config.tilt,
    revenge: config.revenge,
    overtrading: config.overtrading
  }), [config]);

  /**
   * Thresholds formatados para calculateStudentStatus()
   */
  const statusThresholds = useMemo(() => config.studentStatus, [config]);

  return {
    config,
    detectionConfig,
    statusThresholds,
    loading,
    saving,
    error,
    lastSaved,
    save,
    reset,
    defaults: DEFAULT_COMPLIANCE_RULES,
    isMentor: isMentor()
  };
};

export default useComplianceRules;
