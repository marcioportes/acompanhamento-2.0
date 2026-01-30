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
 * Hook para gerenciamento de movimentações (depósitos/saques)
 */
export const useMovements = (accountId = null) => {
  const { user, isMentor } = useAuth();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar movimentações
  useEffect(() => {
    if (!user) {
      setMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let q;

    if (accountId) {
      // Movimentações de uma conta específica
      q = query(
        collection(db, 'movements'),
        where('accountId', '==', accountId),
        orderBy('date', 'desc')
      );
    } else if (isMentor()) {
      // Mentor vê todas as movimentações
      q = query(
        collection(db, 'movements'),
        orderBy('date', 'desc')
      );
    } else {
      // Aluno vê apenas suas movimentações
      q = query(
        collection(db, 'movements'),
        where('studentId', '==', user.uid),
        orderBy('date', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const movementsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMovements(movementsData);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar movimentações:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isMentor, accountId]);

  // Criar movimentação
  const addMovement = useCallback(async (movementData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newMovement = {
        ...movementData,
        studentId: user.uid,
        studentEmail: user.email,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'movements'), newMovement);
      return docRef.id;
    } catch (err) {
      console.error('Erro ao criar movimentação:', err);
      throw err;
    }
  }, [user]);

  // Atualizar movimentação
  const updateMovement = useCallback(async (movementId, movementData) => {
    try {
      const movementRef = doc(db, 'movements', movementId);
      await updateDoc(movementRef, {
        ...movementData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao atualizar movimentação:', err);
      throw err;
    }
  }, []);

  // Deletar movimentação
  const deleteMovement = useCallback(async (movementId) => {
    try {
      await deleteDoc(doc(db, 'movements', movementId));
    } catch (err) {
      console.error('Erro ao deletar movimentação:', err);
      throw err;
    }
  }, []);

  // Buscar movimentações por conta
  const getMovementsByAccount = useCallback((accId) => {
    return movements.filter(m => m.accountId === accId);
  }, [movements]);

  // Calcular totais
  const getAccountTotals = useCallback((accId) => {
    const accountMovements = movements.filter(m => m.accountId === accId);
    
    const deposits = accountMovements
      .filter(m => m.type === 'DEPOSIT')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const withdrawals = accountMovements
      .filter(m => m.type === 'WITHDRAWAL')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    return {
      deposits,
      withdrawals,
      net: deposits - withdrawals
    };
  }, [movements]);

  return {
    movements,
    loading,
    error,
    addMovement,
    updateMovement,
    deleteMovement,
    getMovementsByAccount,
    getAccountTotals
  };
};

export default useMovements;
