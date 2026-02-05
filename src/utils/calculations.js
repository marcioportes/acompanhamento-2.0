/**
 * Funções de cálculo para trades
 * 
 * IMPORTANTE: Este arquivo contém funções básicas de cálculo.
 * Para cálculos avançados com tick/ponto, use tradeCalculations.js
 */

import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Calcula o resultado financeiro de um trade
 * 
 * FÓRMULA:
 * - LONG: (saída - entrada) * quantidade
 * - SHORT: (entrada - saída) * quantidade
 * 
 * @param {string} side - 'LONG' ou 'SHORT'
 * @param {number|string} entry - Preço de entrada
 * @param {number|string} exit - Preço de saída
 * @param {number|string} qty - Quantidade de contratos
 * @returns {number} Resultado financeiro
 */
export const calculateTradeResult = (side, entry, exit, qty) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const quantity = parseFloat(qty);
  
  if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(quantity) || quantity === 0) {
    return 0;
  }
  
  if (side === 'LONG') {
    return (exitPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - exitPrice) * quantity;
  }
};

/**
 * Calcula o percentual de variação do trade
 * 
 * @param {string} side - 'LONG' ou 'SHORT'
 * @param {number|string} entry - Preço de entrada
 * @param {number|string} exit - Preço de saída
 * @returns {number} Percentual (ex: 10 para 10%)
 */
export const calculateResultPercent = (side, entry, exit) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  
  if (isNaN(entryPrice) || isNaN(exitPrice) || entryPrice === 0) {
    return 0;
  }
  
  if (side === 'LONG') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
};

/**
 * Calcula estatísticas de um conjunto de trades
 * 
 * @param {Array} trades - Lista de trades com campo 'result'
 * @returns {Object} Estatísticas
 */
export const calculateStats = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      totalPL: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0
    };
  }
  
  const wins = trades.filter(t => (t.result || 0) > 0);
  const losses = trades.filter(t => (t.result || 0) < 0);
  
  const totalWins = wins.reduce((sum, t) => sum + (t.result || 0), 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.result || 0), 0));
  const totalPL = trades.reduce((sum, t) => sum + (t.result || 0), 0);
  
  return {
    totalTrades: trades.length,
    winTrades: wins.length,
    lossTrades: losses.length,
    totalPL,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0),
    avgWin: wins.length > 0 ? totalWins / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
    largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.result)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.result)) : 0
  };
};

/**
 * Filtra trades por período predefinido
 * 
 * @param {Array} trades - Lista de trades
 * @param {string} period - 'today', 'week', 'month', 'quarter', 'year', 'all'
 * @returns {Array} Trades filtrados
 */
export const filterTradesByPeriod = (trades, period) => {
  if (!trades || period === 'all') return trades || [];
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  let startDate;
  
  switch (period) {
    case 'today':
      startDate = today;
      break;
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      startDate = start.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'quarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = `${now.getFullYear()}-${String(quarterMonth + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'year':
      startDate = `${now.getFullYear()}-01-01`;
      break;
    default:
      return trades;
  }
  
  return trades.filter(t => t.date >= startDate);
};

/**
 * Filtra trades por range de datas
 * 
 * @param {Array} trades - Lista de trades
 * @param {string} startDate - Data início (YYYY-MM-DD)
 * @param {string} endDate - Data fim (YYYY-MM-DD)
 * @returns {Array} Trades filtrados
 */
export const filterTradesByDateRange = (trades, startDate, endDate) => {
  if (!trades) return [];
  
  return trades.filter(t => {
    const tradeDate = t.date;
    return tradeDate >= startDate && tradeDate <= endDate;
  });
};

/**
 * Busca trades por texto
 * 
 * @param {Array} trades - Lista de trades
 * @param {string} query - Texto de busca
 * @returns {Array} Trades encontrados
 */
export const searchTrades = (trades, query) => {
  if (!trades) return [];
  if (!query || query.trim() === '') return trades;
  
  const searchLower = query.toLowerCase();
  
  return trades.filter(t => {
    const ticker = (t.ticker || '').toLowerCase();
    const setup = (t.setup || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const emotion = (t.emotion || '').toLowerCase();
    
    return ticker.includes(searchLower) ||
           setup.includes(searchLower) ||
           notes.includes(searchLower) ||
           emotion.includes(searchLower);
  });
};

/**
 * Formata valor como moeda
 * 
 * @param {number} value - Valor
 * @param {string} currency - Código da moeda
 * @returns {string} Valor formatado
 */
export const formatCurrency = (value, currency = 'BRL') => {
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  
  const c = config[currency] || config.BRL;
  
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.currency
  }).format(value || 0);
};

/**
 * Formata percentual
 * 
 * @param {number} value - Valor percentual
 * @param {number} decimals - Casas decimais
 * @returns {string} Percentual formatado
 */
export const formatPercent = (value, decimals = 1) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

/**
 * Agrupa trades por data para calendário
 * 
 * @param {Array} trades - Lista de trades
 * @returns {Object} Mapa de data -> resultado total
 */
export const groupTradesByDate = (trades) => {
  if (!trades) return {};
  
  return trades.reduce((acc, trade) => {
    const date = trade.date;
    if (!date) return acc;
    
    if (!acc[date]) {
      acc[date] = {
        date,
        totalPL: 0,
        count: 0,
        wins: 0,
        losses: 0
      };
    }
    
    acc[date].totalPL += trade.result || 0;
    acc[date].count += 1;
    
    if ((trade.result || 0) > 0) {
      acc[date].wins += 1;
    } else if ((trade.result || 0) < 0) {
      acc[date].losses += 1;
    }
    
    return acc;
  }, {});
};

/**
 * Gera dados para gráfico de curva de capital
 * 
 * @param {Array} trades - Lista de trades ordenados por data
 * @param {number} initialBalance - Saldo inicial
 * @returns {Array} Dados para Recharts
 */
export const generateEquityCurve = (trades, initialBalance = 0) => {
  if (!trades || trades.length === 0) {
    return [{ date: new Date().toISOString().split('T')[0], balance: initialBalance }];
  }
  
  // Ordenar por data
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  
  let balance = initialBalance;
  const curve = [{ date: sorted[0]?.date || '', balance: initialBalance }];
  
  sorted.forEach(trade => {
    balance += trade.result || 0;
    curve.push({
      date: trade.date,
      balance,
      result: trade.result
    });
  });
  
  return curve;
};

export default {
  calculateTradeResult,
  calculateResultPercent,
  calculateStats,
  filterTradesByPeriod,
  filterTradesByDateRange,
  searchTrades,
  formatCurrency,
  formatPercent,
  groupTradesByDate,
  generateEquityCurve
};
