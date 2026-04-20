/**
 * AmbiguousOperationsPanel.jsx
 * @version 1.0.0 (v1.1.0 — issue #93 redesign V1.1b Fase 5)
 * @deprecated desde v1.37.0 (issue #156 Fase C) — substituído pelo
 *   `ConversationalOpCard` classe `ambiguous`, que expõe seleção por rádio +
 *   descarte por operação. Mantido apenas para retrocompatibilidade (tela DONE
 *   legada fora do fluxo conversacional). Não é mais renderizado pelo
 *   `OrderImportPage` — remover em limpeza futura após verificar callers externos.
 *
 * Sem state, sem actions. Display puro.
 */

import { AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} props
 * @param {Array<{ operation: Object, tradeIds: string[] }>} props.ops
 */
const AmbiguousOperationsPanel = ({ ops = [] }) => {
  if (!ops?.length) return null;

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/30">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          {ops.length} operaç{ops.length === 1 ? 'ão' : 'ões'} ambígu{ops.length === 1 ? 'a' : 'as'}
        </h3>
        <p className="text-[11px] text-slate-400 mb-3">
          {ops.length === 1 ? 'Esta operação correlaciona' : 'Estas operações correlacionam'} com
          múltiplos trades do diário. Nenhuma ação automática foi tomada. Para resolver, edite os
          trades no diário e refaça a importação, ou abra suporte.
        </p>

        <div className="space-y-1.5">
          {ops.map((item, i) => {
            const op = item.operation;
            const isLong = op.side === 'LONG';
            return (
              <div key={op.operationId || i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700/30">
                {isLong
                  ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                }
                <span className="text-xs text-white font-mono">{op.instrument}</span>
                <span className={`text-[10px] ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
                  {op.side}
                </span>
                <span className="text-[10px] text-slate-500">{op.totalQty}x</span>
                <span className="ml-auto text-[10px] text-amber-300">
                  {item.tradeIds.length} trades correlacionados
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <DebugBadge component="AmbiguousOperationsPanel" />
    </div>
  );
};

export default AmbiguousOperationsPanel;
