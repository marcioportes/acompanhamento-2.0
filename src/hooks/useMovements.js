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
/**
 * useMovements
 * @version 5.3.0 (Smart Fetch)
 * @description Hook focado em buscar o histórico financeiro para o Reverse Ledger.
 * * ESTRATÉGIA:
 * - Busca movimentos ordenados por data (Decrescente: Hoje -> Ontem).
 * - Removemos limits baixos para garantir que o cálculo reverso tenha a cadeia completa.
 * - Mantemos a criação de movimentos (addMovement) desacoplada do saldo (Single Responsibility).
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, 
  serverTimestamp, deleteDoc, getDocs 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useMovements = (accountId = null) => {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accountId || !user) {
      setMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Trazemos o histórico ordenado do mais recente para o mais antigo.
    // Para o Reverse Ledger funcionar perfeitamente, precisamos da cadeia contínua.
    // Em produção com +10k itens, aqui entrará uma estratégia de "Windowing" ou carga por ano.
    const q = query(
      collection(db, 'movements'),
      where('accountId', '==', accountId),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc') // Desempate para movimentos no mesmo dia
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Normalização preventiva de datas
          date: doc.data().date || new Date().toISOString().split('T')[0]
        }));
        setMovements(data);
        setLoading(false);
      }, (err) => {
        console.error('Erro ao carregar movimentos:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [accountId, user]);

  // --- ACTIONS (Apenas criam o registro, o Backend atualiza o saldo) ---

  const addMovement = useCallback(async (accId, type, amount, description, options = {}) => {
    if (!user) throw new Error('Auth required');
    const targetAccountId = accId || accountId;
    
    const movementData = {
      accountId: targetAccountId,
      type,
      amount: Number(amount), // Garante numérico
      description,
      date: options.date || new Date().toISOString().split('T')[0],
      dateTime: new Date().toISOString(),
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      ...(options.tradeId && { tradeId: options.tradeId })
    };

    await addDoc(collection(db, 'movements'), movementData);
  }, [user, accountId]);

  const addDeposit = (accId, val, desc) => addMovement(accId, 'DEPOSIT', Math.abs(val), desc || 'Aporte');
  const addWithdrawal = (accId, val, desc) => addMovement(accId, 'WITHDRAWAL', -Math.abs(val), desc || 'Retirada');

  return {
    movements,
    loading,
    error,
    addDeposit,
    addWithdrawal
  };
};

export default useMovements;