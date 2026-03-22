/**
 * KPIValidationCard.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Card compacto de validação de KPI — mostra flag de inflação.
 *   Visível no StudentDashboard quando há análise de cross-check.
 */

import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

const KPIValidationCard = ({ kpiValidation, onClick }) => {
  if (!kpiValidation) return null;

  const { kpiInflationFlag, kpiInflationSeverity, reportedWinRate, adjustedWinRate, stopUsageRate } = kpiValidation;

  if (!kpiInflationFlag) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-all group"
      >
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-emerald-300">KPI Validado</span>
        <span className="text-[10px] text-slate-500">
          WR {(reportedWinRate * 100).toFixed(0)}% • Stop {(stopUsageRate * 100).toFixed(0)}%
        </span>
      </button>
    );
  }

  const isSevere = kpiInflationSeverity === 'SEVERE';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all group ${
        isSevere
          ? 'border-red-500/30 bg-red-500/10 hover:border-red-500/50'
          : 'border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50'
      }`}
    >
      <ShieldAlert className={`w-4 h-4 ${isSevere ? 'text-red-400' : 'text-amber-400'}`} />
      <span className={`text-xs font-bold ${isSevere ? 'text-red-300' : 'text-amber-300'}`}>
        KPI Inflado
      </span>
      <span className="text-[10px] text-slate-500">
        WR {(reportedWinRate * 100).toFixed(0)}% → {(adjustedWinRate * 100).toFixed(0)}%
      </span>
      {isSevere && (
        <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
      )}
    </button>
  );
};

export default KPIValidationCard;
