/**
 * AdjustmentModal.jsx
 * @version 1.0.0 (v1.37.0 — issue #156 Fase E)
 * @description Modal de ajuste fino para `match_confident`. Mostra diff campo a
 *   campo entre o trade existente e os valores reconstruídos das ordens, e
 *   permite ao aluno escolher "usar novo" / "manter atual" / editar valor por
 *   campo antes de enriquecer.
 *
 * Campos considerados: entry, exit, qty, stopLoss.
 *
 * Trade ausente → versão simplificada (apenas valores novos editáveis),
 * conforme degradação graciosa descrita no spec Fase E §2.
 *
 * Props:
 *   operation: Object      — operação reconstruída (avgEntryPrice, avgExitPrice, totalQty, stopOrders)
 *   trade:     Object|null — trade atual carregado pelo caller (null = modo simplificado)
 *   onConfirm: ({ finalFields }) => void — finalFields = { entry, exit, qty, stopLoss }
 *   onCancel:  () => void
 */

import { useMemo, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import DebugBadge from '../DebugBadge';

const FIELDS = [
  { key: 'entry', label: 'Entrada' },
  { key: 'exit', label: 'Saída' },
  { key: 'qty', label: 'Quantidade' },
  { key: 'stopLoss', label: 'Stop Loss' },
];

const MODE = {
  NEW: 'new',
  CURRENT: 'current',
  EDIT: 'edit',
};

const normalize = (val) => {
  if (val == null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

const formatVal = (v) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('pt-BR');
};

const deriveNewStopLoss = (op) => {
  if (op?.hasStopProtection && op?.stopOrders?.length > 0) {
    const lastStop = op.stopOrders[op.stopOrders.length - 1];
    const parsed = parseFloat(lastStop.stopPrice ?? lastStop.price);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const AdjustmentModal = ({ operation, trade, onConfirm, onCancel }) => {
  const isSimplified = !trade;

  const newValues = useMemo(
    () => ({
      entry: normalize(operation?.avgEntryPrice),
      exit: normalize(operation?.avgExitPrice),
      qty: normalize(operation?.totalQty),
      stopLoss: deriveNewStopLoss(operation),
    }),
    [operation]
  );

  const currentValues = useMemo(
    () => ({
      entry: normalize(trade?.entry),
      exit: normalize(trade?.exit),
      qty: normalize(trade?.qty),
      stopLoss: normalize(trade?.stopLoss),
    }),
    [trade]
  );

  // Estado: por campo, modo escolhido e valor editado (quando mode=edit).
  const [state, setState] = useState(() => {
    const initial = {};
    for (const { key } of FIELDS) {
      initial[key] = {
        mode: MODE.NEW,
        editValue: newValues[key] != null ? String(newValues[key]) : '',
      };
    }
    return initial;
  });

  const setMode = (key, mode) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        mode,
        editValue:
          mode === MODE.EDIT
            ? (prev[key].editValue || (newValues[key] != null ? String(newValues[key]) : ''))
            : prev[key].editValue,
      },
    }));
  };

  const setEditValue = (key, val) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], editValue: val } }));
  };

  const handleConfirm = () => {
    const finalFields = {};
    for (const { key } of FIELDS) {
      const { mode, editValue } = state[key];
      if (mode === MODE.CURRENT && !isSimplified) {
        finalFields[key] = currentValues[key];
      } else if (mode === MODE.EDIT) {
        finalFields[key] = normalize(editValue);
      } else {
        finalFields[key] = newValues[key];
      }
    }
    onConfirm({ finalFields });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="adjustment-modal"
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Ajustar campos antes de enriquecer
              </h3>
              <p className="text-[11px] text-slate-500">
                {operation?.instrument || '—'} · {operation?.side || '—'} · {operation?.totalQty ?? '—'}×
                {isSimplified && ' · Trade não carregado — modo simplificado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — diff table */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {isSimplified
              ? 'Ajuste os valores novos antes de enriquecer. Os campos comportamentais do trade (emoção, setup, feedback) são preservados.'
              : 'Por campo, escolha: usar o valor novo das ordens, manter o atual do trade, ou editar. Campos comportamentais (emoção, setup, feedback) são sempre preservados.'}
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-800/50">
            <table className="w-full text-xs" data-testid="adjustment-diff-table">
              <thead className="bg-slate-800/60 text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Campo</th>
                  {!isSimplified && <th className="text-right px-3 py-2 font-medium">Atual</th>}
                  <th className="text-right px-3 py-2 font-medium">Novo (ordens)</th>
                  <th className="text-left px-3 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(({ key, label }) => {
                  const row = state[key];
                  const newVal = newValues[key];
                  const currentVal = currentValues[key];
                  const divergent = !isSimplified && normalize(currentVal) !== normalize(newVal);

                  return (
                    <tr
                      key={key}
                      className={`border-t border-slate-800/50 ${divergent ? 'bg-amber-500/5' : ''}`}
                      data-testid={`adjustment-row-${key}`}
                    >
                      <td className="px-3 py-2 text-slate-200">{label}</td>
                      {!isSimplified && (
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">
                          {formatVal(currentVal)}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-blue-300 font-mono">
                        {formatVal(newVal)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setMode(key, MODE.NEW)}
                            className={`px-2 py-1 rounded text-[10px] transition-colors ${
                              row.mode === MODE.NEW
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40'
                                : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                            }`}
                            data-testid={`mode-new-${key}`}
                          >
                            Usar novo
                          </button>
                          {!isSimplified && (
                            <button
                              type="button"
                              onClick={() => setMode(key, MODE.CURRENT)}
                              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                                row.mode === MODE.CURRENT
                                  ? 'bg-slate-500/20 text-slate-100 border border-slate-500/40'
                                  : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                              }`}
                              data-testid={`mode-current-${key}`}
                            >
                              Manter atual
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setMode(key, MODE.EDIT)}
                            className={`px-2 py-1 rounded text-[10px] transition-colors ${
                              row.mode === MODE.EDIT
                                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                            }`}
                            data-testid={`mode-edit-${key}`}
                          >
                            Editar
                          </button>
                          {row.mode === MODE.EDIT && (
                            <input
                              type="number"
                              step="any"
                              value={row.editValue}
                              onChange={(e) => setEditValue(key, e.target.value)}
                              className="ml-1 w-24 px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-100 text-[11px] font-mono focus:outline-none focus:border-emerald-500/60"
                              data-testid={`edit-input-${key}`}
                              aria-label={`Valor editado de ${label}`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800/50 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium rounded-lg transition-colors"
            data-testid="confirm-adjustment"
          >
            Confirmar ajuste
          </button>
        </div>

        <DebugBadge component="AdjustmentModal" embedded />
      </div>
    </div>
  );
};

export default AdjustmentModal;
