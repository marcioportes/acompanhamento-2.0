/**
 * PendingReflections (issue #327)
 * @description Card no dashboard do aluno listando trades FECHADOS ainda sem
 *              auto-análise (`selfReview`) — importados (CSV/Order) ou pulados no
 *              registro. Cobra o hábito de refletir todo trade (#325 follow-up 2b).
 *
 * Regras de visibilidade:
 *   - Item = trade com `result != null` (fechado) e SEM `selfReview`.
 *   - Respeita o filtro de plano da ContextBar (planId) quando definido.
 *   - Sem pendência → retorna null. Suprimido em View-As (mentor não reflete pelo aluno).
 *   - Clicar num item abre o TradeDetailModal (onOpenTrade), onde o Espelho fica editável.
 */

import { useMemo } from 'react';
import { Eye, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';

const fmtDateBR = (date) => (date ? String(date).split('-').reverse().join('/') : '-');

const PendingReflections = ({ trades = [], planId = null, onOpenTrade = null }) => {
  const pending = useMemo(() => {
    const list = Array.isArray(trades) ? trades : [];
    return list
      .filter((t) => t && t.result != null && !t.selfReview)
      .filter((t) => !planId || t.planId === planId)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [trades, planId]);

  if (pending.length === 0) return null;

  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-amber-500/10 rounded-lg">
          <Eye className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Trades a refletir</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
          {pending.length} {pending.length === 1 ? 'trade' : 'trades'}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-2.5">
        Fechados sem sua auto-análise. Refletir sobre cada trade é parte do processo — abra e olhe no espelho.
      </p>
      <div className="border border-slate-800 rounded-lg bg-slate-900/40 p-2">
        <div className="space-y-0.5">
          {pending.map((trade) => {
            const result = Number(trade.result) || 0;
            const win = result > 0;
            return (
              <button
                key={trade.id}
                onClick={() => onOpenTrade && onOpenTrade(trade)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-800/50 group text-left transition-colors"
              >
                <span className="text-[11px] text-slate-500 tabular-nums shrink-0 w-14">{fmtDateBR(trade.date)}</span>
                <span className="flex-1 text-[13px] text-slate-200 font-medium truncate">
                  {trade.symbol || trade.ticker || '—'}
                </span>
                <span className={`text-[13px] tabular-nums shrink-0 ${win ? 'text-emerald-400' : 'text-red-400'}`}>
                  {win ? '+' : ''}{formatCurrency(result, trade.currency)}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PendingReflections;
