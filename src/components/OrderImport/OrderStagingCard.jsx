/**
 * OrderStagingCard
 * @version 1.0.0 (v1.83.15 — issue #366)
 * @description Card compacto de importação de ordens não finalizada.
 *
 * Espelha `csv/CsvImportCard` (CHUNK-07). Antes do #366 o rascunho de ordens era
 * invisível: `useOrderStaging.stagingBatches` existia e não tinha um único leitor,
 * então um lote abandonado ficava no banco sem que ninguém pudesse ver nem limpar.
 */

import { FileClock, ChevronRight } from 'lucide-react';

const OrderStagingCard = ({ totalCount = 0, batchCount = 0, onClick }) => {
  if (totalCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all group"
    >
      <FileClock className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-bold text-white">
        Importação não finalizada
      </span>
      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
        {totalCount} {totalCount === 1 ? 'ordem' : 'ordens'}
        {batchCount > 1 ? ` · ${batchCount} lotes` : ''}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
    </button>
  );
};

export default OrderStagingCard;
