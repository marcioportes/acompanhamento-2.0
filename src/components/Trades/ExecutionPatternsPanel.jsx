/**
 * ExecutionPatternsPanel
 * @description Seção read-only de padrões comportamentais de execução detectados
 *   no trade. Lê trades + orders e renderiza badges com severity, evidência e
 *   fonte literária. Issue #208 — Fase 6 UI mínima.
 */

import { useMemo } from 'react';
import { detectExecutionEvents } from '../../utils/executionBehaviorEngine';

const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/15 border-red-500/40 text-red-300',
  MEDIUM: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  LOW: 'bg-slate-500/15 border-slate-500/40 text-slate-300',
};

const EVENT_LABELS = {
  STOP_TAMPERING: 'Stop reemitido para mais largo',
  STOP_PARTIAL_SIZING: 'Stop dimensionado para meio lote',
  RAPID_REENTRY_POST_STOP: 'Reentrada rápida após stop',
  HESITATION_PRE_ENTRY: 'Hesitação pré-entrada',
  CHASE_REENTRY: 'Reentrada com preço pior (chase)',
};

const formatEvidence = (event) => {
  const e = event.evidence || {};
  switch (event.type) {
    case 'STOP_TAMPERING':
      return `Stop movido de ${e.from} para ${e.to} (${e.tradeSide || ''} — risco ampliado)`;
    case 'STOP_PARTIAL_SIZING':
      return `Stop qty=${e.stopQty} enquanto trade qty=${e.tradeQty} (cobertura ${Math.round((e.ratio || 0) * 100)}%)`;
    case 'RAPID_REENTRY_POST_STOP':
      return `${e.gapMinutes}min após stop do trade anterior · ${e.side} ${e.instrument}`;
    case 'HESITATION_PRE_ENTRY':
      return `Cancelamento ${e.gapMinutes}min antes da entrada efetiva`;
    case 'CHASE_REENTRY':
      return `Re-submetida com preço pior em ${e.worseBy} (${e.side} ${e.prevPrice} → ${e.currPrice})`;
    default:
      return null;
  }
};

const formatCitation = (event) => {
  if (event.source === 'literature' && event.citation) {
    return `Fonte: ${event.citation}`;
  }
  if (event.source === 'heuristic') {
    return event.citation
      ? `Fonte: ${event.citation} (heurística)`
      : 'Fonte: heurística operacional';
  }
  return null;
};

const ExecutionPatternsPanel = ({ trade, orders }) => {
  const events = useMemo(() => {
    if (!trade?.id || !Array.isArray(orders) || orders.length === 0) return [];
    const correlated = orders.filter((o) => o.correlatedTradeId === trade.id);
    if (correlated.length === 0) return [];
    return detectExecutionEvents({ trades: [trade], orders: correlated })
      .filter((e) => e.tradeId === trade.id);
  }, [trade, orders]);

  if (events.length === 0) return null;

  return (
    <div className="p-6 border-t border-slate-800/50">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-slate-700/50 border border-slate-600/50 rounded text-xs">
          Padrões de execução · {events.length} detectado{events.length === 1 ? '' : 's'}
        </span>
      </h3>
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
