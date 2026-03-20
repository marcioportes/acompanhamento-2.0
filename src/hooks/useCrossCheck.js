/**
 * useCrossCheck.js
 * @version 1.0.0 (v1.20.0)
 * @description Hook para cálculo e armazenamento de métricas de cross-check.
 *   Combina dados de orders + trades para produzir análise comportamental.
 *
 * EXPORTS (via hook):
 *   analysis, loading, error
 *   runCrossCheck(orders, trades, planId, period) → Promise<void>
 *   getAnalysis(studentId, period) → Object|null
 *
 * @firestore orderAnalysis — auto-ID, indexed by studentId + period
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { correlateOrders } from '../utils/orderCorrelation';
import { calculateCrossCheckMetrics } from '../utils/orderCrossCheck';
import { validateKPIs } from '../utils/kpiValidation';

const COLLECTION = 'orderAnalysis';

/**
 * @param {string|null} studentId - UID do aluno
 */
const useCrossCheck = (studentId = null) => {
  const { user, isMentor } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const targetId = studentId ?? user?.uid;

  // ============================================
  // LISTENER
  // ============================================
  useEffect(() => {
    if (!targetId) {
      setAnalyses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', targetId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.generatedAt?.seconds ?? 0) - (a.generatedAt?.seconds ?? 0));
        setAnalyses(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useCrossCheck] Listener error:', err);
        setAnalyses([]);
        setLoading(false);
        setError(err.message);
      }
    );

    return () => unsub();
  }, [targetId]);

  // ============================================
  // RUN CROSS-CHECK
  // ============================================
  /**
   * Executa cross-check completo e persiste em orderAnalysis.
   *
   * @param {Object[]} orders — ordens da collection `orders` (já ingeridas)
   * @param {Object[]} trades — trades do período
   * @param {string} planId
   * @param {string} period — ex: "2026-W12"
   * @param {string} periodType — ex: "week"
   * @returns {Promise<string>} ID do documento de análise criado
   */
  const runCrossCheck = useCallback(async (orders, trades, planId, period, periodType = 'week') => {
    if (!targetId) throw new Error('StudentId necessário');
    if (!orders?.length) throw new Error('Nenhuma ordem para analisar');

    // 1. Correlação
    const { correlations, stats: correlationStats } = correlateOrders(orders, trades);

    // 2. Métricas cross-check
    const crossCheckMetrics = calculateCrossCheckMetrics(orders, trades, correlations);

    // 3. Trade metrics para KPI validation
    const winningTrades = trades.filter(t => (Number(t.result) || 0) > 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const tradeMetrics = { winRate, totalTrades: trades.length };

    // 4. KPI validation
    const kpiValidation = validateKPIs(crossCheckMetrics, tradeMetrics);

    // 5. Persistir
    const analysisDoc = {
      studentId: targetId,
      planId,
      period,
      periodType,
      ordersAnalyzed: orders.length,
      tradesInPeriod: trades.length,
      crossCheckMetrics,
      correlationStats,
      kpiValidation: {
        reportedWinRate: kpiValidation.reportedWinRate,
        adjustedWinRate: kpiValidation.adjustedWinRate,
        winRateDelta: kpiValidation.winRateDelta,
        stopUsageRate: kpiValidation.stopUsageRate,
        kpiInflationFlag: kpiValidation.kpiInflationFlag,
        kpiInflationSeverity: kpiValidation.kpiInflationSeverity,
      },
      alerts: kpiValidation.alerts,
      generatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), analysisDoc);
    console.log(`[useCrossCheck] Analysis generated: ${docRef.id} for ${period}`);
    return docRef.id;
  }, [targetId]);

  // ============================================
  // GET ANALYSIS BY PERIOD
  // ============================================
  const getAnalysis = useCallback((period) => {
    return analyses.find(a => a.period === period) || null;
  }, [analyses]);

  /** Análise mais recente */
  const latestAnalysis = analyses.length > 0 ? analyses[0] : null;

  return {
    analyses,
    latestAnalysis,
    loading,
    error,
    runCrossCheck,
    getAnalysis,
  };
};

export default useCrossCheck;
