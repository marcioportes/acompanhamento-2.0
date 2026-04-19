/**
 * PropHistoricalKPIs — Zona 2 da PropFirmPage: KPIs retrospectivos
 * @description Dias operados X/Y, melhor dia $, pior dia $, consistency %,
 *   tempo médio entre trades (se disponível).
 *   Fonte: drawdownHistory (reagrupa por data) + account.propFirm.bestDayProfit.
 *
 * Ref: issue #145 Fase F, spec v2 §4 Zona 2
 */

import { useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';

function groupByDay(history) {
  const byDay = new Map();
  for (const d of history ?? []) {
    if (!d.date) continue;
    const existing = byDay.get(d.date);
    const dayPnl = typeof d.dailyPnL === 'number' ? d.dailyPnL : null;
    if (!existing) {
      byDay.set(d.date, { date: d.date, dailyPnL: dayPnl, lastBalance: d.balance });
    } else if (dayPnl !== null) {
      existing.dailyPnL = dayPnl;
      existing.lastBalance = d.balance ?? existing.lastBalance;
    }
  }
  return Array.from(byDay.values());
}

const Metric = ({ icon: Icon, label, value, color = 'text-white' }) => (
  <div className="flex items-center gap-2">
    <Icon className={`w-3.5 h-3.5 ${color}`} />
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium ${color} truncate`}>{value}</div>
    </div>
  </div>
);

const PropHistoricalKPIs = ({
  drawdownHistory,
  evalTimeLimit,
  profitTarget,
  consistencyRule,
  currency = 'USD',
}) => {
  const days = useMemo(() => groupByDay(drawdownHistory ?? []), [drawdownHistory]);

  const tradingDays = days.length;
  const { bestDay, worstDay } = useMemo(() => {
    let best = null;
    let worst = null;
    for (const d of days) {
      if (d.dailyPnL == null) continue;
      if (best == null || d.dailyPnL > best.dailyPnL) best = d;
      if (worst == null || d.dailyPnL < worst.dailyPnL) worst = d;
    }
    return { bestDay: best, worstDay: worst };
  }, [days]);

  const consistencyThreshold = consistencyRule && profitTarget > 0
    ? profitTarget * consistencyRule
    : null;
  const consistencyPct = consistencyThreshold && bestDay
    ? (bestDay.dailyPnL / consistencyThreshold) * 100
    : null;
  const consistencyOk = consistencyPct == null ? null : consistencyPct <= 100;

  return (
    <div className="glass-card border border-slate-700/50 p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-400" />
        KPIs retrospectivos
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          icon={Calendar}
          label="Dias operados"
          value={evalTimeLimit ? `${tradingDays} / ${evalTimeLimit}` : `${tradingDays}`}
          color="text-white"
        />
        <Metric
          icon={TrendingUp}
          label="Melhor dia"
          value={bestDay ? formatCurrencyDynamic(bestDay.dailyPnL, currency) : '—'}
          color="text-emerald-300"
        />
        <Metric
          icon={TrendingDown}
          label="Pior dia"
          value={worstDay ? formatCurrencyDynamic(worstDay.dailyPnL, currency) : '—'}
          color="text-red-300"
        />
        <Metric
          icon={Percent}
          label="Consistency"
          value={
            consistencyPct == null
              ? '—'
              : `${consistencyPct.toFixed(0)}% do teto`
          }
          color={consistencyOk === false ? 'text-red-300' : consistencyOk === true ? 'text-emerald-300' : 'text-slate-400'}
        />
      </div>

      {consistencyThreshold && (
        <div className="mt-3 pt-3 border-t border-slate-800/50 text-[11px] text-slate-500">
          Teto de consistency: {formatCurrencyDynamic(consistencyThreshold, currency)} · melhor dia não pode exceder.
        </div>
      )}
    </div>
  );
};

export default PropHistoricalKPIs;
