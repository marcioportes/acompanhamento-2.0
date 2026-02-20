/**
 * useAccounts
 * @see version.js para versão do produto
 * @description Hook para gerenciamento de contas de trading
 * 
 * CHANGELOG (produto):
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

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      const accountId = docRef.id;
      
      if (initialAmount > 0) {
        const movementDate = new Date().toISOString().split('T')[0];
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
      
      // ETAPA 2: PLANOS
      try {
        let plansToDelete = [];
        if (isMentor()) {
          const q = query(collection(db, 'plans'), where('accountId', '==', accountId));
          const snap = await getDocs(q);
          plansToDelete = snap.docs;
        } else {
          // Aluno: query por studentId + filtro em memória por accountId
          // (evita índice composto accountId+studentId)
          const q = query(collection(db, 'plans'), where('studentId', '==', user.uid));
          const snap = await getDocs(q);
          plansToDelete = snap.docs.filter(d => d.data().accountId === accountId);
        }
        await Promise.all(plansToDelete.map(docSnap => deleteDoc(doc(db, 'plans', docSnap.id))));
        console.log(`[useAccounts] ${plansToDelete.length} planos deletados`);
      } catch (e) {
        console.warn('[useAccounts] Erro planos:', e);
      }

      // ETAPA 3: TRADES (FIX: FILTRO EM MEMÓRIA)
      try {
        let tradesToDelete = [];

        if (isMentor()) {
           const q = query(collection(db, 'trades'), where('accountId', '==', accountId));
           const snap = await getDocs(q);
           tradesToDelete = snap.docs;
        } else if (user?.email) {
           const q = query(collection(db, 'trades'), where('studentEmail', '==', user.email));
           const snap = await getDocs(q);
           tradesToDelete = snap.docs.filter(doc => doc.data().accountId === accountId);
        }

        console.log(`[useAccounts] ${tradesToDelete.length} trades para deletar`);
        await Promise.all(tradesToDelete.map(docSnap => deleteDoc(doc(db, 'trades', docSnap.id))));
      } catch (e) {
        console.warn('[useAccounts] Erro trades:', e);
      }
      
      // ETAPA 4: CONTA
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