/**
 * ConversationalOpCard.jsx
 * @version 1.0.0 (v1.37.0 — issue #156 Fase C)
 * @description Card conversacional por operação. Substitui o bypass
 *   auto-create do #93 e coloca a decisão de classificação nas mãos do aluno.
 *
 * Variações por `operation.classification`:
 *   - match_confident  → hipótese clara (1 trade candidato) → Confirmar/Ajustar/Descartar
 *   - ambiguous        → N candidatos → Rádio + Confirmar seleção/Descartar
 *   - new              → nenhum candidato → Criar trade/Descartar (+ apontar existente)
 *   - autoliq          → evento de sistema → Registrar trade (cautela)/Descartar + badge
 *
 * Copy literal segue a issue #156 — foco em conversa, não em formulário.
 *
 * Props:
 *   operation: Object     — operação reconstruída com classification + matchCandidates + tradeId
 *   onConfirm: Function   — (payload) => void. payload inclui { decision, tradeId?, adjustments? }
 *   onDiscard: Function   — () => void
 *   onAdjust?: Function   — opcional, só consumido em match_confident
 *   tradesById?: Map      — para renderizar resumo do candidato (ticker, data)
 */

import { useState } from 'react';
import {
  Target, GitBranch, Plus, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import DebugBadge from '../DebugBadge';
import AutoLiqBadge from './AutoLiqBadge';
import { CLASSIFICATION } from '../../utils/orderTradeCreation';

// ============================================
// HELPERS
// ============================================

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatScore = (score) => {
  if (typeof score !== 'number') return '—';
  return `${Math.round(score * 100)}%`;
};

const SideIcon = ({ side, className = 'w-3.5 h-3.5' }) => (
  side === 'LONG'
    ? <ArrowUpRight className={`${className} text-emerald-400 shrink-0`} />
    : <ArrowDownRight className={`${className} text-red-400 shrink-0`} />
);

// ============================================
// SUMMARY BLOCK — compartilhado por todas as classes
// ============================================

const OperationSummary = ({ op }) => {
  const entryLabel = op.entryTime ? formatDateTime(op.entryTime) : '—';
  const exitLabel = op.exitTime ? formatDateTime(op.exitTime) : '—';
  const partials = (op.entryOrders?.length || 0) + (op.exitOrders?.length || 0);
  const priceFmt = (v) => (v != null ? Number(v).toLocaleString('pt-BR') : '—');

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
      <SideIcon side={op.side} />
      <span className="font-mono text-white">{op.instrument || '—'}</span>
      <span className={op.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>
        {op.side || '—'}
      </span>
      <span className="text-slate-500">{op.totalQty ?? '?'}×</span>
      <span className="text-slate-600">·</span>
      <span>entrada {priceFmt(op.avgEntryPrice)}</span>
      <span className="text-slate-600">→</span>
      <span>saída {priceFmt(op.avgExitPrice)}</span>
      <span className="text-slate-600">·</span>
      <span className="flex items-center gap-1 text-slate-500">
        <Clock className="w-3 h-3" />
        {entryLabel} → {exitLabel}
      </span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500">{partials} parcia{partials === 1 ? 'l' : 'is'}</span>
    </div>
  );
};

// ============================================
// VARIATION: match_confident
// ============================================

const MatchConfidentView = ({ op, tradeId, candidate, tradesById, onConfirm, onAdjust, onDiscard }) => {
  const trade = tradesById?.get?.(tradeId);
  const tradeDate = trade?.entryTime || trade?.date;
  const tradeLabel = trade
    ? `${trade.ticker || op.instrument} ${trade.side || op.side} ${trade.qty || op.totalQty}× · ${formatDateTime(tradeDate)}`
    : `trade ${tradeId}`;
  const scoreLabel = candidate?.score != null ? ` (${formatScore(candidate.score)})` : '';

  return (
    <div className="glass-card p-4 space-y-3 border-blue-500/20">
      <div className="flex items-start gap-2">
        <Target className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-white font-medium">
            Minha hipótese: essas ordens são o trade <span className="font-mono text-blue-300">{op.instrument}</span>
            {tradeDate ? <> de <span className="font-mono text-blue-300">{formatDateTime(tradeDate)}</span></> : null}. Confere?
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Candidato: {tradeLabel}{scoreLabel}</p>
        </div>
      </div>

      <OperationSummary op={op} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onConfirm({ decision: 'confirmed', tradeId })}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg transition-colors"
        >
          Confirmar
        </button>
        {onAdjust && (
          <button
            type="button"
            onClick={() => onAdjust({ decision: 'adjusted', tradeId })}
            className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors"
          >
            Ajustar
          </button>
        )}
        <button
          type="button"
          onClick={() => onDiscard()}
          className="px-3 py-1.5 text-xs font-medium bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
};

// ============================================
// VARIATION: ambiguous
// ============================================

const AmbiguousView = ({ op, matchCandidates = [], tradesById, onConfirm, onDiscard }) => {
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const sorted = [...matchCandidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="glass-card p-4 space-y-3 border-amber-500/20">
      <div className="flex items-start gap-2">
        <GitBranch className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-white font-medium">
            {sorted.length} candidatos encontrados. Selecione o trade correto ou descarte.
          </p>
        </div>
      </div>

      <OperationSummary op={op} />

      <div className="space-y-1">
        {sorted.map(({ tradeId, score }) => {
          const trade = tradesById?.get?.(tradeId);
          const checked = selectedTradeId === tradeId;
          const label = trade
            ? `${trade.ticker || op.instrument} ${trade.side || op.side} ${trade.qty || op.totalQty}× · ${formatDateTime(trade.entryTime || trade.date)}`
            : tradeId;
          return (
            <label
              key={tradeId}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                checked
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-slate-700/40 bg-slate-900/30 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name={`ambiguous-${op.operationId || 'op'}`}
                value={tradeId}
                checked={checked}
                onChange={() => setSelectedTradeId(tradeId)}
                className="accent-amber-400"
              />
              <span className="text-[11px] font-mono text-slate-200 flex-1">{label}</span>
              <span className="text-[10px] text-slate-500">{formatScore(score)}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onConfirm({ decision: 'confirmed', tradeId: selectedTradeId })}
          disabled={!selectedTradeId}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar seleção
        </button>
        <button
          type="button"
          onClick={() => onDiscard()}
          className="px-3 py-1.5 text-xs font-medium bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
};

// ============================================
// VARIATION: new
// ============================================

const NewOperationView = ({ op, dayCandidates = [], tradesById, onConfirm, onDiscard, onPointToExisting }) => {
  const [picking, setPicking] = useState(false);
  const [pickedTradeId, setPickedTradeId] = useState(null);

  return (
    <div className="glass-card p-4 space-y-3 border-emerald-500/20">
      <div className="flex items-start gap-2">
        <Plus className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-white font-medium">
            Nova operação detectada. Criar novo trade?
          </p>
        </div>
      </div>

      <OperationSummary op={op} />

      {picking && dayCandidates.length > 0 && (
        <div className="space-y-1 border-t border-slate-800/50 pt-2">
          <p className="text-[11px] text-slate-400">Trades do dia na conta:</p>
          {dayCandidates.map((trade) => {
            const checked = pickedTradeId === trade.id;
            const label = `${trade.ticker} ${trade.side} ${trade.qty}× · ${formatDateTime(trade.entryTime || trade.date)}`;
            return (
              <label
                key={trade.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  checked
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-slate-700/40 bg-slate-900/30 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name={`new-pick-${op.operationId || 'op'}`}
                  value={trade.id}
                  checked={checked}
                  onChange={() => setPickedTradeId(trade.id)}
                  className="accent-blue-400"
                />
                <span className="text-[11px] font-mono text-slate-200 flex-1">{label}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {picking ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (pickedTradeId && onPointToExisting) {
                  onPointToExisting({ tradeId: pickedTradeId });
                }
              }}
              disabled={!pickedTradeId}
              className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apontar este trade
            </button>
            <button
              type="button"
              onClick={() => { setPicking(false); setPickedTradeId(null); }}
              className="px-3 py-1.5 text-xs font-medium bg-transparent border border-slate-700 text-slate-400 hover:border-slate-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onConfirm({ decision: 'confirmed' })}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg transition-colors"
            >
              Criar trade
            </button>
            <button
              type="button"
              onClick={() => onDiscard()}
              className="px-3 py-1.5 text-xs font-medium bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Descartar
            </button>
            {onPointToExisting && dayCandidates.length > 0 && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="px-3 py-1.5 text-xs font-medium bg-transparent border border-blue-500/30 text-blue-300 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-lg transition-colors"
              >
                Apontar trade existente
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// VARIATION: autoliq
// ============================================

const AutoLiqView = ({ op, onConfirm, onDiscard }) => {
  return (
    <div className="glass-card p-4 space-y-3 border-red-500/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <AutoLiqBadge />
          </div>
          <p className="text-xs text-white font-medium">
            Evento de sistema detectado — liquidação forçada da corretora.
          </p>
          <p className="text-[11px] text-slate-400">
            Você pode registrar este evento como trade (com cautela — a liquidação não foi sua decisão)
            ou descartar. O comportamento subjacente segue visível na análise comportamental.
          </p>
        </div>
      </div>

      <OperationSummary op={op} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onConfirm({ decision: 'confirmed' })}
          className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors"
        >
          Registrar trade
        </button>
        <button
          type="button"
          onClick={() => onDiscard()}
          className="px-3 py-1.5 text-xs font-medium bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * @param {Object} props
 * @param {Object} props.operation — operação reconstruída com classification (Fase B)
 * @param {Array<{tradeId, score}>} [props.matchCandidates] — override; default lê de operation.matchCandidates
 * @param {string} [props.tradeId] — override; default lê de operation.tradeId
 * @param {Map<string, Object>} [props.tradesById] — lookup auxiliar para renderizar candidatos
 * @param {Object[]} [props.dayCandidates] — trades do mesmo dia (só para classe `new` com pick)
 * @param {Function} props.onConfirm — ({ decision, tradeId?, adjustments? }) => void
 * @param {Function} props.onDiscard — () => void
 * @param {Function} [props.onAdjust] — ({ decision, tradeId? }) => void — opcional em match_confident
 * @param {Function} [props.onPointToExisting] — ({ tradeId }) => void — opcional em `new`
 */
const ConversationalOpCard = ({
  operation,
  matchCandidates,
  tradeId,
  tradesById,
  dayCandidates = [],
  onConfirm,
  onAdjust,
  onDiscard,
  onPointToExisting,
}) => {
  if (!operation) return null;

  const cls = operation.classification;
  const candidates = matchCandidates ?? operation.matchCandidates ?? [];
  const resolvedTradeId = tradeId ?? operation.tradeId ?? candidates[0]?.tradeId ?? null;
  const bestCandidate = candidates.find(c => c.tradeId === resolvedTradeId) ?? candidates[0] ?? null;

  let view = null;
  if (cls === CLASSIFICATION.MATCH_CONFIDENT) {
    view = (
      <MatchConfidentView
        op={operation}
        tradeId={resolvedTradeId}
        candidate={bestCandidate}
        tradesById={tradesById}
        onConfirm={onConfirm}
        onAdjust={onAdjust}
        onDiscard={onDiscard}
      />
    );
  } else if (cls === CLASSIFICATION.AMBIGUOUS) {
    view = (
      <AmbiguousView
        op={operation}
        matchCandidates={candidates}
        tradesById={tradesById}
        onConfirm={onConfirm}
        onDiscard={onDiscard}
      />
    );
  } else if (cls === CLASSIFICATION.AUTOLIQ) {
    view = (
      <AutoLiqView
        op={operation}
        onConfirm={onConfirm}
        onDiscard={onDiscard}
      />
    );
  } else if (cls === CLASSIFICATION.NEW) {
    view = (
      <NewOperationView
        op={operation}
        dayCandidates={dayCandidates}
        tradesById={tradesById}
        onConfirm={onConfirm}
        onDiscard={onDiscard}
        onPointToExisting={onPointToExisting}
      />
    );
  } else {
    // Classificação desconhecida — exibe stub defensivo. Não desce silenciosamente.
    view = (
      <div className="glass-card p-4 border-slate-700/40">
        <p className="text-xs text-amber-400">
          Classificação desconhecida: {String(cls)}. A operação não pode ser confirmada até que o
          sistema classifique.
        </p>
      </div>
    );
  }

  return (
    <div data-testid={`convop-card-${cls || 'unknown'}`} className="relative">
      {view}
      <DebugBadge component="ConversationalOpCard" embedded />
    </div>
  );
};

export default ConversationalOpCard;
