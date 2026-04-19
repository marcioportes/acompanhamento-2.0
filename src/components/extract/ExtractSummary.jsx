/**
 * ExtractSummary
 * @version 2.1.0 (v1.19.6)
 * @description Resumo executivo do extrato — PL, resultado, estado, score, breakdown pré/pós evento.
 *   v2.1.0: PL Atual tricolor — verde (lucro), amarelo (perda parcial), vermelho (capital zerado).
 *   v2.0.0: RO$, RO%, RR Alvo no header (B4 — Issue #71/#73).
 *   v1.0.0: PL inicial, resultado, estado, score emocional, meta/stop.
 *   Sub-componente do PlanLedgerExtract (sem DebugBadge próprio).
 */

import {
  Trophy, Skull, Check, TrendingUp, TrendingDown,
  AlertTriangle, Activity, Brain, Target, ShieldAlert, BarChart3
} from 'lucide-react';
import { classifyPeriodBadge, PERIOD_STATES } from '../../utils/planStateMachine';

const scoreColor = (score) => {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
};

/** Formato compacto: 1.6k, 20k, 1.2M */
const fmtCompact = (val) => {
  const abs = Math.abs(val || 0);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
  return abs.toFixed(0);
};

const BADGE_ICONS = {
  Check, Trophy, TrendingUp, TrendingDown, Skull, AlertTriangle, Activity,
};

const COLOR_MAP = {
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  slate: 'text-slate-400',
  blue: 'text-blue-400',
};

/**
 * @param {Object|null} periodState - Retorno de computePeriodState (visão período)
 * @param {Object|null} cycleSummary - computePlanState().cycleState.summary (visão ciclo)
 * @param {boolean} isCycleView - true = ciclo, false = período
 * @param {number} startPL - PL inicial do plano
 * @param {Object|null} emotionalData - { score, statusLabel } ou null
 * @param {string} cycleStatus - Status do ciclo (PERIOD_STATES)
 * @param {Function} fmt - Formatador de moeda
 * @param {Object|null} planRiskInfo - { riskPerOperation, rrTarget } do plano (B4)
 */
const ExtractSummary = ({ periodState, cycleSummary, isCycleView, startPL, emotionalData, cycleStatus, fmt, planRiskInfo, summaryMetrics = null }) => {
  const summary = periodState?.summary;
  if (!summary && !cycleSummary) return null;

  const activeSummary = isCycleView ? cycleSummary : summary;
  const totalPnL = activeSummary?.totalPnL ?? 0;
  const currentPL = startPL + totalPnL;
  const resultPercent = startPL > 0 ? (totalPnL / startPL) * 100 : 0;
  const goalVal = activeSummary?.goalVal ?? 0;
  const stopVal = activeSummary?.stopVal ?? 0;

  // Badge do estado (só para visão de período)
  const badge = periodState && !isCycleView ? classifyPeriodBadge(periodState) : null;
  const BadgeIcon = badge ? BADGE_ICONS[badge.icon] : null;
  const statusColor = badge ? (COLOR_MAP[badge.colorClass] || 'text-blue-400') : 'text-blue-400';

  // Status label
  let statusLabel;
  if (isCycleView) {
    if (cycleStatus === PERIOD_STATES.GOAL_HIT) statusLabel = '🏆 Meta do Ciclo';
    else if (cycleStatus === PERIOD_STATES.STOP_HIT) statusLabel = '🔴 Stop do Ciclo';
    else statusLabel = '📊 Em Andamento';
  } else {
    statusLabel = badge?.label || 'Em Andamento';
  }

  // Separação pré/pós evento
  const hasPostEvent = summary && (summary.postEventCount > 0) && !isCycleView;

  return (
    <div className="px-5 py-4 bg-slate-800/30 border-b border-slate-800">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">PL Inicial</span>
          <span className="text-sm font-mono font-bold text-white">{fmt(startPL)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Resultado</span>
          <span className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}{fmt(totalPnL)}
          </span>
          <span className={`text-[10px] font-mono ml-1 ${totalPnL >= 0 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
            ({resultPercent >= 0 ? '+' : ''}{resultPercent.toFixed(1)}%)
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">PL Atual</span>
          <span className={`text-sm font-mono font-bold ${currentPL <= 0 ? 'text-red-400' : totalPnL >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {fmt(currentPL)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Estado</span>
          <div className="flex items-center gap-1.5">
            {BadgeIcon && <BadgeIcon className={`w-3.5 h-3.5 ${statusColor}`} />}
            <span className={`text-sm font-bold ${isCycleView ? 'text-blue-400' : statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
            <Brain className="w-3 h-3" /> Score Emocional
          </span>
          {emotionalData?.score != null ? (
            <span className={`text-sm font-bold ${scoreColor(emotionalData.score)}`}>
              {Math.round(emotionalData.score)}/100 · {emotionalData.statusLabel}
            </span>
          ) : (
            <span className="text-sm text-slate-500 italic">
              Dados insuficientes
            </span>
          )}
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Meta / Stop</span>
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-emerald-400/70">{fmtCompact(goalVal)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-red-400/70">-{fmtCompact(stopVal)}</span>
          </div>
        </div>
      </div>

      {/* RO / RR Alvo — referência do plano para o mentor (B4) */}
      {planRiskInfo && (planRiskInfo.riskPerOperation > 0 || planRiskInfo.rrTarget > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-6 text-xs">
          {planRiskInfo.riskPerOperation > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-blue-400" />
                <span className="text-slate-500">RO:</span>
                <span className="font-mono font-bold text-blue-400">
                  {fmt(startPL * planRiskInfo.riskPerOperation / 100)}
                </span>
                <span className="text-slate-500 font-mono">({planRiskInfo.riskPerOperation}%)</span>
              </div>
            </>
          )}
          {planRiskInfo.rrTarget > 0 && (
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-purple-400" />
              <span className="text-slate-500">RR Alvo:</span>
              <span className="font-mono font-bold text-purple-400">{planRiskInfo.rrTarget}:1</span>
              {planRiskInfo.riskPerOperation > 0 && (
                <span className="text-slate-500 font-mono">
                  (resultado esperado: {fmt(startPL * planRiskInfo.riskPerOperation / 100 * planRiskInfo.rrTarget)})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* R3 #102: Resumo do recorte (qty trades, WR) */}
      {summaryMetrics && summaryMetrics.tradesCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3 text-slate-400" />
            <span className="text-slate-500">Trades:</span>
            <span className="font-mono font-bold text-white">{summaryMetrics.tradesCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">WR:</span>
            <span className={`font-mono font-bold ${
              summaryMetrics.winRate >= 50 ? 'text-emerald-400'
              : summaryMetrics.winRate >= 40 ? 'text-amber-400'
              : 'text-red-400'
            }`}>
              {summaryMetrics.winRate.toFixed(1)}%
            </span>
            <span className="text-slate-600 font-mono text-[10px]">
              ({summaryMetrics.winCount}/{summaryMetrics.tradesCount})
            </span>
          </div>
        </div>
      )}

      {/* Separação pré/pós evento */}
      {hasPostEvent && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Até evento:</span>
            <span className={`font-mono font-bold ${summary.preEventPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.preEventPnL >= 0 ? '+' : ''}{fmt(summary.preEventPnL)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400">Pós-evento ({summary.postEventCount} trade{summary.postEventCount !== 1 ? 's' : ''}):</span>
            <span className={`font-mono font-bold ${summary.postEventPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.postEventPnL >= 0 ? '+' : ''}{fmt(summary.postEventPnL)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractSummary;
