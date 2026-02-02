/**
 * Funções de cálculo para trades baseado em especificações de tick
 * 
 * CONCEITOS:
 * - tickSize: menor variação de preço permitida
 * - tickValue: valor monetário de 1 tick
 * - pointValue: valor de 1 ponto inteiro
 * 
 * FÓRMULA GERAL:
 * resultado = ((saída - entrada) / tickSize) * tickValue * contratos * (side === 'LONG' ? 1 : -1)
 * 
 * Ou simplificando:
 * resultado = (saída - entrada) * pointValue * contratos * (side === 'LONG' ? 1 : -1)
 */

/**
 * Calcula o resultado financeiro de um trade baseado nas especificações do ativo
 * 
 * @param {Object} params
 * @param {string} params.side - 'LONG' ou 'SHORT'
 * @param {number} params.entry - Preço de entrada
 * @param {number} params.exit - Preço de saída
 * @param {number} params.qty - Quantidade de contratos
 * @param {Object} params.ticker - Objeto do ticker com tickSize, tickValue, pointValue
 * @returns {number} Resultado financeiro
 */
export const calculateTradeResultByTick = ({ side, entry, exit, qty, ticker }) => {
  if (!entry || !exit || !qty) return 0;
  
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const contracts = parseFloat(qty);
  
  if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(contracts)) return 0;
  
  // Se não tiver ticker com especificações, usar cálculo simples
  if (!ticker || !ticker.pointValue) {
    const priceDiff = side === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    return priceDiff * contracts;
  }
  
  // Cálculo baseado em tick/ponto
  const pointDiff = exitPrice - entryPrice;
  const direction = side === 'LONG' ? 1 : -1;
  
  // resultado = diferença de pontos * valor do ponto * contratos * direção
  const result = pointDiff * ticker.pointValue * contracts * direction;
  
  return Math.round(result * 100) / 100; // Arredondar para 2 casas
};

/**
 * Calcula quantos ticks de movimento houve
 * 
 * @param {number} entry - Preço de entrada
 * @param {number} exit - Preço de saída  
 * @param {number} tickSize - Tamanho do tick
 * @returns {number} Número de ticks
 */
export const calculateTicks = (entry, exit, tickSize) => {
  if (!tickSize || tickSize === 0) return 0;
  const diff = Math.abs(exit - entry);
  return Math.round(diff / tickSize);
};

/**
 * Calcula o resultado em ticks
 * 
 * @param {Object} params
 * @returns {number} Resultado em quantidade de ticks
 */
export const calculateResultInTicks = ({ side, entry, exit, tickSize }) => {
  if (!tickSize || tickSize === 0) return 0;
  
  const diff = parseFloat(exit) - parseFloat(entry);
  const ticks = diff / tickSize;
  
  return side === 'LONG' ? ticks : -ticks;
};

/**
 * Calcula o percentual de resultado sobre o saldo da conta
 * 
 * @param {number} result - Resultado financeiro
 * @param {number} accountBalance - Saldo da conta
 * @returns {number} Percentual (ex: 2.5 para 2,5%)
 */
export const calculateResultPercent = (result, accountBalance) => {
  if (!accountBalance || accountBalance === 0) return 0;
  return (result / accountBalance) * 100;
};

/**
 * Calcula o risco percentual do trade
 * 
 * @param {Object} params
 * @param {string} params.side - 'LONG' ou 'SHORT'
 * @param {number} params.entry - Preço de entrada
 * @param {number} params.stopLoss - Preço do stop loss
 * @param {number} params.qty - Quantidade de contratos
 * @param {Object} params.ticker - Especificações do ticker
 * @param {number} params.accountBalance - Saldo da conta
 * @returns {number} Risco percentual
 */
export const calculateRiskPercent = ({ side, entry, stopLoss, qty, ticker, accountBalance }) => {
  if (!entry || !stopLoss || !qty || !accountBalance || accountBalance === 0) return 0;
  
  const entryPrice = parseFloat(entry);
  const stopPrice = parseFloat(stopLoss);
  const contracts = parseFloat(qty);
  
  // Calcular diferença de pontos até o stop
  const pointDiff = Math.abs(entryPrice - stopPrice);
  
  // Valor do risco
  const pointValue = ticker?.pointValue || 1;
  const riskAmount = pointDiff * pointValue * contracts;
  
  return (riskAmount / accountBalance) * 100;
};

/**
 * Calcula o Risk:Reward ratio
 * 
 * @param {Object} params
 * @param {string} params.side - 'LONG' ou 'SHORT'
 * @param {number} params.entry - Preço de entrada
 * @param {number} params.stopLoss - Preço do stop loss
 * @param {number} params.takeProfit - Preço do alvo
 * @returns {number|null} R:R ratio ou null se não puder calcular
 */
export const calculateRiskReward = ({ side, entry, stopLoss, takeProfit }) => {
  if (!entry || !stopLoss || !takeProfit) return null;
  
  const entryPrice = parseFloat(entry);
  const stopPrice = parseFloat(stopLoss);
  const targetPrice = parseFloat(takeProfit);
  
  const risk = Math.abs(entryPrice - stopPrice);
  const reward = Math.abs(targetPrice - entryPrice);
  
  if (risk === 0) return null;
  
  return Math.round((reward / risk) * 100) / 100;
};

/**
 * Valida se o preço está alinhado com o tick size
 * 
 * @param {number} price - Preço a validar
 * @param {number} tickSize - Tamanho do tick
 * @returns {boolean} true se válido
 */
export const isValidTickPrice = (price, tickSize) => {
  if (!tickSize || tickSize === 0) return true;
  
  const remainder = (price * 1000000) % (tickSize * 1000000); // Evitar problemas de ponto flutuante
  return Math.abs(remainder) < 0.0001;
};

/**
 * Arredonda preço para o tick mais próximo
 * 
 * @param {number} price - Preço a arredondar
 * @param {number} tickSize - Tamanho do tick
 * @returns {number} Preço arredondado
 */
export const roundToTick = (price, tickSize) => {
  if (!tickSize || tickSize === 0) return price;
  return Math.round(price / tickSize) * tickSize;
};

/**
 * Formata resultado com símbolo da moeda
 * 
 * @param {number} value - Valor
 * @param {string} currency - Código da moeda (BRL, USD, etc)
 * @returns {string} Valor formatado
 */
export const formatCurrencyValue = (value, currency = 'BRL') => {
  const currencyMap = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  
  const config = currencyMap[currency] || currencyMap.BRL;
  
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency
  }).format(value);
};

/**
 * Calcula estatísticas de um conjunto de trades
 * 
 * @param {Array} trades - Lista de trades
 * @returns {Object} Estatísticas
 */
export const calculateTradeStats = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      totalPL: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      largestWin: 0,
      largestLoss: 0,
      avgTrade: 0
    };
  }
  
  const wins = trades.filter(t => t.result > 0);
  const losses = trades.filter(t => t.result < 0);
  const breakeven = trades.filter(t => t.result === 0);
  
  const totalWins = wins.reduce((sum, t) => sum + t.result, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.result, 0));
  const totalPL = trades.reduce((sum, t) => sum + (t.result || 0), 0);
  
  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPL,
    avgWin: wins.length > 0 ? totalWins / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.result)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.result)) : 0,
    avgTrade: trades.length > 0 ? totalPL / trades.length : 0
  };
};

export default {
  calculateTradeResultByTick,
  calculateTicks,
  calculateResultInTicks,
  calculateResultPercent,
  calculateRiskPercent,
  calculateRiskReward,
  isValidTickPrice,
  roundToTick,
  formatCurrencyValue,
  calculateTradeStats
};
