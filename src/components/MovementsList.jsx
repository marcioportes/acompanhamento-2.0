import { useState, useMemo } from 'react';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Trash2,
  Calendar,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatDate } from '../utils/calculations';

const MovementsList = ({ 
  movements, 
  accounts = [],
  onDelete,
  showStudent = false,
  itemsPerPage = 10
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  // Filtrar movimentações
  const filteredMovements = useMemo(() => {
    return movements.filter(movement => {
      // Filtro de busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchDesc = movement.description?.toLowerCase().includes(search);
        const matchStudent = movement.studentName?.toLowerCase().includes(search);
        const account = accounts.find(acc => acc.id === movement.accountId);
        const matchAccount = account?.name?.toLowerCase().includes(search);
        if (!matchDesc && !matchStudent && !matchAccount) return false;
      }

      // Filtro de tipo
      if (filterType !== 'all' && movement.type !== filterType) return false;

      // Filtro de conta
      if (filterAccount !== 'all' && movement.accountId !== filterAccount) return false;

      return true;
    });
  }, [movements, searchTerm, filterType, filterAccount, accounts]);

  // Paginação
  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedMovements = filteredMovements.slice(startIndex, startIndex + itemsPerPage);

  // Calcular totais
  const totals = useMemo(() => {
    const deposits = filteredMovements
      .filter(m => m.type === 'DEPOSIT')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const withdrawals = filteredMovements
      .filter(m => m.type === 'WITHDRAWAL')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    return {
      deposits,
      withdrawals,
      net: deposits - withdrawals,
      count: filteredMovements.length
    };
  }, [filteredMovements]);

  const handleDelete = (movement) => {
    const typeLabel = movement.type === 'DEPOSIT' ? 'depósito' : 'saque';
    if (window.confirm(`Tem certeza que deseja excluir este ${typeLabel}? O saldo da conta será revertido automaticamente.`)) {
      onDelete?.(movement);
    }
  };

  // Encontrar conta por ID
  const getAccountName = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account?.name || 'Conta não encontrada';
  };

  // Mapear moeda para símbolo
  const getCurrencySymbol = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    switch (account?.currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  const hasActiveFilters = filterType !== 'all' || filterAccount !== 'all' || searchTerm;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterAccount('all');
  };

  if (movements.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
          <ArrowDownCircle className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Nenhuma movimentação</h3>
        <p className="text-slate-500">
          Registre depósitos e saques para acompanhar seu capital
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Depósitos</p>
              <p className="text-lg font-semibold text-emerald-400">
                +R$ {totals.deposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Saques</p>
              <p className="text-lg font-semibold text-red-400">
                -R$ {totals.withdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totals.net >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              {totals.net >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Saldo Líquido</p>
              <p className={`text-lg font-semibold ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.net >= 0 ? '+' : '-'}R$ {Math.abs(totals.net).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar movimentação..."
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

          {/* Filtro de tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full md:w-40"
          >
            <option value="all">Todos os tipos</option>
            <option value="DEPOSIT">Depósitos</option>
            <option value="WITHDRAWAL">Saques</option>
          </select>

          {/* Filtro de conta */}
          {accounts.length > 1 && (
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full md:w-48"
            >
              <option value="all">Todas as contas</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Histórico</h3>
            <span className="text-sm text-slate-500">
              {totals.count} movimentaç{totals.count !== 1 ? 'ões' : 'ão'}
            </span>
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum resultado</h3>
            <p className="text-slate-500">Tente ajustar os filtros</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-800/50">
              {displayedMovements.map((movement, index) => (
                <div 
                  key={movement.id} 
                  className="p-4 hover:bg-slate-800/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Ícone */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        movement.type === 'DEPOSIT'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {movement.type === 'DEPOSIT' ? (
                          <ArrowDownCircle className="w-6 h-6" />
                        ) : (
                          <ArrowUpCircle className="w-6 h-6" />
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            movement.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {movement.type === 'DEPOSIT' ? 'Depósito' : 'Saque'}
                          </span>
                          {showStudent && movement.studentName && (
                            <span className="text-sm text-slate-500">
                              • {movement.studentName}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            {getAccountName(movement.accountId)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(movement.date)}
                          </span>
                        </div>
                        
                        {movement.description && (
                          <p className="text-sm text-slate-400 mt-1">
                            {movement.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Valor e Ações */}
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-semibold ${
                        movement.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {movement.type === 'DEPOSIT' ? '+' : '-'}
                        {getCurrencySymbol(movement.accountId)} {movement.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>

                      {onDelete && (
                        <button
                          onClick={() => handleDelete(movement)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Excluir movimentação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800/50 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredMovements.length)} de {filteredMovements.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MovementsList;
