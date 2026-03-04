/**
 * ExtractPeriodSelector
 * @version 1.0.0 (v1.16.0)
 * @description Seletor temporal para o extrato do plano.
 *   Toggle: Ciclo (consolidado) vs períodos individuais.
 */

import { Calendar, RefreshCw } from 'lucide-react';

const fmtPeriodLabel = (periodKey, operationPeriod) => {
  if (!periodKey) return '-';
  const [y, m, d] = periodKey.split('-');
  return operationPeriod === 'Semanal' ? `Sem. ${d}/${m}` : `${d}/${m}`;
};

/**
 * @param {string[]} availablePeriods - Chaves dos períodos disponíveis
 * @param {string|null} selectedPeriod - Período selecionado (null = visão ciclo)
 * @param {Function} onSelectPeriod - (periodKey|null) => void
 * @param {string} operationPeriod - 'Diário' | 'Semanal'
 * @param {string} currentPeriodKey - Chave do período atual (highlight)
 */
const ExtractPeriodSelector = ({
  availablePeriods,
  selectedPeriod,
  onSelectPeriod,
  operationPeriod,
  currentPeriodKey,
}) => {
  const isCycleView = selectedPeriod === null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelectPeriod(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
          isCycleView
            ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
            : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
        }`}
      >
        <RefreshCw className="w-3 h-3" />
        Ciclo
      </button>
      <span className="text-slate-700">|</span>
      {availablePeriods.map(periodKey => {
        const isSelected = selectedPeriod === periodKey;
        const isCurrent = periodKey === currentPeriodKey;
        return (
          <button
            key={periodKey}
            onClick={() => onSelectPeriod(periodKey)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              isSelected
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold'
                : isCurrent
                  ? 'bg-slate-800/50 text-slate-300 border-slate-600 hover:border-blue-500/40'
                  : 'bg-slate-800/30 text-slate-500 border-slate-700/30 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {fmtPeriodLabel(periodKey, operationPeriod)}
          </button>
        );
      })}
      {availablePeriods.length === 0 && (
        <span className="text-xs text-slate-600 italic">Sem períodos com trades</span>
      )}
    </div>
  );
};

export default ExtractPeriodSelector;
