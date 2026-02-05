/**
 * useMovements - Hook para gerenciamento do Ledger Contábil
 * 
 * MODELO CONTÁBIL:
 * - Cada conta tem uma coleção de movimentos (ledger)
 * - Movimentos são imutáveis (append-only)
 * - O saldo atual é SEMPRE a soma dos movimentos
 * 
 * TIPOS DE MOVIMENTO:
 * - INITIAL_BALANCE: Saldo inicial ao criar conta
 * - DEPOSIT: Aporte de capital
 * - WITHDRAWAL: Retirada de capital
 * - TRADE_RESULT: Resultado de trade (criado automaticamente pelo useTrades)
 * - ADJUSTMENT: Ajuste manual (correção de erros)
 * 
 * ESTRUTURA DO MOVIMENTO:
 * {
 *   accountId: string,
 *   type: 'INITIAL_BALANCE' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_RESULT' | 'ADJUSTMENT',
 *   amount: number (positivo para entrada, negativo para saída),
 *   balanceBefore: number,
 *   balanceAfter: number,
 *   description: string,
 *   date: string (YYYY-MM-DD),
 *   dateTime: string (ISO 8601 - YYYY-MM-DDTHH:mm:ss.sssZ) - para ordenação precisa
 *   tradeId?: string (se for TRADE_RESULT),
 *   createdAt: timestamp,
 *   createdBy: string (userId)
 * }
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, getDocs,
  doc, updateDoc, serverTimestamp, writeBatch, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useMovements = (accountId = null) => {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar movimentos da conta (listener real-time)
  useEffect(() => {
    if (!accountId || !user) {
      setMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Query simples - ordenação será feita localmente por dateTime
    const q = query(
      collection(db, 'movements'),
      where('accountId', '==', accountId)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Ordenar por dateTime (ISO string ordena corretamente como texto)
        data.sort((a, b) => {
          const dtA = a.dateTime || a.date || '';
          const dtB = b.dateTime || b.date || '';
          return dtA.localeCompare(dtB);
        });
        
        setMovements(data);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar movimentos:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [accountId, user]);

  /**
   * Buscar saldo atual da conta (último balanceAfter)
   */
  const getCurrentBalance = useCallback(() => {
    if (movements.length === 0) return 0;
    return movements[movements.length - 1].balanceAfter || 0;
  }, [movements]);

  /**
   * Buscar último movimento (para calcular balanceBefore do próximo)
   */
  const getLastMovement = useCallback(async (accId) => {
    const targetAccountId = accId || accountId;
    if (!targetAccountId) return null;

    try {
      const q = query(
        collection(db, 'movements'),
        where('accountId', '==', targetAccountId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      
      // Ordenar por dateTime e pegar o último
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => {
        const dtA = a.dateTime || a.date || '';
        const dtB = b.dateTime || b.date || '';
        return dtB.localeCompare(dtA); // Descendente para pegar o último
      });
      
      return all[0];
    } catch (err) {
      console.error('Erro ao buscar último movimento:', err);
      return null;
    }
  }, [accountId]);

  /**
   * Gerar dateTime para ordenação
   * Para INITIAL_BALANCE, usa data às 00:00:00
   * Para outros, usa momento atual
   */
  const generateDateTime = (date, type) => {
    if (type === 'INITIAL_BALANCE') {
      // INITIAL_BALANCE sempre no início do dia
      return `${date}T00:00:00.000Z`;
    }
    // Outros movimentos usam timestamp atual
    return new Date().toISOString();
  };

  /**
   * Adicionar movimento genérico
   */
  const addMovement = useCallback(async (accId, type, amount, description, options = {}) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    const targetAccountId = accId || accountId;
    if (!targetAccountId) throw new Error('Account ID obrigatório');

    try {
      // Buscar último movimento para calcular saldo anterior
      const lastMovement = await getLastMovement(targetAccountId);
      const balanceBefore = lastMovement?.balanceAfter || 0;
      const balanceAfter = balanceBefore + amount;
      
      const date = options.date || new Date().toISOString().split('T')[0];
      const dateTime = options.dateTime || generateDateTime(date, type);

      const movementData = {
        accountId: targetAccountId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description: description || getDefaultDescription(type),
        date,
        dateTime, // Campo para ordenação precisa
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        ...(options.tradeId && { tradeId: options.tradeId }),
        ...(options.metadata && { metadata: options.metadata })
      };

      const docRef = await addDoc(collection(db, 'movements'), movementData);

      // Atualizar currentBalance na conta
      await updateDoc(doc(db, 'accounts', targetAccountId), {
        currentBalance: balanceAfter,
        updatedAt: serverTimestamp()
      });

      return { id: docRef.id, ...movementData, balanceAfter };
    } catch (err) {
      console.error('Erro ao adicionar movimento:', err);
      throw err;
    }
  }, [user, accountId, getLastMovement]);

  /**
   * Adicionar depósito
   */
  const addDeposit = useCallback(async (accId, amount, description = '') => {
    return addMovement(accId, 'DEPOSIT', Math.abs(amount), description || 'Depósito');
  }, [addMovement]);

  /**
   * Adicionar saque
   */
  const addWithdrawal = useCallback(async (accId, amount, description = '') => {
    return addMovement(accId, 'WITHDRAWAL', -Math.abs(amount), description || 'Saque');
  }, [addMovement]);

  /**
   * Adicionar resultado de trade (chamado pelo useTrades)
   */
  const addTradeResult = useCallback(async (accId, tradeResult, tradeId, tradeDescription, tradeDate) => {
    return addMovement(
      accId, 
      'TRADE_RESULT', 
      tradeResult, 
      tradeDescription,
      { 
        tradeId,
        date: tradeDate,
        dateTime: tradeDate ? `${tradeDate}T${new Date().toISOString().split('T')[1]}` : undefined
      }
    );
  }, [addMovement]);

  /**
   * Adicionar saldo inicial (chamado ao criar conta)
   */
  const addInitialBalance = useCallback(async (accId, amount, date) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    const movementDate = date || new Date().toISOString().split('T')[0];
    
    try {
      const movementData = {
        accountId: accId,
        type: 'INITIAL_BALANCE',
        amount: Math.abs(amount),
        balanceBefore: 0,
        balanceAfter: Math.abs(amount),
        description: 'Saldo inicial',
        date: movementDate,
        dateTime: `${movementDate}T00:00:00.000Z`, // Sempre no início do dia
        createdAt: serverTimestamp(),
        createdBy: user.uid
      };

      await addDoc(collection(db, 'movements'), movementData);

      // Atualizar conta
      await updateDoc(doc(db, 'accounts', accId), {
        currentBalance: Math.abs(amount),
        updatedAt: serverTimestamp()
      });

      return movementData;
    } catch (err) {
      console.error('Erro ao adicionar saldo inicial:', err);
      throw err;
    }
  }, [user]);

  /**
   * Buscar movimentos por período
   */
  const getMovementsByPeriod = useCallback((startDate, endDate) => {
    return movements.filter(m => {
      const date = m.date;
      return date >= startDate && date <= endDate;
    });
  }, [movements]);

  /**
   * Calcular totais por tipo
   */
  const getTotals = useCallback(() => {
    const totals = {
      deposits: 0,
      withdrawals: 0,
      tradeResults: 0,
      adjustments: 0,
      net: 0
    };

    movements.forEach(m => {
      switch (m.type) {
        case 'INITIAL_BALANCE':
        case 'DEPOSIT':
          totals.deposits += m.amount;
          break;
        case 'WITHDRAWAL':
          totals.withdrawals += Math.abs(m.amount);
          break;
        case 'TRADE_RESULT':
          totals.tradeResults += m.amount;
          break;
        case 'ADJUSTMENT':
          totals.adjustments += m.amount;
          break;
      }
      totals.net += m.amount;
    });

    return totals;
  }, [movements]);

  return {
    movements,
    loading,
    error,
    getCurrentBalance,
    getLastMovement,
    addMovement,
    addDeposit,
    addWithdrawal,
    addTradeResult,
    addInitialBalance,
    getMovementsByPeriod,
    getTotals
  };
};

// Helper para descrição padrão
const getDefaultDescription = (type) => {
  switch (type) {
    case 'INITIAL_BALANCE': return 'Saldo inicial';
    case 'DEPOSIT': return 'Depósito';
    case 'WITHDRAWAL': return 'Saque';
    case 'TRADE_RESULT': return 'Resultado de operação';
    case 'ADJUSTMENT': return 'Ajuste';
    default: return 'Movimento';
  }
};

export default useMovements;
