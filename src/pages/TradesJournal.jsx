/**
 * TradesJournal
 * @see version.js para versão do produto
 * @description Diário de trades com navegação para FeedbackPage
 * 
 * CHANGELOG (produto):
 * - 1.10.0: Ordenação crescente (mais antigo primeiro), plans passado para TradesList
 * - 1.6.0: Suporte a parciais via AddTradeModal
 * - 1.4.0: Adicionado suporte a onNavigateToFeedback
 */

import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, FlaskConical, Filter } from 'lucide-react';
import Filters from '../components/Filters';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import AddTradeModal from '../components/AddTradeModal';
import AccountFilterBar from '../components/AccountFilterBar';
import Loading from '../components/Loading';
import DebugBadge from '../components/DebugBadge';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useSetups } from '../hooks/useSetups';
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

const TradesJournal = ({ onNavigateToFeedback }) => {
  // Hooks
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade, getPartials } = useTrades();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { plans, loading: plansLoading } = usePlans();
  const { setups, loading: setupsLoading } = useSetups();

  // Estados
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  
  // Filtro de contas — mesmo padrão do StudentDashboard via AccountFilterBar
  const [accountTypeFilter, setAccountTypeFilter] = useState('real');
  
  // Filtros
  const [filters, setFilters] = useState({ 
    period: 'all', ticker: 'all', accountId: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' 
  });

  // Contas filtradas por tipo (all/real/demo)
  const filteredAccountsByType = useMemo(() => {
    if (accountTypeFilter === 'real') return accounts.filter(isRealAccount);
    if (accountTypeFilter === 'demo') return accounts.filter(isDemoAccount);
    return accounts;
  }, [accounts, accountTypeFilter]);

  // IDs das contas selecionadas
  const selectedAccountIds = useMemo(() => {
    if (filters.accountId === 'all') return filteredAccountsByType.map(a => a.id);
    return [filters.accountId];
  }, [filteredAccountsByType, filters.accountId]);

  const availableTickers = useMemo(() => {
    const accountTrades = trades.filter(t => selectedAccountIds.includes(t.accountId));
    const unique = new Set(accountTrades.map(t => t.ticker).filter(Boolean));
    return Array.from(unique).sort();
  }, [trades, selectedAccountIds]);

  const filteredTrades = useMemo(() => {
    if (selectedAccountIds.length === 0) return [];
    let result = trades.filter(t => selectedAccountIds.includes(t.accountId));
    
    if (filters.period !== 'all' && filters.period !== 'custom') result = filterTradesByPeriod(result, filters.period);
    else if (filters.period === 'custom') result = filterTradesByDateRange(result, filters.startDate, filters.endDate);
    
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.exchange !== 'all') result = result.filter(t => t.exchange === filters.exchange);
    if (filters.result === 'wins') result = result.filter(t => t.result > 0);
    else if (filters.result === 'losses') result = result.filter(t => t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    
    // Ordenação crescente: mais antigo primeiro
    result.sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = (a.entryTime || '').localeCompare(b.entryTime || '');
      if (timeCompare !== 0) return timeCompare;
      // Fallback: createdAt (Firestore timestamp)
      const aTs = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
      const bTs = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
      return aTs - bTs;
    });

    return result;
  }, [trades, filters, selectedAccountIds]);

  const isDemoView = useMemo(() => {
    if (accountTypeFilter === 'demo') return true;
    if (accountTypeFilter === 'real') return false;
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc ? isDemoAccount(acc) : false;
    }
    return accounts.every(isDemoAccount);
  }, [accountTypeFilter, filters.accountId, accounts]);

  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      if (editingTrade) await updateTrade(editingTrade.id, tradeData, htfFile, ltfFile);
      else await addTrade(tradeData, htfFile, ltfFile);
      setShowAddModal(false);
      setEditingTrade(null);
    } finally { setIsSubmitting(false); }
  };

  const resetFilters = () => {
    setFilters(prev => ({ ...prev, period: 'all', ticker: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' }));
  };

  // Handler para ver conversa de feedback
  const handleViewFeedbackHistory = (trade) => {
    setViewingTrade(null); // Fecha o modal
    if (onNavigateToFeedback) {
      onNavigateToFeedback(trade);
    }
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

      {/* HEADER — AccountFilterBar (mesmo padrão do StudentDashboard) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-3">Diário de Trades</h1>
          <AccountFilterBar
            accounts={accounts}
            accountTypeFilter={accountTypeFilter}
            onAccountTypeChange={setAccountTypeFilter}
            selectedAccountId={filters.accountId}
            onAccountSelect={(id) => setFilters(prev => ({ ...prev, accountId: id }))}
          />
        </div>
        
        <div className="flex gap-3">
          <button 
             onClick={() => setShowFilters(!showFilters)}
             className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}
           >
             <Filter className="w-4 h-4" /> Filtros
           </button>
          <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> Novo Trade
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-2">
          <Filters 
            filters={filters} 
            onFilterChange={setFilters} 
            onReset={resetFilters} 
            tickers={availableTickers}
          />
        </div>
      )}

      <div className="glass-card">
        <TradesList 
          trades={filteredTrades} 
          plans={plans}
          onViewTrade={setViewingTrade} 
          onEditTrade={(t) => { setEditingTrade(t); setShowAddModal(true); }} 
          onDeleteTrade={async (trade) => { try { await deleteTrade(trade.id, trade.htfUrl, trade.ltfUrl); } catch (err) { console.error(err); } }} 
        />
        {filteredTrades.length === 0 && (
          <div className="p-8 text-center text-slate-500">Nenhum trade encontrado.</div>
        )}
      </div>

      <AddTradeModal 
        isOpen={showAddModal} 
        onClose={() => { setShowAddModal(false); setEditingTrade(null); }} 
        onSubmit={handleAddTrade} 
        editTrade={editingTrade} 
        loading={isSubmitting} 
        accounts={accounts} 
        plans={plans}       
        setups={setups}     
      />
      
      <TradeDetailModal 
        isOpen={!!viewingTrade} 
        onClose={() => setViewingTrade(null)} 
        trade={viewingTrade}
        plans={plans}
        onViewFeedbackHistory={handleViewFeedbackHistory}
        getPartials={getPartials}
      />

      <DebugBadge component="TradesJournal" />
    </div>
  );
};

export default TradesJournal;
