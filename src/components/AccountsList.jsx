import { useState, useMemo } from 'react';
import { 
  Wallet, 
  PlusCircle, 
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Building2,
  ChevronDown,
  X
} from 'lucide-react';
import AccountCard from './AccountCard';
import { ACCOUNT_TYPES } from '../firebase';

const AccountsList = ({ 
  accounts, 
  onAddAccount,
  onEditAccount, 
  onDeleteAccount, 
  onSetActiveAccount,
  showStudent = false,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterBroker, setFilterBroker] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Extrair lista única de corretoras
  const brokers = useMemo(() => {
    const brokerSet = new Set(accounts.map(acc => acc.broker).filter(Boolean));
    return Array.from(brokerSet).sort();
  }, [accounts]);

  // Filtrar contas
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      // Filtro de busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = account.name?.toLowerCase().includes(search);
        const matchBroker = account.broker?.toLowerCase().includes(search);
        const matchStudent = account.studentName?.toLowerCase().includes(search);
        if (!matchName && !matchBroker && !matchStudent) return false;
      }

      // Filtro de tipo
      if (filterType !== 'all' && account.type !== filterType) return false;

      // Filtro de corretora
      if (filterBroker !== 'all' && account.broker !== filterBroker) return false;

      return true;
    });
  }, [accounts, searchTerm, filterType, filterBroker]);

  // Calcular totais
  const totals = useMemo(() => {
    const totalInitial = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
    const totalCurrent = accounts.reduce((sum, acc) => sum + (acc.currentBalance || acc.initialBalance || 0), 0);
    const variation = totalCurrent - totalInitial;
    const variationPercent = totalInitial > 0 ? (variation / totalInitial) * 100 : 0;
    
    return {
      totalInitial,
      totalCurrent,
      variation,
      variationPercent,
      activeCount: accounts.filter(a => a.active).length,
      totalCount: accounts.length
    };
  }, [accounts]);

  // Separar conta ativa das outras
  const activeAccount = filteredAccounts.find(acc => acc.active);
  const otherAccounts = filteredAccounts.filter(acc => !acc.active);

  const hasActiveFilters = filterType !== 'all' || filterBroker !== 'all' || searchTerm;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterBroker('all');
  };

  if (loading) {
    return (
      <div className="glass-card p-8">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="ml-3 text-slate-400">Carregando contas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com totais */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                Contas de Trading
              </h2>
              <p className="text-sm text-slate-500">
                {totals.totalCount} conta{totals.totalCount !== 1 ? 's' : ''} cadastrada{totals.totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {onAddAccount && (
            <button
              onClick={onAddAccount}
              className="btn-primary"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Nova Conta
            </button>
          )}
        </div>

        {/* Stats Cards */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Capital Total Inicial</p>
              <p className="text-lg font-semibold text-white">
                R$ {totals.totalInitial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Capital Total Atual</p>
              <p className="text-lg font-semibold text-white">
                R$ {totals.totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Variação Total</p>
              <div className="flex items-center gap-2">
                {totals.variation >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <p className={`text-lg font-semibold ${totals.variation >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.variation >= 0 ? '+' : ''}R$ {Math.abs(totals.variation).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Rentabilidade</p>
              <div className="flex items-center gap-2">
                {totals.variationPercent >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <p className={`text-lg font-semibold ${totals.variationPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.variationPercent >= 0 ? '+' : ''}{totals.variationPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtros e Busca */}
      {accounts.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar conta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Toggle Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Filtros Expandidos */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800/50">
              {/* Filtro por Tipo */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tipo</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full"
                >
                  <option value="all">Todos os tipos</option>
                  {ACCOUNT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type === 'REAL' ? 'Real' : type === 'DEMO' ? 'Demo' : 'Prop Firm'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Corretora */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Corretora</label>
                <select
                  value={filterBroker}
                  onChange={(e) => setFilterBroker(e.target.value)}
                  className="w-full"
                >
                  <option value="all">Todas as corretoras</option>
                  {brokers.map(broker => (
                    <option key={broker} value={broker}>{broker}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de Contas */}
      {accounts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
            <Wallet className="w-10 h-10 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhuma conta cadastrada
          </h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Adicione sua primeira conta de trading para começar a acompanhar seu desempenho e registrar trades.
          </p>
          {onAddAccount && (
            <button onClick={onAddAccount} className="btn-primary">
              <PlusCircle className="w-4 h-4 mr-2" />
              Criar Primeira Conta
            </button>
          )}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Nenhuma conta encontrada
          </h3>
          <p className="text-slate-500">
            Tente ajustar os filtros ou a busca
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Conta Ativa */}
          {activeAccount && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Conta Ativa
              </h3>
              <AccountCard
                account={activeAccount}
                onEdit={onEditAccount}
                onDelete={onDeleteAccount}
                onSetActive={onSetActiveAccount}
                showStudent={showStudent}
              />
            </div>
          )}

          {/* Outras Contas */}
          {otherAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {activeAccount ? 'Outras Contas' : 'Suas Contas'}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {otherAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <AccountCard
                      account={account}
                      onEdit={onEditAccount}
                      onDelete={onDeleteAccount}
                      onSetActive={onSetActiveAccount}
                      showStudent={showStudent}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountsList;
