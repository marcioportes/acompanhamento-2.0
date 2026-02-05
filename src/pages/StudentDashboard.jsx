/**
 * StudentDashboard - Dashboard principal do aluno
 * 
 * Layout melhorado com:
 * - Cards de KPIs modernos com indicadores visuais
 * - Progresso de metas do plano (Stop/Gain)
 * - Análise SWOT automática
 * - Curva de capital e calendário
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, Target, TrendingUp, TrendingDown, Award, PlusCircle, 
  Wallet, X, FlaskConical, Filter, BarChart3, Activity
} from 'lucide-react';
import StatCard from '../components/StatCard';
import TradingCalendar from '../components/TradingCalendar';
import SetupAnalysis from '../components/SetupAnalysis';
import EquityCurve from '../components/EquityCurve';
import EmotionAnalysis from '../components/EmotionAnalysis';
import TradesList from '../components/TradesList';
import AddTradeModal from '../components/AddTradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import Filters from '../components/Filters';
import AccountSetupWizard from '../components/AccountSetupWizard';
import Loading from '../components/Loading';
import SwotAnalysis from '../components/SwotAnalysis';
import PlanProgress from '../components/PlanProgress';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext';
import { calculateStats, filterTradesByPeriod, filterTradesByDateRange, searchTrades, formatCurrency, formatPercent } from '../utils/calculations';

/**
 * Helpers para retrocompatibilidade type/isReal
 */
const isRealAccount = (acc) => {
  if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
  return acc.isReal === true;
};

const isDemoAccount = (acc) => {
  if (acc.type) return acc.type === 'DEMO';
  return acc.isReal === false || acc.isReal === undefined;
};

/**
 * Calcula P&L do período atual (dia/semana/mês baseado no plano)
 */
const calculatePeriodPnL = (trades, periodType) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let startDate;
  switch (periodType) {
    case 'Diário': startDate = startOfDay; break;
    case 'Semanal': startDate = startOfWeek; break;
    case 'Mensal': startDate = startOfMonth; break;
    default: startDate = startOfWeek;
  }

  return trades
    .filter(t => new Date(t.date) >= startDate)
    .reduce((sum, t) => sum + (t.result || 0), 0);
};

/**
 * Calcula P&L do ciclo atual (semana/mês/trimestre/ano baseado no plano)
 */
const calculateCyclePnL = (trades, cycleType) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  let startDate;
  switch (cycleType) {
    case 'Semanal': startDate = startOfWeek; break;
    case 'Mensal': startDate = startOfMonth; break;
    case 'Trimestral': startDate = startOfQuarter; break;
    case 'Anual': startDate = startOfYear; break;
    default: startDate = startOfMonth;
  }

  return trades
    .filter(t => new Date(t.date) >= startDate)
    .reduce((sum, t) => sum + (t.result || 0), 0);
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { plans, loading: plansLoading, getPlansByAccount } = usePlans();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({ 
    period: 'all', 
    ticker: 'all', 
    accountId: null,
    setup: 'all', 
    emotion: 'all', 
    exchange: 'all', 
    result: 'all', 
    search: '' 
  });

  // Ajuste inteligente do filtro inicial
  useEffect(() => {
    if (!accountsLoading && accounts.length > 0 && !filters.accountId) {
      const hasReal = accounts.some(isRealAccount);
      const hasDemo = accounts.some(isDemoAccount);
      
      if (hasDemo) {
        setFilters(prev => ({ ...prev, accountId: 'all_demo' }));
      } else if (hasReal) {
        setFilters(prev => ({ ...prev, accountId: 'all_real' }));
      } else {
        setFilters(prev => ({ ...prev, accountId: accounts[0]?.id || 'all_demo' }));
      }
    }
  }, [accountsLoading, accounts, filters.accountId]);

  const hasAccounts = accounts.length > 0;

  // Engine de dados
  const selectedAccounts = useMemo(() => {
    if (!filters.accountId) return [];
    if (filters.accountId === 'all_real') return accounts.filter(isRealAccount);
    if (filters.accountId === 'all_demo') return accounts.filter(isDemoAccount);
    return accounts.filter(a => a.id === filters.accountId);
  }, [accounts, filters.accountId]);

  const aggregatedInitialBalance = useMemo(() => {
    return selectedAccounts.reduce((sum, acc) => sum + Number(acc.initialBalance || 0), 0);
  }, [selectedAccounts]);

  const aggregatedCurrentBalance = useMemo(() => {
    return selectedAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || acc.initialBalance || 0), 0);
  }, [selectedAccounts]);

  // Plano ativo (do primeiro account selecionado)
  const activePlan = useMemo(() => {
    if (selectedAccounts.length === 0) return null;
    const accountPlans = getPlansByAccount(selectedAccounts[0].id);
    return accountPlans.length > 0 ? accountPlans[0] : null;
  }, [selectedAccounts, getPlansByAccount]);

  const filteredTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    
    const validAccountIds = selectedAccounts.map(a => a.id);
    let result = trades.filter(t => validAccountIds.includes(t.accountId));

    if (calendarSelectedDate) result = result.filter(t => t.date === calendarSelectedDate);
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
  }, [trades, filters, selectedAccounts, calendarSelectedDate]);

  // Todos os trades das contas selecionadas (sem filtros de período)
  const allAccountTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    const validAccountIds = selectedAccounts.map(a => a.id);
    return trades.filter(t => validAccountIds.includes(t.accountId));
  }, [trades, selectedAccounts]);

  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

  // P&L do período e ciclo (para PlanProgress)
  const periodPnL = useMemo(() => {
    if (!activePlan) return 0;
    return calculatePeriodPnL(allAccountTrades, activePlan.operationPeriod);
  }, [allAccountTrades, activePlan]);

  const cyclePnL = useMemo(() => {
    if (!activePlan) return 0;
    return calculateCyclePnL(allAccountTrades, activePlan.adjustmentCycle);
  }, [allAccountTrades, activePlan]);

  // Drawdown calculado
  const drawdown = useMemo(() => {
    if (aggregatedInitialBalance === 0) return 0;
    const peak = Math.max(aggregatedInitialBalance, aggregatedCurrentBalance);
    return ((peak - aggregatedCurrentBalance) / peak) * 100;
  }, [aggregatedInitialBalance, aggregatedCurrentBalance]);
  
  const isDemoView = useMemo(() => {
    if (filters.accountId === 'all_demo') return true;
    if (filters.accountId === 'all_real') return false;
    if (selectedAccounts.length === 1) return isDemoAccount(selectedAccounts[0]);
    return selectedAccounts.every(isDemoAccount);
  }, [filters.accountId, selectedAccounts]);

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
    try { 
      await deleteTrade(trade.id, trade.htfUrl, trade.ltfUrl); 
    } catch (e) {
      console.error('Erro ao deletar trade:', e);
    } 
  };
  
  const handleDateSelect = (date) => {
    setCalendarSelectedDate(date === calendarSelectedDate ? null : date);
    if (date !== calendarSelectedDate) {
      setTimeout(() => document.getElementById('daily-trades')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };
  
  const resetFilters = () => setFilters(prev => ({ 
    ...prev, 
    period: 'all', 
    ticker: 'all', 
    setup: 'all', 
    emotion: 'all', 
    result: 'all', 
    search: '' 
  }));
  
  const availableTickers = useMemo(() => {
    return Array.from(new Set(filteredTrades.map(t => t.ticker).filter(Boolean))).sort();
  }, [filteredTrades]);

  // Loading
  if (tradesLoading || accountsLoading || plansLoading) {
    return <Loading fullScreen text="Carregando dados..." />;
  }
  
  // Wizard
  if (showWizard && !wizardCompleted) {
    return (
      <AccountSetupWizard 
        onComplete={() => {
          setWizardCompleted(true);
          setShowWizard(false);
        }} 
      />
    );
  }
  
  // Sem contas
  if (!hasAccounts) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Bem-vindo ao Journal! 🚀</h1>
          <p className="text-slate-400 mb-8">Para começar, você precisa criar uma conta de trading.</p>
          <button onClick={() => setShowWizard(true)} className="btn-primary py-3 px-8">
            <PlusCircle className="w-5 h-5 mr-2" />
            Criar Minha Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      {/* Banner Demo */}
      {isDemoView && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-2 text-center text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 -mx-6 lg:-mx-8 -mt-6 lg:-mt-8 flex items-center justify-center gap-2">
          <FlaskConical className="w-4 h-4" /> Ambiente Simulado - Resultados não auditados
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
            Olá, {user?.displayName || user?.email?.split('@')[0] || 'Trader'}! 👋
          </h1>
          <p className="text-slate-400 mt-1">Painel de Performance</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}
          >
            <Filter className="w-4 h-4" /> Filtrar Resultados
          </button>
          <button 
            onClick={() => { setEditingTrade(null); setShowAddModal(true); }} 
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" /> Novo Trade
          </button>
        </div>
      </div>

      {/* Filtros (Colapsável) */}
      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-2">
          <Filters 
            filters={filters} 
            onFilterChange={setFilters} 
            onReset={resetFilters} 
            tickers={availableTickers} 
            accounts={accounts} 
          />
        </div>
      )}

      {/* KPI Cards - Layout Moderno */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* P&L Acumulado */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full" />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${stats.totalPL >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            <DollarSign className={`w-6 h-6 ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">P&L Acumulado</p>
          <p className={`text-2xl font-bold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(stats.totalPL)}
          </p>
          {aggregatedInitialBalance > 0 && (
            <p className={`text-xs mt-1 ${stats.totalPL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.totalPL >= 0 ? '+' : ''}{((stats.totalPL / aggregatedInitialBalance) * 100).toFixed(1)}%
            </p>
          )}
        </div>

        {/* Win Rate */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${stats.winRate >= 50 ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}>
            <Target className={`w-6 h-6 ${stats.winRate >= 50 ? 'text-blue-400' : 'text-amber-400'}`} />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-white">{formatPercent(stats.winRate)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.winTrades}W / {stats.lossTrades}L ({stats.totalTrades} trades)
          </p>
        </div>

        {/* Profit Factor / Kelly */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${stats.profitFactor >= 1 ? 'bg-purple-500/20' : 'bg-red-500/20'}`}>
            <Activity className={`w-6 h-6 ${stats.profitFactor >= 1 ? 'text-purple-400' : 'text-red-400'}`} />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Profit Factor</p>
          <p className="text-2xl font-bold text-white">
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </p>
          <p className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
            stats.profitFactor >= 1.5 ? 'bg-emerald-500/20 text-emerald-400' : 
            stats.profitFactor >= 1 ? 'bg-blue-500/20 text-blue-400' : 
            'bg-red-500/20 text-red-400'
          }`}>
            {stats.profitFactor >= 1.5 ? 'Excelente' : stats.profitFactor >= 1 ? 'OK' : 'Atenção'}
          </p>
        </div>

        {/* Drawdown */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-rose-500/10 to-transparent rounded-bl-full" />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${drawdown < 5 ? 'bg-emerald-500/20' : drawdown < 10 ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
            <TrendingDown className={`w-6 h-6 ${drawdown < 5 ? 'text-emerald-400' : drawdown < 10 ? 'text-amber-400' : 'text-red-400'}`} />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawdown</p>
          <p className={`text-2xl font-bold ${drawdown < 5 ? 'text-emerald-400' : drawdown < 10 ? 'text-amber-400' : 'text-red-400'}`}>
            -{drawdown.toFixed(1)}%
          </p>
          <p className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
            drawdown < 5 ? 'bg-emerald-500/20 text-emerald-400' : 
            drawdown < 10 ? 'bg-amber-500/20 text-amber-400' : 
            'bg-red-500/20 text-red-400'
          }`}>
            {drawdown < 5 ? 'OK' : drawdown < 10 ? 'Atenção' : 'Crítico'}
          </p>
        </div>
      </div>

      {/* Plan Progress + Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Plan Progress */}
        {activePlan && (
          <div className="lg:col-span-1">
            <PlanProgress 
              plan={activePlan}
              periodPnL={periodPnL}
              cyclePnL={cyclePnL}
              currentBalance={aggregatedCurrentBalance}
            />
          </div>
        )}
        
        {/* Equity Curve */}
        <div className={`glass-card min-h-[380px] ${activePlan ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <EquityCurve trades={filteredTrades} initialBalance={aggregatedInitialBalance} />
        </div>
      </div>

      {/* Calendar + SWOT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TradingCalendar 
          trades={filteredTrades} 
          selectedDate={calendarSelectedDate} 
          onSelectDate={handleDateSelect} 
        />
        
        {/* SWOT Analysis */}
        <SwotAnalysis 
          trades={allAccountTrades}
          plans={activePlan ? [activePlan] : []}
          currentBalance={aggregatedCurrentBalance}
        />
      </div>

      {/* Trades do dia selecionado */}
      {calendarSelectedDate && (
        <div id="daily-trades" className="mb-6 animate-in slide-in-from-top-4">
          <div className="glass-card border-l-4 border-blue-500 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="font-bold text-white">
                📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}
              </h3>
              <button 
                onClick={() => setCalendarSelectedDate(null)} 
                className="text-sm text-slate-400 hover:text-white flex gap-1"
              >
                <X className="w-4 h-4"/> Fechar
              </button>
            </div>
            <TradesList 
              trades={filteredTrades.filter(t => t.date === calendarSelectedDate)} 
              onViewTrade={setViewingTrade} 
              onEditTrade={handleEditTrade} 
              onDeleteTrade={handleDeleteTrade} 
            />
          </div>
        </div>
      )}

      {/* Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SetupAnalysis trades={filteredTrades} />
        <EmotionAnalysis trades={filteredTrades} />
      </div>

      {/* Modals */}
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
