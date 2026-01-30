import { useState, useMemo } from 'react';
import { DollarSign, Target, TrendingUp, Award, PlusCircle, BarChart3 } from 'lucide-react';
import StatCard from '../components/StatCard';
import CalendarHeatmap from '../components/CalendarHeatmap';
import SetupAnalysis from '../components/SetupAnalysis';
import EquityCurve from '../components/EquityCurve';
import EmotionAnalysis from '../components/EmotionAnalysis';
import TradesList from '../components/TradesList';
import AddTradeModal from '../components/AddTradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import Filters from '../components/Filters';
import { useTrades } from '../hooks/useTrades';
import { useAuth } from '../contexts/AuthContext';
import { calculateStats, filterTradesByPeriod, filterTradesByDateRange, searchTrades, formatCurrency, formatPercent } from '../utils/calculations';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { trades, loading, addTrade, updateTrade, deleteTrade } = useTrades();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({ period: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });

  // Aplicar filtros
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // Filtro por período
    if (filters.period !== 'all' && filters.period !== 'custom') {
      result = filterTradesByPeriod(result, filters.period);
    } else if (filters.period === 'custom') {
      result = filterTradesByDateRange(result, filters.startDate, filters.endDate);
    }
    
    // Filtro por setup
    if (filters.setup !== 'all') {
      result = result.filter(t => t.setup === filters.setup);
    }
    
    // Filtro por emoção
    if (filters.emotion !== 'all') {
      result = result.filter(t => t.emotion === filters.emotion);
    }
    
    // Filtro por bolsa
    if (filters.exchange !== 'all') {
      result = result.filter(t => t.exchange === filters.exchange);
    }
    
    // Filtro por resultado
    if (filters.result === 'wins') {
      result = result.filter(t => t.result > 0);
    } else if (filters.result === 'losses') {
      result = result.filter(t => t.result < 0);
    }
    
    // Busca
    if (filters.search) {
      result = searchTrades(result, filters.search);
    }
    
    return result;
  }, [trades, filters]);

  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

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
      console.error('Error deleting trade:', err);
    }
  };

  const resetFilters = () => {
    setFilters({ period: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
            Olá, {user?.displayName || user?.email?.split('@')[0]}! 👋
          </h1>
          <p className="text-slate-400 mt-1">Acompanhe sua evolução como trader</p>
        </div>
        <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" />
          Novo Trade
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="P&L Total"
          value={formatCurrency(stats.totalPL)}
          icon={DollarSign}
          color={stats.totalPL >= 0 ? 'green' : 'red'}
          trend={stats.totalPL >= 0 ? 'up' : 'down'}
          trendValue={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard
          title="Win Rate"
          value={formatPercent(stats.winRate)}
          icon={Target}
          color={stats.winRate >= 50 ? 'green' : 'red'}
          subtitle={`${stats.totalTrades} trades`}
        />
        <StatCard
          title="Profit Factor"
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          icon={TrendingUp}
          color={stats.profitFactor >= 1 ? 'green' : 'red'}
          subtitle={stats.profitFactor >= 1 ? 'Positivo' : 'Negativo'}
        />
        <StatCard
          title="Avg Win / Loss"
          value={`${formatCurrency(stats.avgWin)}`}
          subtitle={`Perda: ${formatCurrency(stats.avgLoss)}`}
          icon={Award}
          color="blue"
        />
      </div>

      {/* Filtros */}
      <div className="mb-6">
        <Filters filters={filters} onFilterChange={setFilters} onReset={resetFilters} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <EquityCurve trades={filteredTrades} />
        <CalendarHeatmap trades={filteredTrades} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SetupAnalysis trades={filteredTrades} />
        <EmotionAnalysis trades={filteredTrades} />
      </div>

      {/* Trades List */}
      <TradesList
        trades={filteredTrades}
        onViewTrade={setViewingTrade}
        onEditTrade={handleEditTrade}
        onDeleteTrade={handleDeleteTrade}
      />

      {/* Modais */}
      <AddTradeModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingTrade(null); }}
        onSubmit={handleAddTrade}
        editTrade={editingTrade}
        loading={isSubmitting}
      />

      <TradeDetailModal
        isOpen={!!viewingTrade}
        onClose={() => setViewingTrade(null)}
        trade={viewingTrade}
      />
    </div>
  );
};

export default StudentDashboard;
