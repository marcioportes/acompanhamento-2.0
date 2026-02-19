/**
 * Funções de cálculo para trades
 * @version 1.2.1
 * 
 * CHANGELOG:
 * - 1.2.1: Fix formatDate para Firestore Timestamp, fix identifyStudentsNeedingAttention
 * - 1.2.0: Padronização de versão
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- CÁLCULOS BÁSICOS ---

export const calculateTradeResult = (side, entry, exit, qty) => {
  try {
    const entryPrice = parseFloat(entry);
    const exitPrice = parseFloat(exit);
    const quantity = parseFloat(qty);
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(quantity) || quantity === 0) return 0;
    return side === 'LONG' ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity;
  } catch (e) { return 0; }
};

export const calculateResultPercent = (side, entry, exit) => {
  try {
    const entryPrice = parseFloat(entry);
    const exitPrice = parseFloat(exit);
    if (isNaN(entryPrice) || isNaN(exitPrice) || entryPrice === 0) return 0;
    return side === 'LONG' 
      ? ((exitPrice - entryPrice) / entryPrice) * 100 
      : ((entryPrice - exitPrice) / entryPrice) * 100;
  } catch (e) { return 0; }
};

// --- ESTATÍSTICAS E ANÁLISES ---

export const calculateStats = (trades) => {
  try {
    const safeTrades = Array.isArray(trades) ? trades : [];
    if (safeTrades.length === 0) return { totalTrades: 0, winTrades: 0, lossTrades: 0, totalPL: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0, expectancy: 0 };
    
    const wins = safeTrades.filter(t => (t.result || 0) > 0);
    const losses = safeTrades.filter(t => (t.result || 0) < 0);
    
    const totalWins = wins.reduce((sum, t) => sum + (t.result || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.result || 0), 0));
    const totalPL = safeTrades.reduce((sum, t) => sum + (t.result || 0), 0);
    
    const winRate = safeTrades.length > 0 ? (wins.length / safeTrades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const expectancy = ((winRate / 100) * avgWin) - ((100 - winRate) / 100 * avgLoss);
    
    return {
      totalTrades: safeTrades.length,
      winTrades: wins.length,
      lossTrades: losses.length,
      totalPL: Math.round(totalPL * 100) / 100,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: totalLosses > 0 ? parseFloat((totalWins / totalLosses).toFixed(2)) : (totalWins > 0 ? Infinity : 0),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.result)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.result)) : 0,
      expectancy: parseFloat(expectancy.toFixed(2))
    };
  } catch (e) { return { totalTrades: 0, totalPL: 0, winRate: 0, profitFactor: 0 }; }
};

export const analyzeBySetup = (trades) => {
  if (!trades || !Array.isArray(trades) || trades.length === 0) return [];
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
  if (!trades || !Array.isArray(trades) || trades.length === 0) return [];
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

// --- COMPLIANCE E PLANOS ---

export const analyzePlanCompliance = (periodTrades, stopLimitValue, goalLimitValue) => {
  if (!periodTrades || periodTrades.length === 0) return { status: 'NO_TRADES', events: [], history: [] };

  const sortedTrades = [...periodTrades].sort((a, b) => {
    const tA = a.createdAt?.seconds || new Date(a.date).getTime();
    const tB = b.createdAt?.seconds || new Date(b.date).getTime();
    return tA - tB;
  });

  const stopLimit = -Math.abs(stopLimitValue || 0);
  const goalLimit = Math.abs(goalLimitValue || 0);
  
  let runningBalance = 0;
  let stopBreachIndex = -1;
  let goalReachIndex = -1;
  
  const history = sortedTrades.map((trade, index) => {
    const result = Number(trade.result || 0);
    runningBalance += result;
    let event = null;
    if (stopLimit !== 0 && runningBalance <= stopLimit && stopBreachIndex === -1) {
      stopBreachIndex = index;
      event = 'STOP_HIT';
    }
    if (goalLimit !== 0 && runningBalance >= goalLimit && goalReachIndex === -1) {
      goalReachIndex = index;
      event = 'GOAL_HIT';
    }
    return {
      ...trade,
      runningBalance,
      rowEvent: event,
      isAfterStop: stopBreachIndex !== -1 && index > stopBreachIndex,
      isAfterGoal: goalReachIndex !== -1 && index > goalReachIndex
    };
  });

  const finalBalance = runningBalance;
  const lastIndex = sortedTrades.length - 1;
  let status = 'NORMAL';

  if (stopBreachIndex !== -1) {
    const tradedAfterStop = lastIndex > stopBreachIndex;
    if (goalReachIndex !== -1 && goalReachIndex > stopBreachIndex) status = 'LOSS_TO_GOAL';
    else if (tradedAfterStop) status = (finalBalance <= history[stopBreachIndex].runningBalance) ? 'STOP_WORSENED' : 'STOP_RECOVERED';
    else status = 'STOP_DISCIPLINED';
  } else if (goalReachIndex !== -1) {
    const tradedAfterGoal = lastIndex > goalReachIndex;
    if (stopBreachIndex !== -1 && stopBreachIndex > goalReachIndex) status = 'GOAL_TO_STOP';
    else if (tradedAfterGoal) status = (finalBalance < history[goalReachIndex].runningBalance) ? 'GOAL_GAVE_BACK' : 'GOAL_IMPROVED';
    else status = 'GOAL_DISCIPLINED';
  }

  return { status, stopBreachIndex, goalReachIndex, history, finalBalance };
};

// --- MENTORIA ---

export const calculateStudentRanking = (groupedTrades, sortBy = 'totalPL') => {
  if (!groupedTrades) return [];
  
  try {
    // Normaliza entrada - aceita objeto { email: [trades] } ou array
    let students;
    if (Array.isArray(groupedTrades)) {
      students = groupedTrades;
    } else {
      students = Object.entries(groupedTrades).map(([email, trades]) => ({
        email,
        name: trades[0]?.studentName || email.split('@')[0],
        trades
      }));
    }
    
    return students
      .map(student => {
        const trades = student.trades || [];
        const stats = calculateStats(trades);
        return { 
          ...student, 
          ...stats,
          stats 
        };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'winRate': return b.winRate - a.winRate;
          case 'profitFactor': return b.profitFactor - a.profitFactor;
          case 'totalTrades': return b.totalTrades - a.totalTrades;
          default: return b.totalPL - a.totalPL;
        }
      });
  } catch (e) { 
    console.error('[calculateStudentRanking]', e);
    return []; 
  }
};

/**
 * Identifica alunos que precisam de atenção
 * @param {Object|Array} groupedTrades - { email: [trades] } ou [{ email, name, trades }]
 * @returns {Array} Lista de alunos com reasons
 */
export const identifyStudentsNeedingAttention = (groupedTrades) => {
  try {
    if (!groupedTrades) return [];
    
    // Normaliza entrada - aceita objeto { email: [trades] } ou array
    let students;
    if (Array.isArray(groupedTrades)) {
      students = groupedTrades;
    } else {
      // Converte objeto { email: [trades] } para array
      students = Object.entries(groupedTrades).map(([email, trades]) => ({
        email,
        name: trades[0]?.studentName || email.split('@')[0],
        trades
      }));
    }
    
    return students
      .map(student => {
        const trades = student.trades || [];
        if (trades.length === 0) return null;
        
        const stats = calculateStats(trades);
        const reasons = [];
        
        // Critérios de atenção
        if (stats.totalPL < 0) reasons.push('Prejuízo');
        if (stats.totalTrades >= 5 && stats.winRate < 40) reasons.push('WinRate Baixo');
        if (stats.totalTrades >= 5 && stats.profitFactor < 0.8) reasons.push('Profit Factor Baixo');
        
        // Sem razões = não precisa atenção
        if (reasons.length === 0) return null;
        
        return {
          email: student.email,
          name: student.name,
          stats,
          reasons
        };
      })
      .filter(Boolean);
  } catch (error) { 
    console.error('[identifyStudentsNeedingAttention]', error);
    return []; 
  }
};

// --- FILTROS E HELPERS ---

export const filterTradesByPeriod = (trades, period) => {
  if (!trades || period === 'all') return trades || [];
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let startDate = new Date(now);
    switch (period) {
      case 'today': break;
      case 'week': startDate.setDate(now.getDate() - now.getDay()); break;
      case 'month': startDate.setDate(1); break;
      case 'quarter': const qM = Math.floor(now.getMonth() / 3) * 3; startDate.setMonth(qM, 1); break;
      case 'year': startDate.setMonth(0, 1); break;
      default: return trades;
    }
    return trades.filter(t => {
      if (!t.date) return false;
      const tD = new Date(t.date);
      const tLocal = new Date(tD.getUTCFullYear(), tD.getUTCMonth(), tD.getUTCDate());
      return tLocal.getTime() >= startDate.getTime();
    });
  } catch (e) { return []; }
};

export const filterTradesByDateRange = (trades, startDate, endDate) => {
  if (!trades) return [];
  return trades.filter(t => t.date >= startDate && t.date <= endDate);
};

export const searchTrades = (trades, query) => {
  if (!trades) return [];
  if (!query || query.trim() === '') return trades;
  const s = query.toLowerCase();
  return trades.filter(t => (t.ticker||'').toLowerCase().includes(s) || (t.setup||'').toLowerCase().includes(s) || (t.notes||'').toLowerCase().includes(s));
};

export const formatCurrency = (value, currency = 'BRL') => {
  try {
    const c = { BRL: { l: 'pt-BR', c: 'BRL' }, USD: { l: 'en-US', c: 'USD' }, EUR: { l: 'de-DE', c: 'EUR' } }[currency] || { l: 'pt-BR', c: 'BRL' };
    return new Intl.NumberFormat(c.l, { style: 'currency', currency: c.c }).format(value || 0);
  } catch (e) { return "R$ 0,00"; }
};

export const formatPercent = (value) => `${(value || 0).toFixed(1)}%`;

/**
 * Formata data para exibição
 * Suporta: Firestore Timestamp, Date, string ISO
 * @param {any} date - Data em qualquer formato
 * @param {string} pattern - Padrão date-fns (default: 'dd/MM/yyyy')
 * @returns {string} Data formatada
 */
export const formatDate = (date, pattern = 'dd/MM/yyyy') => {
  if (!date) return '-';
  
  try {
    let d;
    
    // Firestore Timestamp { seconds, nanoseconds }
    if (date?.seconds !== undefined && date?.nanoseconds !== undefined) {
      d = new Date(date.seconds * 1000);
    }
    // Firestore Timestamp com método toDate()
    else if (typeof date?.toDate === 'function') {
      d = date.toDate();
    }
    // String ISO ou data
    else if (typeof date === 'string') {
      d = parseISO(date);
    }
    // Objeto Date
    else if (date instanceof Date) {
      d = date;
    }
    // Número (timestamp em ms)
    else if (typeof date === 'number') {
      d = new Date(date);
    }
    else {
      return String(date) || '-';
    }
    
    // Verifica se é data válida
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    return format(d, pattern, { locale: ptBR });
  } catch (e) { 
    console.warn('[formatDate] Erro:', e, 'Input:', date);
    return '-'; 
  }
};

export const groupTradesByDate = (trades) => {
  if (!trades) return {};
  return trades.reduce((acc, t) => {
    if (!t.date) return acc;
    if (!acc[t.date]) acc[t.date] = { date: t.date, totalPL: 0, count: 0, wins: 0, losses: 0 };
    acc[t.date].totalPL += t.result || 0;
    acc[t.date].count++;
    if ((t.result || 0) > 0) acc[t.date].wins++; else if ((t.result || 0) < 0) acc[t.date].losses++;
    return acc;
  }, {});
};

export const generateCalendarData = (trades) => Object.values(groupTradesByDate(trades)).sort((a, b) => a.date.localeCompare(b.date));

export const generateEquityCurve = (trades, initialBalance = 0) => {
  if (!trades || trades.length === 0) return [{ date: new Date().toISOString().split('T')[0], balance: initialBalance }];
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let balance = initialBalance;
  const curve = [{ date: sorted[0]?.date || '', balance: initialBalance }];
  sorted.forEach(t => { balance += t.result || 0; curve.push({ date: t.date, balance, result: t.result }); });
  return curve;
};

export default {
  calculateTradeResult,
  calculateResultPercent,
  calculateStats,
  analyzeBySetup,
  analyzeByEmotion,
  calculateStudentRanking,
  identifyStudentsNeedingAttention,
  filterTradesByPeriod,
  filterTradesByDateRange,
  searchTrades,
  formatCurrency,
  formatPercent,
  formatDate,
  groupTradesByDate,
  generateCalendarData,
  generateEquityCurve,
  analyzePlanCompliance
};
