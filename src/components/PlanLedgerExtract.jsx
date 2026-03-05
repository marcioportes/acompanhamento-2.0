/**
 * PlanLedgerExtract
 * @version 4.0.0 (v1.17.0)
 * @description Extrato Ledger emocional — orquestrador.
 *   v4.0.0: Navegação entre ciclos, ExtractCycleCard com gauges, click-to-filter.
 *   v3.0.0: Integra planStateMachine, seletor temporal, sub-componentes extraídos.
 *   v2.0.0: Multi-moeda via currency prop.
 *   v1.1.0: Compliance events (RO/RR/NO_STOP).
 *
 * ARQUITETURA:
 *   PlanLedgerExtract (orquestrador)
 *     ├─ ExtractPeriodSelector (seletor temporal + navegação ciclos)
 *     ├─ ExtractCycleCard (barra progresso + breakdown por período — lateral)
 *     ├─ ExtractSummary (resumo com estado + separação pré/pós)
 *     └─ ExtractTable (tabela com RO/RR/Emoção + eventos inline)
 *
 * USAGE:
 *   <PlanLedgerExtract plan={plan} trades={planTrades} onClose={fn} currency="USD" />
 */

import { useState, useMemo, useCallback } from 'react';
import { X, ScrollText } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import { formatCurrencyDynamic } from '../utils/currency';
import { computePlanState, getAvailableCycles, getCycleStartDate, getCycleEndDate } from '../utils/planStateMachine';
import DebugBadge from './DebugBadge';

// Sub-componentes
import ExtractPeriodSelector from './extract/ExtractPeriodSelector';
import ExtractCycleCard from './extract/ExtractCycleCard';
import ExtractSummary from './extract/ExtractSummary';
import ExtractTable from './extract/ExtractTable';

const PlanLedgerExtract = ({ plan, trades, onClose, currency = 'BRL' }) => {
  const { getEmotionConfig } = useMasterData();
  const { detectionConfig, statusThresholds } = useComplianceRules();
  const emotional = useEmotionalProfile({ trades, detectionConfig, statusThresholds });

  // Seletor temporal: null = ciclo inteiro, string = periodKey
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Currency formatter parcial
  const fmt = useCallback((v) => formatCurrencyDynamic(v, currency), [currency]);

  // ==================== CYCLE NAVIGATION ====================

  const adjustmentCycle = plan?.adjustmentCycle || 'Mensal';

  const availableCycles = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return getAvailableCycles(trades, adjustmentCycle);
  }, [trades, adjustmentCycle]);

  // Ciclo selecionado (default = ciclo atual)
  const [selectedCycleKey, setSelectedCycleKey] = useState(() => {
    if (!trades || trades.length === 0) return null;
    const now = new Date();
    const currentCycleStart = getCycleStartDate(adjustmentCycle, now);
    const currentKey = `${currentCycleStart.getFullYear()}-${String(currentCycleStart.getMonth() + 1).padStart(2, '0')}-${String(currentCycleStart.getDate()).padStart(2, '0')}`;
    // Se o ciclo atual tem trades, usar ele. Senão, usar o último com trades.
    const cycles = getAvailableCycles(trades, adjustmentCycle);
    const hasCurrent = cycles.some(c => c.key === currentKey);
    if (hasCurrent) return currentKey;
    return cycles.length > 0 ? cycles[cycles.length - 1].key : null;
  });

  const handleSelectCycle = useCallback((cycleKey) => {
    setSelectedCycleKey(cycleKey);
    setSelectedPeriod(null); // Reset período ao trocar ciclo
  }, []);

  // Resolver start/end do ciclo selecionado
  const selectedCycleRange = useMemo(() => {
    if (!selectedCycleKey) return null;
    const d = new Date(selectedCycleKey + 'T12:00:00');
    return {
      start: getCycleStartDate(adjustmentCycle, d),
      end: getCycleEndDate(adjustmentCycle, d),
    };
  }, [selectedCycleKey, adjustmentCycle]);

  // ==================== STATE MACHINE ====================

  const planState = useMemo(() => {
    if (!plan || !trades || trades.length === 0) return null;

    const options = selectedCycleRange
      ? { targetCycle: selectedCycleRange, targetDate: selectedCycleRange.start }
      : {};

    return computePlanState(trades, {
      pl: Number(plan.pl) || 0,
      periodGoal: Number(plan.periodGoal) || 0,
      periodStop: Number(plan.periodStop) || 0,
      cycleGoal: Number(plan.cycleGoal) || 0,
      cycleStop: Number(plan.cycleStop) || 0,
      operationPeriod: plan.operationPeriod || 'Diário',
      adjustmentCycle: adjustmentCycle,
    }, options);
  }, [plan, trades, selectedCycleRange, adjustmentCycle]);

  // ==================== DADOS DERIVADOS ====================

  const currentPeriodState = useMemo(() => {
    if (!planState) return null;
    if (selectedPeriod === null) return null;
    return planState.cycleState.periods.get(selectedPeriod) || null;
  }, [planState, selectedPeriod]);

  // Rows para a tabela + saldo anterior (carry-over entre períodos)
  // Também marca cycleEvent quando um trade causa CYCLE_GOAL_HIT ou CYCLE_STOP_HIT
  const { tableRows, carryOver } = useMemo(() => {
    if (!planState) return { tableRows: [], carryOver: 0 };

    // Pré-computar: qual periodKey causou cycle event
    const cycleEventByPeriod = {};
    planState.cycleState.events?.forEach(e => {
      cycleEventByPeriod[e.periodKey] = e.type;
    });

    // Computar acumulado do ciclo para cada trade (para detectar exatamente qual trade cruzou)
    const cycleGoalVal = planState.cycleState.summary.goalVal;
    const cycleStopVal = planState.cycleState.summary.stopVal;

    if (selectedPeriod === null) {
      // Ciclo inteiro
      const allRows = [];
      let runningTotal = 0;
      let cycleTriggered = false;
      for (const periodKey of planState.availablePeriods) {
        const period = planState.cycleState.periods.get(periodKey);
        if (!period) continue;
        for (const row of period.rows) {
          runningTotal += row.result;
          let cycleEvent = null;
          if (!cycleTriggered) {
            if (cycleGoalVal > 0 && runningTotal >= cycleGoalVal) {
              cycleEvent = 'CYCLE_GOAL_HIT';
              cycleTriggered = true;
            } else if (cycleStopVal > 0 && runningTotal <= -cycleStopVal) {
              cycleEvent = 'CYCLE_STOP_HIT';
              cycleTriggered = true;
            }
          }
          allRows.push({ ...row, cumPnL: runningTotal, cycleEvent });
        }
      }
      return { tableRows: allRows, carryOver: 0 };
    }

    // Período individual
    let carry = 0;
    for (const periodKey of planState.availablePeriods) {
      if (periodKey === selectedPeriod) break;
      const period = planState.cycleState.periods.get(periodKey);
      if (period) carry += period.summary.totalPnL;
    }

    const periodRows = currentPeriodState?.rows || [];
    const adjustedRows = periodRows.map(row => ({
      ...row,
      cumPnL: carry + row.cumPnL,
      cycleEvent: null,
    }));

    return { tableRows: adjustedRows, carryOver: carry };
  }, [planState, selectedPeriod, currentPeriodState]);

  // Dados emocionais para o summary
  const emotionalData = useMemo(() => {
    if (!emotional.isReady) return null;
    return {
      score: emotional.metrics?.score ?? null,
      statusLabel: emotional.status?.label || '-'
    };
  }, [emotional]);

  // Eventos emocionais para matching inline na tabela
  const emotionalEvents = useMemo(() => {
    if (!emotional.isReady || !emotional.alerts) return [];
    return emotional.alerts
      .filter(a => ['TILT_DETECTED', 'REVENGE_DETECTED', 'STATUS_CRITICAL'].includes(a.type))
      .map(a => ({
        type: a.type,
        date: a.timestamp?.split?.('T')?.[0] || '',
        tradeId: a.tradeId || null,
        message: a.message,
      }));
  }, [emotional]);

  // ==================== RENDER ====================

  if (!plan) return null;

  const startPL = Number(plan.pl) || 0;
  const isCycleView = selectedPeriod === null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-7xl h-[90vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <ScrollText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Extrato Emocional: {plan.name}</h2>
              <p className="text-xs text-slate-400">
                {plan.operationPeriod || 'Diário'} · {plan.adjustmentCycle || 'Mensal'} · {fmt(startPL)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Selector + Cycle Navigation */}
        {planState && (
          <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-800/10">
            <ExtractPeriodSelector
              availablePeriods={planState.availablePeriods}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              operationPeriod={plan.operationPeriod || 'Diário'}
              currentPeriodKey={planState.currentPeriodKey}
              availableCycles={availableCycles}
              selectedCycleKey={selectedCycleKey}
              onSelectCycle={handleSelectCycle}
            />
          </div>
        )}

        {/* Main content: Cycle Card (lateral) + Summary + Table */}
        <div className="flex-1 flex overflow-hidden">

          {/* Cycle Card — lateral esquerda */}
          {planState && (
            <div className="w-72 min-w-[288px] border-r border-slate-800/50 bg-slate-900/50 overflow-y-auto hidden lg:flex lg:flex-col">
              <ExtractCycleCard
                planState={planState}
                startPL={startPL}
                fmt={fmt}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={setSelectedPeriod}
                operationPeriod={plan.operationPeriod || 'Diário'}
              />
            </div>
          )}

          {/* Conteúdo principal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ExtractSummary
              periodState={currentPeriodState}
              startPL={startPL}
              fmt={fmt}
              emotionalData={emotionalData}
              isCycleView={isCycleView}
              cycleSummary={planState?.cycleState?.summary || null}
              cycleStatus={planState?.cycleState?.status || 'IN_PROGRESS'}
            />

            <ExtractTable
              rows={tableRows}
              fmt={fmt}
              getEmotionConfig={getEmotionConfig}
              carryOver={carryOver}
              emotionalEvents={emotionalEvents}
            />
          </div>
        </div>

      </div>
      <DebugBadge component="PlanLedgerExtract" />
    </div>
  );
};

export default PlanLedgerExtract;
