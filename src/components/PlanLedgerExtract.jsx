/**
 * PlanLedgerExtract
 * @version 3.0.0 (v1.16.0)
 * @description Extrato Ledger emocional — orquestrador.
 *   v3.0.0: Integra planStateMachine, seletor temporal, sub-componentes extraídos.
 *   v2.0.0: Multi-moeda via currency prop.
 *   v1.1.0: Compliance events (RO/RR/NO_STOP).
 *
 * ARQUITETURA:
 *   PlanLedgerExtract (orquestrador)
 *     ├─ ExtractPeriodSelector (seletor temporal)
 *     ├─ ExtractSummary (resumo com estado + separação pré/pós)
 *     ├─ ExtractTable (tabela com RO/RR/Emoção + marcação POST_GOAL/POST_STOP)
 *     └─ ExtractEvents (painel de eventos)
 *
 * USAGE:
 *   <PlanLedgerExtract plan={plan} trades={planTrades} onClose={fn} currency="USD" />
 */

import { useState, useMemo } from 'react';
import { X, ScrollText } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import { formatCurrencyDynamic } from '../utils/currency';
import { computePlanState } from '../utils/planStateMachine';
import DebugBadge from './DebugBadge';

// Sub-componentes extraídos
import ExtractPeriodSelector from './extract/ExtractPeriodSelector';
import ExtractSummary from './extract/ExtractSummary';
import ExtractTable from './extract/ExtractTable';
import ExtractEvents from './extract/ExtractEvents';

const fmtTime = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const PlanLedgerExtract = ({ plan, trades, onClose, currency = 'BRL' }) => {
  const { getEmotionConfig } = useMasterData();
  const { detectionConfig, statusThresholds } = useComplianceRules();
  const emotional = useEmotionalProfile({ trades, detectionConfig, statusThresholds });

  // Seletor temporal: null = ciclo inteiro, string = periodKey
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Currency formatter parcial
  const fmt = (v) => formatCurrencyDynamic(v, currency);

  // ==================== STATE MACHINE ====================

  const planState = useMemo(() => {
    if (!plan || !trades || trades.length === 0) return null;

    return computePlanState(trades, {
      pl: Number(plan.pl) || 0,
      periodGoal: Number(plan.periodGoal) || 0,
      periodStop: Number(plan.periodStop) || 0,
      cycleGoal: Number(plan.cycleGoal) || 0,
      cycleStop: Number(plan.cycleStop) || 0,
      operationPeriod: plan.operationPeriod || 'Diário',
      adjustmentCycle: plan.adjustmentCycle || 'Mensal',
    });
  }, [plan, trades]);

  // ==================== DADOS DERIVADOS ====================

  const currentPeriodState = useMemo(() => {
    if (!planState) return null;
    if (selectedPeriod === null) return null;
    return planState.cycleState.periods.get(selectedPeriod) || null;
  }, [planState, selectedPeriod]);

  // Rows para a tabela
  const tableRows = useMemo(() => {
    if (!planState) return [];
    if (selectedPeriod === null) {
      // Ciclo inteiro: concatenar rows de todos os períodos
      const allRows = [];
      for (const periodKey of planState.availablePeriods) {
        const period = planState.cycleState.periods.get(periodKey);
        if (period) allRows.push(...period.rows);
      }
      return allRows;
    }
    return currentPeriodState?.rows || [];
  }, [planState, selectedPeriod, currentPeriodState]);

  // Eventos consolidados
  const allEvents = useMemo(() => {
    if (!planState) return [];
    const evts = [];

    // Eventos da state machine (por período)
    for (const periodKey of planState.availablePeriods) {
      const period = planState.cycleState.periods.get(periodKey);
      if (period?.events) {
        period.events.forEach(e => {
          evts.push({
            type: e.type,
            date: e.timestamp?.split?.('T')?.[0] || periodKey,
            time: fmtTime(e.timestamp),
            message: e.type === 'GOAL_HIT'
              ? `META atingida: ${fmt(e.cumPnL)}`
              : `STOP atingido: ${fmt(e.cumPnL)}`
          });
        });
      }
    }

    // Eventos do ciclo
    planState.cycleState.events?.forEach(e => {
      evts.push({
        type: e.type,
        date: e.periodKey,
        time: '',
        message: e.type === 'CYCLE_GOAL_HIT'
          ? `Meta do Ciclo atingida: ${fmt(e.cycleCumPnL)}`
          : `Stop do Ciclo atingido: ${fmt(e.cycleCumPnL)}`
      });
    });

    // Compliance events
    for (const row of tableRows) {
      const trade = row.trade;
      if (trade.compliance?.roStatus === 'FORA_DO_PLANO') {
        evts.push({
          type: 'RO_FORA', date: trade.date, time: fmtTime(trade.entryTime),
          message: `RO fora do plano: ${trade.ticker} (${(trade.riskPercent || 0).toFixed(1)}%)`
        });
      }
      if (trade.compliance?.rrStatus === 'NAO_CONFORME') {
        evts.push({
          type: 'RR_FORA', date: trade.date, time: fmtTime(trade.entryTime),
          message: `RR não conforme: ${trade.ticker} (${(trade.rrRatio || 0).toFixed(1)}x)`
        });
      }
      const hasNoStop = Array.isArray(trade.redFlags) && trade.redFlags.some(f =>
        (typeof f === 'string' ? f : f.type) === 'TRADE_SEM_STOP'
      );
      if (hasNoStop) {
        evts.push({
          type: 'NO_STOP', date: trade.date, time: fmtTime(trade.entryTime),
          message: `Trade sem stop: ${trade.ticker}`
        });
      }
    }

    // Alertas emocionais
    if (emotional.isReady && emotional.alerts) {
      emotional.alerts.forEach(a => {
        if (['TILT_DETECTED', 'REVENGE_DETECTED', 'STATUS_CRITICAL'].includes(a.type)) {
          evts.push({
            type: a.type,
            date: a.timestamp?.split?.('T')?.[0] || '',
            time: fmtTime(a.timestamp),
            message: a.message
          });
        }
      });
    }

    evts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return evts;
  }, [planState, tableRows, emotional, fmt]);

  // Dados emocionais para o summary
  const emotionalData = useMemo(() => {
    if (!emotional.isReady) return null;
    return {
      score: emotional.metrics?.score ?? null,
      statusLabel: emotional.status?.label || '-'
    };
  }, [emotional]);

  // ==================== RENDER ====================

  if (!plan) return null;

  const startPL = Number(plan.pl) || 0;
  const isCycleView = selectedPeriod === null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[90vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">

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

        {/* Period Selector */}
        {planState && (
          <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-800/10">
            <ExtractPeriodSelector
              availablePeriods={planState.availablePeriods}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              operationPeriod={plan.operationPeriod || 'Diário'}
              currentPeriodKey={planState.currentPeriodKey}
            />
          </div>
        )}

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
        />

        <ExtractEvents events={allEvents} />

      </div>
      <DebugBadge component="PlanLedgerExtract" />
    </div>
  );
};

export default PlanLedgerExtract;
