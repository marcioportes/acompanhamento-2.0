/**
 * ExtractCycleCard
 * @version 5.0.0 (v1.17.0)
 * @description Painel lateral do ciclo com velocímetro e breakdown.
 *   - Label de alerta quando status crítico (STOP_HIT, POST_STOP, GOAL_TO_STOP)
 *   - Barra do período mostra se atingiu meta/stop e se continuou
 */

import {
  Trophy, Skull, Check, TrendingUp, TrendingDown,
  AlertTriangle, Activity, Target, AlertOctagon
} from 'lucide-react';
import GaugeChart from '../GaugeChart';
import { classifyPeriodBadge, PERIOD_STATES } from '../../utils/planStateMachine';

const ICON_MAP = {
  Check, Trophy, TrendingUp, TrendingDown, Skull, AlertTriangle, Activity,
};

const COLOR_MAP = {
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  slate: 'text-slate-400',
};

const fmtPeriodLabel = (periodKey, operationPeriod) => {
  if (!periodKey) return '-';
  const [y, m, d] = periodKey.split('-');
  return operationPeriod === 'Semanal' ? `Sem ${d}/${m}` : `${d}/${m}`;
};

/** Determina se o status do ciclo é crítico */
const isCriticalStatus = (status) => [
  PERIOD_STATES.STOP_HIT,
  PERIOD_STATES.POST_STOP,
].includes(status);

/** Label compacto do período para a barra */
const getPeriodStatusLabel = (badge) => {
  switch (badge.badge) {
    case 'GOAL_DISCIPLINED': return { text: 'Meta', cls: 'text-emerald-400' };
    case 'POST_GOAL_GAIN': return { text: 'Meta → Cont.', cls: 'text-amber-400' };
    case 'POST_GOAL_LOSS': return { text: 'Meta → Devolveu', cls: 'text-amber-400' };
    case 'GOAL_TO_STOP': return { text: 'Meta → Stop!', cls: 'text-red-400' };
    case 'STOP_HIT': return { text: 'Stop', cls: 'text-red-400' };
    case 'STOP_WORSENED': return { text: 'Stop → Violou', cls: 'text-red-400' };
    case 'LOSS_TO_GOAL': return { text: 'Stop → Violou', cls: 'text-amber-400' };
    default: return null;
  }
};

const ExtractCycleCard = ({
  planState,
  startPL,
  fmt,
  selectedPeriod,
  onSelectPeriod,
  operationPeriod = 'Diário',
}) => {
  if (!planState) return null;

  const { cycleState, availablePeriods } = planState;
  const cycleSummary = cycleState.summary;
  const resultPct = startPL > 0 ? (cycleSummary.totalPnL / startPL) * 100 : 0;
  const critical = isCriticalStatus(cycleState.status);

  // B9: Gauge mostra dados do período selecionado, ou ciclo se nenhum selecionado
  const selectedPeriodState = selectedPeriod && selectedPeriod !== 'CICLO'
    ? cycleState.periods.get(selectedPeriod)
    : null;
  const gaugeSummary = selectedPeriodState ? selectedPeriodState.summary : cycleSummary;
  const gaugeStatus = selectedPeriodState ? selectedPeriodState.status : cycleState.status;
  const gaugeLabel = selectedPeriodState ? fmtPeriodLabel(selectedPeriod, operationPeriod) : 'Ciclo';

  return (
    <div className="flex flex-col h-full">
      {/* Header + resultado */}
      <div className={`px-4 pt-4 pb-2 border-b ${critical ? 'border-red-500/30 bg-red-500/[0.03]' : 'border-slate-800/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{gaugeLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span>{cycleSummary.tradesCount}t</span>
            <span className="text-slate-700">·</span>
            <span>{cycleSummary.periodsCount}p</span>
          </div>
        </div>

        {/* Label crítico */}
        {critical && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              {cycleState.status === PERIOD_STATES.STOP_HIT ? 'Stop do Ciclo Atingido' : 'Stop do Ciclo Violado'}
            </span>
          </div>
        )}

        {/* Velocímetro — segue o período selecionado */}
        <GaugeChart
          pnl={gaugeSummary.totalPnL}
          goalVal={gaugeSummary.goalVal}
          stopVal={gaugeSummary.stopVal}
          status={gaugeStatus}
          fmt={fmt}
        />
      </div>

      {/* Breakdown por período */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/30 z-10">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Períodos ({availablePeriods.length})
          </span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {availablePeriods.map(periodKey => {
            const periodState = cycleState.periods.get(periodKey);
            if (!periodState) return null;

            const isSelected = selectedPeriod === periodKey;
            const badge = classifyPeriodBadge(periodState);
            const BadgeIcon = ICON_MAP[badge.icon] || Activity;
            const colorClass = COLOR_MAP[badge.colorClass] || 'text-slate-400';
            const pnl = periodState.summary.totalPnL;
            const tradesCount = periodState.summary.tradesCount;
            const statusLabel = getPeriodStatusLabel(badge);

            const goalPct = periodState.summary.goalVal > 0 && pnl > 0
              ? Math.min((pnl / periodState.summary.goalVal) * 100, 100) : 0;
            const stopPct = periodState.summary.stopVal > 0 && pnl < 0
              ? Math.min((Math.abs(pnl) / periodState.summary.stopVal) * 100, 100) : 0;
            const barPct = pnl >= 0 ? goalPct : stopPct;

            return (
              <button
                key={periodKey}
                onClick={() => onSelectPeriod(periodKey)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <BadgeIcon className={`w-3 h-3 ${colorClass} ${badge.animate ? 'animate-pulse' : ''}`} />
                    <span className={`text-xs font-mono ${isSelected ? 'text-blue-400 font-bold' : 'text-slate-300'}`}>
                      {fmtPeriodLabel(periodKey, operationPeriod)}
                    </span>
                    {/* Status label (meta/stop/continuou) */}
                    {statusLabel && (
                      <span className={`text-[8px] font-bold uppercase ${statusLabel.cls}`}>
                        {statusLabel.text}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-700/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pnl >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono w-5 text-right">{tradesCount}t</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExtractCycleCard;
