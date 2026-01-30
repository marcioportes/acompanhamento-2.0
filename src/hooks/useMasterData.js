import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hook para carregar dados mestres do sistema
 * (moedas, corretoras, tickers, exchanges, emotions)
 */
export const useMasterData = () => {
  const [currencies, setCurrencies] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribes = [];

    try {
      // Carregar moedas
      const currenciesQuery = query(
        collection(db, 'currencies'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(currenciesQuery, (snapshot) => {
          setCurrencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
      );

      // Carregar corretoras
      const brokersQuery = query(
        collection(db, 'brokers'),
        where('active', '==', true),
        orderBy('name', 'asc')
      );
      unsubscribes.push(
        onSnapshot(brokersQuery, (snapshot) => {
          setBrokers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
      );

      // Carregar tickers
      const tickersQuery = query(
        collection(db, 'tickers'),
        where('active', '==', true),
        orderBy('symbol', 'asc')
      );
      unsubscribes.push(
        onSnapshot(tickersQuery, (snapshot) => {
          setTickers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
      );

      // Carregar exchanges
      const exchangesQuery = query(
        collection(db, 'exchanges'),
        where('active', '==', true)
      );
      unsubscribes.push(
        onSnapshot(exchangesQuery, (snapshot) => {
          setExchanges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
      );

      // Carregar emoções
      const emotionsQuery = query(
        collection(db, 'emotions'),
        where('active', '==', true),
        orderBy('name', 'asc')
      );
      unsubscribes.push(
        onSnapshot(emotionsQuery, (snapshot) => {
          setEmotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
      );

      setLoading(false);

    } catch (err) {
      console.error('Erro ao carregar dados mestres:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Helpers
  const getCurrencyByCode = (code) => currencies.find(c => c.code === code);
  const getBrokerById = (id) => brokers.find(b => b.id === id);
  const getTickerBySymbol = (symbol) => tickers.find(t => t.symbol === symbol);
  const getExchangeByCode = (code) => exchanges.find(e => e.code === code);
  const getEmotionById = (id) => emotions.find(e => e.id === id);
  
  // Filtrar tickers por exchange
  const getTickersByExchange = (exchangeCode) => 
    tickers.filter(t => t.exchange === exchangeCode);
  
  // Filtrar emoções por categoria
  const getEmotionsByCategory = (category) => 
    emotions.filter(e => e.category === category);
  
  // Emoções negativas (para bloquear no plano)
  const getNegativeEmotions = () => 
    emotions.filter(e => e.category === 'negative');

  return {
    currencies,
    brokers,
    tickers,
    exchanges,
    emotions,
    loading,
    error,
    // Helpers
    getCurrencyByCode,
    getBrokerById,
    getTickerBySymbol,
    getExchangeByCode,
    getEmotionById,
    getTickersByExchange,
    getEmotionsByCategory,
    getNegativeEmotions
  };
};

export default useMasterData;
