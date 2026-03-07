/**
 * DashboardHeader
 * @version 1.0.0 (v1.15.0)
 * @description Header do StudentDashboard: título, botões, AccountFilterBar, card informativo.
 *   Extraído do StudentDashboard para modularização.
 */

import { PlusCircle, Filter, Wallet, Upload, FolderPlus } from 'lucide-react';
import AccountFilterBar from '../AccountFilterBar';
import { formatCurrencyDynamic } from '../../utils/currency';
import { isRealAccount } from '../../utils/planCalculations';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} props
 * @param {Object|null} viewAs
 * @param {boolean} showFilters
 * @param {Function} onToggleFilters
 * @param {Function} onNewTrade
 * @param {Array} accounts
 * @param {string} accountTypeFilter
 * @param {Function} onAccountTypeChange
 * @param {string} selectedAccountId
 * @param {Function} onAccountSelect
 * @param {Array} filteredAccountsByType
 * @param {number} aggregatedCurrentBalance
 * @param {string|null} dominantCurrency
 * @param {Map} balancesByCurrency
 */
const DashboardHeader = ({
  viewAs,
  showFilters,
  onToggleFilters,
  onNewTrade,
  onCsvImport,
  onCreatePlan,
  accounts,
  accountTypeFilter,
  onAccountTypeChange,
  selectedAccountId,
  onAccountSelect,
  filteredAccountsByType,
  aggregatedCurrentBalance,
  dominantCurrency,
  balancesByCurrency,
}) => {
  return (
    <div className="flex flex-col gap-4">
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
                <Upload className="w-3.5 h-3.5" /> Importar CSV
              </button>
              <button onClick={onNewTrade} className="btn-primary flex items-center gap-2">
                <PlusCircle className="w-5 h-5" /> Novo Trade
              </button>
            </>
          )}
        </div>
      </div>

      <AccountFilterBar
        accounts={accounts}
        accountTypeFilter={accountTypeFilter}
        onAccountTypeChange={onAccountTypeChange}
        selectedAccountId={selectedAccountId}
        onAccountSelect={onAccountSelect}
      />

      {/* Card informativo: contas incluídas na seleção — v1.15.0: multi-moeda */}
      {selectedAccountId === 'all' && filteredAccountsByType.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-700/30 text-xs text-slate-400 flex-wrap">
          {!viewAs && (
            <button onClick={onCreatePlan} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50 hover:bg-blue-500/20 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-all mr-1">
              <FolderPlus className="w-3 h-3" /> Novo Plano
            </button>
          )}
          <Wallet className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-slate-500 font-medium">
            {accountTypeFilter === 'real' ? 'Reais:' : accountTypeFilter === 'demo' ? 'Demo:' : 'Contas:'}
          </span>
          {filteredAccountsByType.map((acc, i) => (
            <span key={acc.id} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isRealAccount(acc) ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <span className="text-slate-300">{acc.name}</span>
              {i < filteredAccountsByType.length - 1 && <span className="text-slate-600">·</span>}
            </span>
          ))}
          <span className="ml-auto font-mono text-slate-300 flex gap-2">
            {dominantCurrency ? (
              formatCurrencyDynamic(aggregatedCurrentBalance, dominantCurrency)
            ) : (
              [...balancesByCurrency.entries()].map(([cur, data]) => (
                <span key={cur}>{formatCurrencyDynamic(data.current, cur)}</span>
              ))
            )}
          </span>
        </div>
      )}
      <DebugBadge component="DashboardHeader" />
    </div>
  );
};

export default DashboardHeader;
