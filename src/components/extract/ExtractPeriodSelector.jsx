/**
 * ExtractPeriodSelector
 * @version 2.0.0 (v1.17.0)
 * @description Seletor temporal para o extrato do plano.
 *   v2.0.0: Navegação entre ciclos (setas + dropdown), dropdown para >7 períodos.
 *   v1.0.0: Toggle Ciclo vs períodos individuais como botões.
 */

import { Calendar, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const DROPDOWN_THRESHOLD = 7;

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
 * @param {Array} availableCycles - Lista de ciclos { key, label, start, end, tradesCount }
 * @param {string} selectedCycleKey - Chave do ciclo selecionado
 * @param {Function} onSelectCycle - (cycleKey) => void
 */
const ExtractPeriodSelector = ({
  availablePeriods,
  selectedPeriod,
  onSelectPeriod,
  operationPeriod,
  currentPeriodKey,
  availableCycles = [],
  selectedCycleKey,
  onSelectCycle,
}) => {
  const isCycleView = selectedPeriod === null;
  const useDropdown = availablePeriods.length > DROPDOWN_THRESHOLD;

  // Navegação entre ciclos
  const currentCycleIndex = availableCycles.findIndex(c => c.key === selectedCycleKey);
  const hasPrev = currentCycleIndex > 0;
  const hasNext = currentCycleIndex < availableCycles.length - 1;
  const currentCycleLabel = availableCycles[currentCycleIndex]?.label || '';

  const handlePrevCycle = () => {
    if (hasPrev && onSelectCycle) {
      onSelectCycle(availableCycles[currentCycleIndex - 1].key);
    }
  };

  const handleNextCycle = () => {
    if (hasNext && onSelectCycle) {
      onSelectCycle(availableCycles[currentCycleIndex + 1].key);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Navegação de ciclos */}
      {availableCycles.length > 1 && (
        <div className="flex items-center gap-1 mr-2 border-r border-slate-700/50 pr-3">
          <button
            onClick={handlePrevCycle}
            disabled={!hasPrev}
            className={`p-1 rounded transition-all ${
              hasPrev
                ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                : 'text-slate-700 cursor-not-allowed'
            }`}
            title="Ciclo anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {availableCycles.length <= 6 ? (
            <span className="text-xs font-bold text-white px-2 py-1 bg-slate-900 rounded-lg border border-slate-700 min-w-[80px] text-center">
              {currentCycleLabel}
            </span>
          ) : (
            <select
              value={selectedCycleKey || ''}
              onChange={(e) => onSelectCycle?.(e.target.value)}
              className="text-xs font-bold text-white bg-slate-900 rounded-lg border border-slate-700 px-2 py-1 min-w-[80px] text-center appearance-none cursor-pointer hover:border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {availableCycles.map(c => (
                <option key={c.key} value={c.key} className="bg-slate-900">{c.label} ({c.tradesCount})</option>
              ))}
            </select>
          )}

          <button
            onClick={handleNextCycle}
            disabled={!hasNext}
            className={`p-1 rounded transition-all ${
              hasNext
                ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                : 'text-slate-700 cursor-not-allowed'
            }`}
            title="Próximo ciclo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Botão Ciclo (consolidado) */}
      <button
        onClick={() => onSelectPeriod(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
          isCycleView
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
        }`}
      >
        <RefreshCw className="w-3 h-3" />
        Ciclo
      </button>

      <span className="text-slate-600">|</span>

      {/* Períodos: botões (≤7) ou dropdown (>7) */}
      {useDropdown ? (
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-slate-500" />
          <select
            value={selectedPeriod || ''}
            onChange={(e) => onSelectPeriod(e.target.value || null)}
            className={`text-xs font-mono bg-slate-900 rounded-lg border px-2.5 py-1.5 appearance-none cursor-pointer focus:outline-none transition-all ${
              selectedPeriod
                ? 'text-blue-300 border-blue-500/40 font-bold'
                : 'text-white border-slate-700 hover:border-slate-600'
            }`}
          >
            <option value="" className="bg-slate-900">Selecionar período...</option>
            {availablePeriods.map(periodKey => (
              <option key={periodKey} value={periodKey} className="bg-slate-900">
                {fmtPeriodLabel(periodKey, operationPeriod)}
                {periodKey === currentPeriodKey ? ' (atual)' : ''}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-600">{availablePeriods.length} períodos</span>
        </div>
      ) : (
        <>
          {availablePeriods.map(periodKey => {
            const isSelected = selectedPeriod === periodKey;
            const isCurrent = periodKey === currentPeriodKey;
            return (
              <button
                key={periodKey}
                onClick={() => onSelectPeriod(periodKey)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold'
                    : isCurrent
                      ? 'bg-slate-900 text-white border-slate-600 hover:border-blue-500/40'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {fmtPeriodLabel(periodKey, operationPeriod)}
              </button>
            );
          })}
        </>
      )}

      {availablePeriods.length === 0 && (
        <span className="text-xs text-slate-600 italic">Sem períodos com trades</span>
      )}
    </div>
  );
};

export default ExtractPeriodSelector;
