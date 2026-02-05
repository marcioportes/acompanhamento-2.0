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
 * Hook para gerenciar dados mestres do sistema
 * - Setups (configurados pelo mentor)
 * - Bolsas/Exchanges
 * - Corretoras/Brokers
 * - Moedas
 * - Emoções
 * - Tickers (ativos negociáveis)
 * 
 * Mentor pode criar/editar/excluir
 * Aluno apenas lê
 */
export const useMasterData = () => {
  const { user, isMentor } = useAuth();
  
  const [setups, setSetups] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar todos os dados mestres
  useEffect(() => {
    if (!user) {
      setSetups([]);
      setExchanges([]);
      setBrokers([]);
      setCurrencies([]);
      setEmotions([]);
      setTickers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [];

    try {
      // Setups
      const setupsQuery = query(
        collection(db, 'setups'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(setupsQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setSetups(data);
        }, (err) => {
          console.error('Erro ao carregar setups:', err);
        })
      );

      // Exchanges/Bolsas
      const exchangesQuery = query(
        collection(db, 'exchanges'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(exchangesQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setExchanges(data);
        }, (err) => {
          console.error('Erro ao carregar exchanges:', err);
        })
      );

      // Brokers/Corretoras
      const brokersQuery = query(
        collection(db, 'brokers'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(brokersQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setBrokers(data);
        }, (err) => {
          console.error('Erro ao carregar brokers:', err);
        })
      );

      // Currencies/Moedas
      const currenciesQuery = query(
        collection(db, 'currencies'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(currenciesQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCurrencies(data);
        }, (err) => {
          console.error('Erro ao carregar currencies:', err);
        })
      );

      // Emotions/Emoções
      const emotionsQuery = query(
        collection(db, 'emotions'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(emotionsQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setEmotions(data);
        }, (err) => {
          console.error('Erro ao carregar emotions:', err);
        })
      );

      // Tickers (ativos negociáveis)
      const tickersQuery = query(
        collection(db, 'tickers'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(tickersQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
          setTickers(data);
        }, (err) => {
          console.error('Erro ao carregar tickers:', err);
        })
      );

      setLoading(false);

    } catch (err) {
      console.error('Erro ao configurar listeners:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  // ==================== CRUD GENÉRICO ====================

  const addItem = useCallback(async (collectionName, data) => {
    if (!isMentor()) throw new Error('Apenas mentor pode adicionar');
    
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (err) {
      console.error(`Erro ao adicionar ${collectionName}:`, err);
      throw err;
    }
  }, [isMentor]);

  const updateItem = useCallback(async (collectionName, id, data) => {
    if (!isMentor()) throw new Error('Apenas mentor pode editar');
    
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(`Erro ao atualizar ${collectionName}:`, err);
      throw err;
    }
  }, [isMentor]);

  const deleteItem = useCallback(async (collectionName, id) => {
    if (!isMentor()) throw new Error('Apenas mentor pode excluir');
    
    try {
      // Soft delete - marca como inativo
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        active: false,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(`Erro ao excluir ${collectionName}:`, err);
      throw err;
    }
  }, [isMentor]);

  // ==================== SETUPS ====================

  const addSetup = useCallback((data) => addItem('setups', data), [addItem]);
  const updateSetup = useCallback((id, data) => updateItem('setups', id, data), [updateItem]);
  const deleteSetup = useCallback((id) => deleteItem('setups', id), [deleteItem]);

  // ==================== EXCHANGES ====================

  const addExchange = useCallback((data) => addItem('exchanges', data), [addItem]);
  const updateExchange = useCallback((id, data) => updateItem('exchanges', id, data), [updateItem]);
  const deleteExchange = useCallback((id) => deleteItem('exchanges', id), [deleteItem]);

  // ==================== BROKERS ====================

  const addBroker = useCallback((data) => addItem('brokers', data), [addItem]);
  const updateBroker = useCallback((id, data) => updateItem('brokers', id, data), [updateItem]);
  const deleteBroker = useCallback((id) => deleteItem('brokers', id), [deleteItem]);

  // ==================== CURRENCIES ====================

  const addCurrency = useCallback((data) => addItem('currencies', data), [addItem]);
  const updateCurrency = useCallback((id, data) => updateItem('currencies', id, data), [updateItem]);
  const deleteCurrency = useCallback((id) => deleteItem('currencies', id), [deleteItem]);

  // ==================== EMOTIONS ====================

  const addEmotion = useCallback((data) => addItem('emotions', data), [addItem]);
  const updateEmotion = useCallback((id, data) => updateItem('emotions', id, data), [updateItem]);
  const deleteEmotion = useCallback((id) => deleteItem('emotions', id), [deleteItem]);

  // ==================== HELPERS ====================

  const getSetupById = useCallback((id) => setups.find(s => s.id === id), [setups]);
  const getSetupByName = useCallback((name) => setups.find(s => s.name === name), [setups]);
  const getExchangeByCode = useCallback((code) => exchanges.find(e => e.code === code), [exchanges]);
  const getBrokerById = useCallback((id) => brokers.find(b => b.id === id), [brokers]);
  const getBrokerByName = useCallback((name) => brokers.find(b => b.name === name), [brokers]);
  const getCurrencyByCode = useCallback((code) => currencies.find(c => c.code === code), [currencies]);
  const getEmotionById = useCallback((id) => emotions.find(e => e.id === id), [emotions]);
  const getEmotionByName = useCallback((name) => emotions.find(e => e.name === name), [emotions]);
  
  // Emoções por categoria
  const getPositiveEmotions = useCallback(() => emotions.filter(e => e.category === 'positive'), [emotions]);
  const getNegativeEmotions = useCallback(() => emotions.filter(e => e.category === 'negative'), [emotions]);
  const getNeutralEmotions = useCallback(() => emotions.filter(e => e.category === 'neutral'), [emotions]);

  return {
    // Data
    setups,
    exchanges,
    brokers,
    currencies,
    emotions,
    tickers,
    loading,
    error,
    
    // CRUD Setups
    addSetup,
    updateSetup,
    deleteSetup,
    
    // CRUD Exchanges
    addExchange,
    updateExchange,
    deleteExchange,
    
    // CRUD Brokers
    addBroker,
    updateBroker,
    deleteBroker,
    
    // CRUD Currencies
    addCurrency,
    updateCurrency,
    deleteCurrency,
    
    // CRUD Emotions
    addEmotion,
    updateEmotion,
    deleteEmotion,
    
    // Helpers
    getSetupById,
    getSetupByName,
    getExchangeByCode,
    getBrokerById,
    getBrokerByName,
    getCurrencyByCode,
    getEmotionById,
    getEmotionByName,
    getPositiveEmotions,
    getNegativeEmotions,
    getNeutralEmotions
  };
};

export default useMasterData;
