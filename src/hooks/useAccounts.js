import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para gerenciamento de contas de trading
 * VERSÃO 2.5 (FIX DEFINITIVO):
 * - Resolve erro "Missing permissions" na exclusão.
 * - Estratégia: Busca trades pelo studentEmail (permitido) e seleciona os da conta via Javascript.
 */
export const useAccounts = () => {
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
      if (isMentor()) {
        q = query(collection(db, 'accounts'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'accounts'), where('studentId', '==', user.uid));
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
          console.error('Erro ao carregar contas:', err); 
          setError(err.message);
          setLoading(false); 
        }
      );
      
      return () => unsubscribe();
    } catch (err) { 
      console.error('Erro ao configurar listener:', err);
      setError(err.message); 
      setLoading(false); 
    }
  }, [user, isMentor]);

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
      console.error('Erro ao criar conta:', err);
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
          
          await addDoc(collection(db, 'movements'), {
            accountId: accountId,
            type: 'ADJUSTMENT',
            amount: diff,
            balanceBefore,
            balanceAfter,
            description: diff > 0 
              ? `Ajuste: saldo inicial alterado de ${oldInitial} para ${newInitial}`
              : `Ajuste: saldo inicial alterado de ${oldInitial} para ${newInitial}`,
            date: adjustmentDate,
            dateTime: new Date().toISOString(),
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          updateData.currentBalance = balanceAfter;
        }
      }
      
      await updateDoc(accountRef, { 
        ...updateData, 
        updatedAt: serverTimestamp() 
      });
    } catch (err) { 
      console.error('Erro ao atualizar conta:', err);
      throw err; 
    }
  }, [user, accounts]);

  /**
   * Deletar conta com CASCADE DELETE (Estratégia Segura)
   */
  const deleteAccount = useCallback(async (accountId) => {
    try {
      console.log(`[useAccounts] Iniciando exclusão da conta ${accountId}...`);

      // ETAPA 1: MOVIMENTOS
      try {
        const movementsQuery = query(collection(db, 'movements'), where('accountId', '==', accountId));
        const movementsSnapshot = await getDocs(movementsQuery);
        const movementDeletePromises = movementsSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'movements', docSnap.id)));
        await Promise.all(movementDeletePromises);
      } catch (e) {
        console.warn('Erro ao deletar movimentos:', e);
      }
      
      // ETAPA 2: PLANOS
      try {
        const plansQuery = query(collection(db, 'plans'), where('accountId', '==', accountId));
        const plansSnapshot = await getDocs(plansQuery);
        const planDeletePromises = plansSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'plans', docSnap.id)));
        await Promise.all(planDeletePromises);
      } catch (e) {
        console.warn('Erro ao deletar planos:', e);
      }

      // ETAPA 3: TRADES (FIX DEFINITIVO - FILTRO EM MEMÓRIA)
      try {
        let tradesToDelete = [];

        if (isMentor()) {
           // Mentor pode tudo
           const q = query(collection(db, 'trades'), where('accountId', '==', accountId));
           const snap = await getDocs(q);
           tradesToDelete = snap.docs;
        } else if (user?.email) {
           // ALUNO:
           // 1. Busca TUDO que é seu pelo email (Query Permitida e com Índice)
           const q = query(collection(db, 'trades'), where('studentEmail', '==', user.email));
           const snap = await getDocs(q);
           
           // 2. Filtra localmente os trades desta conta
           tradesToDelete = snap.docs.filter(doc => doc.data().accountId === accountId);
        }

        console.log(`[useAccounts] Encontrados ${tradesToDelete.length} trades para deletar.`);

        const tradesDeletePromises = tradesToDelete.map(docSnap => deleteDoc(doc(db, 'trades', docSnap.id)));
        await Promise.all(tradesDeletePromises);
      } catch (e) {
        console.warn('Erro ao deletar trades (verifique permissões):', e);
      }
      
      // ETAPA 4: CONTA
      await deleteDoc(doc(db, 'accounts', accountId));
      console.log(`[useAccounts] Conta deletada com sucesso.`);
      
    } catch (err) { 
      console.error('Erro fatal ao deletar conta:', err);
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