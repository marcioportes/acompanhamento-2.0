/**
 * SwotAnalysis - Análise Estratégica automática do comportamento operacional
 * 
 * Baseado em:
 * - FORÇAS (Strengths): Win rate alto em setups específicos, respeito a stops
 * - FRAQUEZAS (Weaknesses): Overtrading, hesitação, vingança após loss
 * - OPORTUNIDADES (Opportunities): Setups com bom desempenho para aumentar mão
 * - AMEAÇAS (Threats): Drawdown próximo do limite, concentração de risco
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, LayoutGrid } from 'lucide-react';

const SwotAnalysis = ({ trades, plans = [], currentBalance = 0 }) => {
  
  const analysis = useMemo(() => {
    if (!trades || trades.length < 5) {
      return null; // Precisa de pelo menos 5 trades para análise
    }

    const strengths = [];
    const weaknesses = [];
    const opportunities = [];
    const threats = [];

    // === ANÁLISE DE SETUPS ===
    const setupStats = {};
    trades.forEach(t => {
      if (!t.setup) return;
      if (!setupStats[t.setup]) {
        setupStats[t.setup] = { wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      setupStats[t.setup].total++;
      setupStats[t.setup].pnl += t.result || 0;
      if (t.result > 0) setupStats[t.setup].wins++;
      else if (t.result < 0) setupStats[t.setup].losses++;
    });

    // Setups com win rate > 65% (FORÇA)
    Object.entries(setupStats).forEach(([setup, stats]) => {
      if (stats.total >= 3) {
        const winRate = (stats.wins / stats.total) * 100;
        if (winRate >= 65) {
          strengths.push(`Win Rate alto em ${setup} (${winRate.toFixed(0)}%)`);
        }
        if (winRate <= 35 && stats.total >= 5) {
          weaknesses.push(`Baixo desempenho em ${setup} (${winRate.toFixed(0)}%)`);
        }
        // Oportunidade: setup com bom WR mas poucos trades
        if (winRate >= 60 && stats.total <= 10 && stats.pnl > 0) {
          opportunities.push(`Aumentar mão no Setup ${setup}`);
        }
      }
    });

    // === ANÁLISE DE HORÁRIO (OVERTRADING) ===
    const hourStats = {};
    trades.forEach(t => {
      if (!t.createdAt) return;
      const date = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      const hour = date.getHours();
      if (!hourStats[hour]) hourStats[hour] = { wins: 0, losses: 0, total: 0 };
      hourStats[hour].total++;
      if (t.result > 0) hourStats[hour].wins++;
      else if (t.result < 0) hourStats[hour].losses++;
    });

    // Horários com mais losses que wins
    Object.entries(hourStats).forEach(([hour, stats]) => {
      if (stats.total >= 3 && stats.losses > stats.wins) {
        const lossRate = (stats.losses / stats.total) * 100;
        if (lossRate >= 60) {
          weaknesses.push(`Overtrading após as ${hour}:00`);
        }
      }
    });

    // === ANÁLISE DE SEQUÊNCIA (VINGANÇA) ===
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    let tradesAfterLoss = { wins: 0, losses: 0 };
    let lastWasLoss = false;

    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || a.date);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || b.date);
      return dateA - dateB;
    });

    sortedTrades.forEach(t => {
      if (lastWasLoss) {
        if (t.result > 0) tradesAfterLoss.wins++;
        else if (t.result < 0) tradesAfterLoss.losses++;
      }
      
      if (t.result < 0) {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        lastWasLoss = true;
      } else {
        consecutiveLosses = 0;
        lastWasLoss = false;
      }
    });

    // Padrão de vingança
    if (tradesAfterLoss.wins + tradesAfterLoss.losses >= 5) {
      const afterLossWinRate = tradesAfterLoss.wins / (tradesAfterLoss.wins + tradesAfterLoss.losses);
      if (afterLossWinRate < 0.4) {
        weaknesses.push('Aumenta lote após Loss (Vingança)');
      }
    }

    // === ANÁLISE DE DRAWDOWN ===
    let peak = currentBalance;
    let maxDrawdown = 0;
    let runningBalance = currentBalance;

    // Calcular drawdown reverso (do mais recente para o mais antigo)
    [...sortedTrades].reverse().forEach(t => {
      runningBalance -= t.result || 0;
      if (runningBalance > peak) peak = runningBalance;
      const dd = ((peak - runningBalance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, dd);
    });

    // Recalcular corretamente
    runningBalance = currentBalance - trades.reduce((sum, t) => sum + (t.result || 0), 0);
    peak = runningBalance;
    maxDrawdown = 0;

    sortedTrades.forEach(t => {
      runningBalance += t.result || 0;
      if (runningBalance > peak) peak = runningBalance;
      const dd = peak > 0 ? ((peak - runningBalance) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, dd);
    });

    if (maxDrawdown >= 8) {
      threats.push(`Drawdown de ${maxDrawdown.toFixed(1)}% no período`);
    }

    // === ANÁLISE DE PLANO ===
    if (plans && plans.length > 0) {
      const plan = plans[0]; // Plano principal
      
      // Verificar stop do ciclo
      if (plan.cycleStop && maxDrawdown >= plan.cycleStop * 0.8) {
        threats.push('Drawdown próximo do limite do ciclo');
      }
      
      // Verificar meta do período
      const periodPnL = trades.reduce((sum, t) => sum + (t.result || 0), 0);
      const periodPnLPercent = currentBalance > 0 ? (periodPnL / currentBalance) * 100 : 0;
      
      if (plan.periodGoal && periodPnLPercent >= plan.periodGoal * 0.8) {
        strengths.push('Próximo da meta do período');
      }
    }

    // === RESPEITO A STOPS ===
    const tradesWithStopRespected = trades.filter(t => {
      // Se o trade teve loss mas não ultrapassou muito o entry
      if (t.result < 0 && t.entry && t.exit) {
        const maxLoss = Math.abs(t.entry * 0.02); // 2% do entry
        return Math.abs(t.result) <= maxLoss * (t.qty || 1);
      }
      return true;
    });

    if (tradesWithStopRespected.length / trades.length >= 0.9) {
      strengths.push('Respeito ao Stop Loss');
    }

    // === CONCENTRAÇÃO DE ATIVOS ===
    const tickerStats = {};
    trades.forEach(t => {
      if (!t.ticker) return;
      tickerStats[t.ticker] = (tickerStats[t.ticker] || 0) + 1;
    });

    const totalTickers = Object.keys(tickerStats).length;
    const maxTickerTrades = Math.max(...Object.values(tickerStats));
    
    if (totalTickers >= 3 && maxTickerTrades / trades.length >= 0.7) {
      threats.push('Alta concentração em poucos ativos');
    }

    // === OPORTUNIDADES DE VOLATILIDADE ===
    // Se tem trades em datas de payroll/FOMC (simplificado)
    const goodVolatilityDays = trades.filter(t => {
      const day = new Date(t.date).getDay();
      return day === 5; // Sexta-feira
    });
    
    if (goodVolatilityDays.length > 0) {
      const fridayWinRate = goodVolatilityDays.filter(t => t.result > 0).length / goodVolatilityDays.length;
      if (fridayWinRate >= 0.6) {
        opportunities.push('Explorar volatilidade de sexta-feira');
      }
    }

    // === CONSISTÊNCIA ===
    const wins = trades.filter(t => t.result > 0).length;
    const winRate = (wins / trades.length) * 100;
    
    if (winRate >= 55) {
      strengths.push(`Consistência geral (${winRate.toFixed(0)}% WR)`);
    }

    return {
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 3),
      opportunities: opportunities.slice(0, 2),
      threats: threats.slice(0, 2)
    };
  }, [trades, plans, currentBalance]);

  if (!analysis) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <LayoutGrid className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-bold text-white">Análise Estratégica (SWOT)</h3>
        </div>
        <p className="text-slate-500 text-sm text-center py-8">
          Registre pelo menos 5 trades para gerar a análise estratégica.
        </p>
      </div>
    );
  }

  const quadrants = [
    {
      key: 'strengths',
      title: 'FORÇAS (STRENGTHS)',
      icon: TrendingUp,
      items: analysis.strengths,
      bgColor: 'bg-emerald-500/5',
      borderColor: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      textColor: 'text-emerald-300'
    },
    {
      key: 'weaknesses',
      title: 'FRAQUEZAS (WEAKNESSES)',
      icon: TrendingDown,
      items: analysis.weaknesses,
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      iconColor: 'text-red-400',
      textColor: 'text-red-300'
    },
    {
      key: 'opportunities',
      title: 'OPORTUNIDADES (OPPORTUNITIES)',
      icon: Zap,
      items: analysis.opportunities,
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300'
    },
    {
      key: 'threats',
      title: 'AMEAÇAS (THREATS)',
      icon: AlertTriangle,
      items: analysis.threats,
      bgColor: 'bg-amber-500/5',
      borderColor: 'border-amber-500/20',
      iconColor: 'text-amber-400',
      textColor: 'text-amber-300'
    }
  ];

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Análise Estratégica (SWOT)</h3>
          <p className="text-xs text-slate-500">Diagnóstico automático do seu comportamento operacional</p>
        </div>
      </div>

      {/* SWOT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrants.map(q => (
          <div 
            key={q.key} 
            className={`${q.bgColor} ${q.borderColor} border rounded-xl p-4`}
          >
            <div className="flex items-center gap-2 mb-3">
              <q.icon className={`w-4 h-4 ${q.iconColor}`} />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${q.iconColor}`}>
                {q.title}
              </h4>
            </div>
            
            {q.items.length > 0 ? (
              <ul className="space-y-2">
                {q.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${q.iconColor.replace('text-', 'bg-')} mt-1.5 flex-shrink-0`} />
                    <span className={`text-sm ${q.textColor}`}>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600 italic">Nenhum item identificado</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SwotAnalysis;
