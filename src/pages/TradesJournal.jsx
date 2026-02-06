import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, FlaskConical } from 'lucide-react';
import Filters from '../components/Filters';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import AddTradeModal from '../components/AddTradeModal';
import Loading from '../components/Loading';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useSetups } from '../hooks/useSetups'; // Hook de Setups
import { filterTradesByPeriod, filterTradesByDateRange, searchTrades } from '../utils/calculations';

// Helpers
const isRealAccount = (acc) => {
  if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
  return acc.isReal === true;
};

const isDemoAccount = (acc) => {
  if (acc.type) return acc.type === 'DEMO';
  return acc.isReal === false || acc.isReal === undefined;
};

const TradesJournal = () => {
  // Hooks de Dados
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { plans, loading: plansLoading } = usePlans();
  const { setups, loading: setupsLoading } = useSetups(); // Carregando setups do banco

  // Estados Locais
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filtros
  const [filters, setFilters] = useState({ 
    period: 'all', ticker: 'all', accountId: null, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' 
  });

  // Inicializa filtro de conta
  useEffect(() => {
    if (!accountsLoading && accounts.length > 0 && !filters.accountId) {
      const hasReal = accounts.some(isRealAccount);
      const hasDemo = accounts.some(isDemoAccount);
      if (hasDemo) setFilters(prev => ({ ...prev, accountId: 'all_demo' }));
      else if (hasReal) setFilters(prev => ({ ...prev, accountId: 'all_real' }));
      else setFilters(prev => ({ ...prev, accountId: accounts[0]?.id || 'all_demo' }));
    }
  }, [accountsLoading, accounts, filters.accountId]);

  // Lógica de Filtragem
  const selectedAccounts = useMemo(() => {
    if (!filters.accountId) return [];
    if (filters.accountId === 'all_real') return accounts.filter(isRealAccount);
    if (filters.accountId === 'all_demo') return accounts.filter(isDemoAccount);
    return accounts.filter(a => a.id === filters.accountId);
  }, [accounts, filters.accountId]);

  const availableTickers = useMemo(() => {
    const validAccountIds = selectedAccounts.map(a => a.id);
    const accountTrades = trades.filter(t => validAccountIds.includes(t.accountId));
    const unique = new Set(accountTrades.map(t => t.ticker).filter(Boolean));
    return Array.from(unique).sort();
  }, [trades, selectedAccounts]);

  const filteredTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    const validAccountIds = selectedAccounts.map(a => a.id);
    let result = trades.filter(t => validAccountIds.includes(t.accountId));
    
    if (filters.period !== 'all' && filters.period !== 'custom') result = filterTradesByPeriod(result, filters.period);
    else if (filters.period === 'custom') result = filterTradesByDateRange(result, filters.startDate, filters.endDate);
    
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.exchange !== 'all') result = result.filter(t => t.exchange === filters.exchange);
    if (filters.result === 'wins') result = result.filter(t => t.result > 0);
    else if (filters.result === 'losses') result = result.filter(t => t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    
    return result;
  }, [trades, filters, selectedAccounts]);

  const isDemoView = useMemo(() => {
    if (filters.accountId === 'all_demo') return true;
    if (filters.accountId === 'all_real') return false;
    if (selectedAccounts.length === 1) return isDemoAccount(selectedAccounts[0]);
    return selectedAccounts.every(isDemoAccount);
  }, [filters.accountId, selectedAccounts]);

  // Handlers
  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      if (editingTrade) await updateTrade(editingTrade.id, tradeData, htfFile, ltfFile);
      else await addTrade(tradeData, htfFile, ltfFile);
      setShowAddModal(false);
      setEditingTrade(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTrade = (trade) => {
    setEditingTrade(trade);
    setShowAddModal(true);
  };

  const handleDeleteTrade = async (trade) => {
    try { await deleteTrade(trade.id, trade.htfUrl, trade.ltfUrl); } 
    catch (err) { console.error(err); }
  };

  const resetFilters = () => {
    setFilters(prev => ({ ...prev, period: 'all', ticker: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' }));
  };

  if (tradesLoading || accountsLoading || plansLoading || setupsLoading) {
    return <Loading fullScreen text="Carregando trades..." />;
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      {isDemoView && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-2 text-center text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 -mx-6 lg:-mx-8 -mt-6 lg:-mt-8 flex items-center justify-center gap-2">
          <FlaskConical className="w-4 h-4" /> Ambiente Simulado - Resultados não auditados
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Diário de Trades</h1>
          <p className="text-slate-400">
            Histórico operacional completo
            {selectedAccounts.length === 1 && <span className="text-blue-400 ml-2">• {selectedAccounts[0].name}</span>}
            {selectedAccounts.length > 1 && <span className="text-slate-500 ml-2">• {selectedAccounts.length} contas</span>}
          </p>
        </div>
        <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" /> Novo Trade
        </button>
      </div>

      <div className="mb-6">
        <Filters 
          filters={filters} 
          onFilterChange={setFilters} 
          onReset={resetFilters} 
          tickers={availableTickers}
          accounts={accounts}
          plans={plans}
        />
      </div>

      <div className="glass-card">
        <TradesList 
          trades={filteredTrades} 
          onViewTrade={setViewingTrade} 
          onEditTrade={handleEditTrade} 
          onDeleteTrade={handleDeleteTrade} 
        />
        {filteredTrades.length === 0 && (
          <div className="p-8 text-center text-slate-500">Nenhum trade encontrado.</div>
        )}
      </div>

      {/* MODAL PRINCIPAL */}
      <AddTradeModal 
        isOpen={showAddModal} 
        onClose={() => { setShowAddModal(false); setEditingTrade(null); }} 
        onSubmit={handleAddTrade} 
        editTrade={editingTrade} 
        loading={isSubmitting} 
        accounts={accounts} // Passando contas (para pegar nomes)
        plans={plans}       // Passando planos (para o dropdown principal)
        setups={setups}     // Passando setups (para o dropdown de contexto)
      />
      
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} />
    </div>
  );
};

export default TradesJournal;
