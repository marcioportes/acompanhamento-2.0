/**
 * PlanProgress - Indicadores visuais de progresso do plano de trading
 * 
 * Mostra:
 * - Progresso até a meta do período (Gain)
 * - Progresso até o stop do período (Loss)
 * - Progresso do ciclo
 * - Alertas visuais quando próximo do limite
 */

import { useMemo } from 'react';
import { Target, AlertTriangle, TrendingUp, TrendingDown, Shield, Award } from 'lucide-react';

const PlanProgress = ({ plan, periodPnL = 0, cyclePnL = 0, currentBalance = 0 }) => {
  
  const metrics = useMemo(() => {
    if (!plan) return null;

    const pl = currentBalance || plan.pl || 0;
    
    // Cálculos do Período
    const periodPnLPercent = pl > 0 ? (periodPnL / pl) * 100 : 0;
    const periodGoalProgress = plan.periodGoal > 0 ? Math.min((periodPnLPercent / plan.periodGoal) * 100, 100) : 0;
    const periodStopProgress = plan.periodStop > 0 ? Math.min((Math.abs(Math.min(periodPnLPercent, 0)) / plan.periodStop) * 100, 100) : 0;
    
    // Cálculos do Ciclo
    const cyclePnLPercent = pl > 0 ? (cyclePnL / pl) * 100 : 0;
    const cycleGoalProgress = plan.cycleGoal > 0 ? Math.min((cyclePnLPercent / plan.cycleGoal) * 100, 100) : 0;
    const cycleStopProgress = plan.cycleStop > 0 ? Math.min((Math.abs(Math.min(cyclePnLPercent, 0)) / plan.cycleStop) * 100, 100) : 0;

    // Status
    const isPeriodGoalHit = periodPnLPercent >= plan.periodGoal;
    const isPeriodStopHit = periodPnLPercent <= -plan.periodStop;
    const isCycleGoalHit = cyclePnLPercent >= plan.cycleGoal;
    const isCycleStopHit = cyclePnLPercent <= -plan.cycleStop;

    // Alertas (80% do limite)
    const isPeriodStopWarning = periodPnLPercent <= -(plan.periodStop * 0.8) && !isPeriodStopHit;
    const isCycleStopWarning = cyclePnLPercent <= -(plan.cycleStop * 0.8) && !isCycleStopHit;

    return {
      period: {
        pnl: periodPnL,
        pnlPercent: periodPnLPercent,
        goal: plan.periodGoal,
        stop: plan.periodStop,
        goalProgress: periodPnLPercent > 0 ? periodGoalProgress : 0,
        stopProgress: periodPnLPercent < 0 ? periodStopProgress : 0,
        isGoalHit: isPeriodGoalHit,
        isStopHit: isPeriodStopHit,
        isStopWarning: isPeriodStopWarning,
        periodType: plan.operationPeriod || 'Diário'
      },
      cycle: {
        pnl: cyclePnL,
        pnlPercent: cyclePnLPercent,
        goal: plan.cycleGoal,
        stop: plan.cycleStop,
        goalProgress: cyclePnLPercent > 0 ? cycleGoalProgress : 0,
        stopProgress: cyclePnLPercent < 0 ? cycleStopProgress : 0,
        isGoalHit: isCycleGoalHit,
        isStopHit: isCycleStopHit,
        isStopWarning: isCycleStopWarning,
        cycleType: plan.adjustmentCycle || 'Mensal'
      },
      planName: plan.name,
      planDescription: plan.description
    };
  }, [plan, periodPnL, cyclePnL, currentBalance]);

  if (!metrics) {
    return null;
  }

  const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const ProgressBar = ({ progress, isGain, isWarning, isHit }) => {
    let bgColor = 'bg-slate-700';
    let fillColor = isGain ? 'bg-emerald-500' : 'bg-red-500';
    
    if (isHit) {
      fillColor = isGain ? 'bg-emerald-400' : 'bg-red-400';
    } else if (isWarning) {
      fillColor = 'bg-amber-500';
    }

    return (
      <div className={`h-2 rounded-full ${bgColor} overflow-hidden`}>
        <div 
          className={`h-full ${fillColor} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    );
  };

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">{metrics.planName || 'Plano de Trading'}</h3>
            <p className="text-xs text-slate-500">{metrics.planDescription}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        {(metrics.period.isStopHit || metrics.cycle.isStopHit) && (
          <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-red-400">STOP ATINGIDO</span>
          </div>
        )}
        {(metrics.period.isGoalHit || metrics.cycle.isGoalHit) && !metrics.period.isStopHit && !metrics.cycle.isStopHit && (
          <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">META ATINGIDA</span>
          </div>
        )}
      </div>

      {/* Period Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {metrics.period.periodType}
          </span>
          <span className={`text-sm font-bold ${metrics.period.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(metrics.period.pnlPercent)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Meta (Gain) */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-400">Meta</span>
              </div>
              <span className="text-xs font-mono text-emerald-400">+{metrics.period.goal}%</span>
            </div>
            <ProgressBar 
              progress={metrics.period.goalProgress} 
              isGain={true}
              isHit={metrics.period.isGoalHit}
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">
              {metrics.period.goalProgress.toFixed(0)}% completo
            </p>
          </div>

          {/* Stop (Loss) */}
          <div className={`bg-slate-800/50 rounded-lg p-3 ${metrics.period.isStopWarning ? 'ring-1 ring-amber-500/50' : ''} ${metrics.period.isStopHit ? 'ring-1 ring-red-500/50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-slate-400">Stop</span>
              </div>
              <span className="text-xs font-mono text-red-400">-{metrics.period.stop}%</span>
            </div>
            <ProgressBar 
              progress={metrics.period.stopProgress} 
              isGain={false}
              isWarning={metrics.period.isStopWarning}
              isHit={metrics.period.isStopHit}
            />
            {metrics.period.isStopWarning && (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Aproximando do limite!
              </p>
            )}
            {metrics.period.isStopHit && (
              <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Stop atingido!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cycle Progress */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Ciclo {metrics.cycle.cycleType}
          </span>
          <span className={`text-sm font-bold ${metrics.cycle.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(metrics.cycle.pnlPercent)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Meta do Ciclo */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-400">Meta</span>
              </div>
              <span className="text-xs font-mono text-emerald-400">+{metrics.cycle.goal}%</span>
            </div>
            <ProgressBar 
              progress={metrics.cycle.goalProgress} 
              isGain={true}
              isHit={metrics.cycle.isGoalHit}
            />
          </div>

          {/* Stop do Ciclo */}
          <div className={`bg-slate-800/50 rounded-lg p-3 ${metrics.cycle.isStopWarning ? 'ring-1 ring-amber-500/50' : ''} ${metrics.cycle.isStopHit ? 'ring-1 ring-red-500/50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-slate-400">Stop</span>
              </div>
              <span className="text-xs font-mono text-red-400">-{metrics.cycle.stop}%</span>
            </div>
            <ProgressBar 
              progress={metrics.cycle.stopProgress} 
              isGain={false}
              isWarning={metrics.cycle.isStopWarning}
              isHit={metrics.cycle.isStopHit}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanProgress;
