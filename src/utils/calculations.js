import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Calcular resultado de um trade
export const calculateTradeResult = (side, entry, exit, qty) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const quantity = parseFloat(qty);
  
  if (side === 'LONG') {
    return (exitPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - exitPrice) * quantity;
  }
};

// Calcular resultado percentual
export const calculateResultPercent = (side, entry, exit) => {
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  
  if (side === 'LONG') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
};

// Calcular todas as estatísticas de um conjunto de trades
export const calculateStats = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalPL: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      currentStreak: { type: null, count: 0 },
      avgTradeSize: 0,
      maxDrawdown: 0,
    };
  }

  const wins = trades.filter(t => t.result > 0);
  const losses = trades.filter(t => t.result < 0);
  const breakeven = trades.filter(t => t.result === 0);

  const totalPL = trades.reduce((sum, t) => sum + (t.result || 0), 0);
  const winRate = (wins.length / trades.length) * 100;

  const totalWins = wins.reduce((sum, t) => sum + t.result, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.result, 0));
  
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.result)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.result)) : 0;

  // Calcular streaks
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  sortedTrades.forEach(trade => {
    if (trade.result > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
    } else if (trade.result < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
    }
  });

  // Streak atual
  let currentStreak = { type: null, count: 0 };
  if (sortedTrades.length > 0) {
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    if (lastTrade.result > 0) {
      currentStreak = { type: 'win', count: currentWinStreak };
    } else if (lastTrade.result < 0) {
      currentStreak = { type: 'loss', count: currentLossStreak };
    }
  }

  // Média do tamanho dos trades
  const avgTradeSize = trades.reduce((sum, t) => sum + Math.abs(t.result || 0), 0) / trades.length;

  // Calcular drawdown máximo
  let peak = 0;
  let maxDrawdown = 0;
  let runningPL = 0;

  sortedTrades.forEach(trade => {
    runningPL += trade.result || 0;
    if (runningPL > peak) {
      peak = runningPL;
    }
    const drawdown = peak - runningPL;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return {
    totalPL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    largestWin,
    largestLoss,
    consecutiveWins: maxConsecutiveWins,
    consecutiveLosses: maxConsecutiveLosses,
    currentStreak,
    avgTradeSize,
    maxDrawdown,
  };
};

// Análise por setup
export const analyzeBySetup = (trades) => {
  const setupStats = {};

  trades.forEach(trade => {
    const setup = trade.setup || 'Outros';
    if (!setupStats[setup]) {
      setupStats[setup] = {
        setup,
        trades: [],
        total: 0,
        wins: 0,
        losses: 0,
        totalPL: 0,
      };
    }
    
    setupStats[setup].trades.push(trade);
    setupStats[setup].total++;
    setupStats[setup].totalPL += trade.result || 0;
    
    if (trade.result > 0) {
      setupStats[setup].wins++;
    } else if (trade.result < 0) {
      setupStats[setup].losses++;
    }
  });

  return Object.values(setupStats).map(s => ({
    ...s,
    winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
  })).sort((a, b) => b.totalPL - a.totalPL);
};

// Análise por emoção
export const analyzeByEmotion = (trades) => {
  const emotionStats = {};

  trades.forEach(trade => {
    const emotion = trade.emotion || 'Não informado';
    if (!emotionStats[emotion]) {
      emotionStats[emotion] = {
        emotion,
        total: 0,
        wins: 0,
        losses: 0,
        totalPL: 0,
      };
    }
    
    emotionStats[emotion].total++;
    emotionStats[emotion].totalPL += trade.result || 0;
    
    if (trade.result > 0) {
      emotionStats[emotion].wins++;
    } else if (trade.result < 0) {
      emotionStats[emotion].losses++;
    }
  });

  return Object.values(emotionStats).map(e => ({
    ...e,
    winRate: e.total > 0 ? (e.wins / e.total) * 100 : 0,
  })).sort((a, b) => b.total - a.total);
};

// Análise por bolsa
export const analyzeByExchange = (trades) => {
  const exchangeStats = {};

  trades.forEach(trade => {
    const exchange = trade.exchange || 'B3';
    if (!exchangeStats[exchange]) {
      exchangeStats[exchange] = {
        exchange,
        total: 0,
        wins: 0,
        totalPL: 0,
      };
    }
    
    exchangeStats[exchange].total++;
    exchangeStats[exchange].totalPL += trade.result || 0;
    
    if (trade.result > 0) {
      exchangeStats[exchange].wins++;
    }
  });

  return Object.values(exchangeStats).map(e => ({
    ...e,
    winRate: e.total > 0 ? (e.wins / e.total) * 100 : 0,
  }));
};

// Dados para o calendário heatmap
export const generateCalendarData = (trades, weeks = 8) => {
  const today = new Date();
  const startDate = subDays(today, weeks * 7);
  
  // Criar mapa de P&L por dia
  const plByDate = {};
  trades.forEach(trade => {
    const date = trade.date;
    if (!plByDate[date]) {
      plByDate[date] = { pl: 0, count: 0 };
    }
    plByDate[date].pl += trade.result || 0;
    plByDate[date].count++;
  });

  // Gerar dados para cada dia
  const days = eachDayOfInterval({ start: startDate, end: today });
  
  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const data = plByDate[dateStr];
    
    return {
      date: dateStr,
      dayOfWeek: day.getDay(),
      dayName: format(day, 'EEE', { locale: ptBR }),
      dayNumber: format(day, 'd'),
      month: format(day, 'MMM', { locale: ptBR }),
      pl: data?.pl || 0,
      count: data?.count || 0,
      hasData: !!data,
    };
  });
};

// Dados para equity curve
export const generateEquityCurve = (trades) => {
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let cumulativePL = 0;
  const data = sortedTrades.map((trade, index) => {
    cumulativePL += trade.result || 0;
    return {
      date: trade.date,
      pl: cumulativePL,
      trade: index + 1,
      result: trade.result,
      ticker: trade.ticker,
    };
  });

  // Adicionar ponto inicial
  if (data.length > 0) {
    data.unshift({
      date: sortedTrades[0].date,
      pl: 0,
      trade: 0,
      result: 0,
      ticker: 'Início',
    });
  }

  return data;
};

// Formatar valores monetários
export const formatCurrency = (value, currency = 'BRL') => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Formatar percentual
export const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00%';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

// Formatar número
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// Formatar data
export const formatDate = (dateString, formatStr = 'dd/MM/yyyy') => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatStr, { locale: ptBR });
  } catch {
    return dateString;
  }
};

// Filtrar trades por período
export const filterTradesByPeriod = (trades, period) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  let startDate;
  
  switch (period) {
    case 'today':
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = startOfWeek(today, { weekStartsOn: 1 });
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case '3months':
      startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      break;
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      return trades;
  }

  return trades.filter(trade => {
    const tradeDate = parseISO(trade.date);
    return isWithinInterval(tradeDate, { start: startDate, end: today });
  });
};

// Filtrar trades por data customizada
export const filterTradesByDateRange = (trades, startDate, endDate) => {
  if (!startDate && !endDate) return trades;
  
  const start = startDate ? new Date(startDate) : new Date('1900-01-01');
  const end = endDate ? new Date(endDate) : new Date('2100-12-31');
  
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return trades.filter(trade => {
    const tradeDate = parseISO(trade.date);
    return isWithinInterval(tradeDate, { start, end });
  });
};

// Buscar trades por texto
export const searchTrades = (trades, query) => {
  if (!query || query.trim() === '') return trades;
  
  const searchTerm = query.toLowerCase().trim();
  
  return trades.filter(trade => 
    trade.ticker?.toLowerCase().includes(searchTerm) ||
    trade.notes?.toLowerCase().includes(searchTerm) ||
    trade.setup?.toLowerCase().includes(searchTerm) ||
    trade.emotion?.toLowerCase().includes(searchTerm) ||
    trade.exchange?.toLowerCase().includes(searchTerm)
  );
};

// Identificar alunos que precisam de atenção
export const identifyStudentsNeedingAttention = (studentsTrades) => {
  const needsAttention = [];

  Object.entries(studentsTrades).forEach(([email, trades]) => {
    const stats = calculateStats(trades);
    const reasons = [];

    // Win rate baixo
    if (stats.winRate < 40 && stats.totalTrades >= 5) {
      reasons.push(`Win rate: ${formatPercent(stats.winRate)}`);
    }

    // Muitas perdas consecutivas recentes
    if (stats.currentStreak.type === 'loss' && stats.currentStreak.count >= 4) {
      reasons.push(`${stats.currentStreak.count} perdas consecutivas`);
    }

    // Drawdown alto
    if (stats.maxDrawdown > 0 && stats.totalPL < 0) {
      reasons.push(`Drawdown: ${formatCurrency(stats.maxDrawdown)}`);
    }

    if (reasons.length > 0) {
      needsAttention.push({
        email,
        name: email.split('@')[0],
        reasons,
        stats,
        trades,
      });
    }
  });

  return needsAttention;
};

// Calcular ranking de alunos
export const calculateStudentRanking = (studentsTrades, sortBy = 'totalPL') => {
  const rankings = Object.entries(studentsTrades).map(([email, trades]) => {
    const stats = calculateStats(trades);
    return {
      email,
      name: email.split('@')[0],
      ...stats,
      tradesCount: trades.length,
    };
  });

  return rankings.sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        return b.winRate - a.winRate;
      case 'profitFactor':
        return b.profitFactor - a.profitFactor;
      case 'totalTrades':
        return b.totalTrades - a.totalTrades;
      case 'totalPL':
      default:
        return b.totalPL - a.totalPL;
    }
  });
};

// Top trades (winners e losers)
export const getTopTrades = (trades, limit = 5) => {
  const sorted = [...trades].sort((a, b) => b.result - a.result);
  
  return {
    topWinners: sorted.filter(t => t.result > 0).slice(0, limit),
    topLosers: sorted.filter(t => t.result < 0).slice(-limit).reverse(),
  };
};

// Análise de disciplina
export const analyzeDiscipline = (trades) => {
  const disciplinedTrades = trades.filter(t => t.emotion === 'Disciplinado');
  const impulsiveTrades = trades.filter(t => ['FOMO', 'Ansioso', 'Eufórico'].includes(t.emotion));
  
  const disciplinedStats = calculateStats(disciplinedTrades);
  const impulsiveStats = calculateStats(impulsiveTrades);

  return {
    disciplinedCount: disciplinedTrades.length,
    impulsiveCount: impulsiveTrades.length,
    disciplinedWinRate: disciplinedStats.winRate,
    impulsiveWinRate: impulsiveStats.winRate,
    disciplinedPL: disciplinedStats.totalPL,
    impulsivePL: impulsiveStats.totalPL,
    disciplineScore: trades.length > 0 
      ? (disciplinedTrades.length / trades.length) * 100 
      : 0,
  };
};
