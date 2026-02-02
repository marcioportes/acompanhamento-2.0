import { useState, useMemo } from 'react';
import { DollarSign, Target, TrendingUp, Award, PlusCircle, Wallet } from 'lucide-react';
import StatCard from '../components/StatCard';
import CalendarHeatmap from '../components/CalendarHeatmap';
import SetupAnalysis from '../components/SetupAnalysis';
import EquityCurve from '../components/EquityCurve';
import EmotionAnalysis from '../components/EmotionAnalysis';
import TradesList from '../components/TradesList';
import AddTradeModal from '../components/AddTradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import Filters from '../components/Filters';
import AccountSetupWizard from '../components/AccountSetupWizard';
import Loading from '../components/Loading';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { calculateStats, filterTradesByPeriod, filterTradesByDateRange, searchTrades, formatCurrency, formatPercent } from '../utils/calculations';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades();
  const { accounts, loading: accountsLoading, getActiveAccount } = useAccounts();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({ period: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });
  const [showWizard, setShowWizard] = useState(false);

  // Verificar se tem contas (depois do loading)
  const hasAccounts = accounts.length > 0;
  const activeAccount = getActiveAccount();

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

  const handleWizardComplete = () => {
    setShowWizard(false);
    // O componente vai re-renderizar e mostrar o dashboard normal
  };

  // Loading
  if (tradesLoading || accountsLoading) {
    return <Loading fullScreen text="Carregando dados..." />;
  }

  // Se não tem conta, mostrar wizard ou botão para criar
  if (!hasAccounts) {
    if (showWizard) {
      return <AccountSetupWizard onComplete={handleWizardComplete} />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            Bem-vindo ao Journal! 🚀
          </h1>
          <p className="text-slate-400 mb-8">
            Para começar a registrar seus trades, você precisa criar uma conta de trading.
            Vamos configurar tudo em poucos passos!
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="btn-primary py-3 px-8"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Criar Minha Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
            Olá, {user?.displayName || user?.email?.split('@')[0]}! 👋
          </h1>
          <p className="text-slate-400 mt-1">
            Acompanhe sua evolução como trader
            {activeAccount && (
              <span className="ml-2 text-sm bg-slate-800/50 px-2 py-1 rounded-lg">
                Conta: {activeAccount.name}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" />
          Novo Trade
        </button>
      </div>

      {/* Info da Conta */}
      {activeAccount && (
        <div className="glass-card p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Saldo Atual</p>
              <p className={`text-xl font-bold ${activeAccount.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(activeAccount.currentBalance || 0)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Saldo Inicial</p>
            <p className="text-white font-medium">{formatCurrency(activeAccount.initialBalance || 0)}</p>
          </div>
        </div>
      )}

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
