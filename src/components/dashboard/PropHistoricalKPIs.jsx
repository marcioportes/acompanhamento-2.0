/**
 * PropHistoricalKPIs — Zona 2 da PropFirmPage: KPIs retrospectivos
 * @description Dias operados (vs mínimo do contrato), melhor dia $, pior dia $, consistency %.
 *   Fonte: histórico vivo (`liveDrawdownHistory`, #490) — só trades que ainda existem.
 *
 * Ref: issue #145 Fase F, spec v2 §4 Zona 2; issue #490
 */

import { Calendar, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';
import DebugBadge from '../DebugBadge';

const Metric = ({ icon: Icon, label, value, color = 'text-white' }) => (
  <div className="flex items-center gap-2">
    <Icon className={`w-3.5 h-3.5 ${color}`} />
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium ${color} truncate`}>{value}</div>
    </div>
  </div>
);

const pnlColor = (v) => (v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-300' : 'text-red-300');

const PropHistoricalKPIs = ({
  liveHistory,
  evalMinTradingDays,
  profitTarget,
  consistencyRule,
  phase = 'EVALUATION',
  currency = 'USD',
}) => {
  const tradingDays = liveHistory?.tradingDays ?? 0;
  const bestDay = liveHistory?.bestDay ?? null;
  const worstDay = liveHistory?.worstDay ?? null;

  const consistencyThreshold = consistencyRule && profitTarget > 0
    ? profitTarget * consistencyRule
    : null;
  const consistencyPct = consistencyThreshold && bestDay
    ? (Math.max(0, bestDay.pnl) / consistencyThreshold) * 100
    : null;
  const consistencyOk = consistencyPct == null ? null : consistencyPct <= 100;

  return (
    <div className="glass-card border border-slate-700/50 p-4 pb-6">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-400" />
        KPIs retrospectivos
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          icon={Calendar}
          label="Dias operados"
          value={phase === 'EVALUATION' && evalMinTradingDays > 0 ? `${tradingDays} / ${evalMinTradingDays} mín.` : `${tradingDays}`}
          color="text-white"
        />
        <Metric
          icon={TrendingUp}
          label="Melhor dia"
          value={bestDay ? formatCurrencyDynamic(bestDay.pnl, currency) : '—'}
          color={pnlColor(bestDay?.pnl)}
        />
        <Metric
          icon={TrendingDown}
          label="Pior dia"
          value={worstDay ? formatCurrencyDynamic(worstDay.pnl, currency) : '—'}
          color={pnlColor(worstDay?.pnl)}
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
      <DebugBadge component="PropHistoricalKPIs" embedded />
    </div>
  );
};

export default PropHistoricalKPIs;
