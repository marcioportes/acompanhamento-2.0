/**
 * MatchedOperationsPanel.jsx
 * @version 2.0.0 (v1.1.0 — issue #93 redesign V1.1b Fase 5)
 * @description Modo Confronto Enriquecido: exibe operações correlacionadas a
 *   trades existentes com divergências lado a lado. Permite ao aluno:
 *   - "Manter manual": mantém o trade atual (dismissal client-side)
 *   - "Aceitar enriquecimento": atualiza trade existente via enrichTrade
 *     (parciais + stop + preços da corretora, preserva emoção/setup)
 *
 * Racional: mentoria comportamental exige dado verdadeiro. O aluno confronta
 * o que ele registrou vs o que a corretora viu e decide caso a caso.
 */

import { useState, useCallback } from 'react';
import {
  GitCompare, ArrowRight, Check, RefreshCw, CheckCircle,
  XCircle, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { DIVERGENCE_SEVERITY } from '../../utils/orderTradeComparison';

// ============================================
// HELPERS
// ============================================

const severityColor = (severity) => {
  switch (severity) {
    case DIVERGENCE_SEVERITY.HIGH: return 'red';
    case DIVERGENCE_SEVERITY.MEDIUM: return 'amber';
    case DIVERGENCE_SEVERITY.LOW: return 'slate';
    default: return 'slate';
  }
};

const formatValue = (v) => {
  if (v == null) return '—';
  if (typeof v === 'string' && v.includes('T')) {
    try {
      return new Date(v).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return v; }
  }
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  return String(v);
};

// ============================================
// SUBCOMPONENTS
// ============================================

const DivergenceRow = ({ divergence }) => {
  const color = severityColor(divergence.severity);
  return (
    <div className={`grid grid-cols-[100px_1fr_auto_1fr] gap-2 items-center py-1.5 text-[11px] border-b border-slate-800/30 last:border-0`}>
      <span className={`text-${color}-400 font-medium`}>{divergence.label}</span>
      <span className="text-slate-500 font-mono text-right">{formatValue(divergence.tradeValue)}</span>
      <ArrowRight className={`w-3 h-3 text-${color}-400`} />
      <span className="text-white font-mono">{formatValue(divergence.operationValue)}</span>
    </div>
  );
};

const OperationCard = ({ item, onAccept, onEnrich, disabled, state }) => {
  const { operation, trade, comparison } = item;
  const isLong = operation.side === 'LONG';
  const maxColor = severityColor(comparison.maxSeverity);

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      state === 'accepted' ? 'bg-emerald-500/5 border-emerald-500/20' :
      state === 'enriched' ? 'bg-blue-500/5 border-blue-500/20' :
      state === 'error' ? 'bg-red-500/10 border-red-500/30' :
      `bg-slate-900/50 border-${maxColor}-500/20`
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isLong
          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
        }
        <span className="text-xs text-white font-mono">{operation.instrument}</span>
        <span className={`text-[10px] ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
          {operation.side}
        </span>
        <span className="text-[10px] text-slate-500">{operation.totalQty}x</span>
        <span className={`ml-auto text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-${maxColor}-500/10 text-${maxColor}-400 border border-${maxColor}-500/20`}>
          {comparison.divergences.length} {comparison.divergences.length === 1 ? 'divergência' : 'divergências'}
        </span>
      </div>

      {/* Side-by-side headers */}
      <div className="grid grid-cols-[100px_1fr_auto_1fr] gap-2 pb-1 mb-1 border-b border-slate-700/50 text-[9px] uppercase tracking-wider">
        <span className="text-slate-600">Campo</span>
        <span className="text-slate-500 text-right">Diário (atual)</span>
        <span className="w-3" />
        <span className="text-slate-400">Corretora</span>
      </div>

      {/* Divergences */}
      <div className="mb-3">
        {comparison.divergences.map((d, i) => (
          <DivergenceRow key={i} divergence={d} />
        ))}
      </div>

      {/* State feedback */}
      {state === 'accepted' && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mb-2">
          <CheckCircle className="w-3 h-3" />
          Mantido como está
        </div>
      )}
      {state === 'enriched' && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 mb-2">
          <CheckCircle className="w-3 h-3" />
          Enriquecido com dados da corretora
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400 mb-2">
          <XCircle className="w-3 h-3" />
          Erro ao atualizar
        </div>
      )}

      {/* Actions */}
      {!state && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Mantém o trade atual do diário sem alterações"
          >
            <Check className="w-3 h-3" />
            Manter manual
          </button>
          <button
            onClick={onEnrich}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] bg-blue-600/80 hover:bg-blue-500 text-white rounded border border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Aplica parciais, stop e preços exatos da corretora ao trade existente, preservando emoção e setup."
          >
            <RefreshCw className="w-3 h-3" />
            Aceitar enriquecimento
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN
// ============================================

/**
 * @param {Object} props
 * @param {Array} props.confrontData — { divergent: [], converged: [] } (output de prepareConfrontBatch)
 * @param {Function} props.onAccept — async (item) => void (dismissal client-side)
 * @param {Function} props.onEnrich — async (item) => Promise<{ success, error }>
 */
const MatchedOperationsPanel = ({ confrontData, onAccept, onEnrich }) => {
  const [itemStates, setItemStates] = useState({}); // { [operationId]: 'accepted' | 'enriched' | 'error' }
  const [busy, setBusy] = useState(false);

  const handleAccept = useCallback(async (item) => {
    const opId = item.operation.operationId;
    if (onAccept) await onAccept(item);
    setItemStates(prev => ({ ...prev, [opId]: 'accepted' }));
  }, [onAccept]);

  const handleEnrich = useCallback(async (item) => {
    const opId = item.operation.operationId;
    setBusy(true);
    try {
      const result = await onEnrich(item);
      if (result?.success) {
        setItemStates(prev => ({ ...prev, [opId]: 'enriched' }));
      } else {
        setItemStates(prev => ({ ...prev, [opId]: 'error' }));
      }
    } catch (err) {
      console.error('[MatchedOperationsPanel] Erro enriquecendo trade:', err);
      setItemStates(prev => ({ ...prev, [opId]: 'error' }));
    } finally {
      setBusy(false);
    }
  }, [onEnrich]);

  if (!confrontData || (confrontData.divergent.length === 0 && confrontData.converged.length === 0)) {
    return null;
  }

  const { divergent, converged } = confrontData;

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/20">
        <h3 className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
          <GitCompare className="w-3.5 h-3.5 text-amber-400" />
          Modo Confronto — {divergent.length} divergênci{divergent.length === 1 ? 'a' : 'as'} vs diário
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">
          Operações correlacionadas com trades do diário, mas com campos divergentes.
          Compare lado a lado e decida caso a caso.
        </p>

        {converged.length > 0 && (
          <div className="mb-3 p-2 rounded bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-emerald-300">
              {converged.length} operaç{converged.length === 1 ? 'ão' : 'ões'} alinhad{converged.length === 1 ? 'a' : 'as'} perfeitamente com o diário
            </span>
          </div>
        )}

        {divergent.length === 0 && (
          <p className="text-[10px] text-slate-500 text-center py-2">
            Nenhuma divergência detectada.
          </p>
        )}

        {divergent.length > 0 && (
          <div className="space-y-2">
            {divergent.map((item) => (
              <OperationCard
                key={item.operation.operationId}
                item={item}
                state={itemStates[item.operation.operationId]}
                onAccept={() => handleAccept(item)}
                onEnrich={() => handleEnrich(item)}
                disabled={busy || !!itemStates[item.operation.operationId]}
              />
            ))}
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 justify-center py-2 mt-2 text-[10px] text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enriquecendo trade...
          </div>
        )}

        <p className="text-[10px] text-slate-600 mt-3 text-center">
          "Aceitar enriquecimento" atualiza o trade existente com parciais, stop e preços exatos
          da corretora. PL e compliance são recalculados via Cloud Functions. Emoção e setup
          são preservados.
        </p>
      </div>
      <DebugBadge component="MatchedOperationsPanel" />
    </div>
  );
};

export default MatchedOperationsPanel;
