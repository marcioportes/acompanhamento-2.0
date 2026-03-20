/**
 * OrderCorrelation.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Visualização de resultados da correlação ordem↔trade.
 *   Mostra matches, ghost orders e estatísticas.
 */

import { Link, Unlink, CheckCircle } from 'lucide-react';

const ConfidenceBadge = ({ confidence }) => {
  const color = confidence >= 0.8 ? 'emerald' : confidence >= 0.5 ? 'amber' : 'red';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
};

const OrderCorrelation = ({ correlations, stats }) => {
  if (!correlations?.length) return null;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Link className="w-3 h-3 inline mr-1" />
          {stats.matched} correlacionadas
        </span>
        {stats.ghost > 0 && (
          <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            <Unlink className="w-3 h-3 inline mr-1" />
            {stats.ghost} ghost orders
          </span>
        )}
        {stats.avgConfidence > 0 && (
          <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
            Confiança média: {(stats.avgConfidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Ghost orders list (most important for mentor) */}
      {stats.ghost > 0 && (
        <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/10">
          <p className="text-xs text-red-300 font-semibold mb-2">
            Ghost Orders — Ordens sem trade registrado
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {correlations.filter(c => c.matchType === 'ghost').slice(0, 20).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <Unlink className="w-3 h-3 text-red-400 shrink-0" />
                <span className="font-mono">{c.instrument || '?'}</span>
                <span className="text-slate-600">—</span>
                <span className="text-slate-500">{c.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary note for mentor */}
      {stats.ghost > stats.total * 0.1 && (
        <p className="text-xs text-amber-300/80 italic">
          Nota: {((stats.ghost / stats.total) * 100).toFixed(0)}% das ordens executadas não têm trade correspondente.
          Isso pode indicar sub-registro ou trades fora do período importado.
        </p>
      )}
    </div>
  );
};

export default OrderCorrelation;
