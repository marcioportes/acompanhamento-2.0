/**
 * MetricsCards
 * @version 3.0.0 (v1.19.4)
 * @description Cards de métricas do StudentDashboard (Saldo, P&L, WR, PF, DD, Eficiência do Risco).
 *   v3.0.0: Card "Eficiência do Risco" — Risk Asymmetry W/L + RO Efficiency.
 *   v2.0.0: P&L contextual — label dinâmico (B5 — Issue #71).
 *   v1.0.0: Extraído do StudentDashboard para modularização.
 *   Suporta multi-moeda: quando dominantCurrency é null, exibe breakdown por moeda.
 */

import { DollarSign, Target, TrendingDown, Wallet, Activity, Shield, Info } from 'lucide-react';
import { useState } from 'react';
import { formatPercent } from '../../utils/calculations';
import { formatCurrencyDynamic } from '../../utils/currency';
import DebugBadge from '../DebugBadge';

/**
 * Classifica o Risk Asymmetry ratio em faixas de severidade.
 * @param {number|null} ratio
 * @returns {{ label: string, color: string, bgColor: string }}
 */
const getAsymmetryLevel = (ratio) => {
  if (ratio == null) return { label: '-', color: 'text-slate-400', bgColor: 'bg-slate-500/20' };
  if (ratio >= 0.9 && ratio <= 1.1) return { label: 'Excelente', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
  if (ratio >= 0.7) return { label: 'Bom', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
  if (ratio >= 0.4) return { label: 'Atenção', color: 'text-amber-400', bgColor: 'bg-amber-500/20' };
  return { label: 'Crítico', color: 'text-red-400', bgColor: 'bg-red-500/20' };
};

/**
 * Tooltip de referência para Risk Asymmetry.
 */
const RiskAsymmetryTooltip = ({ onClose }) => (
  <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl z-50">
    <div className="flex justify-between items-start mb-2">
      <p className="text-sm font-medium text-white">Risk asymmetry (W/L)</p>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
    </div>
    <p className="text-xs text-slate-400 mb-3 leading-relaxed">
      Razão entre risco médio nos wins vs losses. Valores abaixo de 1.0 indicam que o aluno
      arrisca menos quando acerta — corroendo o edge mesmo com WR e RR conformes.
    </p>
    <div className="space-y-1.5">
      {[
        { range: '0.9 – 1.1', label: 'Excelente', color: 'bg-emerald-400' },
        { range: '0.7 – 0.9', label: 'Bom', color: 'bg-blue-400' },
        { range: '0.4 – 0.7', label: 'Atenção', color: 'bg-amber-400' },
        { range: '< 0.4', label: 'Crítico', color: 'bg-red-400' },
      ].map(({ range, label, color }) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-slate-500 w-16">{range}</span>
          <span className="text-slate-300">{label}</span>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-3 border-t border-slate-700">
      <p className="text-[10px] text-slate-500 leading-relaxed">
        RO Eficiência: % médio do risco permitido efetivamente utilizado. 100% = usa todo o RO do plano em cada trade.
      </p>
    </div>
    <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-slate-800 border-b border-r border-slate-700 rotate-45" />
  </div>
);

/**
 * @param {Object} stats - Retorno de calculateStats
 * @param {number} aggregatedCurrentBalance
 * @param {string|null} dominantCurrency - null = moedas mistas
 * @param {Map} balancesByCurrency - Map<currency, {current, pnl, ...}>
 * @param {number} drawdown
 * @param {Object} maxDrawdownData - {maxDD, maxDDPercent, maxDDDate}
 * @param {Object|null} winRatePlanned - {rate, eligible, disciplinedWins, gap}
 * @param {Object|null} complianceRate - {rate, compliant, total, violations}
 * @param {Object|null} riskAsymmetry - {asymmetryRatio, avgRiskWins, avgRiskLosses, avgRoEfficiency, ...}
 * @param {Object} plContext - { label, type } do P&L contextual (B5)
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
  riskAsymmetry,
  plContext,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const asymLevel = getAsymmetryLevel(riskAsymmetry?.asymmetryRatio);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{plContext?.label || 'P&L Acumulado'}</p>
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

      {/* Eficiência do Risco — v1.19.4 */}
      <div className={`glass-card p-5 relative overflow-hidden border ${riskAsymmetry ? (asymLevel.color === 'text-red-400' ? 'border-red-500/30' : asymLevel.color === 'text-amber-400' ? 'border-amber-500/30' : 'border-slate-700/50') : 'border-slate-700/50'}`}>
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${asymLevel.bgColor}`}>
            <Shield className={`w-5 h-5 ${asymLevel.color}`} />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && <RiskAsymmetryTooltip onClose={() => setShowTooltip(false)} />}
          </div>
        </div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Eficiência do Risco</p>
        {riskAsymmetry ? (
          <>
            <p className={`text-xl lg:text-2xl font-bold ${asymLevel.color}`}>
              {riskAsymmetry.asymmetryRatio != null ? `${riskAsymmetry.asymmetryRatio.toFixed(2)}x` : '-'}
            </p>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">RO médio:</span>
                <span className={`text-xs font-bold font-mono ${riskAsymmetry.avgRoEfficiency >= 60 ? 'text-emerald-400' : riskAsymmetry.avgRoEfficiency >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                  {riskAsymmetry.avgRoEfficiency.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-600">W:</span>
                <span className="font-mono text-slate-400">{formatCurrencyDynamic(riskAsymmetry.avgRiskWins, dominantCurrency || 'BRL')}</span>
                <span className="text-slate-600">L:</span>
                <span className="font-mono text-red-400/80">{formatCurrencyDynamic(riskAsymmetry.avgRiskLosses, dominantCurrency || 'BRL')}</span>
              </div>
              {/* Barra de severidade */}
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${asymLevel.color === 'text-emerald-400' ? 'bg-emerald-400' : asymLevel.color === 'text-blue-400' ? 'bg-blue-400' : asymLevel.color === 'text-amber-400' ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (riskAsymmetry.asymmetryRatio ?? 0) * 100)}%` }}
                  />
                </div>
                <span className={`text-[9px] ${asymLevel.color}`}>{asymLevel.label}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xl font-bold text-slate-600">-</p>
        )}
      </div>
      <DebugBadge component="MetricsCards" />
    </div>
  );
};

export default MetricsCards;
