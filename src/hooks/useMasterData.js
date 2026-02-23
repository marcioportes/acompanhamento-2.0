/**
 * useMasterData
 * @version 4.1.0
 * @description Hook central para dados mestres (CRUD + helpers V2 emocional)
 * 
 * CHANGELOG:
 * - 4.1.0: Adicionado getEmotionConfig(), getEmotionScore(), getCriticalEmotions() — Fase 1.4.0
 * - 4.0.0: Tickers hierárquicos com cascade delete — v1.6.0
 */
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
  orderBy,
  writeBatch, 
  getDocs,
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para gerenciar dados mestres do sistema
 * VERSÃO 3.0 - CRUD completo de Tickers + cascade delete Exchange→Tickers
 * 
 * Entidades: setups, exchanges, brokers, currencies, emotions, tickers
 * Permissões: Mentor = CRUD completo | Aluno = leitura
 * 
 * REGRAS DE NEGÓCIO:
 * - Ticker SEMPRE pertence a uma exchange (campo exchange = code da bolsa)
 * - Deletar exchange desativa todos tickers vinculados (cascade)
 * - Deletar exchange é bloqueado se há trades vinculados à bolsa
 * - Deletar ticker é bloqueado se há trades usando aquele symbol
 * - Tickers de futuros possuem tickSize, tickValue, minLot para cálculo de P&L
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

  // ==================== LISTENERS REALTIME ====================

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
          data.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          setExchanges(data);
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

  // ==================== EXCHANGES (com cascade delete → tickers) ====================

  const addExchange = useCallback((data) => addItem('exchanges', data), [addItem]);
  const updateExchange = useCallback((id, data) => updateItem('exchanges', id, data), [updateItem]);
  
  /**
   * Deleta exchange com cascade: desativa todos os tickers vinculados
   * BLOQUEIO: se houver trades usando esta bolsa, impede exclusão
   */
  const deleteExchange = useCallback(async (id) => {
    if (!isMentor()) throw new Error('Apenas mentor pode excluir');

    try {
      const exchangeToDeactivate = exchanges.find(e => e.id === id);
      if (!exchangeToDeactivate) throw new Error('Bolsa não encontrada');

      // 1. Verificar se existem trades associados a esta bolsa
      const tradesQuery = query(
        collection(db, 'trades'),
        where('exchange', '==', exchangeToDeactivate.code),
        limit(1)
      );
      const tradesSnapshot = await getDocs(tradesQuery);
      
      if (!tradesSnapshot.empty) {
        throw new Error(`Não é possível excluir a bolsa "${exchangeToDeactivate.code}" pois existem trades vinculados a ela.`);
      }

      const batch = writeBatch(db);
      const timestamp = serverTimestamp();

      // 2. Desativar a Bolsa
      const exchangeRef = doc(db, 'exchanges', id);
      batch.update(exchangeRef, { active: false, updatedAt: timestamp });

      // 3. CASCADE: Desativar todos os Tickers vinculados à bolsa
      const tickersQuery = query(
        collection(db, 'tickers'),
        where('exchange', '==', exchangeToDeactivate.code),
        where('active', '==', true)
      );
      const tickersSnapshot = await getDocs(tickersQuery);
      
      const tickerCount = tickersSnapshot.size;
      tickersSnapshot.forEach((tickerDoc) => {
        const tickerRef = doc(db, 'tickers', tickerDoc.id);
        batch.update(tickerRef, { active: false, updatedAt: timestamp });
      });

      // 4. Commit atômico
      await batch.commit();
      
      console.log(`Exchange "${exchangeToDeactivate.code}" desativada com ${tickerCount} ticker(s) em cascata.`);

    } catch (err) {
      console.error('Erro na exclusão em cascata:', err);
      throw err;
    }
  }, [isMentor, exchanges]);

  // ==================== TICKERS ====================

  /**
   * Adiciona ticker vinculado a uma exchange
   * Campos obrigatórios: symbol, name, exchange
   * Campos opcionais (futuros): tickSize, tickValue, minLot, pointValue
   */
  const addTicker = useCallback(async (data) => {
    if (!isMentor()) throw new Error('Apenas mentor pode adicionar');
    
    // Validação: exchange deve existir
    if (!data.exchange) throw new Error('Ticker deve estar vinculado a uma bolsa');
    const exchangeExists = exchanges.find(e => e.code === data.exchange);
    if (!exchangeExists) throw new Error(`Bolsa "${data.exchange}" não encontrada`);
    
    // Validação: symbol único por exchange
    const duplicate = tickers.find(t => 
      t.symbol.toUpperCase() === (data.symbol || '').toUpperCase() && 
      t.exchange === data.exchange
    );
    if (duplicate) throw new Error(`Ticker "${data.symbol}" já existe na bolsa "${data.exchange}"`);

    // Normalizar dados numéricos
    const normalized = {
      symbol: (data.symbol || '').toUpperCase().trim(),
      name: (data.name || '').trim(),
      exchange: data.exchange,
      tickSize: data.tickSize ? parseFloat(data.tickSize) : null,
      tickValue: data.tickValue ? parseFloat(data.tickValue) : null,
      minLot: data.minLot ? parseInt(data.minLot, 10) : 1,
      pointValue: data.pointValue ? parseFloat(data.pointValue) : null,
    };

    return addItem('tickers', normalized);
  }, [isMentor, addItem, exchanges, tickers]);

  /**
   * Atualiza ticker - mantém exchange se não fornecida
   */
  const updateTicker = useCallback(async (id, data) => {
    if (!isMentor()) throw new Error('Apenas mentor pode editar');
    
    // Se está mudando exchange, validar
    if (data.exchange) {
      const exchangeExists = exchanges.find(e => e.code === data.exchange);
      if (!exchangeExists) throw new Error(`Bolsa "${data.exchange}" não encontrada`);
    }

    // Se está mudando symbol, verificar duplicata
    if (data.symbol) {
      const currentTicker = tickers.find(t => t.id === id);
      const targetExchange = data.exchange || currentTicker?.exchange;
      const duplicate = tickers.find(t => 
        t.id !== id &&
        t.symbol.toUpperCase() === data.symbol.toUpperCase() && 
        t.exchange === targetExchange
      );
      if (duplicate) throw new Error(`Ticker "${data.symbol}" já existe na bolsa "${targetExchange}"`);
    }

    // Normalizar dados numéricos
    const normalized = { ...data };
    if (data.symbol) normalized.symbol = data.symbol.toUpperCase().trim();
    if (data.name) normalized.name = data.name.trim();
    if (data.tickSize !== undefined) normalized.tickSize = data.tickSize ? parseFloat(data.tickSize) : null;
    if (data.tickValue !== undefined) normalized.tickValue = data.tickValue ? parseFloat(data.tickValue) : null;
    if (data.minLot !== undefined) normalized.minLot = data.minLot ? parseInt(data.minLot, 10) : 1;
    if (data.pointValue !== undefined) normalized.pointValue = data.pointValue ? parseFloat(data.pointValue) : null;

    return updateItem('tickers', id, normalized);
  }, [isMentor, updateItem, exchanges, tickers]);

  /**
   * Deleta ticker (soft delete)
   * BLOQUEIO: se houver trades usando este ticker, impede exclusão
   */
  const deleteTicker = useCallback(async (id) => {
    if (!isMentor()) throw new Error('Apenas mentor pode excluir');

    const tickerToDelete = tickers.find(t => t.id === id);
    if (!tickerToDelete) throw new Error('Ticker não encontrado');

    // Verificar se existem trades usando este ticker
    const tradesQuery = query(
      collection(db, 'trades'),
      where('ticker', '==', tickerToDelete.symbol),
      limit(1)
    );
    const tradesSnapshot = await getDocs(tradesQuery);
    
    if (!tradesSnapshot.empty) {
      throw new Error(`Não é possível excluir o ticker "${tickerToDelete.symbol}" pois existem trades vinculados.`);
    }

    return deleteItem('tickers', id);
  }, [isMentor, deleteItem, tickers]);

  /**
   * Importa múltiplos tickers em batch (usado pelo "Importar Populares")
   * Ignora duplicatas silenciosamente
   * @param {Array} tickersToImport - Array de { symbol, name, exchange, tickSize?, tickValue?, minLot? }
   * @returns {Object} { imported: number, skipped: number }
   */
  const importTickers = useCallback(async (tickersToImport) => {
    if (!isMentor()) throw new Error('Apenas mentor pode importar');
    if (!Array.isArray(tickersToImport) || tickersToImport.length === 0) {
      throw new Error('Lista de tickers vazia');
    }

    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    let imported = 0;
    let skipped = 0;

    for (const t of tickersToImport) {
      // Verificar duplicata (por symbol + exchange)
      const exists = tickers.find(existing => 
        existing.symbol.toUpperCase() === (t.symbol || '').toUpperCase() &&
        existing.exchange === t.exchange
      );
      
      if (exists) {
        skipped++;
        continue;
      }

      const newDocRef = doc(collection(db, 'tickers'));
      batch.set(newDocRef, {
        symbol: (t.symbol || '').toUpperCase().trim(),
        name: (t.name || '').trim(),
        exchange: t.exchange,
        tickSize: t.tickSize ? parseFloat(t.tickSize) : null,
        tickValue: t.tickValue ? parseFloat(t.tickValue) : null,
        minLot: t.minLot ? parseInt(t.minLot, 10) : 1,
        pointValue: t.pointValue ? parseFloat(t.pointValue) : null,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      imported++;
    }

    if (imported > 0) {
      await batch.commit();
    }

    return { imported, skipped };
  }, [isMentor, tickers]);

  // ==================== OUTROS CRUDs ====================

  const addBroker = useCallback((data) => addItem('brokers', data), [addItem]);
  const updateBroker = useCallback((id, data) => updateItem('brokers', id, data), [updateItem]);
  const deleteBroker = useCallback((id) => deleteItem('brokers', id), [deleteItem]);

  const addCurrency = useCallback((data) => addItem('currencies', data), [addItem]);
  const updateCurrency = useCallback((id, data) => updateItem('currencies', id, data), [updateItem]);
  const deleteCurrency = useCallback((id) => deleteItem('currencies', id), [deleteItem]);

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
  
  const getPositiveEmotions = useCallback(() => emotions.filter(e => e.category === 'positive'), [emotions]);
  const getNegativeEmotions = useCallback(() => emotions.filter(e => e.category === 'negative'), [emotions]);
  const getNeutralEmotions = useCallback(() => emotions.filter(e => e.category === 'neutral'), [emotions]);

  // ── Helpers V2 — Sistema Emocional v2.0 (Fase 1.3.1+) ──────────
  
  /**
   * Retorna configuração completa da emoção (campos v2) com fallback seguro.
   * Aceita nome ou ID. Se não encontrada, retorna objeto NEUTRAL.
   * 
   * @param {string} nameOrId - Nome da emoção (ex: 'Disciplinado') ou Firestore ID
   * @returns {Object} { id, name, emoji, category, score, analysisCategory, behavioralPattern, riskLevel, ... }
   */
  const getEmotionConfig = useCallback((nameOrId) => {
    if (!nameOrId) {
      return { id: 'UNKNOWN', name: 'Não Informado', emoji: '❓', category: 'neutral', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER', riskLevel: 'MEDIUM' };
    }
    const found = emotions.find(e => e.name === nameOrId || e.id === nameOrId);
    if (found) {
      return {
        ...found,
        score: found.score ?? 0,
        analysisCategory: found.analysisCategory ?? 'NEUTRAL',
        behavioralPattern: found.behavioralPattern ?? 'OTHER',
        riskLevel: found.riskLevel ?? 'MEDIUM'
      };
    }
    return { id: 'UNKNOWN', name: nameOrId, emoji: '❓', category: 'neutral', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER', riskLevel: 'MEDIUM' };
  }, [emotions]);

  /**
   * Retorna score numérico da emoção (-4 a +3), com fallback 0
   */
  const getEmotionScore = useCallback((nameOrId) => {
    return getEmotionConfig(nameOrId).score;
  }, [getEmotionConfig]);

  /**
   * Retorna emoções CRITICAL (riskLevel === 'CRITICAL')
   */
  const getCriticalEmotions = useCallback(() => {
    return emotions.filter(e => e.riskLevel === 'CRITICAL' || e.analysisCategory === 'CRITICAL');
  }, [emotions]);

  // Tickers helpers
  const getTickerBySymbol = useCallback((symbol) => tickers.find(t => t.symbol === symbol), [tickers]);
  const getTickersByExchange = useCallback((exchangeCode) => {
    if (!exchangeCode) return tickers;
    return tickers.filter(t => t.exchange === exchangeCode);
  }, [tickers]);

  return {
    // Data
    setups, exchanges, brokers, currencies, emotions, tickers, loading, error,
    
    // CRUD Setups
    addSetup, updateSetup, deleteSetup,
    
    // CRUD Exchanges (com cascade delete)
    addExchange, updateExchange, deleteExchange,
    
    // CRUD Tickers
    addTicker, updateTicker, deleteTicker, importTickers,
    
    // CRUD Brokers
    addBroker, updateBroker, deleteBroker,
    
    // CRUD Currencies
    addCurrency, updateCurrency, deleteCurrency,
    
    // CRUD Emotions
    addEmotion, updateEmotion, deleteEmotion,
    
    // Helpers
    getSetupById, getSetupByName, getExchangeByCode, getBrokerById,
    getBrokerByName, getCurrencyByCode, getEmotionById, getEmotionByName,
    getPositiveEmotions, getNegativeEmotions, getNeutralEmotions,
    getEmotionConfig, getEmotionScore, getCriticalEmotions,
    getTickerBySymbol, getTickersByExchange,
  };
};

export default useMasterData;
