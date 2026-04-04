/**
 * GhostOperationsPanel.jsx
 * @version 1.0.0 (v1.1.0 — issue #93)
 * @description Modo Criação: exibe operações ghost (sem trade correspondente)
 *   e permite criar trades a partir delas via tradeGateway.createTrade.
 *
 * Campos comportamentais (emotionEntry, emotionExit, setup) ficam pendentes
 * para o aluno complementar depois.
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, Plus, CheckCircle, XCircle, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} props
 * @param {Object[]} props.ghostOperations — operações ghost (output de identifyGhostOperations)
 * @param {Object[]} props.toCreate — { operation, tradeData }[] (output de prepareBatchCreation)
 * @param {Object[]} props.duplicates — { operation, reason }[] (output de prepareBatchCreation)
 * @param {Function} props.onCreateTrades — async (tradeDataArray) => { success[], failed[] }
 * @param {boolean} props.disabled — desabilita ações durante criação
 */
const GhostOperationsPanel = ({ ghostOperations = [], toCreate = [], duplicates = [], onCreateTrades, disabled = false }) => {
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState(null); // { success: [], failed: [] }
  const [selectedOps, setSelectedOps] = useState(() => new Set(toCreate.map((_, i) => i)));

  const toggleOp = useCallback((index) => {
    setSelectedOps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedOps.size === toCreate.length) {
      setSelectedOps(new Set());
    } else {
      setSelectedOps(new Set(toCreate.map((_, i) => i)));
    }
  }, [selectedOps.size, toCreate.length]);

  const handleCreate = useCallback(async () => {
    if (!onCreateTrades || selectedOps.size === 0) return;
    setCreating(true);
    try {
      const selected = toCreate.filter((_, i) => selectedOps.has(i)).map(item => item.tradeData);
      const result = await onCreateTrades(selected);
      setResults(result);
    } catch (err) {
      setResults({ success: [], failed: [{ error: err.message }] });
    } finally {
      setCreating(false);
    }
  }, [onCreateTrades, selectedOps, toCreate]);

  if (ghostOperations.length === 0) return null;

  // Pós-criação
  if (results) {
    return (
      <div className="space-y-3">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Modo Criação — Resultado
          </h3>

          {results.success.length > 0 && (
            <div className="flex items-start gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-xs text-emerald-300">
                {results.success.length} trade{results.success.length > 1 ? 's' : ''} criado{results.success.length > 1 ? 's' : ''} com sucesso
              </span>
            </div>
          )}

          {results.failed.length > 0 && (
            <div className="space-y-1">
              {results.failed.map((f, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-red-300">{f.error}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-500 mt-3">
            Campos pendentes (emotionEntry, emotionExit, setup) podem ser preenchidos no diário de trades.
          </p>
        </div>
        <DebugBadge component="GhostOperationsPanel" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/20">
        <h3 className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Modo Criação — {ghostOperations.length} operaç{ghostOperations.length > 1 ? 'ões' : 'ão'} sem trade
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">
          Estas operações foram executadas na corretora mas não têm trade registrado.
          Selecione quais deseja criar como trades.
        </p>

        {/* Duplicates warning */}
        {duplicates.length > 0 && (
          <div className="mb-3 p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-300 font-medium mb-1">
              {duplicates.length} operaç{duplicates.length > 1 ? 'ões' : 'ão'} já possui{duplicates.length > 1 ? 'em' : ''} trade correspondente (dedup):
            </p>
            {duplicates.map((d, i) => (
              <p key={i} className="text-[10px] text-amber-400/70 pl-2">
                • {d.operation.instrument} {d.operation.side} {d.operation.totalQty}x — {d.reason}
              </p>
            ))}
          </div>
        )}

        {/* Selectable operations */}
        {toCreate.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={toggleAll}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                disabled={disabled || creating}
              >
                {selectedOps.size === toCreate.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              <span className="text-[10px] text-slate-500">
                {selectedOps.size}/{toCreate.length} selecionadas
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-3">
              {toCreate.map((item, i) => {
                const op = item.operation;
                const isLong = op.side === 'LONG';
                return (
                  <label
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedOps.has(i)
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-slate-900/50 border border-slate-700/30 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOps.has(i)}
                      onChange={() => toggleOp(i)}
                      disabled={disabled || creating}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-blue-500 focus:ring-blue-500/20"
                    />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {isLong
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      }
                      <span className="text-xs text-white font-mono truncate">
                        {op.instrument}
                      </span>
                      <span className={`text-[10px] ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
                        {op.side}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {op.totalQty}x
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-mono ${(op.resultPoints ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(op.resultPoints ?? 0) >= 0 ? '+' : ''}{(op.resultPoints ?? 0).toFixed(0)} pts
                      </span>
                      {op.entryTime && (
                        <p className="text-[9px] text-slate-600">
                          {new Date(op.entryTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={disabled || creating || selectedOps.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Criando trades...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Criar {selectedOps.size} trade{selectedOps.size > 1 ? 's' : ''}
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-600 mt-2 text-center">
              Campos emotionEntry, emotionExit e setup ficam pendentes para preenchimento no diário.
            </p>
          </>
        )}

        {toCreate.length === 0 && duplicates.length > 0 && (
          <p className="text-[10px] text-slate-500 text-center py-2">
            Todas as operações ghost já possuem trades correspondentes.
          </p>
        )}
      </div>
      <DebugBadge component="GhostOperationsPanel" />
    </div>
  );
};

export default GhostOperationsPanel;
