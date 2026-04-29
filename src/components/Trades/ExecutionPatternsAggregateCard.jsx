/**
 * ExecutionPatternsAggregateCard
 *
 * Visão agregada dos padrões comportamentais de execução detectados na janela
 * de trades atual (aluno ou perfil aberto pelo mentor). Computa eventos
 * on-the-fly via detectExecutionEvents e agrupa por tipo. Issue #208 — Fase 7
 * (visibilidade no dashboard, complementa o ExecutionPatternsPanel por trade).
 */

import { useMemo, useState } from 'react';
import { detectExecutionEvents } from '../../utils/executionBehaviorEngine';
import {
  SEVERITY_STYLES,
  SEVERITY_DOT,
  EVENT_LABELS,
  EVENT_DESCRIPTIONS,
  formatEvidence,
  formatCitation,
} from './executionPatternsDisplay';

const TYPE_ORDER = [
  'STOP_TAMPERING',
  'STOP_PARTIAL_SIZING',
  'RAPID_REENTRY_POST_STOP',
  'CHASE_REENTRY',
  'HESITATION_PRE_ENTRY',
];

const formatDateBR = (value) => {
  if (!value) return '—';
  const d = value?.toMillis ? new Date(value.toMillis()) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const ExecutionPatternsAggregateCard = ({
  trades,
  orders,
  windowLabel = 'janela atual',
  onTradeClick,
}) => {
  const { events, tradesWithOrderData, totalTrades } = useMemo(() => {
    const safeTrades = Array.isArray(trades) ? trades : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    if (safeTrades.length === 0 || safeOrders.length === 0) {
      return { events: [], tradesWithOrderData: 0, totalTrades: safeTrades.length };
    }
    const correlatedTradeIds = new Set(
      safeOrders.map((o) => o.correlatedTradeId).filter(Boolean)
    );
    const tradesWithOrders = safeTrades.filter((t) => correlatedTradeIds.has(t.id));
    const detected = detectExecutionEvents({
      trades: tradesWithOrders,
      orders: safeOrders,
    });
    return {
      events: detected,
      tradesWithOrderData: tradesWithOrders.length,
      totalTrades: safeTrades.length,
    };
  }, [trades, orders]);

  const [expanded, setExpanded] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!map[ev.type]) map[ev.type] = [];
      map[ev.type].push(ev);
    }
    return map;
  }, [events]);

  const orderedTypes = TYPE_ORDER.filter((t) => grouped[t]?.length > 0);

  const tradesById = useMemo(() => {
    const map = {};
    for (const t of trades || []) {
      if (t?.id) map[t.id] = t;
    }
    return map;
  }, [trades]);

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Padrões de execução observados</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {tradesWithOrderData}/{totalTrades} trades com ordens correlacionadas · {windowLabel}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800/70 border border-slate-700 text-slate-400">
          {events.length} evento{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {tradesWithOrderData === 0 && (
        <div className="text-xs text-slate-500 italic">
          Nenhum trade da janela tem ordens da corretora correlacionadas. Importe Order Import (ProfitChartPro) para ativar a detecção.
        </div>
      )}

      {tradesWithOrderData > 0 && events.length === 0 && (
        <div className="text-xs text-emerald-400">
          Nenhum padrão comportamental detectado nesta janela. Execução limpa.
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          {orderedTypes.map((type) => {
            const list = grouped[type];
            const sample = list[0];
            const style = SEVERITY_STYLES[sample.severity] || SEVERITY_STYLES.LOW;
            const dot = SEVERITY_DOT[sample.severity] || SEVERITY_DOT.LOW;
            const isOpen = expanded === type;
            return (
              <div
                key={type}
                className="bg-slate-800/30 border border-slate-800 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : type)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
                    <span className="text-sm text-slate-200 truncate">
                      {EVENT_LABELS[type] || type}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${style} flex-shrink-0`}>
                      {sample.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono text-slate-300">
                      {list.length}×
                    </span>
                    <span className={`text-slate-500 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                      ▸
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-800/50">
                    <p className="text-xs text-slate-400 italic mb-2">
                      {EVENT_DESCRIPTIONS[type]}
                    </p>
                    <div className="space-y-1.5">
                      {list.map((ev, i) => {
                        const trade = tradesById[ev.tradeId];
                        const ticker = trade?.ticker || ev.evidence?.instrument || '—';
                        const date = formatDateBR(ev.timestamp || trade?.entryTime);
                        const clickable = !!(onTradeClick && trade);
                        return (
                          <div
                            key={`${type}-${ev.tradeId}-${i}`}
                            className={`text-[11px] rounded border border-slate-800/50 bg-slate-900/40 p-2 ${
                              clickable ? 'hover:bg-slate-800/60 cursor-pointer transition' : ''
                            }`}
                            onClick={clickable ? () => onTradeClick(trade) : undefined}
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                          >
                            <div className="flex items-center justify-between text-slate-300 font-mono">
                              <span>{date} · {ticker}</span>
                              {trade?.id && (
                                <span className="text-[10px] text-slate-600">#{String(trade.id).slice(-6)}</span>
                              )}
                            </div>
                            <div className="text-slate-400 mt-0.5">{formatEvidence(ev)}</div>
                          </div>
                        );
                      })}
                    </div>
                    {formatCitation(sample) && (
                      <div className="text-[10px] text-slate-600 italic mt-2">
                        {formatCitation(sample)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExecutionPatternsAggregateCard;
