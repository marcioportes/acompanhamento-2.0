import { useState, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import Filters from '../components/Filters';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import AddTradeModal from '../components/AddTradeModal';
import { useTrades } from '../hooks/useTrades';
import { filterTradesByPeriod, filterTradesByDateRange, searchTrades } from '../utils/calculations';

/**
 * Página: Diário de Trades (Journal)
 * Responsável pela listagem, filtro e gestão detalhada (CRUD) dos trades.
 */
const TradesJournal = () => {
  const { trades, addTrade, updateTrade, deleteTrade } = useTrades();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [filters, setFilters] = useState({ 
    period: 'all', ticker: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' 
  });

  const availableTickers = useMemo(() => {
    const unique = new Set(trades.map(t => t.ticker).filter(Boolean));
    return Array.from(unique).sort();
  }, [trades]);

  const filteredTrades = useMemo(() => {
    let result = [...trades];
    if (filters.period !== 'all' && filters.period !== 'custom') {
      result = filterTradesByPeriod(result, filters.period);
    } else if (filters.period === 'custom') {
      result = filterTradesByDateRange(result, filters.startDate, filters.endDate);
    }
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.exchange !== 'all') result = result.filter(t => t.exchange === filters.exchange);
    if (filters.result === 'wins') result = result.filter(t => t.result > 0);
    else if (filters.result === 'losses') result = result.filter(t => t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    return result;
  }, [trades, filters]);

  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      if (editingTrade) {
        await updateTrade(editingTrade.id, tradeData, htfFile, ltfFile);
      } else {
        await addTrade(tradeData, htfFile, ltfFile);
      }
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
    try {
      await deleteTrade(trade.id, trade.htfUrl, trade.ltfUrl);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Diário de Trades</h1>
          <p className="text-slate-400">Histórico operacional completo</p>
        </div>
        <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" /> Novo Trade
        </button>
      </div>

      <div className="mb-6">
        <Filters filters={filters} onFilterChange={setFilters} onReset={() => setFilters({ period: 'all', ticker: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' })} tickers={availableTickers} />
      </div>

      {/* REMOVIDO: pb-48 e min-h fixo exagerado. Agora o layout é natural. */}
      <div className="glass-card">
        <TradesList 
          trades={filteredTrades} 
          onViewTrade={setViewingTrade} 
          onEditTrade={handleEditTrade} 
          onDeleteTrade={handleDeleteTrade} 
        />
        
        {filteredTrades.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Nenhum trade encontrado.
          </div>
        )}
      </div>

      <AddTradeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} />
    </div>
  );
};

export default TradesJournal;