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
    let q;

    if (isMentor()) {
      // Mentor vê todas as contas
      q = query(
        collection(db, 'accounts'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Aluno vê apenas suas contas
      q = query(
        collection(db, 'accounts'),
        where('studentId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const accountsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
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
  }, [user, isMentor]);

  // Criar conta
  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newAccount = {
        ...accountData,
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        currentBalance: accountData.initialBalance,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
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
