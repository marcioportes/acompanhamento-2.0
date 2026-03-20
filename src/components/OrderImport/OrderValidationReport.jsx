/**
 * OrderValidationReport.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Relatório de validação de ordens — erros e warnings das 3 camadas.
 */

import { AlertTriangle, XCircle, Info } from 'lucide-react';

const OrderValidationReport = ({ validationResult, parseErrors = [] }) => {
  if (!validationResult && !parseErrors.length) return null;

  const { invalidOrders = [], batchWarnings = [], stats = {} } = validationResult || {};
  const hasErrors = invalidOrders.length > 0 || parseErrors.length > 0;
  const hasWarnings = batchWarnings.length > 0;

  if (!hasErrors && !hasWarnings) return null;

  return (
    <div className="space-y-3">
      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-300">
              {parseErrors.length} erro(s) de parsing
            </span>
          </div>
          <ul className="space-y-1">
            {parseErrors.slice(0, 10).map((err, i) => (
              <li key={i} className="text-xs text-red-300/80">
                Linha {err.row}: {err.message}
              </li>
            ))}
            {parseErrors.length > 10 && (
              <li className="text-xs text-red-300/60">
                ... e mais {parseErrors.length - 10} erro(s)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Validation errors */}
      {invalidOrders.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-300">
              {invalidOrders.length} ordem(ns) inválida(s) (removidas automaticamente)
            </span>
          </div>
          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
            {invalidOrders.slice(0, 10).map((item, i) => (
              <li key={i} className="text-xs text-red-300/80">
                <span className="text-slate-500">Linha {item.order?._rowIndex ?? '?'}:</span>{' '}
                {item.errors.join('; ')}
              </li>
            ))}
            {invalidOrders.length > 10 && (
              <li className="text-xs text-red-300/60">
                ... e mais {invalidOrders.length - 10} inválida(s)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Batch warnings */}
      {hasWarnings && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">Avisos</span>
          </div>
          <ul className="space-y-1">
            {batchWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-300/80">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {stats.total > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          <span>
            {stats.valid} de {stats.total} ordens válidas
            {stats.warnings > 0 && ` (${stats.warnings} com avisos)`}
          </span>
        </div>
      )}
    </div>
  );
};

export default OrderValidationReport;
