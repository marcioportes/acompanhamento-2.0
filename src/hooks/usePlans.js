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
 * Hook para gerenciamento de planos de trading
 * Plano = Aluno + Setup + Regras de risco
 */
export const usePlans = () => {
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
    let q;

    if (isMentor()) {
      // Mentor vê todos os planos
      q = query(
        collection(db, 'plans'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Aluno vê apenas seus planos
      q = query(
        collection(db, 'plans'),
        where('studentId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const plansData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPlans(plansData);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar planos:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isMentor]);

  // Criar plano
  const addPlan = useCallback(async (planData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newPlan = {
        ...planData,
        studentId: planData.studentId || user.uid,
        studentEmail: planData.studentEmail || user.email,
        studentName: planData.studentName || user.displayName || user.email.split('@')[0],
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'plans'), newPlan);
      return docRef.id;
    } catch (err) {
      console.error('Erro ao criar plano:', err);
      throw err;
    }
  }, [user]);

  // Atualizar plano
  const updatePlan = useCallback(async (planId, planData) => {
    try {
      const planRef = doc(db, 'plans', planId);
      await updateDoc(planRef, {
        ...planData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao atualizar plano:', err);
      throw err;
    }
  }, []);

  // Deletar plano
  const deletePlan = useCallback(async (planId) => {
    try {
      await deleteDoc(doc(db, 'plans', planId));
    } catch (err) {
      console.error('Erro ao deletar plano:', err);
      throw err;
    }
  }, []);

  // Buscar planos por aluno
  const getPlansByStudent = useCallback((studentId) => {
    return plans.filter(p => p.studentId === studentId);
  }, [plans]);

  // Buscar planos ativos do aluno
  const getActivePlans = useCallback((studentId) => {
    const id = studentId || user?.uid;
    return plans.filter(p => p.studentId === id && p.active);
  }, [plans, user]);

  // Buscar plano por setup
  const getPlanBySetup = useCallback((studentId, setupId) => {
    return plans.find(p => 
      p.studentId === studentId && 
      p.setupId === setupId && 
      p.active
    );
  }, [plans]);

  // Buscar plano por ID
  const getPlanById = useCallback((planId) => {
    return plans.find(p => p.id === planId);
  }, [plans]);

  // Validar trade contra plano
  const validateTradeAgainstPlan = useCallback((trade, plan, accountBalance) => {
    const violations = [];

    if (!plan) {
      violations.push({
        type: 'NO_PLAN',
        message: 'Trade sem plano associado'
      });
      return violations;
    }

    // Validar risco máximo
    if (plan.maxRiskPercent && accountBalance) {
      const riskAmount = Math.abs(trade.result < 0 ? trade.result : 0);
      const riskPercent = (riskAmount / accountBalance) * 100;
      
      if (riskPercent > plan.maxRiskPercent) {
        violations.push({
          type: 'RISK_EXCEEDED',
          message: `Risco ${riskPercent.toFixed(2)}% excede máximo de ${plan.maxRiskPercent}%`
        });
      }
    }

    // Validar R:R mínimo
    if (plan.minRiskReward && trade.riskReward) {
      if (trade.riskReward < plan.minRiskReward) {
        violations.push({
          type: 'RR_BELOW_MINIMUM',
          message: `R:R ${trade.riskReward.toFixed(2)} abaixo do mínimo ${plan.minRiskReward}`
        });
      }
    }

    // Validar emoção bloqueada
    if (plan.blockedEmotions && plan.blockedEmotions.includes(trade.emotion)) {
      violations.push({
        type: 'BLOCKED_EMOTION',
        message: `Estado emocional "${trade.emotion}" bloqueado no plano`
      });
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
    getPlansByStudent,
    getActivePlans,
    getPlanBySetup,
    getPlanById,
    validateTradeAgainstPlan
  };
};

export default usePlans;
