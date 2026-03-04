/**
 * PlanCardGrid
 * @version 2.0.0 (v1.16.0)
 * @description Grid de cards de planos operacionais.
 *   v2.0.0: Integra planStateMachine para badges e sentiment icons.
 *   v1.0.0: Extraído do StudentDashboard (v1.15.0).
 *
 * MUDANÇAS v2:
 * - getComplianceBadge() → classifyPeriodBadge() (da state machine)
 * - renderSentimentIcon() → getSentimentFromState() (da state machine)
 * - Novos badges: POST_GOAL_GAIN, POST_GOAL_LOSS, GOAL_TO_STOP, LOSS_TO_GOAL
 * - Ícones evoluídos: Trophy, Skull em vez de apenas Smile/Frown/Meh
 */

import {
  PlusCircle, Check, Settings, Trash2, RefreshCw, Calendar, ScrollText,
  Skull, Trophy, TrendingUp, TrendingDown, Smile, Frown, Meh,
  AlertTriangle, Activity
} from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';
import { calculatePeriodPnL, calculateCyclePnL } from '../../utils/planCalculations';
import { computePlanState, classifyPeriodBadge, getSentimentFromState } from '../../utils/planStateMachine';
import DebugBadge from '../DebugBadge';

const MiniProgressBar = ({ current, target, isLoss }) => {
  const percent = target > 0 ? Math.min(Math.abs(current) / target * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${isLoss ? 'bg-red-500' : 'bg-emerald-500'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// Icon map for dynamic rendering from state machine
const ICON_MAP = {
  Smile, Frown, Meh, Trophy, Skull, TrendingUp, TrendingDown, AlertTriangle, Activity, Check,
};

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

/**
 * Renderiza badge de compliance baseado na state machine.
 */
const renderStateBadge = (badge) => {
  if (!badge || badge.badge === 'IN_PROGRESS' || badge.badge === 'UNKNOWN') return null;

  const colors = COLOR_MAP[badge.colorClass] || COLOR_MAP.slate;
  const Icon = ICON_MAP[badge.icon] || Activity;
  const baseClass = "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border backdrop-blur-sm shadow-sm";

  return (
    <div
      className={`${baseClass} ${colors.bg} ${colors.text} ${colors.border} ${badge.animate ? 'animate-pulse' : ''}`}
      title={badge.label}
    >
      <Icon className="w-3 h-3" />
      {badge.label}
    </div>
  );
};

/**
 * Renderiza ícone de sentimento baseado na state machine.
 */
const renderSentimentFromState = (sentiment) => {
  const Icon = ICON_MAP[sentiment.icon] || Meh;
  return <Icon className={`w-5 h-5 ${sentiment.colorClass}`} />;
};

const PlanCardGrid = ({
  availablePlans,
  accounts,
  trades,
  selectedPlanId,
  viewAs,
  onSelectPlan,
  onOpenLedger,
  onEditPlan,
  onDeletePlan,
  onCreatePlan,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {!viewAs && (
        <button onClick={onCreatePlan} className="group relative cursor-pointer min-h-[140px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/30 transition-all">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors mb-2">
            <PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-400 group-hover:text-white">Criar Novo Plano</span>
        </button>
      )}
      {availablePlans.map(plan => {
        const isSelected = selectedPlanId === plan.id;
        const planAccount = accounts.find(a => a.id === plan.accountId);
        const planCurrency = planAccount?.currency || 'BRL';
        const planTrades = trades.filter(t => t.planId === plan.id);
        const periodPnL = calculatePeriodPnL(planTrades, plan.operationPeriod);
        const cyclePnL = calculateCyclePnL(planTrades, plan.adjustmentCycle);
        const planInitialPL = Number(plan.pl) || 0;
        const totalPlanPnL = planTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
        const currentPlanBalance = planInitialPL + totalPlanPnL;
        const periodStopVal = (plan.pl * (plan.periodStop / 100));
        const periodGoalVal = (plan.pl * (plan.periodGoal / 100));
        const cycleGoalVal = (plan.pl * (plan.cycleGoal / 100));
        const cycleStopVal = (plan.pl * (plan.cycleStop / 100));

        // State machine: computar estado do período atual
        const planState = computePlanState(planTrades, {
          pl: planInitialPL,
          periodGoal: Number(plan.periodGoal) || 0,
          periodStop: Number(plan.periodStop) || 0,
          cycleGoal: Number(plan.cycleGoal) || 0,
          cycleStop: Number(plan.cycleStop) || 0,
          operationPeriod: plan.operationPeriod || 'Diário',
          adjustmentCycle: plan.adjustmentCycle || 'Mensal',
        });

        // Badge do período atual
        const currentPeriodKey = planState?.currentPeriodKey;
        const currentPeriodState = currentPeriodKey
          ? planState.cycleState.periods.get(currentPeriodKey)
          : null;
        const badge = currentPeriodState ? classifyPeriodBadge(currentPeriodState) : null;

        // Sentiment icon do período atual
        const periodStatus = currentPeriodState?.status || null;
        const sentiment = getSentimentFromState(periodStatus, periodPnL);

        return (
          <div key={plan.id} onClick={() => onSelectPlan(isSelected ? null : plan.id)} className={`relative cursor-pointer transition-all duration-300 overflow-hidden rounded-2xl border group ${isSelected ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'}`}>
            <div className="absolute top-2 left-2 z-30">{renderStateBadge(badge)}</div>
            <div className="absolute top-2 right-2 flex gap-1 z-20">
              <button onClick={(e) => { e.stopPropagation(); onOpenLedger(plan); }} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" title="Extrato Emocional"><ScrollText className="w-4 h-4" /></button>
              {!viewAs && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onEditPlan(plan); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Settings className="w-4 h-4" /></button>
                  <button onClick={(e) => onDeletePlan(e, plan.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
            {isSelected && <div className="absolute bottom-2 right-2 text-blue-400 animate-in zoom-in z-10"><Check className="w-4 h-4" /></div>}
            <div className="p-4 relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-2 pl-8 mt-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50 shadow-inner ml-auto">
                    <div className={!plan.active ? 'opacity-50 grayscale' : ''}>{renderSentimentFromState(sentiment)}</div>
                  </div>
                </div>
                <h3 className={`font-bold truncate mb-1 pr-6 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3>
                <p className="text-xs text-slate-500 truncate max-w-[150px]">{planAccount?.name}</p>
                <div className="mt-3 mb-1 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block mb-0.5">Saldo do Plano (PL)</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-mono font-bold ${currentPlanBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrencyDynamic(currentPlanBalance, planCurrency)}</span>
                    <span className={`text-xs font-mono ${totalPlanPnL >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>{totalPlanPnL >= 0 ? '+' : ''}{formatCurrencyDynamic(totalPlanPnL, planCurrency)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-700/50 pt-3">
                <div className="flex flex-col border-r border-slate-700/50 pr-2">
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.operationPeriod}</span></div>
                    <span className="text-[10px] text-slate-500 font-mono">/ {periodPnL >= 0 ? formatCurrencyDynamic(periodGoalVal, planCurrency) : `-${formatCurrencyDynamic(periodStopVal, planCurrency)}`}</span>
                  </div>
                  <MiniProgressBar current={periodPnL} target={periodPnL >= 0 ? periodGoalVal : periodStopVal} isLoss={periodPnL < 0} />
                </div>
                <div className="flex flex-col pl-2">
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.adjustmentCycle}</span></div>
                    <span className="text-[10px] text-slate-500 font-mono">/ {cyclePnL >= 0 ? formatCurrencyDynamic(cycleGoalVal, planCurrency) : `-${formatCurrencyDynamic(cycleStopVal, planCurrency)}`}</span>
                  </div>
                  <MiniProgressBar current={cyclePnL} target={cyclePnL >= 0 ? cycleGoalVal : cycleStopVal} isLoss={cyclePnL < 0} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <DebugBadge component="PlanCardGrid" />
    </div>
  );
};

export default PlanCardGrid;
