/**
 * DashboardHeader
 * @version 2.0.0 (v1.41.0)
 * @description Header do StudentDashboard: título + botões de ação.
 *   v2.0.0: #164 review — remove AccountFilterBar (redundante com ContextBar #118,
 *           que é o seletor unificado de Conta/Plano/Ciclo/Período).
 *   v1.0.0: Extraído do StudentDashboard para modularização.
 */

import { PlusCircle, Filter, Upload } from 'lucide-react';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} props
 * @param {Object|null} viewAs
 * @param {boolean} showFilters
 * @param {Function} onToggleFilters
 * @param {Function} onNewTrade
 * @param {Function} onCsvImport
 * @param {Function} onOrderImport
 */
const DashboardHeader = ({
  viewAs,
  showFilters,
  onToggleFilters,
  onNewTrade,
  onCsvImport,
  onOrderImport,
}) => {
  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
            {viewAs ? `Dashboard de ${viewAs.name || viewAs.email}` : 'Meu Dashboard'}
          </h1>
          <p className="text-slate-400 mt-1">
            {viewAs ? 'Visualização do mentor' : 'Acompanhe sua performance de trading'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onToggleFilters} className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}>
            <Filter className="w-4 h-4" /> Filtros
          </button>
          {!viewAs && (
            <>
              <button onClick={onCsvImport} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50 hover:bg-amber-500/20 text-xs font-bold text-amber-400 hover:text-amber-300 transition-all">
                <Upload className="w-3.5 h-3.5" /> Importar Performance
              </button>
              <button onClick={onOrderImport} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50 hover:bg-blue-500/20 text-xs font-bold text-blue-400 hover:text-blue-300 transition-all">
                <Upload className="w-3.5 h-3.5" /> Importar Ordens
              </button>
              <button onClick={onNewTrade} className="btn-primary flex items-center gap-2">
                <PlusCircle className="w-5 h-5" /> Novo Trade
              </button>
            </>
          )}
        </div>
      </div>
      <DebugBadge component="DashboardHeader" embedded />
    </div>
  );
};

export default DashboardHeader;
