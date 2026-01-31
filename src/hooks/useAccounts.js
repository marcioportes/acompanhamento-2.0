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
 * Hook para gerenciamento de contas de trading
 * 
 * CORREÇÕES APLICADAS:
 * - Bug #1: Agora cria movimentação automática quando saldo inicial > 0
 * - Bug #3: Query corrigida para garantir que todas as contas do aluno apareçam
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
        // Mentor vê todas as contas
        q = query(
          collection(db, 'accounts'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // CORREÇÃO Bug #3: Query simplificada para aluno
        // Removido orderBy composto que pode causar problemas de índice
        // A ordenação será feita no cliente
        q = query(
          collection(db, 'accounts'),
          where('studentId', '==', user.uid)
        );
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          let accountsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Ordenar no cliente: conta ativa primeiro, depois por data de criação
          accountsData.sort((a, b) => {
            // Ativa primeiro
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            
            // Depois por data de criação (mais recente primeiro)
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
            return dateB - dateA;
          });
          
          setAccounts(accountsData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Erro ao carregar contas:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Erro ao configurar listener de contas:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user, isMentor]);

  // Criar conta
  // CORREÇÃO Bug #1: Agora cria movimentação automática quando saldo inicial > 0
  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const initialBalance = parseFloat(accountData.initialBalance) || 0;
      
      const newAccount = {
        ...accountData,
        initialBalance,
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        currentBalance: initialBalance,
        active: accountData.active !== undefined ? accountData.active : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      
      // CORREÇÃO Bug #1: Criar movimentação de saldo inicial se > 0
      if (initialBalance > 0) {
        await addDoc(collection(db, 'movements'), {
          type: 'DEPOSIT',
          amount: initialBalance,
          accountId: docRef.id,
          date: new Date().toISOString().split('T')[0],
          description: 'Saldo inicial da conta',
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email.split('@')[0],
          isInitialBalance: true, // Flag para identificar que é saldo inicial
          createdAt: serverTimestamp()
        });
      }
      
      return docRef.id;
    } catch (err) {
      console.error('Erro ao criar conta:', err);
      throw err;
    }
  }, [user]);

  // Atualizar conta
  const updateAccount = useCallback(async (accountId, accountData) => {
    try {
      const accountRef = doc(db, 'accounts', accountId);
      await updateDoc(accountRef, {
        ...accountData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao atualizar conta:', err);
      throw err;
    }
  }, []);

  // Deletar conta
  const deleteAccount = useCallback(async (accountId) => {
    try {
      await deleteDoc(doc(db, 'accounts', accountId));
    } catch (err) {
      console.error('Erro ao deletar conta:', err);
      throw err;
    }
  }, []);

  // Buscar contas por aluno
  const getAccountsByStudent = useCallback((studentId) => {
    return accounts.filter(acc => acc.studentId === studentId);
  }, [accounts]);

  // Buscar conta ativa do aluno
  const getActiveAccount = useCallback((studentId) => {
    const studentAccounts = studentId 
      ? accounts.filter(acc => acc.studentId === studentId)
      : accounts.filter(acc => acc.studentId === user?.uid);
    
    return studentAccounts.find(acc => acc.active) || studentAccounts[0];
  }, [accounts, user]);

  return {
    accounts,
    loading,
    error,
    addAccount,
    updateAccount,
    deleteAccount,
    getAccountsByStudent,
    getActiveAccount
  };
};

export default useAccounts;
