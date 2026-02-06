import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para gerenciamento de contas de trading
 * VERSÃO 2.1 (DELETE ROBUSTO):
 * - Garante que a exclusão da conta ocorra mesmo se falhar a exclusão de itens filhos.
 */
export const useAccounts = () => {
  const { user, isMentor } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar contas (Listener padrão)
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
        currentBalance: initialAmount,
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
   * Deletar conta com CASCADE DELETE (Blindado)
   * Tenta deletar filhos, mas garante a exclusão da conta no final.
   */
  const deleteAccount = useCallback(async (accountId) => {
    try {
      // ETAPA 1: MOVIMENTOS
      try {
        const movementsQuery = query(collection(db, 'movements'), where('accountId', '==', accountId));
        const movementsSnapshot = await getDocs(movementsQuery);
        const movementDeletePromises = movementsSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'movements', docSnap.id)));
        await Promise.all(movementDeletePromises);
      } catch (e) {
        console.warn('Erro não-bloqueante ao deletar movimentos:', e);
      }
      
      // ETAPA 2: PLANOS (METAS)
      try {
        const plansQuery = query(collection(db, 'plans'), where('accountId', '==', accountId));
        const plansSnapshot = await getDocs(plansQuery);
        const planDeletePromises = plansSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'plans', docSnap.id)));
        await Promise.all(planDeletePromises);
      } catch (e) {
        console.warn('Erro não-bloqueante ao deletar planos:', e);
      }

      // ETAPA 3: TRADES
      try {
        const tradesQuery = query(collection(db, 'trades'), where('accountId', '==', accountId));
        const tradesSnapshot = await getDocs(tradesQuery);
        const tradesDeletePromises = tradesSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'trades', docSnap.id)));
        await Promise.all(tradesDeletePromises);
      } catch (e) {
        console.warn('Erro não-bloqueante ao deletar trades:', e);
      }
      
      // ETAPA 4: CONTA (O principal)
      await deleteDoc(doc(db, 'accounts', accountId));
      console.log(`[useAccounts] Conta ${accountId} processada.`);
      
    } catch (err) { 
      console.error('Erro fatal ao deletar conta:', err);
      throw err; 
    }
  }, []);

  const getAccountsByStudent = useCallback((studentId) => {
    return accounts.filter(acc => acc.studentId === studentId);
  }, [accounts]);

  const getActiveAccount = useCallback((studentId) => {
    const studentAccounts = studentId 
      ? accounts.filter(acc => acc.studentId === studentId)
      : accounts.filter(acc => acc.studentId === user?.uid);
    return studentAccounts.find(acc => acc.active) || studentAccounts[0];
  }, [accounts, user]);

  const getRealAccounts = useCallback(() => {
    return accounts.filter(acc => {
      if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
      return acc.isReal === true;
    });
  }, [accounts]);

  const getDemoAccounts = useCallback(() => {
    return accounts.filter(acc => {
      if (acc.type) return acc.type === 'DEMO';
      return acc.isReal === false || acc.isReal === undefined;
    });
  }, [accounts]);

  return {
    accounts, 
    loading, 
    error, 
    addAccount, 
    updateAccount, 
    deleteAccount, 
    getAccountsByStudent, 
    getActiveAccount,
    getRealAccounts,
    getDemoAccounts
  };
};

export default useAccounts;