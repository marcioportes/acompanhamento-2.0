/**
 * Funções de cálculo para trades
 * IMPORTANTE: Este arquivo contém funções básicas de cálculo, agregação e formatação.
 * Para cálculos avançados com tick/ponto, use tradeCalculations.js
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- CÁLCULOS BÁSICOS ---

export const calculateTradeResult = (side, entry, exit, qty) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const quantity = parseFloat(qty);
  
  if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(quantity) || quantity === 0) return 0;
  
  if (side === 'LONG') {
    return (exitPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - exitPrice) * quantity;
  }
};

export const calculateResultPercent = (side, entry, exit) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  
  if (isNaN(entryPrice) || isNaN(exitPrice) || entryPrice === 0) return 0;
  
  if (side === 'LONG') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
};

// --- ESTATÍSTICAS E ANÁLISES ---

export const calculateStats = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0, winTrades: 0, lossTrades: 0, totalPL: 0, winRate: 0,
      profitFactor: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0
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

export const analyzeBySetup = (trades) => {
  if (!trades || trades.length === 0) return [];
  const groups = {};
  trades.forEach(trade => {
    const key = trade.setup ? trade.setup.trim() : 'Sem Setup';
    if (!groups[key]) groups[key] = { setup: key, total: 0, wins: 0, losses: 0, totalPL: 0, trades: [] };
    const result = trade.result || 0;
    groups[key].total += 1;
    groups[key].totalPL += result;
    groups[key].trades.push(trade);
    if (result > 0) groups[key].wins += 1;
    else if (result < 0) groups[key].losses += 1;
  });
  return Object.values(groups)
    .map(g => ({ ...g, winRate: g.total > 0 ? (g.wins / g.total) * 100 : 0, avgTrade: g.total > 0 ? g.totalPL / g.total : 0 }))
    .sort((a, b) => b.totalPL - a.totalPL);
};

export const analyzeByEmotion = (trades) => {
  if (!trades || trades.length === 0) return [];
  const groups = {};
  trades.forEach(trade => {
    let key = trade.emotion ? trade.emotion.trim() : 'Não Informado';
    if (key !== 'Não Informado') key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    if (!groups[key]) groups[key] = { emotion: key, total: 0, wins: 0, losses: 0, totalPL: 0, trades: [] };
    const result = trade.result || 0;
    groups[key].total += 1;
    groups[key].totalPL += result;
    groups[key].trades.push(trade);
    if (result > 0) groups[key].wins += 1;
    else if (result < 0) groups[key].losses += 1;
  });
  return Object.values(groups)
    .map(g => ({ ...g, winRate: g.total > 0 ? (g.wins / g.total) * 100 : 0, avgTrade: g.total > 0 ? g.totalPL / g.total : 0 }))
    .sort((a, b) => b.totalPL - a.totalPL);
};

// --- FUNÇÕES DE MENTORIA (RANKING E ALERTAS) ---

export const calculateStudentRanking = (students) => {
  if (!students || students.length === 0) return [];
  const ranked = students.map(student => {
    let stats = student.stats;
    if (!stats && student.trades) {
      stats = calculateStats(student.trades);
    }
    if (!stats) stats = { totalPL: 0, winRate: 0, profitFactor: 0, totalTrades: 0 };
    return { ...student, ...stats, stats };
  });
  return ranked.sort((a, b) => b.totalPL - a.totalPL);
};

// ADICIONADO: Função para filtrar alunos que precisam de atenção
export const identifyStudentsNeedingAttention = (students) => {
  if (!students || students.length === 0) return [];
  
  return students.filter(student => {
    // Garante que temos as estatísticas
    let stats = student.stats;
    if (!stats && student.trades) {
      stats = calculateStats(student.trades);
    }
    if (!stats) return false;

    // Critérios de alerta:
    // 1. Prejuízo Financeiro (PL negativo)
    // 2. Win Rate baixo (< 40%) com consistência mínima de trades (> 5 trades)
    // 3. Profit Factor ruim (< 0.8) com consistência mínima (> 5 trades)
    const isLosingMoney = stats.totalPL < 0;
    const isLowWinRate = stats.totalTrades > 5 && stats.winRate < 40;
    const isLowProfitFactor = stats.totalTrades > 5 && stats.profitFactor < 0.8;

    return isLosingMoney || isLowWinRate || isLowProfitFactor;
  });
};

// --- FILTROS E BUSCAS ---

export const filterTradesByPeriod = (trades, period) => {
  if (!trades || period === 'all') return trades || [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let startDate;
  switch (period) {
    case 'today': startDate = today; break;
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      startDate = start.toISOString().split('T')[0];
      break;
    }
    case 'month': startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; break;
    case 'quarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = `${now.getFullYear()}-${String(quarterMonth + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'year': startDate = `${now.getFullYear()}-01-01`; break;
    default: return trades;
  }
  return trades.filter(t => t.date >= startDate);
};

export const filterTradesByDateRange = (trades, startDate, endDate) => {
  if (!trades) return [];
  return trades.filter(t => t.date >= startDate && t.date <= endDate);
};

export const searchTrades = (trades, query) => {
  if (!trades) return [];
  if (!query || query.trim() === '') return trades;
  const searchLower = query.toLowerCase();
  return trades.filter(t => {
    const ticker = (t.ticker || '').toLowerCase();
    const setup = (t.setup || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const emotion = (t.emotion || '').toLowerCase();
    return ticker.includes(searchLower) || setup.includes(searchLower) || notes.includes(searchLower) || emotion.includes(searchLower);
  });
};

// --- FORMATADORES E HELPERS ---

export const formatCurrency = (value, currency = 'BRL') => {
  const config = { BRL: { locale: 'pt-BR', currency: 'BRL' }, USD: { locale: 'en-US', currency: 'USD' }, EUR: { locale: 'de-DE', currency: 'EUR' } };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value || 0);
};

export const formatPercent = (value, decimals = 1) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

export const formatDate = (date, pattern = 'dd/MM/yyyy') => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, pattern, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return date || '-';
  }
};

export const groupTradesByDate = (trades) => {
  if (!trades) return {};
  return trades.reduce((acc, trade) => {
    const date = trade.date;
    if (!date) return acc;
    if (!acc[date]) acc[date] = { date, totalPL: 0, count: 0, wins: 0, losses: 0 };
    acc[date].totalPL += trade.result || 0;
    acc[date].count += 1;
    if ((trade.result || 0) > 0) acc[date].wins += 1;
    else if ((trade.result || 0) < 0) acc[date].losses += 1;
    return acc;
  }, {});
};

export const generateCalendarData = (trades) => {
  const grouped = groupTradesByDate(trades);
  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
};

export const generateEquityCurve = (trades, initialBalance = 0) => {
  if (!trades || trades.length === 0) return [{ date: new Date().toISOString().split('T')[0], balance: initialBalance }];
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let balance = initialBalance;
  const curve = [{ date: sorted[0]?.date || '', balance: initialBalance }];
  sorted.forEach(trade => {
    balance += trade.result || 0;
    curve.push({ date: trade.date, balance, result: trade.result });
  });
  return curve;
};

// --- EXPORT DEFAULT FINAL ---
export default {
  calculateTradeResult,
  calculateResultPercent,
  calculateStats,
  analyzeBySetup,
  analyzeByEmotion,
  calculateStudentRanking,
  identifyStudentsNeedingAttention, // Adicionado ao export
  filterTradesByPeriod,
  filterTradesByDateRange,
  searchTrades,
  formatCurrency,
  formatPercent,
  formatDate,
  groupTradesByDate,
  generateCalendarData,
  generateEquityCurve
};