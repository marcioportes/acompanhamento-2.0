/**
 * TradeOrdersPanel.jsx
 * @version 1.0.0 (v1.1.0 — issue #93, V1.1c)
 * @description Painel master/detail de ordens associadas a um trade.
 *   Mostra ordens de entrada/saída, stop orders, canceladas.
 *   Embeddável em TradeDetailModal e FeedbackPage.
 */

import { useMemo } from 'react';
import { ShieldCheck, ShieldOff, ArrowDownRight, ArrowUpRight, XCircle, FileText } from 'lucide-react';
import DebugBadge from '../DebugBadge';

/**
 * Formata timestamp ISO para exibição compacta
 */
const formatTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
};

/**
 * Badge de status da ordem
 */
const StatusBadge = ({ status }) => {
  const colors = {
    FILLED: 'emerald',
    PARTIALLY_FILLED: 'blue',
    CANCELLED: 'slate',
    REJECTED: 'red',
    EXPIRED: 'amber',
    MODIFIED: 'purple',
  };
  const color = colors[status] || 'slate';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
      {status}
    </span>
  );
};

/**
 * @param {Object} props
 * @param {Object} props.trade — trade com id
 * @param {Object[]} props.orders — todas as ordens do aluno (hook useOrders)
 * @param {boolean} props.embedded — true se usado dentro de outro componente (oculta DebugBadge duplicado)
 */
const TradeOrdersPanel = ({ trade, orders = [], embedded = false }) => {
  // Filtrar ordens correlacionadas a este trade
  const tradeOrders = useMemo(() => {
    if (!trade?.id || !orders?.length) return [];
    return orders.filter(o => o.correlatedTradeId === trade.id);
  }, [trade?.id, orders]);

  // Separar por tipo
  const { entryOrders, exitOrders, stopOrders, otherOrders } = useMemo(() => {
    const entry = [];
    const exit = [];
    const stop = [];
    const other = [];

    for (const o of tradeOrders) {
      if (o.isStopOrder) {
        stop.push(o);
      } else if (o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED') {
        other.push(o);
      } else {
        // Determinar se é entrada ou saída pelo side vs trade side
        const tradeSide = trade.side;
        if (
          (tradeSide === 'LONG' && o.side === 'BUY') ||
          (tradeSide === 'SHORT' && o.side === 'SELL')
        ) {
          entry.push(o);
        } else {
          exit.push(o);
        }
      }
    }

    // Ordenar por timestamp
    const sortByTime = (a, b) => (a.filledAt || a.submittedAt || '').localeCompare(b.filledAt || b.submittedAt || '');
    entry.sort(sortByTime);
    exit.sort(sortByTime);
    stop.sort(sortByTime);
    other.sort(sortByTime);

    return { entryOrders: entry, exitOrders: exit, stopOrders: stop, otherOrders: other };
  }, [tradeOrders, trade?.side]);

  if (tradeOrders.length === 0) return null;

  const hasStop = stopOrders.length > 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">Ordens da Corretora</span>
        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
          {tradeOrders.length}
        </span>
        {hasStop ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Stop
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <ShieldOff className="w-3 h-3" /> Sem stop
          </span>
        )}
      </div>

      <div className="bg-slate-800/30 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
          <span>Tipo</span>
          <span>Lado</span>
          <span>Preço</span>
          <span>Qtd</span>
          <span>Status</span>
          <span>Data/Hora</span>
        </div>

        {/* Entry orders */}
        {entryOrders.map((o, i) => (
          <div key={`entry-${i}`} className="grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20">
            <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" /> Entrada
            </span>
            <span className="text-[10px] text-slate-400">{o.side}</span>
            <span className="text-white font-mono text-[11px]">{o.filledPrice ?? o.price ?? '-'}</span>
            <span className="text-white font-mono text-[11px]">{o.filledQuantity ?? o.quantity ?? '-'}</span>
            <StatusBadge status={o.status} />
            <span className="text-slate-500 text-[10px] font-mono">{formatTime(o.filledAt || o.submittedAt)}</span>
          </div>
        ))}

        {/* Exit orders */}
        {exitOrders.map((o, i) => (
          <div key={`exit-${i}`} className="grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20">
            <span className="text-[10px] font-medium text-red-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Saída
            </span>
            <span className="text-[10px] text-slate-400">{o.side}</span>
            <span className="text-white font-mono text-[11px]">{o.filledPrice ?? o.price ?? '-'}</span>
            <span className="text-white font-mono text-[11px]">{o.filledQuantity ?? o.quantity ?? '-'}</span>
            <StatusBadge status={o.status} />
            <span className="text-slate-500 text-[10px] font-mono">{formatTime(o.filledAt || o.submittedAt)}</span>
          </div>
        ))}

        {/* Stop orders */}
        {stopOrders.map((o, i) => (
          <div key={`stop-${i}`} className="grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20 bg-amber-500/5">
            <span className="text-[10px] font-medium text-amber-400 flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" /> Stop
            </span>
            <span className="text-[10px] text-slate-400">{o.side}</span>
            <span className="text-white font-mono text-[11px]">{o.stopPrice ?? o.price ?? '-'}</span>
            <span className="text-white font-mono text-[11px]">{o.quantity ?? '-'}</span>
            <StatusBadge status={o.status} />
            <span className="text-slate-500 text-[10px] font-mono">{formatTime(o.filledAt || o.submittedAt)}</span>
          </div>
        ))}

        {/* Cancelled/other orders */}
        {otherOrders.map((o, i) => (
          <div key={`other-${i}`} className="grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20 opacity-60">
            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
              <XCircle className="w-3 h-3" /> Cancel
            </span>
            <span className="text-[10px] text-slate-500">{o.side}</span>
            <span className="text-slate-400 font-mono text-[11px]">{o.price ?? '-'}</span>
            <span className="text-slate-400 font-mono text-[11px]">{o.quantity ?? '-'}</span>
            <StatusBadge status={o.status} />
            <span className="text-slate-600 text-[10px] font-mono">{formatTime(o.cancelledAt || o.submittedAt)}</span>
          </div>
        ))}
      </div>

      {!embedded && <DebugBadge component="TradeOrdersPanel" />}
    </div>
  );
};

export default TradeOrdersPanel;
