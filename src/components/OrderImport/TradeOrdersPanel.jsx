/**
 * TradeOrdersPanel.jsx
 * @version 1.0.0 (v1.1.0 — issue #93, V1.1c)
 * @description Painel master/detail de ordens associadas a um trade.
 *   Mostra ordens de entrada/saída, stop orders, canceladas.
 *   Embeddável em TradeDetailModal e FeedbackPage.
 */

import { useMemo } from 'react';
import { ShieldCheck, ShieldOff, ShieldAlert, ArrowDownRight, ArrowUpRight, XCircle, FileText } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { protectionTimeline, protectiveLegsOf } from '../../utils/executionBehaviorEngine';

/** Duração legível para janela de exposição: "1m22s", "45s", "2h05m". */
const fmtDuracao = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
};

/** Hora curta (HH:MM:SS) para a faixa de exposição. */
const fmtHora = (ms) => {
  try {
    return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '—'; }
};

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
  //
  // Stop implícito: se o trade fechou em loss e não há stop formal, a saída
  // em loss conta como stop "praticado" — adicionamos uma linha sintética
  // representando o exit-as-stop, alinhada ao timestamp da saída.
  // #375 — a leitura de proteção é UMA SÓ em todo o sistema: perna adversa à posição
  // (ordem de stop de verdade, ou limite do lado oposto em preço adverso à entrada),
  // valendo em qualquer status. Antes este painel tinha a sua própria regra e checava
  // CANCELLED primeiro, então todo bracket morto pelo OCO no alvo — o desfecho normal —
  // virava "Cancel" e o cabeçalho anunciava "Sem stop" em trade protegido.
  const { orderedRows, timeline, temProtecao, hasImplicitStop } = useMemo(() => {
    const tsOf = (o) => {
      const raw = o.filledAt || o.submittedAt || o.cancelledAt;
      if (!raw) return 0;
      if (raw?.toMillis) return raw.toMillis();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const tradeSide = trade?.side;
    const tl = protectionTimeline(trade, tradeOrders);
    const legs = protectiveLegsOf(trade, tradeOrders);
    const legById = new Map(legs.filter(l => l.externalOrderId).map(l => [l.externalOrderId, l]));
    const substituidas = new Map(tl.replacements.map(r => [r.fromOrderId, r]));
    const exitTs = (() => {
      const raw = trade?.exitTime;
      if (!raw) return null;
      if (raw?.toMillis) return raw.toMillis();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    })();

    const rows = tradeOrders.map((o) => {
      const leg = o.externalOrderId ? legById.get(o.externalOrderId) : null;
      let role;
      let protectionState = null;
      if (leg) {
        role = 'stop';
        const sub = substituidas.get(o.externalOrderId);
        if (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') {
          protectionState = { kind: 'EXECUTED', label: 'executada' };
        } else if (sub) {
          const seta = sub.direction === 'TIGHTENED' ? '↑' : (sub.direction === 'WIDENED' ? '↓' : '·');
          protectionState = {
            kind: 'REPLACED',
            label: `substituída por ${Number(sub.toPrice).toLocaleString('pt-BR')} ${seta}`,
          };
        } else if (!o.cancelledAt) {
          protectionState = { kind: 'LIVE', label: 'ativa' };
        } else {
          const cTs = tsOf({ filledAt: null, submittedAt: null, cancelledAt: o.cancelledAt });
          const morreuNaSaida = exitTs != null && cTs >= exitTs - 20000;
          protectionState = morreuNaSaida
            ? { kind: 'OCO', label: 'ativa até a saída' }
            : { kind: 'WITHDRAWN', label: 'retirada' };
        }
      } else if (o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED') {
        role = 'cancel';
      } else if (
        (tradeSide === 'LONG' && o.side === 'BUY') ||
        (tradeSide === 'SHORT' && o.side === 'SELL')
      ) {
        role = 'entry';
      } else {
        role = 'exit';
      }
      return { order: o, role, protectionState, ts: tsOf(o) };
    });

    const formal = rows.some((r) => r.role === 'stop');
    const isLoss = typeof trade?.result === 'number' && trade.result < 0;
    let implicit = false;
    if (!formal && isLoss && trade?.exitTime) {
      const exitPrice = trade.avgExit ?? trade.exit ?? null;
      if (exitTs && exitPrice != null) {
        rows.push({
          order: {
            externalOrderId: '__implicit__',
            side: tradeSide === 'LONG' ? 'SELL' : 'BUY',
            stopPrice: exitPrice,
            quantity: trade.qty ?? null,
            status: 'FILLED',
            filledAt: trade.exitTime,
            __implicit: true,
          },
          role: 'stop',
          protectionState: { kind: 'IMPLICIT', label: 'stop praticado' },
          ts: exitTs,
        });
        implicit = true;
      }
    }

    rows.sort((a, b) => a.ts - b.ts);
    return { orderedRows: rows, timeline: tl, temProtecao: formal, hasImplicitStop: implicit };
  }, [tradeOrders, trade]);

  if (tradeOrders.length === 0) return null;

  // Três estados, não dois: protegido o tempo todo · houve janela nua · nunca teve stop.
  const maiorJanela = timeline.windows.length
    ? timeline.windows.reduce((a, w) => (w.durationMs > a.durationMs ? w : a), timeline.windows[0])
    : null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-slate-400 mb-3 flex-wrap">
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">Ordens da Corretora</span>
        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
          {tradeOrders.length}
        </span>
        {maiorJanela ? (
          <span
            className="flex items-center gap-1 text-[10px] text-amber-400"
            title="Contratos abertos sem proteção cobrindo, durante a vida da posição"
          >
            <ShieldAlert className="w-3 h-3" />
            Sem proteção por {fmtDuracao(maiorJanela.durationMs)} ({maiorJanela.contracts} contrato{maiorJanela.contracts === 1 ? '' : 's'})
          </span>
        ) : temProtecao ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Protegido o tempo todo
          </span>
        ) : hasImplicitStop ? (
          <span
            className="flex items-center gap-1 text-[10px] text-amber-400"
            title="Trade fechou em loss sem stop formal — saída em prejuízo conta como stop praticado"
          >
            <ShieldCheck className="w-3 h-3" /> Stop implícito
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <ShieldOff className="w-3 h-3" /> Sem stop
          </span>
        )}
        {timeline.replacements.length > 0 && (
          <span
            className="flex items-center gap-1 text-[10px] text-slate-400"
            title="Proteção cancelada e recolocada — condução de posição, não exposição"
          >
            · {timeline.replacements.length} troca{timeline.replacements.length === 1 ? '' : 's'} de proteção
          </span>
        )}
      </div>

      {maiorJanela && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">Exposição</p>
          {timeline.windows.map((w) => (
            <p key={w.startTs} className="text-[11px] font-mono text-amber-200/90">
              {fmtHora(w.startTs)} → {fmtHora(w.endTs)} · {fmtDuracao(w.durationMs)} · {w.contracts} contrato{w.contracts === 1 ? '' : 's'} sem proteção
            </p>
          ))}
        </div>
      )}

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
        {orderedRows.map(({ order: o, role, protectionState }, i) => {
          const cancelled = role === 'cancel';
          const implicit = o.__implicit === true;
          const rowClass = cancelled
            ? 'opacity-60'
            : implicit ? 'bg-amber-500/10 border-dashed'
            : role === 'stop' ? 'bg-amber-500/5' : '';
          const labelByRole = {
            entry: { Icon: ArrowDownRight, label: 'Entrada', tone: 'text-emerald-400' },
            exit: { Icon: ArrowUpRight, label: 'Saída', tone: 'text-red-400' },
            stop: implicit
              ? { Icon: ShieldCheck, label: 'Stop (impl.)', tone: 'text-amber-300' }
              : {
                Icon: protectionState?.kind === 'WITHDRAWN' ? ShieldAlert : ShieldCheck,
                label: 'Stop',
                tone: protectionState?.kind === 'WITHDRAWN' ? 'text-amber-400' : 'text-emerald-400',
              },
            cancel: { Icon: XCircle, label: 'Cancel', tone: 'text-slate-500' },
          }[role];
          const { Icon, label, tone } = labelByRole;
          const priceCell = role === 'stop' ? (o.stopPrice ?? o.price ?? '-')
            : (o.filledPrice ?? o.price ?? '-');
          const qtyCell = role === 'cancel'
            ? (o.quantity ?? '-')
            : (o.filledQuantity ?? o.quantity ?? '-');
          // Proteção se lê pelo instante em que passou a valer; as demais, pelo fato
          // que as encerrou.
          const tsCell = formatTime(role === 'stop'
            ? (o.submittedAt || o.filledAt || o.cancelledAt)
            : (cancelled ? (o.cancelledAt || o.submittedAt) : (o.filledAt || o.submittedAt)));
          return (
            <div
              key={`${role}-${o.externalOrderId || i}-${i}`}
              className={`grid grid-cols-[70px_60px_80px_80px_70px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-700/20 ${rowClass}`}
              title={implicit ? 'Stop não foi colocado: a saída em loss é o stop praticado' : undefined}
            >
              <span className={`text-[10px] font-medium ${tone} flex items-center gap-0.5`}>
                <Icon className="w-3 h-3" /> {label}
              </span>
              <span className={`text-[10px] ${cancelled ? 'text-slate-500' : 'text-slate-400'}`}>{o.side}</span>
              <span className={`font-mono text-[11px] ${cancelled ? 'text-slate-400' : 'text-white'}`}>{priceCell}</span>
              <span className={`font-mono text-[11px] ${cancelled ? 'text-slate-400' : 'text-white'}`}>{qtyCell}</span>
              {protectionState ? (
                <span
                  className={`text-[9px] italic ${protectionState.kind === 'WITHDRAWN' ? 'text-amber-300' : 'text-slate-400'}`}
                  title={protectionState.kind === 'OCO'
                    ? 'Cancelada junto com a saída pelo OCO — protegeu do começo ao fim'
                    : protectionState.kind === 'REPLACED'
                      ? 'Cancelada e recolocada — condução de posição, não exposição'
                      : protectionState.kind === 'WITHDRAWN'
                        ? 'Retirada com posição aberta e sem substituta'
                        : undefined}
                >
                  {protectionState.label}
                </span>
              ) : (
                <StatusBadge status={o.status} />
              )}
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
