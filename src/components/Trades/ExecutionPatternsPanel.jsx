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

const ExecutionPatternsPanel = ({ trade, orders, embedded = false }) => {
  const events = useMemo(() => {
    if (!trade?.id || !Array.isArray(orders) || orders.length === 0) return [];
    const correlated = orders.filter((o) => o.correlatedTradeId === trade.id);
    if (correlated.length === 0) return [];
    return detectExecutionEvents({ trades: [trade], orders: correlated })
      .filter((e) => e.tradeId === trade.id);
  }, [trade, orders]);

  if (events.length === 0) return null;

  const wrapperClass = embedded ? 'mb-6' : 'p-6 border-t border-slate-800/50';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <span className="text-sm font-medium">Padrões de execução detectados</span>
        <span className="text-xs bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
          {events.length}
        </span>
        <span className="text-[10px] text-slate-500 italic">
          baseados nas ordens acima
        </span>
      </div>
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
