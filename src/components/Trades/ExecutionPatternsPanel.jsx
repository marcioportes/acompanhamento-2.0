/**
 * ExecutionPatternsPanel
 * @description Seção read-only de padrões comportamentais de execução detectados
 *   no trade. Lê trades + orders e renderiza badges com severity, evidência e
 *   fonte literária. Issue #208 — Fase 6 UI mínima.
 */

import { useMemo } from 'react';
import { detectExecutionEvents } from '../../utils/executionBehaviorEngine';
import {
  SEVERITY_STYLES,
  EVENT_LABELS,
  formatEvidence,
  formatCitation,
} from './executionPatternsDisplay';

const ExecutionPatternsPanel = ({ trade, orders, allTrades, embedded = false }) => {
  const { events, correlatedCount } = useMemo(() => {
    if (!trade?.id || !Array.isArray(orders) || orders.length === 0) {
      return { events: [], correlatedCount: 0 };
    }
    const correlated = orders.filter((o) => o.correlatedTradeId === trade.id);
    if (correlated.length === 0) return { events: [], correlatedCount: 0 };
    // Detectores inter-trade (RAPID_REENTRY_POST_STOP) precisam dos trades
    // adjacentes — sem allTrades, o painel ficaria cego para o padrão de
    // loss-chasing e só veria padrões intra-trade. Quando allTrades não é
    // fornecido, degrada para [trade] (modo legado, INTRA-trade only).
    const tradesContext = Array.isArray(allTrades) && allTrades.length > 0
      ? allTrades
      : [trade];
    // Para detectores intra-trade reusarmos só as orders correlacionadas a
    // este trade; para inter-trade precisamos de todas as orders também,
    // mas detectExecutionEvents já filtra por correlatedTradeId internamente.
    const detected = detectExecutionEvents({ trades: tradesContext, orders })
      .filter((e) => e.tradeId === trade.id);
    return { events: detected, correlatedCount: correlated.length };
  }, [trade, orders, allTrades]);

  // Sem ordens correlacionadas → não há análise comportamental para reportar.
  // (TradeOrdersPanel já dá o feedback de "sem ordens" para esse caso.)
  if (correlatedCount === 0) return null;

  const wrapperClass = embedded ? 'mb-6' : 'p-6 border-t border-slate-800/50';
  const headerStyle = events.length > 0
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <span className="text-sm font-medium">Padrões de execução</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${headerStyle}`}>
          {events.length === 0 ? 'nenhum detectado' : `${events.length} detectado${events.length === 1 ? '' : 's'}`}
        </span>
        <span className="text-[10px] text-slate-500 italic">
          analisadas {correlatedCount} {correlatedCount === 1 ? 'ordem' : 'ordens'} acima
        </span>
      </div>

      {events.length === 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300">
          Nenhum dos 7 padrões comportamentais foi detectado neste trade
          <span className="text-emerald-400/70 ml-1">
            (stop tampering, sub-sizing, reentrada rápida, hesitação pré-entrada, chase, breakeven prematuro, hesitação no stop)
          </span>.
        </div>
      )}

      <div className="space-y-3">
        {events.map((event, i) => {
          const style = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.LOW;
          return (
            <div
              key={`${event.type}-${i}`}
              className="bg-slate-800/30 rounded-lg border border-slate-800 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${style}`}>
                  {event.severity}
                </span>
                <span className="text-sm font-medium text-slate-200">
                  {EVENT_LABELS[event.type] || event.type}
                </span>
              </div>
              <div className="text-xs text-slate-400 ml-1">{formatEvidence(event)}</div>
              {formatCitation(event) && (
                <div className="text-[11px] text-slate-500 italic mt-1 ml-1">
                  {formatCitation(event)}
                </div>
              )}
              {Array.isArray(event.orderIds) && event.orderIds.length > 0 && (
                <div className="text-[10px] text-slate-600 font-mono mt-1 ml-1">
                  Ordens: {event.orderIds.join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExecutionPatternsPanel;
