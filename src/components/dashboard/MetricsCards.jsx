/**
 * MetricsCards
 * @version 1.0.0 (v1.15.0)
 * @description Cards de métricas do StudentDashboard (Saldo, P&L, WR, PF, DD).
 *   Extraído do StudentDashboard para modularização.
 *   Suporta multi-moeda: quando dominantCurrency é null, exibe breakdown por moeda.
 */

import { DollarSign, Target, TrendingDown, Wallet, Activity } from 'lucide-react';
import { formatPercent } from '../../utils/calculations';
import { formatCurrencyDynamic } from '../../utils/currency';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} stats - Retorno de calculateStats
 * @param {number} aggregatedCurrentBalance
 * @param {string|null} dominantCurrency - null = moedas mistas
 * @param {Map} balancesByCurrency - Map<currency, {current, pnl, ...}>
 * @param {number} drawdown
 * @param {Object} maxDrawdownData - {maxDD, maxDDPercent, maxDDDate}
 * @param {Object|null} winRatePlanned - {rate, eligible, disciplinedWins, gap}
 * @param {Object|null} complianceRate - {rate, compliant, total, violations}
 */
const MetricsCards = ({
  stats,
  aggregatedCurrentBalance,
  dominantCurrency,
  balancesByCurrency,
  drawdown,
  maxDrawdownData,
  winRatePlanned,
  complianceRate,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Saldo Total */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-blue-500/20"><Wallet className="w-5 h-5 text-blue-400" /></div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Total</p>
        {dominantCurrency ? (
          <p className="text-xl lg:text-2xl font-bold text-white">{formatCurrencyDynamic(aggregatedCurrentBalance, dominantCurrency)}</p>
        ) : (
          <div className="space-y-1">
            {[...balancesByCurrency.entries()].map(([cur, data]) => (
              <p key={cur} className="text-lg font-bold text-white font-mono">
                {formatCurrencyDynamic(data.current, cur)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* P&L Acumulado */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.totalPL >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><DollarSign className={`w-5 h-5 ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`} /></div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">P&L Acumulado</p>
        {dominantCurrency ? (
          <p className={`text-xl lg:text-2xl font-bold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrencyDynamic(stats.totalPL, dominantCurrency)}</p>
        ) : (
          <div className="space-y-1">
            {[...balancesByCurrency.entries()].map(([cur, data]) => (
              <p key={cur} className={`text-lg font-bold font-mono ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.pnl >= 0 ? '+' : ''}{formatCurrencyDynamic(data.pnl, cur)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Win Rate */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.winRate >= 50 ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}><Target className={`w-5 h-5 ${stats.winRate >= 50 ? 'text-blue-400' : 'text-amber-400'}`} /></div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Win Rate</p>
        <p className="text-xl lg:text-2xl font-bold text-white">{formatPercent(stats.winRate)}</p>
        {winRatePlanned && (
          <div className="mt-1.5 flex items-center gap-1.5" title={`WR Planejado: ${winRatePlanned.rate.toFixed(1)}% (${winRatePlanned.disciplinedWins}/${winRatePlanned.eligible} trades atingiram RR target)`}>
            <span className="text-[11px] text-slate-500">Planejado:</span>
            <span className={`text-xs font-bold font-mono ${winRatePlanned.rate >= stats.winRate ? 'text-emerald-400' : 'text-amber-400'}`}>{winRatePlanned.rate.toFixed(1)}%</span>
            {winRatePlanned.gap > 0 && <span className="text-[11px] text-amber-400/70">↓{winRatePlanned.gap.toFixed(0)}%</span>}
          </div>
        )}
      </div>

      {/* Profit Factor */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.profitFactor >= 1 ? 'bg-purple-500/20' : 'bg-red-500/20'}`}><Activity className={`w-5 h-5 ${stats.profitFactor >= 1 ? 'text-purple-400' : 'text-red-400'}`} /></div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Profit Factor</p>
        <p className="text-xl lg:text-2xl font-bold text-white">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</p>
        {complianceRate && (
          <div className="mt-1.5 flex items-center gap-1.5" title={`${complianceRate.compliant}/${complianceRate.total} trades sem violações`}>
            <span className="text-[11px] text-slate-500">Conformidade:</span>
            <span className={`text-xs font-bold font-mono ${complianceRate.rate >= 80 ? 'text-emerald-400' : complianceRate.rate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{complianceRate.rate.toFixed(0)}%</span>
            {complianceRate.violations > 0 && <span className="text-[11px] text-red-400/70">({complianceRate.violations} ⚠️)</span>}
          </div>
        )}
      </div>

      {/* Drawdown */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${drawdown < 5 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><TrendingDown className={`w-5 h-5 ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`} /></div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawdown</p>
        <p className={`text-xl lg:text-2xl font-bold ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`}>-{drawdown.toFixed(1)}%</p>
        {maxDrawdownData.maxDD > 0 && (
          <div className="mt-1.5 space-y-0.5" title={maxDrawdownData.maxDDDate ? `Pior vale em ${maxDrawdownData.maxDDDate.split('-').reverse().join('/')}` : ''}>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Max DD:</span>
              <span className="text-xs font-bold font-mono text-red-400">-{maxDrawdownData.maxDDPercent.toFixed(1)}%</span>
              <span className="text-[11px] text-red-400/70">({formatCurrencyDynamic(-maxDrawdownData.maxDD, dominantCurrency || 'BRL')})</span>
            </div>
            {maxDrawdownData.maxDDDate && (
              <span className="text-[11px] text-slate-600 font-mono">{maxDrawdownData.maxDDDate.split('-').reverse().join('/')}</span>
            )}
          </div>
        )}
      </div>
      <DebugBadge component="MetricsCards" />
    </div>
  );
};

export default MetricsCards;
