/**
 * OrderPreview.jsx
 * @version 1.1.0 (v1.83.15 — issue #366)
 * @description Preview tabular de ordens parseadas antes da ingestão.
 *   Permite exclusão de linhas individuais.
 *
 * #366 — porta de entrada: as ordens que já estão em `orders` chegam aqui
 *   pré-excluídas (`duplicateIndexes`). O aluno vê quantas são e pode reincluí-las
 *   de propósito; o que não pode mais é reimportar sem saber que está reimportando.
 */

import { useState, useMemo, useEffect } from 'react';
import { Trash2, AlertTriangle, Shield, ShieldOff, Copy } from 'lucide-react';

const OrderPreview = ({
  orders,
  onExclude,
  onConfirm,
  onCancel,
  loading = false,
  duplicateIndexes = null,
}) => {
  const [excludedIndexes, setExcludedIndexes] = useState(() => new Set(duplicateIndexes || []));

  // A dedup roda contra a lista de `orders` do dashboard, que chega assíncrona: quando
  // ela aterrissa depois do parse, a seleção precisa acompanhar.
  useEffect(() => {
    setExcludedIndexes(new Set(duplicateIndexes || []));
  }, [duplicateIndexes]);

  const duplicateCount = duplicateIndexes ? duplicateIndexes.size : 0;
  const todasDuplicadas = duplicateCount > 0 && duplicateCount === orders.length;

  const toggleExclude = (idx) => {
    setExcludedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const activeOrders = useMemo(() => {
    return orders.filter((_, i) => !excludedIndexes.has(i));
  }, [orders, excludedIndexes]);

  const stats = useMemo(() => {
    const filled = activeOrders.filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED').length;
    const stops = activeOrders.filter(o => o.isStopOrder).length;
    const cancelled = activeOrders.filter(o => o.status === 'CANCELLED').length;
    return { total: activeOrders.length, filled, stops, cancelled, excluded: excludedIndexes.size };
  }, [activeOrders, excludedIndexes]);

  const reincluirDuplicadas = () => setExcludedIndexes(new Set());

  const handleConfirm = () => {
    if (onExclude) onExclude(Array.from(excludedIndexes));
    onConfirm(activeOrders);
  };

  const statusColor = (status) => {
    switch (status) {
      case 'FILLED': return 'text-emerald-400';
      case 'CANCELLED': return 'text-slate-500';
      case 'REJECTED': return 'text-red-400';
      case 'MODIFIED': return 'text-amber-400';
      case 'PARTIALLY_FILLED': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Já importadas (#366) — o import não tinha porta: reimportar era invisível */}
      {duplicateCount > 0 && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${
          todasDuplicadas
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-800/60 border-slate-700/50'
        }`}>
          <Copy className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs text-amber-200">
              {todasDuplicadas
                ? `Todas as ${duplicateCount} ordens deste arquivo já foram importadas.`
                : `${duplicateCount} de ${orders.length} ordens já foram importadas antes.`}
            </p>
            <p className="text-[11px] text-slate-400">
              {todasDuplicadas
                ? 'Não há nada novo para trazer. Se quiser reimportar mesmo assim, reinclua as ordens abaixo.'
                : 'Elas já estão marcadas para ficar de fora. As demais seguem normalmente.'}
            </p>
            <button
              onClick={reincluirDuplicadas}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Importar mesmo assim
            </button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
          {stats.total} ordens ativas
        </span>
        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
          {stats.filled} executadas
        </span>
        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">
          {stats.stops} stops
        </span>
        {stats.excluded > 0 && (
          <span className="px-2 py-1 rounded bg-red-500/10 text-red-400">
            {stats.excluded} excluídas
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400">
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left">Instrumento</th>
              <th className="px-2 py-2 text-center">Lado</th>
              <th className="px-2 py-2 text-right">Qtd</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-right">Preço</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-center">Stop?</th>
              <th className="px-2 py-2 text-left">Data/Hora</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, idx) => {
              const excluded = excludedIndexes.has(idx);
              return (
                <tr
                  key={idx}
                  className={`border-t border-slate-800/50 ${excluded ? 'opacity-30 line-through' : 'hover:bg-slate-800/30'}`}
                >
                  <td className="px-2 py-1.5 text-slate-600">{order._rowIndex ?? idx + 1}</td>
                  <td className="px-2 py-1.5 text-white font-mono">{order.instrument || '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={order.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                      {order.side || '—'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-300">{order.quantity ?? '—'}</td>
                  <td className="px-2 py-1.5 text-slate-300">{order.orderType || '—'}</td>
                  <td className="px-2 py-1.5 text-right text-slate-300 font-mono">
                    {order.filledPrice ?? order.limitPrice ?? order.stopPrice ?? '—'}
                  </td>
                  <td className={`px-2 py-1.5 ${statusColor(order.status)}`}>
                    {order.status || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {order.isStopOrder ? (
                      <Shield className="w-3.5 h-3.5 text-blue-400 inline" />
                    ) : (
                      <ShieldOff className="w-3.5 h-3.5 text-slate-600 inline" />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                    {order.submittedAt ? new Date(order.submittedAt).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => toggleExclude(idx)}
                      className="p-0.5 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors"
                      title={excluded ? 'Restaurar' : 'Excluir'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || activeOrders.length === 0}
          className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Importando...' : `Importar ${activeOrders.length} ordens`}
        </button>
      </div>
    </div>
  );
};

export default OrderPreview;
