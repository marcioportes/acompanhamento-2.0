/**
 * CsvImportCard
 * @version 2.0.0 (v1.18.0)
 * @description Card compacto que mostra resumo de trades em staging.
 *   Clicável para abrir o CsvImportManager modal.
 *
 * CHANGELOG:
 * - 2.0.0: Lê de useCsvStaging em vez de trades. Mostra pendingCount/readyCount.
 */

import { Package, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

const CsvImportCard = ({ totalCount = 0, pendingCount = 0, readyCount = 0, onClick }) => {
  if (totalCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all group"
    >
      <Package className="w-4 h-4 text-purple-400" />
      <span className="text-xs font-bold text-white">
        {totalCount} em staging
      </span>
      {pendingCount > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
          <AlertTriangle className="w-2.5 h-2.5" />
          {pendingCount} pendentes
        </span>
      )}
      {readyCount > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
          <CheckCircle className="w-2.5 h-2.5" />
          {readyCount} prontos
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors" />
    </button>
  );
};

export default CsvImportCard;
