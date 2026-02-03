import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useAccounts = () => {
  const { user, isMentor } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar contas (Listener padrão)
  useEffect(() => {
    if (!user) { setAccounts([]); setLoading(false); return; }
    setLoading(true);
    let q;
    try {
      if (isMentor()) {
        q = query(collection(db, 'accounts'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'accounts'), where('studentId', '==', user.uid));
      }
      const unsubscribe = onSnapshot(q, (snapshot) => {
          let accountsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Ordenação local
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
        (err) => { console.error(err); setLoading(false); }
      );
      return () => unsubscribe();
    } catch (err) { setError(err.message); setLoading(false); }
  }, [user, isMentor]);

  // --- CRIAÇÃO DE CONTA (PADRÃO LEDGER) ---
  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const initialAmount = parseFloat(accountData.initialBalance) || 0;
      
      // 1. Cria a Conta ZERADA (currentBalance: 0)
      // O 'initialBalance' fica apenas como registro de meta/referência.
      const newAccount = {
        ...accountData,
        initialBalance: initialAmount,
        currentBalance: 0, // Começa zero. O Backend vai somar o movimento.
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        active: accountData.active !== undefined ? accountData.active : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      const accountId = docRef.id;
      
      // 2. Cria o Movimento
      // O Backend (onMovementCreated) vai pegar este movimento e somar na conta:
      // Conta (0) + Movimento (3000) = Saldo Final (3000).
      if (initialAmount > 0) {
        await addDoc(collection(db, 'movements'), {
          type: 'DEPOSIT',
          amount: initialAmount,
          accountId: accountId,
          date: new Date().toISOString().split('T')[0],
          description: 'Saldo inicial da conta',
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email.split('@')[0],
          isInitialBalance: true, // A flag existe, mas o backend agora a processa
          createdAt: serverTimestamp()
        });
      }
      
      return accountId;
    } catch (err) {
      console.error('Erro ao criar conta:', err);
      throw err;
    }
  }, [user]);

  // Métodos auxiliares mantidos...
  const updateAccount = useCallback(async (accountId, accountData) => {
    try {
      const accountRef = doc(db, 'accounts', accountId);
      await updateDoc(accountRef, { ...accountData, updatedAt: serverTimestamp() });
    } catch (err) { throw err; }
  }, []);

  const deleteAccount = useCallback(async (accountId) => {
    try { await deleteDoc(doc(db, 'accounts', accountId)); } 
    catch (err) { throw err; }
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

  return {
    accounts, loading, error, addAccount, updateAccount, deleteAccount, getAccountsByStudent, getActiveAccount
  };
};

export default useAccounts;