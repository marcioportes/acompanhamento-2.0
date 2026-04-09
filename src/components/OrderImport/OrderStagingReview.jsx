/**
 * OrderStagingReview.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Tela de confirmação do staging — mostra operações reconstruídas
 *   para o aluno validar antes da ingestão final.
 *
 * Exibe:
 *   - Operações reconstruídas (agrupamento automático de ordens)
 *   - Parciais de entrada e saída por operação
 *   - Stop orders e movimentações detectadas
 *   - Observações auto-preenchidas (editáveis)
 *   - Totais para sanity check
 *
 * O aluno confirma operação por operação, depois clica "Confirmar e Importar".
 */

import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Shield, ShieldOff, ShieldAlert,
  AlertTriangle, CheckCircle, ArrowLeft, Loader2, Clock,
  TrendingUp, TrendingDown, XCircle,
} from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { makeOrderKey } from '../../utils/orderKey';

// ============================================
// SUB-COMPONENTS
// ============================================

/** Badge de resultado: verde=win, vermelho=loss, cinza=open */
const ResultBadge = ({ points, side }) => {
  if (points == null) return <span className="text-xs text-slate-500">Aberta</span>;
  const isWin = points > 0;
  const color = isWin ? 'text-emerald-400' : points < 0 ? 'text-red-400' : 'text-slate-400';
  const sign = isWin ? '+' : '';
  return <span className={`text-xs font-mono font-bold ${color}`}>{sign}{points} pts</span>;
};

/** Side badge */
const SideBadge = ({ side }) => {
  const isLong = side === 'LONG';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
      isLong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {side}
    </span>
  );
};

/** Stop status indicator */
const StopIndicator = ({ operation }) => {
  const { hasStopProtection, stopExecuted, stopFlags = [] } = operation;

  if (stopExecuted) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <ShieldAlert className="w-3 h-3" /> Stop executado
      </span>
    );
  }

  if (hasStopProtection) {
    const wasRemoved = stopFlags?.some(f => f.type === 'STOP_REMOVED');
    if (wasRemoved) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <ShieldOff className="w-3 h-3" /> Stop removido
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] text-blue-400">
        <Shield className="w-3 h-3" /> Com stop
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-500">
      <ShieldOff className="w-3 h-3" /> Sem stop
    </span>
  );
};

/** Single order row inside operation detail */
const OrderRow = ({ order, role }) => {
  const roleColors = {
    ENTRY: 'border-l-blue-500',
    EXIT: 'border-l-purple-500',
    STOP: 'border-l-amber-500',
    CANCELLED: 'border-l-slate-600',
  };

  const roleLabels = {
    ENTRY: 'Entrada',
    EXIT: 'Saída',
    STOP: 'Stop',
    CANCELLED: 'Cancelada',
  };

  const price = order.filledPrice ?? order.avgFillPrice ?? order.price ?? null;
  const qty = order.filledQuantity ?? order.quantity ?? null;
  const ts = order.filledAt || order.submittedAt || '';
  const timeStr = ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 border-l-2 ${roleColors[role] || 'border-l-slate-700'} bg-slate-800/20`}>
      <span className="text-[10px] text-slate-500 w-16">{roleLabels[role]}</span>
      <span className={`text-[10px] font-bold w-8 ${order.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
        {order.side === 'BUY' ? 'C' : 'V'}
      </span>
      <span className="text-[10px] text-slate-300 w-6 text-right">{qty ?? '—'}</span>
      <span className="text-[10px] text-slate-400">×</span>
      <span className="text-[10px] font-mono text-white w-20 text-right">
        {price != null ? price.toLocaleString('pt-BR') : '—'}
      </span>
      <span className="text-[10px] text-slate-500 ml-auto">{timeStr}</span>
      {order.origin && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{order.origin}</span>
      )}
    </div>
  );
};

/** Expandable operation card */
const OperationCard = ({ operation, index, confirmed, onToggleConfirm, observation, onObservationChange }) => {
  const [expanded, setExpanded] = useState(false);
  const isWin = operation.resultPoints != null && operation.resultPoints > 0;
  const isLoss = operation.resultPoints != null && operation.resultPoints < 0;

  return (
    <div className={`rounded-lg border transition-all ${
      confirmed
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-slate-700/50 bg-slate-800/20'
    }`}>
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        }

        <span className="text-xs text-slate-500 w-8">Op {index + 1}</span>
        <SideBadge side={operation.side} />
        <span className="text-xs font-mono text-white">{operation.instrument}</span>
        <span className="text-[10px] text-slate-500">{operation.totalQty}×</span>

        {/* Entry → Exit times */}
        <span className="text-[10px] text-slate-500 ml-1">
          {operation.entryTime ? new Date(operation.entryTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '?'}
          {' → '}
          {operation.exitTime ? new Date(operation.exitTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '?'}
        </span>

        {operation.duration && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
            <Clock className="w-2.5 h-2.5" />{operation.duration}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <StopIndicator operation={operation} />
          <ResultBadge points={operation.resultPoints} side={operation.side} />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleConfirm(); }}
            className={`p-1 rounded transition-colors ${
              confirmed
                ? 'text-emerald-400 hover:text-emerald-300'
                : 'text-slate-600 hover:text-slate-400'
            }`}
            title={confirmed ? 'Confirmada' : 'Clique para confirmar'}
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail — expanded */}
      {expanded && (
        <div className="border-t border-slate-800/50 px-2 py-2 space-y-1">
          {/* Entry orders */}
          {operation.entryOrders.map((order, i) => (
            <OrderRow key={`entry-${i}`} order={order} role="ENTRY" />
          ))}

          {/* Exit orders */}
          {operation.exitOrders.map((order, i) => (
            <OrderRow key={`exit-${i}`} order={order} role="EXIT" />
          ))}

          {/* Stop orders */}
          {operation.stopOrders?.map((order, i) => (
            <OrderRow key={`stop-${i}`} order={order} role="STOP" />
          ))}

          {/* Cancelled orders */}
          {operation.cancelledOrders?.map((order, i) => (
            <OrderRow key={`cancel-${i}`} order={order} role="CANCELLED" />
          ))}

          {/* Prices summary */}
          <div className="flex gap-4 px-3 py-2 mt-1 text-[10px]">
            <span className="text-slate-500">Preço médio entrada: <span className="text-white font-mono">{operation.avgEntryPrice?.toLocaleString('pt-BR')}</span></span>
            <span className="text-slate-500">Preço médio saída: <span className="text-white font-mono">{operation.avgExitPrice?.toLocaleString('pt-BR')}</span></span>
          </div>

          {/* Stop flags / observations */}
          {operation.stopFlags?.length > 0 && (
            <div className="px-3 py-1.5 space-y-1">
              {operation.stopFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px]">
                  <AlertTriangle className={`w-3 h-3 shrink-0 mt-0.5 ${
                    flag.type === 'STOP_WIDENED' || flag.type === 'STOP_REMOVED' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                  <span className="text-slate-400">{flag.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Auto-observation (editable) */}
          {(operation.autoObservation || observation) && (
            <div className="px-3 py-1.5">
              <label className="text-[10px] text-slate-500 block mb-1">Observação:</label>
              <textarea
                value={observation ?? operation.autoObservation ?? ''}
                onChange={(e) => onObservationChange(e.target.value)}
                rows={2}
                className="w-full text-[11px] bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-slate-300 resize-none focus:outline-none focus:border-blue-500/50"
                placeholder="Observação sobre esta operação..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * @param {Object} props
 * @param {Object[]} props.operations — output de reconstructOperations + associateNonFilledOrders + enrichOperationsWithStopAnalysis
 * @param {Function} props.onConfirm — chamado com { operations, observations } quando aluno confirma
 * @param {Function} props.onBack — voltar para step anterior
 * @param {boolean} props.loading — se true, mostra spinner no botão
 */
const OrderStagingReview = ({ operations, onConfirm, onBack, loading = false }) => {
  const [confirmed, setConfirmed] = useState({});
  const [observations, setObservations] = useState({});

  const toggleConfirm = (opId) => {
    setConfirmed(prev => ({ ...prev, [opId]: !prev[opId] }));
  };

  const setObservation = (opId, text) => {
    setObservations(prev => ({ ...prev, [opId]: text }));
  };

  // Stats
  const stats = useMemo(() => {
    const wins = operations.filter(o => o.resultPoints != null && o.resultPoints > 0);
    const losses = operations.filter(o => o.resultPoints != null && o.resultPoints < 0);
    const totalPts = operations.reduce((sum, o) => sum + (o.resultPoints ?? 0), 0);
    const withStop = operations.filter(o => o.hasStopProtection);
    const stopExecuted = operations.filter(o => o.stopExecuted);
    const totalOrders = operations.reduce((sum, o) =>
      sum + o.entryOrders.length + o.exitOrders.length + (o.stopOrders?.length || 0) + (o.cancelledOrders?.length || 0), 0);

    return {
      total: operations.length,
      wins: wins.length,
      losses: losses.length,
      totalPts,
      withStop: withStop.length,
      stopExecuted: stopExecuted.length,
      totalOrders,
      winRate: operations.length > 0 ? Math.round((wins.length / operations.length) * 100) : 0,
    };
  }, [operations]);

  const allConfirmed = operations.length > 0 && operations.every(op => confirmed[op.operationId]);
  const confirmedCount = Object.values(confirmed).filter(Boolean).length;
  const hasAnyConfirmed = confirmedCount > 0;

  const handleConfirmAll = () => {
    const all = {};
    operations.forEach(op => { all[op.operationId] = true; });
    setConfirmed(all);
  };

  const handleSubmit = () => {
    // Filtrar apenas operações confirmadas (marcadas) — desmarcadas são excluídas da importação
    const selectedOps = operations.filter(op => confirmed[op.operationId]);
    const selectedObservations = {};
    selectedOps.forEach(op => {
      if (observations[op.operationId]) selectedObservations[op.operationId] = observations[op.operationId];
    });

    // Coletar chaves das ordens das operações confirmadas (V1.1 issue #93)
    // Inclui entry/exit/stop/cancelled — TODAS as ordens da operação.
    // ingestBatch usa essas chaves para filtrar staging → orders e deletar o resto;
    // OrderImportPage.handleStagingConfirm usa para filtrar parsedOrders → confirmedOrders.
    // Critério canônico em src/utils/orderKey.js (single source of truth).
    const confirmedOrderKeys = [];
    const seen = new Set();
    for (const op of selectedOps) {
      const allOrders = [
        ...(op.entryOrders || []),
        ...(op.exitOrders || []),
        ...(op.stopOrders || []),
        ...(op.cancelledOrders || []),
      ];
      for (const o of allOrders) {
        const key = makeOrderKey(o);
        if (!seen.has(key)) {
          seen.add(key);
          confirmedOrderKeys.push(key);
        }
      }
    }

    onConfirm({ operations: selectedOps, observations: selectedObservations, confirmedOrderKeys });
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
          {stats.total} operações
        </span>
        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
          {stats.wins} wins
        </span>
        <span className="px-2 py-1 rounded bg-red-500/10 text-red-400">
          {stats.losses} losses
        </span>
        <span className={`px-2 py-1 rounded font-mono font-bold ${
          stats.totalPts >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {stats.totalPts >= 0 ? '+' : ''}{stats.totalPts} pts
        </span>
        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">
          {stats.withStop} com stop
        </span>
        <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
          WR {stats.winRate}%
        </span>
        <span className="px-2 py-1 rounded bg-slate-800 text-slate-500">
          {stats.totalOrders} ordens
        </span>
      </div>

      {/* Operations list */}
      <div className="space-y-2">
        {operations.map((op, i) => (
          <OperationCard
            key={op.operationId}
            operation={op}
            index={i}
            confirmed={!!confirmed[op.operationId]}
            onToggleConfirm={() => toggleConfirm(op.operationId)}
            observation={observations[op.operationId]}
            onObservationChange={(text) => setObservation(op.operationId, text)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          {!allConfirmed && (
            <button
              onClick={handleConfirmAll}
              className="px-3 py-2 text-[10px] text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition-all"
            >
              Confirmar todas ({confirmedCount}/{stats.total})
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={!hasAnyConfirmed || loading}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!hasAnyConfirmed ? 'Selecione ao menos uma operação para importar' : `Importar ${confirmedCount} operação(ões) selecionada(s)`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Importar {confirmedCount > 0 ? `${confirmedCount} ` : ''}operaç{confirmedCount === 1 ? 'ão' : 'ões'}
              </>
            )}
          </button>
        </div>
      </div>

      <DebugBadge component="OrderStagingReview" />
    </div>
  );
};

export default OrderStagingReview;
