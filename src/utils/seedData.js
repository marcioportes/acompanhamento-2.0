/**
 * Script para popular dados iniciais no Firestore
 * Executar uma única vez após deploy
 */

import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Verifica se os dados já foram populados
 */
const checkIfSeeded = async () => {
  const currenciesSnapshot = await getDocs(collection(db, 'currencies'));
  return currenciesSnapshot.size > 0;
};

/**
 * Popula moedas
 */
const seedCurrencies = async () => {
  const currencies = [
    { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$', active: true },
    { code: 'USD', name: 'Dólar Americano', symbol: '$', active: true },
    { code: 'EUR', name: 'Euro', symbol: '€', active: true }
  ];

  for (const currency of currencies) {
    await setDoc(doc(db, 'currencies', currency.code), currency);
  }
  console.log('✅ Moedas criadas');
};

/**
 * Popula corretoras
 */
const seedBrokers = async () => {
  const brokers = [
    { name: 'XP Investimentos', country: 'BR', active: true },
    { name: 'Clear Corretora', country: 'BR', active: true },
    { name: 'Rico Investimentos', country: 'BR', active: true },
    { name: 'BTG Pactual', country: 'BR', active: true },
    { name: 'Modal Mais', country: 'BR', active: true },
    { name: 'Interactive Brokers', country: 'US', active: true },
    { name: 'TD Ameritrade', country: 'US', active: true },
    { name: 'Apex Trader Funding', country: 'US', active: true },
    { name: 'Topstep', country: 'US', active: true },
    { name: 'FTMO', country: 'EU', active: true },
    { name: 'The Funded Trader', country: 'US', active: true },
    { name: 'My Forex Funds', country: 'CA', active: true }
  ];

  for (const broker of brokers) {
    await addDoc(collection(db, 'brokers'), {
      ...broker,
      createdAt: serverTimestamp()
    });
  }
  console.log('✅ Corretoras criadas');
};

/**
 * Popula tickers
 */
const seedTickers = async () => {
  const tickers = [
    // CME Futures
    { symbol: 'ES', name: 'E-mini S&P 500', exchange: 'CME', tickSize: 0.25, tickValue: 12.50, currency: 'USD', active: true },
    { symbol: 'NQ', name: 'E-mini NASDAQ 100', exchange: 'CME', tickSize: 0.25, tickValue: 5.00, currency: 'USD', active: true },
    { symbol: 'YM', name: 'E-mini Dow Jones', exchange: 'CME', tickSize: 1, tickValue: 5.00, currency: 'USD', active: true },
    { symbol: 'RTY', name: 'E-mini Russell 2000', exchange: 'CME', tickSize: 0.1, tickValue: 5.00, currency: 'USD', active: true },
    { symbol: 'CL', name: 'Crude Oil', exchange: 'CME', tickSize: 0.01, tickValue: 10.00, currency: 'USD', active: true },
    { symbol: 'GC', name: 'Gold', exchange: 'CME', tickSize: 0.1, tickValue: 10.00, currency: 'USD', active: true },
    // Micro Futures
    { symbol: 'MES', name: 'Micro E-mini S&P 500', exchange: 'CME', tickSize: 0.25, tickValue: 1.25, currency: 'USD', active: true },
    { symbol: 'MNQ', name: 'Micro E-mini NASDAQ', exchange: 'CME', tickSize: 0.25, tickValue: 0.50, currency: 'USD', active: true },
    { symbol: 'MYM', name: 'Micro E-mini Dow', exchange: 'CME', tickSize: 1, tickValue: 0.50, currency: 'USD', active: true },
    { symbol: 'M2K', name: 'Micro E-mini Russell', exchange: 'CME', tickSize: 0.1, tickValue: 0.50, currency: 'USD', active: true },
    // B3
    { symbol: 'WINFUT', name: 'Mini Índice Bovespa', exchange: 'B3', tickSize: 5, tickValue: 0.20, currency: 'BRL', active: true },
    { symbol: 'WDOFUT', name: 'Mini Dólar', exchange: 'B3', tickSize: 0.5, tickValue: 5.00, currency: 'BRL', active: true },
    { symbol: 'INDFUT', name: 'Índice Bovespa Cheio', exchange: 'B3', tickSize: 5, tickValue: 1.00, currency: 'BRL', active: true },
    { symbol: 'DOLFUT', name: 'Dólar Cheio', exchange: 'B3', tickSize: 0.5, tickValue: 25.00, currency: 'BRL', active: true }
  ];

  for (const ticker of tickers) {
    await setDoc(doc(db, 'tickers', ticker.symbol), ticker);
  }
  console.log('✅ Tickers criados');
};

/**
 * Popula exchanges
 */
const seedExchanges = async () => {
  const exchanges = [
    { code: 'B3', name: 'B3 - Brasil Bolsa Balcão', country: 'BR', timezone: 'America/Sao_Paulo', active: true },
    { code: 'CME', name: 'Chicago Mercantile Exchange', country: 'US', timezone: 'America/Chicago', active: true },
    { code: 'NYSE', name: 'New York Stock Exchange', country: 'US', timezone: 'America/New_York', active: true },
    { code: 'NASDAQ', name: 'NASDAQ Stock Market', country: 'US', timezone: 'America/New_York', active: true },
    { code: 'CRYPTO', name: 'Crypto Markets', country: 'GLOBAL', timezone: 'UTC', active: true }
  ];

  for (const exchange of exchanges) {
    await setDoc(doc(db, 'exchanges', exchange.code), exchange);
  }
  console.log('✅ Exchanges criadas');
};

/**
 * Popula setups globais
 */
const seedSetups = async () => {
  const setups = [
    { name: 'Fractal TTrades', description: 'Setup baseado em fractais do TTrades', isGlobal: true, active: true },
    { name: 'Rompimento', description: 'Trade de rompimento de níveis importantes', isGlobal: true, active: true },
    { name: 'Pullback', description: 'Entrada em pullback após movimento forte', isGlobal: true, active: true },
    { name: 'Reversão', description: 'Trade de reversão em níveis de suporte/resistência', isGlobal: true, active: true },
    { name: 'Tendência', description: 'Trade a favor da tendência', isGlobal: true, active: true },
    { name: 'VWAP', description: 'Trade baseado em VWAP', isGlobal: true, active: true },
    { name: 'Gap', description: 'Trade de gap de abertura', isGlobal: true, active: true },
    { name: 'Scalp', description: 'Operação rápida de scalping', isGlobal: true, active: true },
    { name: 'Swing', description: 'Operação de swing trade', isGlobal: true, active: true },
    { name: 'Order Block', description: 'Trade em order blocks institucionais', isGlobal: true, active: true },
    { name: 'Fair Value Gap', description: 'Trade em fair value gaps', isGlobal: true, active: true },
    { name: 'Liquidity Grab', description: 'Trade após varredura de liquidez', isGlobal: true, active: true }
  ];

  for (const setup of setups) {
    await addDoc(collection(db, 'setups'), {
      ...setup,
      createdAt: serverTimestamp()
    });
  }
  console.log('✅ Setups criados');
};

/**
 * Popula estados emocionais
 */
const seedEmotions = async () => {
  const emotions = [
    // Positivos
    { name: 'Disciplinado', category: 'positive', description: 'Seguiu o plano com disciplina', active: true },
    { name: 'Confiante', category: 'positive', description: 'Confiante na análise', active: true },
    { name: 'Focado', category: 'positive', description: 'Concentrado e atento', active: true },
    { name: 'Paciente', category: 'positive', description: 'Aguardou o setup correto', active: true },
    // Neutros
    { name: 'Neutro', category: 'neutral', description: 'Estado emocional neutro', active: true },
    { name: 'Cauteloso', category: 'neutral', description: 'Operando com cautela', active: true },
    // Negativos
    { name: 'Ansioso', category: 'negative', description: 'Ansiedade antes/durante o trade', active: true },
    { name: 'FOMO', category: 'negative', description: 'Medo de perder oportunidade', active: true },
    { name: 'Hesitante', category: 'negative', description: 'Hesitação na entrada/saída', active: true },
    { name: 'Eufórico', category: 'negative', description: 'Euforia após ganhos', active: true },
    { name: 'Frustrado', category: 'negative', description: 'Frustração após perdas', active: true },
    { name: 'Revenge', category: 'negative', description: 'Tentando recuperar perda', active: true },
    { name: 'Overtrading', category: 'negative', description: 'Operando em excesso', active: true },
    { name: 'Impulsivo', category: 'negative', description: 'Decisão sem análise', active: true },
    { name: 'Medo', category: 'negative', description: 'Medo de perder dinheiro', active: true },
    { name: 'Ganância', category: 'negative', description: 'Querendo mais do que o plano', active: true }
  ];

  for (const emotion of emotions) {
    await addDoc(collection(db, 'emotions'), {
      ...emotion,
      createdAt: serverTimestamp()
    });
  }
  console.log('✅ Emoções criadas');
};

/**
 * Executa o seed completo
 */
export const runSeed = async () => {
  try {
    console.log('🚀 Iniciando seed dos dados...');
    
    const alreadySeeded = await checkIfSeeded();
    if (alreadySeeded) {
      console.log('⚠️ Dados já foram populados anteriormente');
      return { success: false, message: 'Dados já existem' };
    }

    await seedCurrencies();
    await seedBrokers();
    await seedTickers();
    await seedExchanges();
    await seedSetups();
    await seedEmotions();

    console.log('✅ Seed concluído com sucesso!');
    return { success: true, message: 'Dados criados com sucesso!' };

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Força o seed (ignora verificação)
 */
export const forceSeed = async () => {
  try {
    console.log('🚀 Forçando seed dos dados...');
    
    await seedCurrencies();
    await seedBrokers();
    await seedTickers();
    await seedExchanges();
    await seedSetups();
    await seedEmotions();

    console.log('✅ Seed forçado concluído!');
    return { success: true, message: 'Dados criados com sucesso!' };

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    return { success: false, message: error.message };
  }
};

export default runSeed;
