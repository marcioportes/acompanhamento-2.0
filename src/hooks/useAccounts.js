/**
 * useAccounts
 * @see version.js para versão do produto
 * @description Hook para gerenciamento de contas de trading
 * 
 * CHANGELOG (produto):
 * - 1.6.0: FIX INITIAL_BALANCE usa data de abertura da conta (createdAt), não today
 * - 1.5.0: FIX cascade delete planos - query filtrada por studentId para aluno
 * - 1.4.0: FIX CRÍTICO - Removida atualização manual de 'currentBalance' ao ajustar saldo inicial.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * @param {string|null} overrideStudentId - UID do aluno para View As Student
 */
export const useAccounts = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar contas
  useEffect(() => {
    if (!user) { 
      setAccounts([]); 
      setLoading(false); 
      return; 
    }
    
    setLoading(true);
    setError(null);
    
    let q;
    try {
      if (overrideStudentId) {
        // MODO: Mentor visualizando como aluno específico
        console.log('[useAccounts] Override mode:', overrideStudentId);
        q = query(
          collection(db, 'accounts'), 
          where('studentId', '==', overrideStudentId)
        );
      } else if (isMentor()) {
        // MODO: Mentor normal - vê TODAS as contas
        console.log('[useAccounts] Mentor mode - all accounts');
        q = query(
          collection(db, 'accounts'), 
          orderBy('createdAt', 'desc')
        );
      } else {
        // MODO: Aluno - vê apenas suas contas
        console.log('[useAccounts] Student mode:', user.uid);
        q = query(
          collection(db, 'accounts'), 
          where('studentId', '==', user.uid)
        );
      }
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          let accountsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
              id: doc.id, 
              ...data,
              type: data.type || (data.isReal ? 'REAL' : 'DEMO'),
              isReal: data.isReal ?? (data.type === 'REAL' || data.type === 'PROP')
            };
          });
          
          accountsData.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
            return dateB - dateA;
          });
          
          setAccounts(accountsData);
          setLoading(false);
        },
        (err) => { 
          console.error('[useAccounts] Erro:', err); 
          setError(err.message);
          setLoading(false); 
        }
      );
      
      return () => unsubscribe();
    } catch (err) { 
      console.error('[useAccounts] Setup error:', err);
      setError(err.message); 
      setLoading(false); 
    }
  }, [user, isMentor, overrideStudentId]);

  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const initialAmount = parseFloat(accountData.initialBalance) || 0;
      const accountType = accountData.type || 'DEMO';
      const isRealDerived = accountType === 'REAL' || accountType === 'PROP';
      
      const newAccount = {
        name: accountData.name,
        broker: accountData.broker,
        currency: accountData.currency || 'BRL',
        type: accountType,
        isReal: isRealDerived,
        initialBalance: initialAmount,
        currentBalance: 0,
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        active: accountData.active !== undefined ? accountData.active : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Prop firm — campo opcional, só para contas PROP (#52 + Fase 1.5)
      if (accountType === 'PROP' && accountData.propFirm) {
        newAccount.propFirm = {
          templateId: accountData.propFirm.templateId ?? null,
          firmName: accountData.propFirm.firmName ?? '',
          productName: accountData.propFirm.productName ?? '',
          phase: accountData.propFirm.phase ?? 'EVALUATION',
          phaseStartDate: serverTimestamp(),
          evalDeadline: accountData.propFirm.evalDeadline ?? null,
          peakBalance: initialAmount,
          currentDrawdownThreshold: initialAmount - (accountData.propFirm.drawdownMax ?? 0),
          lockLevel: null,
          isDayPaused: false,
          tradingDays: 0,
          // Fase 1.5: instrumento principal selecionado pelo aluno
          selectedInstrument: accountData.propFirm.selectedInstrument ?? null,
          suggestedPlan: accountData.propFirm.suggestedPlan ?? null
        };
      }

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      const accountId = docRef.id;
      
      if (initialAmount > 0) {
        // Data do movement = data de abertura da conta, não today
        const movementDate = accountData.createdAt 
          ? (typeof accountData.createdAt === 'string' ? accountData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0];
        await addDoc(collection(db, 'movements'), {
          accountId: accountId,
          type: 'INITIAL_BALANCE',
          amount: initialAmount,
          balanceBefore: 0,
          balanceAfter: initialAmount,
          description: 'Saldo inicial',
          date: movementDate,
          dateTime: `${movementDate}T00:00:00.000Z`,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      }
      
      return accountId;
    } catch (err) {
      console.error('[useAccounts] Erro criar:', err);
      throw err;
    }
  }, [user]);

  const updateAccount = useCallback(async (accountId, accountData) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      const accountRef = doc(db, 'accounts', accountId);
      const currentAccount = accounts.find(acc => acc.id === accountId);
      
      const updateData = { ...accountData };
      if (accountData.type) {
        updateData.isReal = accountData.type === 'REAL' || accountData.type === 'PROP';
      }

      if (currentAccount && accountData.initialBalance !== undefined) {
        const oldInitial = currentAccount.initialBalance || 0;
        const newInitial = parseFloat(accountData.initialBalance) || 0;
        const diff = newInitial - oldInitial;
        
        if (diff !== 0) {
          const movementsQuery = query(
            collection(db, 'movements'),
            where('accountId', '==', accountId)
          );
          const movementsSnapshot = await getDocs(movementsQuery);
          
          let balanceBefore = 0;
          if (!movementsSnapshot.empty) {
            const allMovements = movementsSnapshot.docs.map(d => ({
              ...d.data(),
              id: d.id
            }));
            allMovements.sort((a, b) => {
              const dtA = a.dateTime || a.date || '';
              const dtB = b.dateTime || b.date || '';
              return dtB.localeCompare(dtA);
            });
            balanceBefore = allMovements[0].balanceAfter || 0;
          }

          const balanceAfter = balanceBefore + diff;
          const adjustmentDate = new Date().toISOString().split('T')[0];
          
          // CRIA O MOVIMENTO DE AJUSTE
          // Isso vai disparar a Cloud Function 'onMovementCreated'
          await addDoc(collection(db, 'movements'), {
            accountId: accountId,
            type: 'ADJUSTMENT',
            amount: diff,
            balanceBefore,
            balanceAfter,
            description: `Ajuste: saldo inicial alterado de ${oldInitial} para ${newInitial}`,
            date: adjustmentDate,
            dateTime: new Date().toISOString(),
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          // [FIX 2.6.1]
          // NÃO atualizamos o currentBalance aqui no Frontend.
          // Deixamos a Cloud Function fazer a soma para evitar duplicidade.
          // updateData.currentBalance = balanceAfter; <--- REMOVIDO
          delete updateData.currentBalance; 
        }
      }
      
      // Prop firm — atualizar campos prop se fornecidos (#52)
      if (updateData.propFirm) {
        const prefixed = {};
        for (const [key, value] of Object.entries(updateData.propFirm)) {
          prefixed[`propFirm.${key}`] = value;
        }
        delete updateData.propFirm;
        Object.assign(updateData, prefixed);
      }

      await updateDoc(accountRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[useAccounts] Erro atualizar:', err);
      throw err;
    }
  }, [user, accounts]);

  /**
   * Deletar conta com CASCADE DELETE
   *
   * Ordem dos passos (importante — coleta planIds ANTES de deletar planos):
   *   1. movements             (where accountId)
   *   2. coleta planIds        (query por accountId — mentor — ou studentId — aluno)
   *   3. trades                (duplo query studentId+studentEmail dedup + filtro accountId,
   *                             aluno; where accountId mentor)
   *   4. orders                (where planId in planIds — em chunks de 10 por limite Firestore;
   *                             aluno usa fallback por studentId+filtro)
   *   5. cycleClosures         (where accountId)
   *   6. plans                 (deleta após orders pra não criar planId fantasma)
   *   7. account
   */
  const deleteAccount = useCallback(async (accountId) => {
    try {
      console.log(`[useAccounts] Deletando conta ${accountId}...`);

      // ETAPA 1: MOVIMENTOS
      try {
        const movementsQuery = query(collection(db, 'movements'), where('accountId', '==', accountId));
        const movementsSnapshot = await getDocs(movementsQuery);
        await Promise.all(movementsSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'movements', docSnap.id))));
        console.log(`[useAccounts] ${movementsSnapshot.size} movimentos deletados`);
      } catch (e) {
        console.warn('[useAccounts] Erro movimentos:', e);
      }

      // ETAPA 2: COLETA PLANOS — não deleta ainda (orders precisam dos planIds)
      let plansToDelete = [];
      try {
        if (isMentor()) {
          const q = query(collection(db, 'plans'), where('accountId', '==', accountId));
          const snap = await getDocs(q);
          plansToDelete = snap.docs;
        } else {
          // Aluno: query por studentId + filtro em memória por accountId
          const q = query(collection(db, 'plans'), where('studentId', '==', user.uid));
          const snap = await getDocs(q);
          plansToDelete = snap.docs.filter(d => d.data().accountId === accountId);
        }
        console.log(`[useAccounts] ${plansToDelete.length} planos identificados`);
      } catch (e) {
        console.warn('[useAccounts] Erro coleta planos:', e);
      }
      const planIds = plansToDelete.map((d) => d.id);

      // ETAPA 3: TRADES — duplo query (studentId + studentEmail) com dedup.
      // Trades antigos podem ter só um dos dois campos populado; tradeGateway
      // moderno grava ambos. Garante cobertura completa.
      try {
        const docMap = new Map();
        if (isMentor()) {
          const q = query(collection(db, 'trades'), where('accountId', '==', accountId));
          const snap = await getDocs(q);
          for (const d of snap.docs) docMap.set(d.id, d);
        } else {
          if (user?.uid) {
            const qById = query(collection(db, 'trades'), where('studentId', '==', user.uid));
            const snapById = await getDocs(qById);
            for (const d of snapById.docs) {
              if (d.data().accountId === accountId) docMap.set(d.id, d);
            }
          }
          if (user?.email) {
            const qByEmail = query(collection(db, 'trades'), where('studentEmail', '==', user.email));
            const snapByEmail = await getDocs(qByEmail);
            for (const d of snapByEmail.docs) {
              if (d.data().accountId === accountId) docMap.set(d.id, d);
            }
          }
        }
        console.log(`[useAccounts] ${docMap.size} trades para deletar`);
        await Promise.all([...docMap.values()].map(d => deleteDoc(doc(db, 'trades', d.id))));
      } catch (e) {
        console.warn('[useAccounts] Erro trades:', e);
      }

      // ETAPA 4: ORDERS — por planId. Orders não carregam accountId, então
      // precisamos dos planIds coletados na etapa 2.
      if (planIds.length > 0) {
        try {
          const docMap = new Map();
          if (isMentor()) {
            // Firestore where-in tem limite de 10 — quebra em chunks
            for (let i = 0; i < planIds.length; i += 10) {
              const chunk = planIds.slice(i, i + 10);
              const q = query(collection(db, 'orders'), where('planId', 'in', chunk));
              const snap = await getDocs(q);
              for (const d of snap.docs) docMap.set(d.id, d);
            }
          } else if (user?.uid) {
            // Aluno: query por studentId + filtro por planId em memória
            const q = query(collection(db, 'orders'), where('studentId', '==', user.uid));
            const snap = await getDocs(q);
            const planIdSet = new Set(planIds);
            for (const d of snap.docs) {
              if (planIdSet.has(d.data().planId)) docMap.set(d.id, d);
            }
          }
          console.log(`[useAccounts] ${docMap.size} orders para deletar`);
          await Promise.all([...docMap.values()].map(d => deleteDoc(doc(db, 'orders', d.id))));
        } catch (e) {
          console.warn('[useAccounts] Erro orders:', e);
        }
      }

      // ETAPA 5: CYCLE CLOSURES — têm accountId direto no doc.
      try {
        let closuresToDelete = [];
        if (isMentor()) {
          const q = query(collection(db, 'cycleClosures'), where('accountId', '==', accountId));
          const snap = await getDocs(q);
          closuresToDelete = snap.docs;
        } else if (user?.uid) {
          const q = query(collection(db, 'cycleClosures'), where('studentId', '==', user.uid));
          const snap = await getDocs(q);
          closuresToDelete = snap.docs.filter(d => d.data().accountId === accountId);
        }
        console.log(`[useAccounts] ${closuresToDelete.length} closures para deletar`);
        await Promise.all(closuresToDelete.map(d => deleteDoc(doc(db, 'cycleClosures', d.id))));
      } catch (e) {
        console.warn('[useAccounts] Erro cycleClosures:', e);
      }

      // ETAPA 6: PLANOS — agora sim, depois que orders e closures saíram.
      try {
        await Promise.all(plansToDelete.map(docSnap => deleteDoc(doc(db, 'plans', docSnap.id))));
        console.log(`[useAccounts] ${plansToDelete.length} planos deletados`);
      } catch (e) {
        console.warn('[useAccounts] Erro deletar planos:', e);
      }

      // ETAPA 7: CONTA
      await deleteDoc(doc(db, 'accounts', accountId));
      console.log(`[useAccounts] Conta deletada`);

    } catch (err) {
      console.error('[useAccounts] Erro fatal:', err);
      throw err;
    }
  }, [user, isMentor]);

  const getAccountsByStudent = useCallback((studentId) => accounts.filter(acc => acc.studentId === studentId), [accounts]);
  
  const getActiveAccount = useCallback((studentId) => {
    const studentAccounts = studentId 
      ? accounts.filter(acc => acc.studentId === studentId)
      : accounts.filter(acc => acc.studentId === user?.uid);
    return studentAccounts.find(acc => acc.active) || studentAccounts[0];
  }, [accounts, user]);
  
  const getRealAccounts = useCallback(() => accounts.filter(acc => acc.type === 'REAL' || acc.type === 'PROP' || acc.isReal === true), [accounts]);
  const getDemoAccounts = useCallback(() => accounts.filter(acc => acc.type === 'DEMO' || (acc.isReal === false || acc.isReal === undefined)), [accounts]);

  return {
    accounts, loading, error, addAccount, updateAccount, deleteAccount, 
    getAccountsByStudent, getActiveAccount, getRealAccounts, getDemoAccounts
  };
};

export default useAccounts;