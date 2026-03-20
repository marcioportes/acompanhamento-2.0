/**
 * CrossCheckDashboard.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Painel de métricas de cross-check comportamental para o mentor.
 *   Mostra todas as 8+ métricas derivadas de ordens vs trades.
 */

import { Shield, ShieldOff, Clock, TrendingDown, AlertTriangle, Activity, Eye } from 'lucide-react';
import DebugBadge from '../DebugBadge';

const MetricRow = ({ label, value, format = 'text', severity = 'neutral', tooltip }) => {
  const severityColors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    neutral: 'text-slate-300',
  };

  const formatValue = () => {
    if (value == null) return '—';
    switch (format) {
      case 'percent': return `${(value * 100).toFixed(0)}%`;
      case 'ratio': return `${value.toFixed(1)}×`;
      case 'minutes': return `${value.toFixed(0)} min`;
      case 'count': return String(value);
      default: return String(value);
    }
  };

  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-slate-400" title={tooltip}>{label}</span>
      <span className={`text-xs font-mono font-semibold ${severityColors[severity]}`}>
        {formatValue()}
      </span>
    </div>
  );
};

const AlertCard = ({ alert }) => {
  const severityBg = {
    SEVERE: 'bg-red-500/10 border-red-500/20',
    MODERATE: 'bg-amber-500/10 border-amber-500/20',
  };
  const severityIcon = alert.severity === 'SEVERE'
    ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
    : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${severityBg[alert.severity] || 'bg-slate-800 border-slate-700'}`}>
      <div className="mt-0.5 shrink-0">{severityIcon}</div>
      <div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">{alert.type}</span>
        <p className="text-xs text-slate-300 mt-0.5">{alert.message}</p>
      </div>
    </div>
  );
};

const CrossCheckDashboard = ({ analysis }) => {
  if (!analysis) return null;

  const { crossCheckMetrics: m, kpiValidation: kpi, alerts = [], ordersAnalyzed, tradesInPeriod, period } = analysis;

  if (!m) return null;

  // Severity helpers
  const stopSeverity = m.stopOrderRate === 0 ? 'danger' : m.stopOrderRate < 0.2 ? 'warning' : 'good';
  const holdSeverity = m.holdTimeAsymmetry > 5 ? 'danger' : m.holdTimeAsymmetry > 3 ? 'warning' : 'good';
  const marketSeverity = m.marketOrderPct > 0.8 ? 'warning' : 'neutral';
  const avgSeverity = m.averagingDownCount > 0 ? 'danger' : 'good';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            Cross-Check Comportamental
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {ordersAnalyzed} ordens × {tradesInPeriod} trades • {period}
          </p>
        </div>
        {kpi?.kpiInflationFlag && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            kpi.kpiInflationSeverity === 'SEVERE'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            KPI INFLADO
          </span>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Proteção */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Proteção</span>
          </div>
          <MetricRow label="Stop Order Rate" value={m.stopOrderRate} format="percent" severity={stopSeverity} tooltip="% de ordens que são stop/stop_limit" />
          <MetricRow label="Market Order %" value={m.marketOrderPct} format="percent" severity={marketSeverity} tooltip="% de ordens market vs limit (impulsividade)" />
          <MetricRow label="Cancel Rate" value={m.cancelRate} format="percent" severity={m.cancelRate > 0.4 ? 'warning' : 'neutral'} />
          <MetricRow label="Modify Rate" value={m.modifyRate} format="percent" severity={m.modifyRate > 0.3 ? 'warning' : 'neutral'} />
        </div>

        {/* Tempo */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Hold Time</span>
          </div>
          <MetricRow label="Avg Win Hold" value={m.avgHoldTimeWin} format="minutes" severity="neutral" />
          <MetricRow label="Avg Loss Hold" value={m.avgHoldTimeLoss} format="minutes" severity={m.avgHoldTimeLoss > m.avgHoldTimeWin * 3 ? 'danger' : 'neutral'} />
          <MetricRow label="Assimetria (L/W)" value={m.holdTimeAsymmetry} format="ratio" severity={holdSeverity} tooltip=">3× = red flag: segurando perdedores" />
        </div>

        {/* Comportamento */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Padrões</span>
          </div>
          <MetricRow label="Averaging Down" value={m.averagingDownCount} format="count" severity={avgSeverity} />
          <MetricRow label="Ghost Orders" value={m.ghostOrderCount} format="count" severity={m.ghostOrderCount > 5 ? 'warning' : 'neutral'} tooltip="Ordens sem trade registrado" />
          <MetricRow label="Ordem/Trade Ratio" value={m.orderToTradeRatio} format="ratio" severity={m.orderToTradeRatio > 5 ? 'warning' : 'neutral'} />
        </div>

        {/* KPI Validation */}
        {kpi && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">KPI Validation</span>
            </div>
            <MetricRow label="Win Rate Reportado" value={kpi.reportedWinRate} format="percent" severity="neutral" />
            <MetricRow label="Win Rate Ajustado" value={kpi.adjustedWinRate} format="percent" severity={kpi.winRateDelta > 0.1 ? 'danger' : 'neutral'} />
            <MetricRow label="Delta" value={kpi.winRateDelta} format="percent" severity={kpi.winRateDelta > 0.1 ? 'danger' : 'good'} />
            <MetricRow label="Stop Usage" value={kpi.stopUsageRate} format="percent" severity={kpi.stopUsageRate < 0.2 ? 'danger' : 'good'} />
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Alertas ({alerts.length})</span>
          {alerts.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      )}

      <DebugBadge component="CrossCheckDashboard" />
    </div>
  );
};

export default CrossCheckDashboard;
