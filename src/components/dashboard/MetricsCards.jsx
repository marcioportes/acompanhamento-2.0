/**
 * MetricsCards
 * @version 5.0.0 (v1.19.6)
 * @description Paineis agrupados de metricas do StudentDashboard.
 *   v5.0.0: Payoff com semaforo de saude do edge, layout reorganizado (WR+Payoff / Consistencia+Utiliz.RO),
 *           semaforo bidirecional do RO (>100% = infracao), labels renomeados, tooltip diagnostico da assimetria.
 *   v4.1.0: 3 paineis em linha unica, tooltips nativos restaurados, EV com explicacao semantica.
 *   v4.0.0: Layout 3 paineis + tooltips diagnosticos + NaN guards.
 *   v3.0.0: Cards Risk Asymmetry + EV Leakage (7 cards).
 *   v2.0.0: P&L contextual (B5 - Issue #71).
 *   v1.0.0: Extraido do StudentDashboard.
 */

import { DollarSign, Target, BarChart3, Info, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatPercent } from '../../utils/calculations';
import { formatCurrencyDynamic } from '../../utils/currency';
import { getFinancialInsights, getPerformanceInsights, getPlanVsResultInsights } from '../../utils/metricsInsights';
import DebugBadge from '../DebugBadge';

const safe = (v, d = 0) => (v != null && !isNaN(v) && isFinite(v)) ? v.toFixed(d) : '-';

const getAsymmetryLevel = (ratio) => {
  if (ratio == null || isNaN(ratio)) return { label: '-', color: 'text-slate-400' };
  if (ratio >= 0.9 && ratio <= 1.1) return { label: 'Excelente', color: 'text-emerald-400' };
  if (ratio >= 0.7) return { label: 'Bom', color: 'text-blue-400' };
  if (ratio >= 0.4) return { label: 'Atencao', color: 'text-amber-400' };
  return { label: 'Critico', color: 'text-red-400' };
};

const getPayoffLevel = (ratio) => {
  if (ratio == null || isNaN(ratio)) return { color: 'text-slate-400' };
  if (ratio >= 1.5) return { color: 'text-emerald-400' };
  if (ratio >= 1.0) return { color: 'text-amber-400' };
  return { color: 'text-red-400' };
};

const getPayoffTooltip = (payoff, stats) => {
  if (!payoff || payoff.ratio == null) return '';
  const wr = stats?.winRate ?? 0;
  if (payoff.ratio >= 1.5) {
    return `Edge sustentavel — Payoff alto protege contra oscilacoes no WR. WR minimo para breakeven: ${payoff.minWRForBreakeven}%`;
  }
  if (payoff.ratio >= 1.0) {
    return `Edge fragil — sustentado pelo WR de ${wr.toFixed(0)}%, nao pela qualidade dos trades. Queda no WR elimina a vantagem. WR minimo para breakeven: ${payoff.minWRForBreakeven}%`;
  }
  return `Sem edge estrutural — perde mais do que ganha por trade. Lucro so possivel com WR acima de ${payoff.minWRForBreakeven}%`;
};

/** Semaforo bidirecional: penaliza tanto subuso (<60%) quanto extrapolacao (>100%) */
const getRoColor = (efficiency) => {
  if (efficiency == null || isNaN(efficiency)) return 'text-slate-400';
  if (efficiency > 120) return 'text-red-400';
  if (efficiency > 100) return 'text-amber-400';
  if (efficiency >= 80) return 'text-emerald-400';
  if (efficiency >= 60) return 'text-amber-400';
  return 'text-red-400';
};

const getRoBgColor = (efficiency) => {
  if (efficiency == null || isNaN(efficiency)) return 'bg-slate-400';
  if (efficiency > 120) return 'bg-red-400';
  if (efficiency > 100) return 'bg-amber-400';
  if (efficiency >= 80) return 'bg-emerald-400';
  if (efficiency >= 60) return 'bg-amber-400';
  return 'bg-red-400';
};

const getLeakageLevel = (leakage) => {
  if (leakage == null || isNaN(leakage)) return { label: '-', color: 'text-slate-400' };
  if (leakage < 0) return { label: 'Superando', color: 'text-emerald-400' };
  if (leakage <= 10) return { label: 'Excelente', color: 'text-emerald-400' };
  if (leakage <= 30) return { label: 'Bom', color: 'text-blue-400' };
  if (leakage <= 60) return { label: 'Atencao', color: 'text-amber-400' };
  return { label: 'Critico', color: 'text-red-400' };
};

const sevDot = (s) => ({ success: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-red-400' }[s] || 'bg-slate-500');
const sevText = (s) => ({ success: 'text-emerald-400', warning: 'text-amber-400', danger: 'text-red-400' }[s] || 'text-slate-400');

const DiagnosticTooltip = ({ title, insights, onClose }) => (
  <div className="absolute top-full right-0 mt-2 w-80 max-h-80 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl z-50 overflow-y-auto">
    <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-800 border-t border-l border-slate-700 rotate-45" />
    <div className="flex justify-between items-start mb-3">
      <p className="text-sm font-medium text-white">{title}</p>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs ml-2">&#x2715;</button>
    </div>
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sevDot(ins.severity)}`} />
          <p className={`text-xs leading-relaxed ${sevText(ins.severity)}`}>{ins.text}</p>
        </div>
      ))}
    </div>
  </div>
);

const InfoBtn = ({ name, openTooltip, toggle }) => (
  <button onClick={() => toggle(name)} className="text-slate-600 hover:text-slate-400 transition-colors">
    <Info className="w-4 h-4" />
  </button>
);

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
  evLeakage,
  payoff,
  asymmetryDiagnostic,
  plContext,
}) => {
  const [openTooltip, setOpenTooltip] = useState(null);
  const toggle = (name) => setOpenTooltip(prev => prev === name ? null : name);

  const cur = dominantCurrency || 'BRL';
  const asymLevel = getAsymmetryLevel(riskAsymmetry?.asymmetryRatio);
  const payoffLevel = getPayoffLevel(payoff?.ratio);
  const leakLevel = getLeakageLevel(evLeakage?.leakage);
  const roEff = riskAsymmetry?.avgRoEfficiency;

  const financialInsights = useMemo(() => getFinancialInsights({
    stats, drawdown, maxDrawdownData, evLeakage, currency: cur
  }), [stats, drawdown, maxDrawdownData, evLeakage, cur]);

  const performanceInsights = useMemo(() => getPerformanceInsights({
    stats, winRatePlanned, riskAsymmetry, complianceRate, asymmetryDiagnostic
  }), [stats, winRatePlanned, riskAsymmetry, complianceRate, asymmetryDiagnostic]);

  const planInsights = useMemo(() => getPlanVsResultInsights({
    evLeakage, riskAsymmetry, winRatePlanned, stats, currency: cur
  }), [evLeakage, riskAsymmetry, winRatePlanned, stats, cur]);

  return (
    <div className="space-y-4 mb-6">

      {/* === 3 paineis em linha === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* FINANCEIRO */}
        <div className="glass-card p-5 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Financeiro</span>
            </div>
            <div className="relative">
              <InfoBtn name="fin" openTooltip={openTooltip} toggle={toggle} />
              {openTooltip === 'fin' && (
                <DiagnosticTooltip title="Diagnostico financeiro" insights={financialInsights} onClose={() => setOpenTooltip(null)} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Saldo */}
            <div>
              <p className="text-[11px] text-slate-600 mb-1">Saldo</p>
              {dominantCurrency ? (
                <p className="text-lg font-bold text-white">{formatCurrencyDynamic(aggregatedCurrentBalance, dominantCurrency)}</p>
              ) : (
                <div className="space-y-0.5">
                  {[...balancesByCurrency.entries()].map(([c, data]) => (
                    <p key={c} className="text-base font-bold text-white font-mono">{formatCurrencyDynamic(data.current, c)}</p>
                  ))}
                </div>
              )}
            </div>

            {/* P&L */}
            <div>
              <p className="text-[11px] text-slate-600 mb-1">{plContext?.label || 'P&L acumulado'}</p>
              {dominantCurrency ? (
                <p className={`text-lg font-bold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrencyDynamic(stats.totalPL, dominantCurrency)}</p>
              ) : (
                <div className="space-y-0.5">
                  {[...balancesByCurrency.entries()].map(([c, data]) => (
                    <p key={c} className={`text-base font-bold font-mono ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.pnl >= 0 ? '+' : ''}{formatCurrencyDynamic(data.pnl, c)}
                    </p>
                  ))}
                </div>
              )}
              {evLeakage?.evReal != null && !isNaN(evLeakage.evReal) && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Expect: <span className={`font-mono ${evLeakage.evReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrencyDynamic(evLeakage.evReal, cur)}/trade</span>
                </p>
              )}
            </div>

            {/* Drawdown */}
            <div title={maxDrawdownData?.maxDDDate ? `Pior vale em ${maxDrawdownData.maxDDDate.split('-').reverse().join('/')}` : ''}>
              <p className="text-[11px] text-slate-600 mb-1">Drawdown</p>
              <p className={`text-lg font-bold ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`}>-{drawdown.toFixed(1)}%</p>
              {maxDrawdownData.maxDD > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Max: <span className="font-mono text-red-400">-{safe(maxDrawdownData.maxDDPercent, 1)}%</span>
                  <span className="text-slate-600 ml-1">({formatCurrencyDynamic(-maxDrawdownData.maxDD, cur)})</span>
                </p>
              )}
            </div>

            {/* Profit Factor */}
            <div title={complianceRate ? `${complianceRate.compliant}/${complianceRate.total} trades sem violacoes` : ''}>
              <p className="text-[11px] text-slate-600 mb-1">Profit factor</p>
              <p className="text-lg font-bold text-white">{stats.profitFactor === Infinity ? '\u221E' : safe(stats.profitFactor, 2)}</p>
              {complianceRate && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Conformidade: <span className={`font-mono ${complianceRate.rate >= 80 ? 'text-emerald-400' : complianceRate.rate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{safe(complianceRate.rate, 0)}%</span>
                  {complianceRate.violations > 0 && <span className="text-red-400/70 ml-1">({complianceRate.violations})</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ASSIMETRIA DE RISCO */}
        <div className="glass-card p-5 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Assimetria de Risco</span>
            </div>
            <div className="relative">
              <InfoBtn name="perf" openTooltip={openTooltip} toggle={toggle} />
              {openTooltip === 'perf' && (
                <DiagnosticTooltip title="Diagnostico de desempenho" insights={performanceInsights} onClose={() => setOpenTooltip(null)} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Win Rate */}
            <div title={winRatePlanned ? `WR Planejado: ${safe(winRatePlanned.rate, 1)}% (${winRatePlanned.disciplinedWins}/${winRatePlanned.eligible} trades atingiram RR target)` : ''}>
              <p className="text-[11px] text-slate-600 mb-1">Win rate</p>
              <p className="text-lg font-bold text-white">{formatPercent(stats.winRate)}</p>
              {winRatePlanned && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Planejado: <span className={`font-mono ${winRatePlanned.rate >= stats.winRate ? 'text-emerald-400' : 'text-amber-400'}`}>{safe(winRatePlanned.rate, 1)}%</span>
                  {winRatePlanned.gap > 0 && <span className="text-amber-400/70 ml-1">{'\u2193'}{safe(winRatePlanned.gap, 0)}%</span>}
                </p>
              )}
            </div>

            {/* Payoff */}
            <div title={getPayoffTooltip(payoff, stats)}>
              <p className="text-[11px] text-slate-600 mb-1">Payoff</p>
              {payoff && payoff.ratio != null ? (
                <>
                  <p className={`text-lg font-bold ${payoffLevel.color}`}>{safe(payoff.ratio, 2)}x</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    W: <span className="font-mono text-emerald-400/80">{formatCurrencyDynamic(payoff.avgWin, cur)}</span>
                    {' '}L: <span className="font-mono text-red-400/80">{formatCurrencyDynamic(payoff.avgLoss, cur)}</span>
                  </p>
                </>
              ) : (
                <p className="text-lg font-bold text-slate-600">-</p>
              )}
            </div>
          </div>

          {/* Risco W/L + Utiliz. RO */}
          <div className="border-t border-slate-700/50 mt-3 pt-3">
            <div className="grid grid-cols-2 gap-x-4">
              {/* Risco W/L (Risk Asymmetry Ratio) */}
              <div>
                <p className="text-[11px] text-slate-600 mb-1">Risco W/L</p>
                {riskAsymmetry && riskAsymmetry.asymmetryRatio != null ? (
                  <>
                    <p className={`text-base font-bold ${asymLevel.color}`}>{safe(riskAsymmetry.asymmetryRatio, 2)}x</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      W: <span className="font-mono text-slate-400">{formatCurrencyDynamic(riskAsymmetry.avgRiskWins, cur)}</span>
                      {' '}L: <span className="font-mono text-red-400/80">{formatCurrencyDynamic(riskAsymmetry.avgRiskLosses, cur)}</span>
                    </p>
                  </>
                ) : riskAsymmetry && riskAsymmetry.winsCount === 0 ? (
                  <>
                    <p className="text-base font-bold text-slate-500">N/D</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Wins sem stop</p>
                  </>
                ) : (
                  <p className="text-base font-bold text-slate-600">-</p>
                )}
              </div>

              {/* Utiliz. RO (antes: RO medio) */}
              <div>
                <p className="text-[11px] text-slate-600 mb-1">Utiliz. RO</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getRoBgColor(roEff)}`}
                      style={{ width: `${Math.min(100, Math.max(0, roEff ?? 0))}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold font-mono ${getRoColor(roEff)}`}>
                      {riskAsymmetry ? safe(roEff, 0) : '-'}%
                    </span>
                    {roEff > 100 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EV — Plano vs Resultado */}
        <div className={`glass-card p-5 relative border ${evLeakage && evLeakage.leakage != null ? (leakLevel.color === 'text-red-400' ? 'border-red-500/30' : leakLevel.color === 'text-amber-400' ? 'border-amber-500/30' : 'border-slate-700/50') : 'border-slate-700/50'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className={`w-4 h-4 ${leakLevel.color}`} />
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">EV</span>
              {evLeakage?.leakage != null && !isNaN(evLeakage.leakage) && (
                <span className={`text-xs font-bold ${leakLevel.color}`}>
                  {evLeakage.leakage <= 0 ? `+${Math.abs(evLeakage.leakage).toFixed(0)}%` : `${evLeakage.leakage.toFixed(0)}% de perda`}
                </span>
              )}
            </div>
            <div className="relative">
              <InfoBtn name="ev" openTooltip={openTooltip} toggle={toggle} />
              {openTooltip === 'ev' && (
                <DiagnosticTooltip title="EV" insights={planInsights} onClose={() => setOpenTooltip(null)} />
              )}
            </div>
          </div>

          {evLeakage && evLeakage.leakage != null ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-slate-800/50">
                  <p className="text-[10px] text-slate-600 mb-1">EV esperado</p>
                  <p className="text-base font-bold text-white">{formatCurrencyDynamic(evLeakage.evTheoretical, cur)}</p>
                  <p className="text-[10px] text-slate-600">/trade</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-800/50">
                  <p className="text-[10px] text-slate-600 mb-1">EV real</p>
                  <p className={`text-base font-bold ${evLeakage.evReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrencyDynamic(evLeakage.evReal, cur)}</p>
                  <p className="text-[10px] text-slate-600">/trade</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <p className="text-[10px] text-slate-600 mb-1">Gap</p>
                  <p className="text-base font-bold text-red-400">{formatCurrencyDynamic(evLeakage.evReal - evLeakage.evTheoretical, cur)}</p>
                  <p className="text-[10px] text-slate-600">/trade</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500">Perda acumulada <span className="text-slate-600">({evLeakage.tradeCount} trades)</span></span>
                  <span className={`text-xs font-bold font-mono ${evLeakage.totalLeakage > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrencyDynamic(-evLeakage.totalLeakage, cur)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                    <div className="flex h-full">
                      <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, 100 - (evLeakage.leakage ?? 0)))}%` }} />
                      <div className="h-full bg-red-400" style={{ width: `${Math.min(100, Math.max(0, evLeakage.leakage ?? 0))}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{safe(100 - evLeakage.leakage, 0)}% capturado</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Dados insuficientes</p>
          )}
        </div>
      </div>

      <DebugBadge component="MetricsCards" />
    </div>
  );
};

export default MetricsCards;
