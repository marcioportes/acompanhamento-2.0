/**
 * CreationResultPanel.jsx
 * @version 1.0.0 (v1.1.0 — issue #93 redesign V1.1a)
 * @description Read-only: lista trades criados automaticamente pela importação
 *   de ordens, duplicatas ignoradas e eventuais falhas.
 *
 * Substitui o GhostOperationsPanel (que tinha seleção e botão manual).
 * No redesign, criação é automática após a confirmação no staging review —
 * este painel apenas mostra o que aconteceu.
 *
 * Sem state, sem actions. Display puro.
 */

import {
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Copy, AlertCircle,
} from 'lucide-react';
import DebugBadge from '../DebugBadge';

// ============================================
// HELPERS
// ============================================

const formatResult = (result) => {
  if (result == null) return '—';
  const sign = result > 0 ? '+' : '';
  return `${sign}${Number(result).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
};

// ============================================
// SUB-COMPONENTS
// ============================================

const TradeRow = ({ trade }) => {
  const isLong = trade.side === 'LONG';
  const isWin = trade.result != null && trade.result > 0;
  const isLoss = trade.result != null && trade.result < 0;
  const resultColor = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700/30">
      {isLong
        ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
      }
      <span className="text-xs text-white font-mono truncate flex-1">{trade.ticker}</span>
      <span className={`text-[10px] ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
        {trade.side}
      </span>
      <span className="text-[10px] text-slate-500">{trade.qty}x</span>
      <span className={`text-xs font-mono font-semibold ${resultColor} ml-2 min-w-[60px] text-right`}>
        {formatResult(trade.result)}
      </span>
    </div>
  );
};

const FailureRow = ({ failure }) => (
  <div className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <span className="text-xs text-white font-mono">{failure.ticker || '—'}</span>
      <p className="text-[10px] text-red-300 mt-0.5">{failure.error}</p>
    </div>
  </div>
);

// ============================================
// MAIN
// ============================================

/**
 * @param {Object} props
 * @param {Object} props.summary
 * @param {Array<{id, ticker, qty, side, result, operationId}>} props.summary.created
 * @param {number} props.summary.duplicates — contagem de duplicatas ignoradas
 * @param {Array<{ticker, error, operationId}>} props.summary.failed
 */
const CreationResultPanel = ({ summary }) => {
  if (!summary) return null;

  const created = summary.created || [];
  const failed = summary.failed || [];
  const duplicates = summary.duplicates || 0;

  // Nada a mostrar
  if (created.length === 0 && failed.length === 0 && duplicates === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-emerald-500/20">
        <h3 className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          {created.length > 0
            ? `${created.length} trade${created.length > 1 ? 's' : ''} criado${created.length > 1 ? 's' : ''} automaticamente`
            : 'Criação automática — resultado'
          }
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">
          Operações sem trade correspondente foram convertidas em trades no diário.
        </p>

        {/* Lista de trades criados */}
        {created.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {created.map((trade, i) => (
              <TradeRow key={trade.id || i} trade={trade} />
            ))}
          </div>
        )}

        {/* Duplicatas (contagem só) */}
        {duplicates > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
            <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-300">
              {`${duplicates} duplicata${duplicates > 1 ? 's' : ''} ignorada${duplicates > 1 ? 's' : ''} (já existia${duplicates > 1 ? 'm' : ''} como trade)`}
            </span>
          </div>
        )}

        {/* Falhas */}
        {failed.length > 0 && (
          <div className="space-y-1.5 mt-2 mb-2">
            <div className="flex items-center gap-2 text-[11px] text-red-300">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              {failed.length} falha{failed.length > 1 ? 's' : ''} ao criar trade{failed.length > 1 ? 's' : ''}:
            </div>
            {failed.map((failure, i) => (
              <FailureRow key={i} failure={failure} />
            ))}
          </div>
        )}

        {/* Footer informativo */}
        {created.length > 0 && (
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            Campos comportamentais (emoção, setup) ficam pendentes — preencha no diário.
          </p>
        )}
      </div>
      <DebugBadge component="CreationResultPanel" />
    </div>
  );
};

export default CreationResultPanel;
