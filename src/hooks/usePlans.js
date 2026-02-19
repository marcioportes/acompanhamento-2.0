/**
 * usePlans
 * @version 2.0.0
 * @description Hook para gerenciamento de Planos de Trading
 * 
 * CHANGELOG:
 * - 2.0.0: Suporte a overrideStudentId para View As Student
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
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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
   */
  const updatePlan = useCallback(async (planId, planData) => {
    try {
      const planRef = doc(db, 'plans', planId);
      await updateDoc(planRef, {
        ...planData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[usePlans] Erro atualizar:', err);
      throw err;
    }
  }, []);

  /**
   * Deletar plano
   */
  const deletePlan = useCallback(async (planId) => {
    try {
      await deleteDoc(doc(db, 'plans', planId));
    } catch (err) {
      console.error('[usePlans] Erro deletar:', err);
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
