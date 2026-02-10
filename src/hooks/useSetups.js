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
 * 
 * Setups podem ser:
 * - Globais (isGlobal: true) - criados pelo mentor, disponíveis para todos
 * - Pessoais (isGlobal: false) - criados pelo aluno, apenas para ele
 */
export const useSetups = () => {
  const { user, isMentor } = useAuth();
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar setups
  useEffect(() => {
    if (!user) {
      setSetups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Carregar setups globais + setups pessoais do aluno
    // Mentor vê todos os setups
    let q;
    
    if (isMentor()) {
      q = query(
        collection(db, 'setups'),
        where('active', '==', true),
        orderBy('name', 'asc')
      );
    } else {
      // Aluno vê setups globais (para todos verem os mesmos)
      q = query(
        collection(db, 'setups'),
        where('active', '==', true),
        orderBy('name', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        let setupsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Se não for mentor, filtrar apenas globais ou do próprio aluno
        if (!isMentor()) {
          setupsData = setupsData.filter(s => 
            s.isGlobal || s.studentId === user.uid
          );
        }
        
        setSetups(setupsData);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar setups:', err);
        // Fallback: tentar sem orderBy
        const fallbackQuery = query(
          collection(db, 'setups'),
          where('active', '==', true)
        );
        
        onSnapshot(fallbackQuery, (snapshot) => {
          let setupsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Ordenar no cliente
          setupsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          
          // Filtrar se não for mentor
          if (!isMentor()) {
            setupsData = setupsData.filter(s => 
              s.isGlobal || s.studentId === user?.uid
            );
          }
          
          setSetups(setupsData);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [user, isMentor]);

  // Criar setup (mentor cria globais, aluno cria pessoais)
  const addSetup = useCallback(async (setupData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const newSetup = {
        ...setupData,
        isGlobal: isMentor() ? (setupData.isGlobal !== false) : false, // Aluno sempre cria pessoal
        studentId: isMentor() ? null : user.uid,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'setups'), newSetup);
      return docRef.id;
    } catch (err) {
      console.error('Erro ao criar setup:', err);
      throw err;
    }
  }, [user, isMentor]);

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

  // Deletar setup (soft delete - marca como inativo)
  const deleteSetup = useCallback(async (setupId) => {
    try {
      const setupRef = doc(db, 'setups', setupId);
      await updateDoc(setupRef, {
        active: false,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao deletar setup:', err);
      throw err;
    }
  }, []);

  // Buscar setup por ID
  const getSetupById = useCallback((setupId) => {
    return setups.find(s => s.id === setupId);
  }, [setups]);

  // Buscar setup por nome
  const getSetupByName = useCallback((name) => {
    return setups.find(s => s.name === name);
  }, [setups]);

  // Buscar setups globais
  const getGlobalSetups = useCallback(() => {
    return setups.filter(s => s.isGlobal);
  }, [setups]);

  // Buscar setups pessoais do aluno
  const getPersonalSetups = useCallback((studentId) => {
    const id = studentId || user?.uid;
    return setups.filter(s => !s.isGlobal && s.studentId === id);
  }, [setups, user]);

  // Buscar setup default
  const getDefaultSetup = useCallback(() => {
    // Primeiro tenta encontrar um marcado como default
    const defaultSetup = setups.find(s => s.isDefault && s.isGlobal);
    if (defaultSetup) return defaultSetup;
    
    // Se não encontrar, retorna o primeiro global
    return setups.find(s => s.isGlobal);
  }, [setups]);

  return {
    setups,
    loading,
    error,
    addSetup,
    updateSetup,
    deleteSetup,
    getSetupById,
    getSetupByName,
    getGlobalSetups,
    getPersonalSetups,
    getDefaultSetup
  };
};

export default useSetups;
