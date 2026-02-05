import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para gerenciamento de contas de trading
 * 
 * ESCRITA HÍBRIDA (Retrocompatibilidade):
 * - Salva `type`: 'REAL' | 'DEMO' | 'PROP' (novo padrão)
 * - Salva `isReal`: boolean (para compatibilidade com hooks antigos)
 * 
 * LEITURA:
 * - Prioriza `type` se existir
 * - Fallback para `isReal` se `type` for nulo (contas antigas)
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
        // Query simples para aluno - ordenação no cliente
        q = query(collection(db, 'accounts'), where('studentId', '==', user.uid));
      }
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          let accountsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
              id: doc.id, 
              ...data,
              // Normalizar: garantir que `type` e `isReal` estejam consistentes
              type: data.type || (data.isReal ? 'REAL' : 'DEMO'),
              isReal: data.isReal ?? (data.type === 'REAL' || data.type === 'PROP')
            };
          });
          
          // Ordenação local: ativa primeiro, depois por data
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

  /**
   * Criar conta com ESCRITA HÍBRIDA
   * - Salva `type` E `isReal` para retrocompatibilidade
   * - Cria movimento de saldo inicial (INITIAL_BALANCE)
   */
  const addAccount = useCallback(async (accountData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const initialAmount = parseFloat(accountData.initialBalance) || 0;
      const accountType = accountData.type || 'DEMO';
      
      // Calcular isReal a partir do type (ESCRITA HÍBRIDA)
      const isRealDerived = accountType === 'REAL' || accountType === 'PROP';
      
      // 1. Cria a Conta
      const newAccount = {
        name: accountData.name,
        broker: accountData.broker,
        currency: accountData.currency || 'BRL',
        type: accountType,           // Novo campo
        isReal: isRealDerived,       // Campo legado para compatibilidade
        initialBalance: initialAmount,
        currentBalance: initialAmount, // Começa com saldo inicial
        studentId: user.uid,
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        active: accountData.active !== undefined ? accountData.active : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'accounts'), newAccount);
      const accountId = docRef.id;
      
      // 2. Cria o Movimento de saldo inicial (INITIAL_BALANCE)
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
          dateTime: `${movementDate}T00:00:00.000Z`, // Sempre no início do dia
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

  /**
   * Atualizar conta com ESCRITA HÍBRIDA
   * Se initialBalance mudou, cria movimento de ADJUSTMENT
   */
  const updateAccount = useCallback(async (accountId, accountData) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      const accountRef = doc(db, 'accounts', accountId);
      
      // Buscar conta atual para comparar
      const currentAccount = accounts.find(acc => acc.id === accountId);
      
      // Se type foi alterado, recalcular isReal
      const updateData = { ...accountData };
      if (accountData.type) {
        updateData.isReal = accountData.type === 'REAL' || accountData.type === 'PROP';
      }

      // Se initialBalance mudou, criar movimento ADJUSTMENT
      if (currentAccount && accountData.initialBalance !== undefined) {
        const oldInitial = currentAccount.initialBalance || 0;
        const newInitial = parseFloat(accountData.initialBalance) || 0;
        const diff = newInitial - oldInitial;
        
        if (diff !== 0) {
          // Buscar último movimento para calcular saldo
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
            // Ordenar por dateTime descendente para pegar o último
            allMovements.sort((a, b) => {
              const dtA = a.dateTime || a.date || '';
              const dtB = b.dateTime || b.date || '';
              return dtB.localeCompare(dtA);
            });
            balanceBefore = allMovements[0].balanceAfter || 0;
          }

          const balanceAfter = balanceBefore + diff;
          const adjustmentDate = new Date().toISOString().split('T')[0];
          
          // Criar movimento de ajuste
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
            dateTime: new Date().toISOString(), // Timestamp atual
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          // Atualizar currentBalance também
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
   * Deletar conta com CASCADE DELETE
   * Remove todos os movements associados
   */
  const deleteAccount = useCallback(async (accountId) => {
    try {
      // 1. Buscar e deletar todos os movements da conta
      const movementsQuery = query(
        collection(db, 'movements'),
        where('accountId', '==', accountId)
      );
      const movementsSnapshot = await getDocs(movementsQuery);
      
      console.log(`[useAccounts] Deletando ${movementsSnapshot.size} movements da conta ${accountId}`);
      
      const deletePromises = movementsSnapshot.docs.map(docSnap => 
        deleteDoc(doc(db, 'movements', docSnap.id))
      );
      await Promise.all(deletePromises);
      
      // 2. Deletar a conta
      await deleteDoc(doc(db, 'accounts', accountId));
      
      console.log(`[useAccounts] Conta ${accountId} deletada com sucesso`);
    } catch (err) { 
      console.error('Erro ao deletar conta:', err);
      throw err; 
    }
  }, []);

  /**
   * Buscar contas por aluno
   */
  const getAccountsByStudent = useCallback((studentId) => {
    return accounts.filter(acc => acc.studentId === studentId);
  }, [accounts]);

  /**
   * Buscar conta ativa do aluno
   */
  const getActiveAccount = useCallback((studentId) => {
    const studentAccounts = studentId 
      ? accounts.filter(acc => acc.studentId === studentId)
      : accounts.filter(acc => acc.studentId === user?.uid);
    return studentAccounts.find(acc => acc.active) || studentAccounts[0];
  }, [accounts, user]);

  /**
   * Buscar contas reais (usando lógica híbrida)
   */
  const getRealAccounts = useCallback(() => {
    return accounts.filter(acc => {
      if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
      return acc.isReal === true;
    });
  }, [accounts]);

  /**
   * Buscar contas demo (usando lógica híbrida)
   */
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
