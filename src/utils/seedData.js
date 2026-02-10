/**
 * Script para popular dados iniciais no Firestore
 * Executar uma única vez após deploy
 * 
 * ATUALIZADO: Especificações de tick corretas pesquisadas
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
    { name: 'Genial Investimentos', country: 'BR', active: true },
    { name: 'Interactive Brokers', country: 'US', active: true },
    { name: 'TD Ameritrade', country: 'US', active: true },
    { name: 'Apex Trader Funding', country: 'US', active: true },
    { name: 'Topstep', country: 'US', active: true },
    { name: 'FTMO', country: 'EU', active: true },
    { name: 'The Funded Trader', country: 'US', active: true },
    { name: 'Earn2Trade', country: 'US', active: true }
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
 * Popula exchanges/bolsas
 */
const seedExchanges = async () => {
  const exchanges = [
    { 
      code: 'B3', 
      name: 'B3 - Brasil Bolsa Balcão', 
      country: 'BR', 
      timezone: 'America/Sao_Paulo',
      tradingHours: '09:00-18:00',
      active: true 
    },
    { 
      code: 'CME', 
      name: 'Chicago Mercantile Exchange', 
      country: 'US', 
      timezone: 'America/Chicago',
      tradingHours: '17:00-16:00 (quase 24h)',
      active: true 
    },
    { 
      code: 'NYMEX', 
      name: 'New York Mercantile Exchange', 
      country: 'US', 
      timezone: 'America/New_York',
      tradingHours: '18:00-17:00 (quase 24h)',
      active: true 
    },
    { 
      code: 'COMEX', 
      name: 'Commodity Exchange', 
      country: 'US', 
      timezone: 'America/New_York',
      tradingHours: '18:00-17:00 (quase 24h)',
      active: true 
    },
    { 
      code: 'CRYPTO', 
      name: 'Crypto Markets', 
      country: 'GLOBAL', 
      timezone: 'UTC',
      tradingHours: '24/7',
      active: true 
    }
  ];

  for (const exchange of exchanges) {
    await setDoc(doc(db, 'exchanges', exchange.code), exchange);
  }
  console.log('✅ Exchanges criadas');
};

/**
 * Popula tickers/ativos com especificações de tick CORRETAS
 * 
 * FÓRMULA DO RESULTADO:
 * resultado = (pontos_ganhos / tickSize) * tickValue * contratos
 * 
 * Exemplo WINFUT: 
 * - Comprou a 130.000, vendeu a 130.100 = 100 pontos
 * - Ticks = 100 / 5 = 20 ticks
 * - Resultado = 20 * R$1.00 * 1 contrato = R$20,00
 */
const seedTickers = async () => {
  const tickers = [
    // ========================================
    // B3 - BRASIL
    // ========================================
    { 
      symbol: 'WINFUT', 
      name: 'Mini Índice Bovespa', 
      exchange: 'B3',
      currency: 'BRL',
      tickSize: 5,           // Variação mínima: 5 pontos
      tickValue: 1.00,       // Cada tick (5 pontos) = R$ 1,00
      pointValue: 0.20,      // Cada ponto = R$ 0,20
      contractSize: 1,       // Lote mínimo
      description: 'Minicontrato de Índice Bovespa',
      active: true 
    },
    { 
      symbol: 'WDOFUT', 
      name: 'Mini Dólar', 
      exchange: 'B3',
      currency: 'BRL',
      tickSize: 0.5,         // Variação mínima: 0,5 ponto
      tickValue: 5.00,       // Cada tick (0,5 ponto) = R$ 5,00
      pointValue: 10.00,     // Cada ponto = R$ 10,00
      contractSize: 1,
      description: 'Minicontrato de Dólar',
      active: true 
    },
    { 
      symbol: 'INDFUT', 
      name: 'Índice Bovespa Cheio', 
      exchange: 'B3',
      currency: 'BRL',
      tickSize: 5,           // Variação mínima: 5 pontos
      tickValue: 5.00,       // Cada tick (5 pontos) = R$ 5,00
      pointValue: 1.00,      // Cada ponto = R$ 1,00
      contractSize: 5,       // Lote mínimo: 5 contratos
      description: 'Contrato Cheio de Índice Bovespa',
      active: true 
    },
    { 
      symbol: 'DOLFUT', 
      name: 'Dólar Cheio', 
      exchange: 'B3',
      currency: 'BRL',
      tickSize: 0.5,         // Variação mínima: 0,5 ponto
      tickValue: 25.00,      // Cada tick = R$ 25,00
      pointValue: 50.00,     // Cada ponto = R$ 50,00
      contractSize: 5,       // Lote mínimo: 5 contratos
      description: 'Contrato Cheio de Dólar',
      active: true 
    },

    // ========================================
    // CME - E-MINI FUTURES
    // ========================================
    { 
      symbol: 'ES', 
      name: 'E-mini S&P 500', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.25,        // Variação mínima: 0,25 ponto
      tickValue: 12.50,      // Cada tick = $12,50
      pointValue: 50.00,     // Cada ponto = $50,00
      contractSize: 1,
      description: 'E-mini S&P 500 Futures',
      active: true 
    },
    { 
      symbol: 'NQ', 
      name: 'E-mini NASDAQ 100', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.25,        // Variação mínima: 0,25 ponto
      tickValue: 5.00,       // Cada tick = $5,00
      pointValue: 20.00,     // Cada ponto = $20,00
      contractSize: 1,
      description: 'E-mini NASDAQ 100 Futures',
      active: true 
    },
    { 
      symbol: 'YM', 
      name: 'E-mini Dow Jones', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 1,           // Variação mínima: 1 ponto
      tickValue: 5.00,       // Cada tick = $5,00
      pointValue: 5.00,      // Cada ponto = $5,00
      contractSize: 1,
      description: 'E-mini Dow Jones Futures',
      active: true 
    },
    { 
      symbol: 'RTY', 
      name: 'E-mini Russell 2000', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.1,         // Variação mínima: 0,1 ponto
      tickValue: 5.00,       // Cada tick = $5,00
      pointValue: 50.00,     // Cada ponto = $50,00
      contractSize: 1,
      description: 'E-mini Russell 2000 Futures',
      active: true 
    },

    // ========================================
    // CME - MICRO E-MINI FUTURES
    // ========================================
    { 
      symbol: 'MES', 
      name: 'Micro E-mini S&P 500', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.25,        // Variação mínima: 0,25 ponto
      tickValue: 1.25,       // Cada tick = $1,25 (1/10 do ES)
      pointValue: 5.00,      // Cada ponto = $5,00
      contractSize: 1,
      description: 'Micro E-mini S&P 500 Futures',
      active: true 
    },
    { 
      symbol: 'MNQ', 
      name: 'Micro E-mini NASDAQ', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.25,        // Variação mínima: 0,25 ponto
      tickValue: 0.50,       // Cada tick = $0,50 (1/10 do NQ)
      pointValue: 2.00,      // Cada ponto = $2,00
      contractSize: 1,
      description: 'Micro E-mini NASDAQ Futures',
      active: true 
    },
    { 
      symbol: 'MYM', 
      name: 'Micro E-mini Dow', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 1,           // Variação mínima: 1 ponto
      tickValue: 0.50,       // Cada tick = $0,50 (1/10 do YM)
      pointValue: 0.50,      // Cada ponto = $0,50
      contractSize: 1,
      description: 'Micro E-mini Dow Futures',
      active: true 
    },
    { 
      symbol: 'M2K', 
      name: 'Micro E-mini Russell', 
      exchange: 'CME',
      currency: 'USD',
      tickSize: 0.1,         // Variação mínima: 0,1 ponto
      tickValue: 0.50,       // Cada tick = $0,50 (1/10 do RTY)
      pointValue: 5.00,      // Cada ponto = $5,00
      contractSize: 1,
      description: 'Micro E-mini Russell 2000 Futures',
      active: true 
    },

    // ========================================
    // COMMODITIES
    // ========================================
    { 
      symbol: 'CL', 
      name: 'Crude Oil (WTI)', 
      exchange: 'NYMEX',
      currency: 'USD',
      tickSize: 0.01,        // Variação mínima: $0,01 por barril
      tickValue: 10.00,      // Cada tick = $10,00 (1000 barris)
      pointValue: 1000.00,   // Cada $1 = $1000
      contractSize: 1,
      description: 'Light Sweet Crude Oil Futures',
      active: true 
    },
    { 
      symbol: 'GC', 
      name: 'Gold', 
      exchange: 'COMEX',
      currency: 'USD',
      tickSize: 0.10,        // Variação mínima: $0,10 por onça
      tickValue: 10.00,      // Cada tick = $10,00 (100 onças)
      pointValue: 100.00,    // Cada $1 = $100
      contractSize: 1,
      description: 'Gold Futures (100 oz)',
      active: true 
    },
    { 
      symbol: 'SI', 
      name: 'Silver', 
      exchange: 'COMEX',
      currency: 'USD',
      tickSize: 0.005,       // Variação mínima: $0,005 por onça
      tickValue: 25.00,      // Cada tick = $25,00 (5000 onças)
      pointValue: 5000.00,   // Cada $1 = $5000
      contractSize: 1,
      description: 'Silver Futures (5000 oz)',
      active: true 
    },
    { 
      symbol: 'MGC', 
      name: 'Micro Gold', 
      exchange: 'COMEX',
      currency: 'USD',
      tickSize: 0.10,        // Variação mínima: $0,10 por onça
      tickValue: 1.00,       // Cada tick = $1,00 (10 onças)
      pointValue: 10.00,     // Cada $1 = $10
      contractSize: 1,
      description: 'Micro Gold Futures (10 oz)',
      active: true 
    }
  ];

  for (const ticker of tickers) {
    await setDoc(doc(db, 'tickers', ticker.symbol), {
      ...ticker,
      createdAt: serverTimestamp()
    });
  }
  console.log('✅ Tickers criados com especificações de tick');
};

/**
 * Popula setups globais
 */
const seedSetups = async () => {
  const setups = [
    { 
      name: 'Fractal TTrades', 
      description: 'Setup baseado em fractais do TTrades', 
      isGlobal: true, 
      isDefault: true, // Setup padrão para novos alunos
      active: true 
    },
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
    // Negativos (podem ser bloqueados no plano)
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
    await seedExchanges();
    await seedTickers();
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
    await seedExchanges();
    await seedTickers();
    await seedSetups();
    await seedEmotions();

    console.log('✅ Seed forçado concluído!');
    return { success: true, message: 'Dados criados com sucesso!' };

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Atualiza apenas os tickers (para corrigir especificações)
 */
export const updateTickers = async () => {
  try {
    console.log('🔄 Atualizando tickers...');
    await seedTickers();
    console.log('✅ Tickers atualizados!');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao atualizar tickers:', error);
    return { success: false, message: error.message };
  }
};

export default runSeed;
