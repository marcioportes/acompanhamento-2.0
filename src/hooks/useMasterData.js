import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';

export const useMasterData = () => {
  const [currencies, setCurrencies] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [tickers, setTickers] = useState([]); // Assets/Ativos
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    // Validar se DB foi inicializado
    if (!db) {
      setError("Firebase DB não inicializado");
      setLoading(false);
      return;
    }

    const unsubscribes = [];
    let mounted = true;

    // Função genérica para criar listeners
    const createListener = (collectionName, setState, label) => {
      try {
        // Query estrita: Só traz o que estiver Ativo.
        // Se seus dados no banco não tiverem 'active: true', isso retornará vazio.
        const q = query(
          collection(db, collectionName),
          where('active', '==', true)
        ); 
        
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            if (!mounted) return;
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // console.log(`[MasterData] ${label} carregados:`, data.length); // Debug
            setState(data);
          },
          (err) => {
            console.error(`[MasterData] Erro ao carregar ${label}:`, err);
            if (mounted) setError(`Erro de acesso em ${label}: ${err.message}`);
          }
        );
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`[MasterData] Falha crítica em ${label}:`, err);
        if (mounted) setError(err.message);
      }
    };

    // Inicializar listeners
    createListener('currencies', setCurrencies, 'Moedas');
    createListener('brokers', setBrokers, 'Corretoras');
    createListener('tickers', setTickers, 'Ativos');
    
    // Timeout de segurança para remover o loading caso o Firebase demore
    const timer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    return () => {
      mounted = false;
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(timer);
    };
  }, []);

  return {
    currencies,
    brokers,
    tickers,
    assets: tickers, // Alias compatível
    loading,
    error
  };
};

export default useMasterData;