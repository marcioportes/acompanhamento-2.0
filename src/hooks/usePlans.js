// v1.14.0 — Issue #43: mentor audit trail
/**
 * usePlans
 * @see version.js para versão do produto
 * @description Hook para gerenciamento de Planos de Trading
 * 
 * CHANGELOG (produto):
 * - 1.5.0: currentPl inicializado na criação do plano (plan-centric ledger)
 *          deletePlan com cascade delete de trades e movements
 * - 1.4.0: Suporte a overrideStudentId para View As Student
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDocs,
  serverTimestamp,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateTradeCompliance } from '../utils/compliance';

/** Campos do plano que afetam compliance — mudança dispara recálculo */
const RISK_FIELDS = ['riskPerOperation', 'rrTarget', 'periodStop', 'cycleStop'];

/**
 * @param {string|null} overrideStudentId - UID do aluno para View As Student
 */
export const usePlans = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar planos
  useEffect(() => {
    if (!user) {
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    let q;

    try {
      if (overrideStudentId) {
        // MODO: Mentor visualizando como aluno específico
        console.log('[usePlans] Override mode:', overrideStudentId);
        q = query(
          collection(db, 'plans'),
          where('studentId', '==', overrideStudentId)
        );
      } else if (isMentor()) {
        // MODO: Mentor normal - vê TODOS os planos
        console.log('[usePlans] Mentor mode - all plans');
        q = query(
          collection(db, 'plans'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // MODO: Aluno - vê apenas seus planos
        console.log('[usePlans] Student mode:', user.uid);
        q = query(
          collection(db, 'plans'),
          where('studentId', '==', user.uid)
        );
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          let plansData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Ordenar no cliente
          plansData.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          });
          
          setPlans(plansData);
          setLoading(false);
        },
        (err) => {
          console.error('[usePlans] Erro:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('[usePlans] Setup error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user, isMentor, overrideStudentId]);

  /**
   * Criar plano
   */
  const addPlan = useCallback(async (planData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newPlan = {
        name: planData.name || 'Plano de Trading',
        description: planData.description || '',
        accountId: planData.accountId,
        
        pl: parseFloat(planData.pl) || 0,
        currentPl: parseFloat(planData.pl) || 0,
        plPercent: parseFloat(planData.plPercent) || 0,
        
        riskPerOperation: parseFloat(planData.riskPerOperation) || 2,
        rrTarget: parseFloat(planData.rrTarget) || 2,
        
        adjustmentCycle: planData.adjustmentCycle || 'Mensal',
        cycleGoal: parseFloat(planData.cycleGoal) || 10,
        cycleStop: parseFloat(planData.cycleStop) || 5,
        
        operationPeriod: planData.operationPeriod || 'Diário',
        periodGoal: parseFloat(planData.periodGoal) || 2,
        periodStop: parseFloat(planData.periodStop) || 2,
        
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'plans'), newPlan);
      return docRef.id;
    } catch (err) {
      console.error('[usePlans] Erro criar:', err);
      throw err;
    }
  }, [user]);

  /**
   * Atualizar plano
   * B1 (v1.19.0): Se campos de risco mudam, dispara recálculo de compliance em cascata.
   * @param {string} planId
   * @param {object} planData
   * @param {object} [auditInfo] - { editedBy: 'mentor'|'student', email, changedFields }
   */
  const updatePlan = useCallback(async (planId, planData, auditInfo = null) => {
    try {
      const planRef = doc(db, 'plans', planId);
      const updateData = {
        ...planData,
        updatedAt: serverTimestamp()
      };

      // Audit trail para edições do mentor
      if (auditInfo && auditInfo.editedBy === 'mentor') {
        updateData.lastEditedBy = 'mentor';
        updateData.lastEditedByEmail = auditInfo.email;
        updateData.lastEditedAt = serverTimestamp();
      }

      await updateDoc(planRef, updateData);

      // Se mentor, registra no editHistory via arrayUnion separado
      if (auditInfo && auditInfo.editedBy === 'mentor') {
        const historyEntry = {
          by: 'mentor',
          email: auditInfo.email,
          fields: auditInfo.changedFields || [],
          timestamp: new Date().toISOString()
        };
        await updateDoc(planRef, {
          editHistory: arrayUnion(historyEntry)
        });
        console.log(`[usePlans] Mentor edit audit: ${auditInfo.email} → ${planId}`);
      }

      // B1: Se campos de risco foram alterados, recalcular compliance em cascata
      const changedFields = auditInfo?.changedFields || Object.keys(planData);
      const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
      if (riskChanged) {
        try {
          const functions = getFunctions();
          const recalc = httpsCallable(functions, 'recalculateCompliance');
          const result = await recalc({ planId });
          console.log(`[usePlans] Compliance recalculado em cascata: ${result.data.updated} trades (planId=${planId})`);
        } catch (recalcErr) {
          console.error('[usePlans] Erro no recálculo em cascata:', recalcErr);
          // Não throw — o plano já foi salvo, o recálculo é best-effort
        }
      }
    } catch (err) {
      console.error('[usePlans] Erro atualizar:', err);
      throw err;
    }
  }, []);

  /**
   * Deletar plano com CASCADE DELETE
   * 1. Busca trades vinculados ao planId
   * 2. Para cada trade, deleta seus movements
   * 3. Deleta os trades
   * 4. Deleta o plano
   */
  const deletePlan = useCallback(async (planId) => {
    try {
      console.log(`[usePlans] Deletando plano ${planId} com cascade...`);

      // ETAPA 1: TRADES do plano
      const tradesQuery = query(collection(db, 'trades'), where('planId', '==', planId));
      const tradesSnapshot = await getDocs(tradesQuery);
      console.log(`[usePlans] ${tradesSnapshot.size} trades vinculados`);

      // ETAPA 2: Para cada trade, deletar movements
      for (const tradeDoc of tradesSnapshot.docs) {
        try {
          const movQuery = query(collection(db, 'movements'), where('tradeId', '==', tradeDoc.id));
          const movSnapshot = await getDocs(movQuery);
          await Promise.all(movSnapshot.docs.map(m => deleteDoc(doc(db, 'movements', m.id))));
          console.log(`[usePlans] Trade ${tradeDoc.id}: ${movSnapshot.size} movements deletados`);
        } catch (e) {
          console.warn(`[usePlans] Erro movements trade ${tradeDoc.id}:`, e);
        }
      }

      // ETAPA 3: Deletar trades
      await Promise.all(tradesSnapshot.docs.map(t => deleteDoc(doc(db, 'trades', t.id))));
      console.log(`[usePlans] ${tradesSnapshot.size} trades deletados`);

      // ETAPA 4: Deletar plano
      await deleteDoc(doc(db, 'plans', planId));
      console.log(`[usePlans] Plano deletado`);

    } catch (err) {
      console.error('[usePlans] Erro cascade delete:', err);
      throw err;
    }
  }, []);

  /**
   * Buscar planos por conta
   */
  const getPlansByAccount = useCallback((accountId) => {
    return plans.filter(p => p.accountId === accountId && p.active);
  }, [plans]);

  /**
   * Buscar planos por aluno
   */
  const getPlansByStudent = useCallback((studentId) => {
    return plans.filter(p => p.studentId === studentId);
  }, [plans]);

  /**
   * Buscar plano por ID
   */
  const getPlanById = useCallback((planId) => {
    return plans.find(p => p.id === planId);
  }, [plans]);

  /**
   * Calcular PL total usado por conta
   */
  const getTotalPlByAccount = useCallback((accountId) => {
    const accountPlans = plans.filter(p => p.accountId === accountId && p.active);
    return accountPlans.reduce((sum, p) => sum + (p.pl || 0), 0);
  }, [plans]);

  /**
   * Calcular PL disponível para nova alocação
   */
  const getAvailablePl = useCallback((accountId, currentBalance, excludePlanId = null) => {
    const accountPlans = plans.filter(p => 
      p.accountId === accountId && 
      p.active && 
      p.id !== excludePlanId
    );
    const usedPl = accountPlans.reduce((sum, p) => sum + (p.pl || 0), 0);
    return Math.max(0, currentBalance - usedPl);
  }, [plans]);

  /**
   * Helper: Retorna planos ativos/em progresso
   */
  const getActivePlans = useCallback(() => {
    return plans.filter(p => {
       const status = p.status || 'ACTIVE';
       return status === 'IN_PROGRESS' || status === 'ACTIVE';
    });
  }, [plans]);

  /**
   * v1.19.1: Diagnóstico bidirecional de plano (leitura, sem escrita)
   * Ida:   PL do plano ← soma dos trades (detecta PL divergente)
   * Volta: Compliance dos trades ← parâmetros do plano (detecta trades desatualizados)
   * 
   * @param {string} planId
   * @param {Array} localTrades - trades já carregados no hook (evita query extra)
   * @returns {{ pl: { current, calculated, divergent }, trades: { total, divergent, details[] } }}
   */
  const diagnosePlan = useCallback((planId, localTrades = []) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) throw new Error('Plano não encontrado no cache local');

    const planTrades = localTrades.filter(t => t.planId === planId);
    const basePl = Number(plan.pl) || 0;
    const currentPl = Number(plan.currentPl ?? plan.pl) || 0;

    // === Ida: PL calculado a partir dos trades ===
    const totalResult = planTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
    const calculatedPl = Math.round((basePl + totalResult) * 100) / 100;
    const plDivergent = Math.abs(currentPl - calculatedPl) > 0.01; // tolerância centavo

    // === Volta: Compliance dos trades vs parâmetros do plano ===
    const divergentTrades = [];

    for (const trade of planTrades) {
      const fresh = calculateTradeCompliance(trade, plan);
      const currentRisk = trade.riskPercent;
      const newRisk = fresh.riskPercent;

      // Comparar riskPercent (null-safe)
      const riskChanged = currentRisk == null && newRisk != null
        || currentRisk != null && newRisk == null
        || (currentRisk != null && newRisk != null && Math.abs(currentRisk - newRisk) > 0.01);

      // Comparar rrRatio (null-safe — DEC-007: calculateTradeCompliance now returns RR for all trades)
      const currentRR = trade.rrRatio;
      const newRR = fresh.rrRatio;
      const rrChanged = currentRR == null && newRR != null
        || currentRR != null && newRR == null
        || (currentRR != null && newRR != null && Math.abs(currentRR - newRR) > 0.01);

      // Comparar compliance status
      const roChanged = (trade.compliance?.roStatus ?? 'CONFORME') !== fresh.compliance.roStatus;
      const rrStatusChanged = (trade.compliance?.rrStatus ?? 'CONFORME') !== fresh.compliance.rrStatus;

      if (riskChanged || rrChanged || roChanged || rrStatusChanged) {
        // Formatar data do trade
        let dateStr = '-';
        if (trade.entryTime) {
          const d = trade.entryTime?.toDate ? trade.entryTime.toDate() : new Date(trade.entryTime);
          dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }

        // Determinar motivo
        let reason = 'Compliance recalculado';
        if (!trade.stopLoss && currentRisk === 100) {
          reason = 'DEC-006: risco retroativo';
        } else if (rrChanged && fresh.rrAssumed) {
          reason = 'DEC-007: RR assumido recalculado';
        } else if (riskChanged) {
          reason = 'RO% recalculado';
        } else if (rrChanged) {
          reason = 'RR recalculado';
        }

        divergentTrades.push({
          id: trade.id,
          date: dateStr,
          ticker: trade.ticker || '-',
          oldRisk: currentRisk != null ? `${currentRisk.toFixed(1)}%` : 'N/A',
          newRisk: newRisk != null ? `${newRisk.toFixed(1)}%` : 'N/A',
          reason,
        });
      }
    }

    return {
      pl: { current: currentPl, calculated: calculatedPl, divergent: plDivergent },
      trades: { total: planTrades.length, divergent: divergentTrades.length, details: divergentTrades },
    };
  }, [plans]);

  /**
   * v1.19.1: Auditoria de plano — delega tudo à callable recalculateCompliance (admin SDK)
   * A callable agora faz: (a) recálculo de PL + (b) recálculo de compliance
   * Sem escrita direta do frontend — bypassa Firestore Rules.
   * 
   * @param {string} planId
   * @param {Function} [onProgress] - callback({ step, message })
   * @returns {{ plRecalculated, complianceUpdated, oldPl, newPl }}
   */
  const auditPlan = useCallback(async (planId, onProgress) => {
    if (!planId) throw new Error('planId obrigatório');

    try {
      onProgress?.({ step: 1, message: 'Recalculando PL e compliance via servidor...' });

      const functions = getFunctions();
      const recalc = httpsCallable(functions, 'recalculateCompliance');
      const result = await recalc({ planId, recalcPl: true });

      const report = {
        oldPl: result.data.oldPl ?? 0,
        newPl: result.data.newPl ?? 0,
        plRecalculated: result.data.plRecalculated ?? false,
        complianceUpdated: result.data.updated ?? 0,
      };

      onProgress?.({ step: 2, message: `Auditoria concluída: PL ${report.oldPl.toFixed(2)} → ${report.newPl.toFixed(2)}, ${report.complianceUpdated} trades` });

      console.log(`[usePlans] auditPlan ${planId}: PL ${report.oldPl} → ${report.newPl}, compliance ${report.complianceUpdated} trades`);

      return report;
    } catch (err) {
      console.error('[usePlans] Erro auditPlan:', err);
      throw err;
    }
  }, []);

  /**
   * Validar trade contra plano
   */
  const validateTradeAgainstPlan = useCallback((trade, plan, periodPL = 0, cyclePL = 0) => {
    const violations = [];

    if (!plan) return violations;

    if (plan.periodStop && periodPL < 0) {
      const periodLossPercent = Math.abs(periodPL / plan.pl) * 100;
      if (periodLossPercent >= plan.periodStop) {
        violations.push({
          type: 'PERIOD_STOP_HIT',
          severity: 'critical',
          message: `Stop do período atingido: -${periodLossPercent.toFixed(1)}% (limite: ${plan.periodStop}%)`
        });
      }
    }

    if (plan.cycleStop && cyclePL < 0) {
      const cycleLossPercent = Math.abs(cyclePL / plan.pl) * 100;
      if (cycleLossPercent >= plan.cycleStop) {
        violations.push({
          type: 'CYCLE_STOP_HIT',
          severity: 'critical',
          message: `Stop do ciclo atingido: -${cycleLossPercent.toFixed(1)}% (limite: ${plan.cycleStop}%)`
        });
      }
    }

    if (plan.rrTarget && trade.riskReward) {
      if (trade.riskReward < plan.rrTarget) {
        violations.push({
          type: 'RR_BELOW_MINIMUM',
          severity: 'warning',
          message: `R:R ${trade.riskReward.toFixed(1)} abaixo do mínimo ${plan.rrTarget}`
        });
      }
    }

    if (plan.riskPerOperation && trade.riskPercent) {
      if (trade.riskPercent > plan.riskPerOperation) {
        violations.push({
          type: 'RISK_EXCEEDED',
          severity: 'warning',
          message: `Risco ${trade.riskPercent.toFixed(1)}% excede limite de ${plan.riskPerOperation}%`
        });
      }
    }

    return violations;
  }, []);

  return {
    plans,
    loading,
    error,
    addPlan,
    updatePlan,
    deletePlan,
    auditPlan,
    diagnosePlan,
    getPlansByAccount,
    getPlansByStudent,
    getPlanById,
    getTotalPlByAccount,
    getAvailablePl,
    getActivePlans,
    validateTradeAgainstPlan
  };
};

export default usePlans;
