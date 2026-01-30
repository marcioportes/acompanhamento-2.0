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
 * Hook para gerenciamento de setups de trading
 */
export const useSetups = () => {
  const { user } = useAuth();
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar setups (globais + do usuário)
  useEffect(() => {
    if (!user) {
      setSetups([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query para setups globais e do usuário
    const q = query(
      collection(db, 'setups'),
      where('active', '==', true),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const setupsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filtra: globais + criados pelo usuário
        const filtered = setupsData.filter(s => 
          s.isGlobal || s.createdBy === user.uid
        );
        
        setSetups(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar setups:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Criar setup personalizado
  const addSetup = useCallback(async (setupData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newSetup = {
        ...setupData,
        createdBy: user.uid,
        isGlobal: false,
        active: true,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'setups'), newSetup);
      return docRef.id;
    } catch (err) {
      console.error('Erro ao criar setup:', err);
      throw err;
    }
  }, [user]);

  // Atualizar setup
  const updateSetup = useCallback(async (setupId, setupData) => {
    try {
      const setupRef = doc(db, 'setups', setupId);
      await updateDoc(setupRef, {
        ...setupData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao atualizar setup:', err);
      throw err;
    }
  }, []);

  // Deletar setup (apenas personalizados)
  const deleteSetup = useCallback(async (setupId) => {
    try {
      await deleteDoc(doc(db, 'setups', setupId));
    } catch (err) {
      console.error('Erro ao deletar setup:', err);
      throw err;
    }
  }, []);

  // Buscar setup por ID
  const getSetupById = useCallback((setupId) => {
    return setups.find(s => s.id === setupId);
  }, [setups]);

  // Buscar setups globais
  const getGlobalSetups = useCallback(() => {
    return setups.filter(s => s.isGlobal);
  }, [setups]);

  // Buscar setups do usuário
  const getUserSetups = useCallback(() => {
    return setups.filter(s => !s.isGlobal && s.createdBy === user?.uid);
  }, [setups, user]);

  return {
    setups,
    loading,
    error,
    addSetup,
    updateSetup,
    deleteSetup,
    getSetupById,
    getGlobalSetups,
    getUserSetups
  };
};

export default useSetups;
