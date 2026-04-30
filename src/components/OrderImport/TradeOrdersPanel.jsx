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

  // Classifica cada ordem em uma role (entry/exit/stop/cancel) e ordena
  // CRONOLOGICAMENTE — issue #208: aluno/mentor leem a sequência da operação
  // como ela aconteceu no tempo. Antes o panel agrupava por categoria e o
  // entry às vezes aparecia depois do exit por causa do agrupamento.
  const orderedRows = useMemo(() => {
    const tsOf = (o) => {
      const raw = o.filledAt || o.submittedAt || o.cancelledAt;
      if (!raw) return 0;
      if (raw?.toMillis) return raw.toMillis();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const tradeSide = trade?.side;
    const rows = tradeOrders.map((o) => {
      let role;
      if (o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED') {
        role = 'cancel';
      } else if (o.isStopOrder) {
        role = 'stop';
      } else if (
        (tradeSide === 'LONG' && o.side === 'BUY') ||
        (tradeSide === 'SHORT' && o.side === 'SELL')
      ) {
        role = 'entry';
      } else {
        role = 'exit';
      }
      return { order: o, role, ts: tsOf(o) };
    });
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }, [tradeOrders, trade?.side]);

  if (tradeOrders.length === 0) return null;

  const hasStop = orderedRows.some((r) => r.role === 'stop');

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

        {/* Linhas em ordem cronológica unificada (issue #208). Cada linha
            renderiza com o estilo da role para que entry/exit/stop/cancel
            sejam visualmente distinguíveis sem perder a sequência temporal. */}
        {orderedRows.map(({ order: o, role }, i) => {
          const cancelled = role === 'cancel';
          const rowClass = cancelled
            ? 'opacity-60'
            : role === 'stop' ? 'bg-amber-500/5' : '';
          const labelByRole = {
            entry: { Icon: ArrowDownRight, label: 'Entrada', tone: 'text-emerald-400' },
            exit: { Icon: ArrowUpRight, label: 'Saída', tone: 'text-red-400' },
            stop: { Icon: ShieldCheck, label: 'Stop', tone: 'text-amber-400' },
            cancel: { Icon: XCircle, label: 'Cancel', tone: 'text-slate-500' },
          }[role];
          const { Icon, label, tone } = labelByRole;
          const priceCell = role === 'stop' ? (o.stopPrice ?? o.price ?? '-')
            : (o.filledPrice ?? o.price ?? '-');
          const qtyCell = role === 'cancel'
            ? (o.quantity ?? '-')
            : (o.filledQuantity ?? o.quantity ?? '-');
          const tsCell = formatTime(cancelled
            ? (o.cancelledAt || o.submittedAt)
            : (o.filledAt || o.submittedAt));
          return (
            <div
              key={`${role}-${o.externalOrderId || i}-${i}`}
              className={`grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20 ${rowClass}`}
            >
              <span className={`text-[10px] font-medium ${tone} flex items-center gap-0.5`}>
                <Icon className="w-3 h-3" /> {label}
              </span>
              <span className={`text-[10px] ${cancelled ? 'text-slate-500' : 'text-slate-400'}`}>{o.side}</span>
              <span className={`font-mono text-[11px] ${cancelled ? 'text-slate-400' : 'text-white'}`}>{priceCell}</span>
              <span className={`font-mono text-[11px] ${cancelled ? 'text-slate-400' : 'text-white'}`}>{qtyCell}</span>
              <StatusBadge status={o.status} />
              <span className={`text-[10px] font-mono ${cancelled ? 'text-slate-600' : 'text-slate-500'}`}>{tsCell}</span>
            </div>
          );
        })}
      </div>

      {!embedded && <DebugBadge component="TradeOrdersPanel" />}
    </div>
  );
};

export default TradeOrdersPanel;
