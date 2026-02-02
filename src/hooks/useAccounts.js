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
 * * CORREÇÕES APLICADAS:
 * - Bug #1: Movimento Inicial duplicando saldo (Resolvido: currentBalance inicia zerado)
 * - Bug #2: Query ajustada para garantir visualização correta
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
        // Aluno vê apenas suas contas
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
          
          // Ordenação no cliente para evitar erros de índice composto no Firestore
          accountsData.sort((a, b) => {
            // 1. Contas ativas no topo
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            
            // 2. Mais recentes depois
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
  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const initialBalance = parseFloat(accountData.initialBalance) || 0;
      
      const newAccount = {
        ...accountData,
        initialBalance, // Mantém o registro do valor de "start" para referência (ex: R$ 3.000)
        
        // --- CORREÇÃO MATEMÁTICA ---
        // Iniciamos com 0. O movimento de depósito abaixo será processado pelo sistema
        // e atualizará este valor para 3.000. Se iniciarmos com 3.000, o movimento
        // somará + 3.000, resultando em 6.000 (erro atual).
        currentBalance: 0, 
        
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        active: accountData.active !== undefined ? accountData.active : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 1. Cria a Conta (Saldo Atual: 0)
      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      
      // 2. Cria o Movimento (Valor: 3.000)
      // O sistema (Cloud Function ou Hook de saldo) vai pegar este movimento
      // e somar na conta: 0 + 3.000 = 3.000 (Correto).
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
          isInitialBalance: true,
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