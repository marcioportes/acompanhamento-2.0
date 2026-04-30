/**
 * MatchedOperationsPanel.jsx
 * @version 3.0.0 (v1.49.0 — issue #208)
 * @description Modo Confronto AUDITORIA: exibe operações correlacionadas a
 *   trades existentes lado a lado para o aluno conferir. Sem ações de aceitar/
 *   enriquecer — o enriquecimento já é aplicado automaticamente na
 *   confirmação da ConversationalReview (categoria MATCH_CONFIDENT). Este painel
 *   é apenas leitura — comparação de campos do diário vs corretora.
 *
 * Racional: ter dois pontos de "aceitar enriquecimento" (este painel + a fila
 * conversacional) gerava double-write e o erro "Trade já enriquecido por este
 * batch". Mantemos só a fila como ponto de decisão.
 */

import {
  GitCompare, ArrowRight, CheckCircle,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { DIVERGENCE_SEVERITY } from '../../utils/orderTradeComparison';

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

const OperationCard = ({ item }) => {
  const { operation, comparison } = item;
  const isLong = operation.side === 'LONG';
  const maxColor = severityColor(comparison.maxSeverity);

  return (
    <div className={`rounded-lg border p-3 bg-slate-900/50 border-${maxColor}-500/20`}>
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

      <div className="grid grid-cols-[100px_1fr_auto_1fr] gap-2 pb-1 mb-1 border-b border-slate-700/50 text-[9px] uppercase tracking-wider">
        <span className="text-slate-600">Campo</span>
        <span className="text-slate-500 text-right">Diário (anterior)</span>
        <span className="w-3" />
        <span className="text-slate-400">Corretora (aplicado)</span>
      </div>

      <div>
        {comparison.divergences.map((d, i) => (
          <DivergenceRow key={i} divergence={d} />
        ))}
      </div>
    </div>
  );
};

/**
 * @param {Object} props
 * @param {Object} props.confrontData — { divergent: [], converged: [] } (output de prepareConfrontBatch)
 */
const MatchedOperationsPanel = ({ confrontData }) => {
  if (!confrontData || (confrontData.divergent.length === 0 && confrontData.converged.length === 0)) {
    return null;
  }

  const { divergent, converged } = confrontData;
  const enrichedCount = divergent.length + converged.length;

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/20">
        <h3 className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
          <GitCompare className="w-3.5 h-3.5 text-amber-400" />
          Auditoria — {enrichedCount} trade{enrichedCount === 1 ? '' : 's'} enriquecido{enrichedCount === 1 ? '' : 's'}
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">
          Trades atualizados com parciais, stop e preços exatos da corretora.
          Emoção e setup foram preservados; PL e compliance recalculados via Cloud Functions.
        </p>

        {converged.length > 0 && (
          <div className="mb-3 p-2 rounded bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-emerald-300">
              {converged.length} operaç{converged.length === 1 ? 'ão' : 'ões'} alinhad{converged.length === 1 ? 'a' : 'as'} perfeitamente com o diário (sem mudanças)
            </span>
          </div>
        )}

        {divergent.length > 0 && (
          <div className="space-y-2">
            {divergent.map((item) => (
              <OperationCard key={item.operation.operationId} item={item} />
            ))}
          </div>
        )}
      </div>
      <DebugBadge component="MatchedOperationsPanel" />
    </div>
  );
};

export default MatchedOperationsPanel;
