/**
 * Funções de cálculo para trades - Versão 3.1 (Full Compliance Audit)
 * * CHANGE LOG 3.1:
 * - FEAT: Nova função 'analyzePlanCompliance' para detectar violação de Meta e Stop simultaneamente.
 * - KEEP: Todas as funções anteriores (analyzeBySetup, analyzeByEmotion, etc) foram mantidas.
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
    
    let result;
    if (side === 'LONG') {
      result = (exitPrice - entryPrice) * quantity;
    } else {
      result = (entryPrice - exitPrice) * quantity;
    }
    return Math.round(result * 100) / 100;
  } catch (e) {
    return 0;
  }
};

export const calculateResultPercent = (side, entry, exit) => {
  try {
    const entryPrice = parseFloat(entry);
    const exitPrice = parseFloat(exit);
    
    if (isNaN(entryPrice) || isNaN(exitPrice) || entryPrice === 0) return 0;
    
    let percent;
    if (side === 'LONG') {
      percent = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else {
      percent = ((entryPrice - exitPrice) / entryPrice) * 100;
    }
    return parseFloat(percent.toFixed(2));
  } catch (e) {
    return 0;
  }
};

// --- ESTATÍSTICAS E ANÁLISES ---

export const calculateStats = (trades) => {
  try {
    const safeTrades = Array.isArray(trades) ? trades : [];

    if (safeTrades.length === 0) {
      return {
        totalTrades: 0, winTrades: 0, lossTrades: 0, totalPL: 0, winRate: 0,
        profitFactor: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0, expectancy: 0
      };
    }
    
    const wins = safeTrades.filter(t => (t.result || 0) > 0);
    const losses = safeTrades.filter(t => (t.result || 0) < 0);
    
    const totalWins = wins.reduce((sum, t) => sum + (t.result || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.result || 0), 0));
    const totalPL = safeTrades.reduce((sum, t) => sum + (t.result || 0), 0);
    
    const winRate = safeTrades.length > 0 ? (wins.length / safeTrades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;

    const lossRate = 100 - winRate;
    const expectancy = ((winRate / 100) * avgWin) - ((lossRate / 100) * avgLoss);
    
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
  } catch (e) {
    console.warn("Erro ao calcular stats:", e);
    return { totalTrades: 0, totalPL: 0, winRate: 0, profitFactor: 0 };
  }
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

// --- FUNÇÕES DE MENTORIA (RANKING E ALERTAS) ---

/**
 * Auditoria Completa do Plano (Compliance)
 * Detecta violações de Stop, Overtrading pós-meta e sequências perigosas.
 * @param {Array} periodTrades - Trades do período ordenados cronologicamente
 * @param {number} stopLimitValue - Valor financeiro do Stop (ex: 500 para limite de -500)
 * @param {number} goalLimitValue - Valor financeiro da Meta (ex: 1000)
 */
export const analyzePlanCompliance = (periodTrades, stopLimitValue, goalLimitValue) => {
  if (!periodTrades || periodTrades.length === 0) {
    return { status: 'NO_TRADES', events: [], history: [] };
  }

  // 1. Ordenação Cronológica Estrita
  const sortedTrades = [...periodTrades].sort((a, b) => {
    // Tenta usar createdAt (seconds), fallback para data string
    const tA = a.createdAt?.seconds || new Date(a.date).getTime();
    const tB = b.createdAt?.seconds || new Date(b.date).getTime();
    return tA - tB;
  });

  const stopLimit = -Math.abs(stopLimitValue || 0); // Ex: -500
  const goalLimit = Math.abs(goalLimitValue || 0);  // Ex: 1000
  
  let runningBalance = 0;
  let stopBreachIndex = -1;
  let goalReachIndex = -1;
  
  // Reconstrução do Histórico
  const history = sortedTrades.map((trade, index) => {
    const result = Number(trade.result || 0);
    runningBalance += result;

    let event = null;

    // Detectar primeiro toque no Stop
    if (stopLimit !== 0 && runningBalance <= stopLimit && stopBreachIndex === -1) {
      stopBreachIndex = index;
      event = 'STOP_HIT';
    }

    // Detectar primeiro toque na Meta
    if (goalLimit !== 0 && runningBalance >= goalLimit && goalReachIndex === -1) {
      goalReachIndex = index;
      event = 'GOAL_HIT';
    }

    return {
      ...trade,
      runningBalance,
      rowEvent: event, // Marca o evento na linha exata
      isAfterStop: stopBreachIndex !== -1 && index > stopBreachIndex,
      isAfterGoal: goalReachIndex !== -1 && index > goalReachIndex
    };
  });

  const finalBalance = runningBalance;
  const lastIndex = sortedTrades.length - 1;

  // --- CLASSIFICAÇÃO DO COMPORTAMENTO (STATUS FINAL) ---
  
  let status = 'NORMAL';

  // Cenário 1: Atingiu STOP
  if (stopBreachIndex !== -1) {
    const tradedAfterStop = lastIndex > stopBreachIndex;
    
    if (goalReachIndex !== -1 && goalReachIndex > stopBreachIndex) {
      status = 'LOSS_TO_GOAL'; // Recuperação Heroica (Perigoso)
    } else if (tradedAfterStop) {
      // Se terminou pior ou igual ao momento do stop
      if (finalBalance <= history[stopBreachIndex].runningBalance) {
        status = 'STOP_WORSENED'; // Cavou o buraco
      } else {
        status = 'STOP_RECOVERED'; // Recuperou algo (mas violou regra)
      }
    } else {
      status = 'STOP_DISCIPLINED'; // Parou no stop (Correto)
    }
  }
  
  // Cenário 2: Atingiu META (e não tinha atingido stop antes)
  else if (goalReachIndex !== -1) {
    const tradedAfterGoal = lastIndex > goalReachIndex;

    if (stopBreachIndex !== -1 && stopBreachIndex > goalReachIndex) {
      status = 'GOAL_TO_STOP'; // Catástrofe (Estava na meta e foi pro stop)
    } else if (tradedAfterGoal) {
      const balanceAtGoal = history[goalReachIndex].runningBalance;
      if (finalBalance < balanceAtGoal) {
        status = 'GOAL_GAVE_BACK'; // Devolveu lucro (Ganância)
      } else {
        status = 'GOAL_IMPROVED'; // Ganhou mais (Sorte/Risco extra)
      }
    } else {
      status = 'GOAL_DISCIPLINED'; // Parou na meta (Perfeito)
    }
  }

  return {
    status, // Códigos de status para UI
    stopBreachIndex,
    goalReachIndex,
    history,
    finalBalance
  };
};

export const calculateStudentRanking = (students) => {
  if (!students) return [];
  try {
    const safeStudents = Array.isArray(students) ? students : Object.values(students);
    const ranked = safeStudents.map(student => {
      let stats = student.stats;
      if (!stats && student.trades) {
        stats = calculateStats(student.trades);
      }
      if (!stats) stats = { totalPL: 0, winRate: 0, profitFactor: 0, totalTrades: 0 };
      return { ...student, ...stats, stats };
    });
    return ranked.sort((a, b) => b.totalPL - a.totalPL);
  } catch (e) {
    return [];
  }
};

export const identifyStudentsNeedingAttention = (students) => {
  try {
    if (!students) return [];
    
    let safeStudentsList = [];
    if (Array.isArray(students)) {
        safeStudentsList = students;
    } else if (typeof students === 'object') {
        safeStudentsList = Object.values(students);
    }

    if (!Array.isArray(safeStudentsList)) return [];
    
    return safeStudentsList.filter(student => {
      if (!student) return false;

      let stats = student.stats;
      if (!stats && student.trades) {
        stats = calculateStats(student.trades);
      }
      
      if (!stats || stats.totalTrades === 0) return false;

      const MIN_TRADES = 5;
      const isLosing = stats.totalPL < 0;
      const hasHistory = stats.totalTrades >= MIN_TRADES;
      const isLowWR = hasHistory && stats.winRate < 40;
      const isLowPF = hasHistory && stats.profitFactor < 0.8;

      student.alertReasons = [];
      if (isLosing) student.alertReasons.push('Prejuízo');
      if (isLowWR) student.alertReasons.push('WinRate Baixo');
      if (isLowPF) student.alertReasons.push('Profit Factor Baixo');

      return isLosing || isLowWR || isLowPF;
    });
  } catch (error) {
    console.error("Erro silencioso em identifyStudentsNeedingAttention:", error);
    return [];
  }
};

// --- FILTROS E BUSCAS ---

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
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate.setMonth(quarterMonth, 1);
        break;
      case 'year': startDate.setMonth(0, 1); break;
      default: return trades;
    }

    const safeTrades = Array.isArray(trades) ? trades : [];

    return safeTrades.filter(t => {
      if (!t.date) return false;
      const tradeDateFull = new Date(t.date);
      const tradeDateLocal = new Date(
          tradeDateFull.getUTCFullYear(),
          tradeDateFull.getUTCMonth(),
          tradeDateFull.getUTCDate(),
          0, 0, 0, 0
      );
      return tradeDateLocal.getTime() >= startDate.getTime();
    });
  } catch (e) {
    return [];
  }
};

export const filterTradesByDateRange = (trades, startDate, endDate) => {
  if (!trades) return [];
  const safeTrades = Array.isArray(trades) ? trades : [];
  return safeTrades.filter(t => t.date >= startDate && t.date <= endDate);
};

export const searchTrades = (trades, query) => {
  if (!trades) return [];
  const safeTrades = Array.isArray(trades) ? trades : [];
  if (!query || query.trim() === '') return safeTrades;
  
  const searchLower = query.toLowerCase();
  return safeTrades.filter(t => {
    const ticker = (t.ticker || '').toLowerCase();
    const setup = (t.setup || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const emotion = (t.emotion || '').toLowerCase();
    return ticker.includes(searchLower) || setup.includes(searchLower) || notes.includes(searchLower) || emotion.includes(searchLower);
  });
};

// --- FORMATADORES E HELPERS ---

export const formatCurrency = (value, currency = 'BRL') => {
  try {
    const config = { BRL: { locale: 'pt-BR', currency: 'BRL' }, USD: { locale: 'en-US', currency: 'USD' }, EUR: { locale: 'de-DE', currency: 'EUR' } };
    const c = config[currency] || config.BRL;
    return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value || 0);
  } catch (e) { return "R$ 0,00"; }
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
    return date || '-';
  }
};

export const groupTradesByDate = (trades) => {
  if (!trades || !Array.isArray(trades)) return {};
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
  if (!trades || !Array.isArray(trades) || trades.length === 0) return [{ date: new Date().toISOString().split('T')[0], balance: initialBalance }];
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
  analyzePlanCompliance // NOVA FUNÇÃO EXPORTADA
};