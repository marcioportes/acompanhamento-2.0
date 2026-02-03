import { useState, useMemo } from 'react';
import { DollarSign, Target, TrendingUp, Award, PlusCircle, Wallet, X } from 'lucide-react';
import StatCard from '../components/StatCard';
import TradingCalendar from '../components/TradingCalendar';
import SetupAnalysis from '../components/SetupAnalysis';
import EquityCurve from '../components/EquityCurve';
import EmotionAnalysis from '../components/EmotionAnalysis';
import TradesList from '../components/TradesList';
import AddTradeModal from '../components/AddTradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import AccountSetupWizard from '../components/AccountSetupWizard';
import Loading from '../components/Loading';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { calculateStats, formatCurrency, formatPercent } from '../utils/calculations';

const StudentDashboard = () => {
  const { user } = useAuth();
  // RESTAURADO: updateTrade e deleteTrade para a lista do calendário funcionar
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades();
  const { accounts, loading: accountsLoading, getActiveAccount } = useAccounts();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null); // RESTAURADO
  const [viewingTrade, setViewingTrade] = useState(null); // RESTAURADO
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

  const hasAccounts = accounts.length > 0;
  const activeAccount = getActiveAccount();
  const stats = useMemo(() => calculateStats(trades), [trades]);

  // Handler Unificado (Criar e Editar)
  const handleSaveTrade = async (tradeData, htfFile, ltfFile) => {
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

  const handleDateSelect = (date) => {
    setCalendarSelectedDate(date === calendarSelectedDate ? null : date);
    if (date !== calendarSelectedDate) {
      setTimeout(() => document.getElementById('daily-trades')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  if (tradesLoading || accountsLoading) return <Loading fullScreen text="Carregando..." />;

  if (!hasAccounts) {
    if (showWizard) return <AccountSetupWizard onComplete={() => setShowWizard(false)} />;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><Wallet className="w-10 h-10 text-blue-400" /></div>
          <h1 className="text-2xl font-bold text-white mb-4">Bem-vindo!</h1>
          <button onClick={() => setShowWizard(true)} className="btn-primary py-3 px-8">Criar Conta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Olá, {user?.displayName || 'Trader'}! 👋</h1>
          <p className="text-slate-400">Visão Geral {activeAccount && `• ${activeAccount.name}`}</p>
        </div>
        <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" /> Novo Trade
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="P&L Total" value={formatCurrency(stats.totalPL)} icon={DollarSign} color={stats.totalPL >= 0 ? 'green' : 'red'} />
        <StatCard title="Win Rate" value={formatPercent(stats.winRate)} icon={Target} color={stats.winRate >= 50 ? 'green' : 'red'} subtitle={`${stats.totalTrades} trades`} />
        <StatCard title="Profit Factor" value={stats.profitFactor.toFixed(2)} icon={TrendingUp} color={stats.profitFactor >= 1 ? 'green' : 'red'} />
        <StatCard title="Avg Win" value={formatCurrency(stats.avgWin)} icon={Award} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch">
        <div className="glass-card w-full h-full min-h-[420px]"><EquityCurve trades={trades} /></div>
        <div className="w-full h-full"><TradingCalendar trades={trades} selectedDate={calendarSelectedDate} onSelectDate={handleDateSelect} /></div>
      </div>

      {/* Drill-Down do Calendário (Agora com Ações) */}
      {calendarSelectedDate && (
        <div id="daily-trades" className="mb-8 animate-in slide-in-from-top-4">
          <div className="glass-card border-l-4 border-blue-500 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="font-bold text-white">📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}</h3>
              <button onClick={() => setCalendarSelectedDate(null)} className="text-sm text-slate-400 hover:text-white flex gap-1"><X className="w-4 h-4"/> Fechar</button>
            </div>
            {/* Agora passamos os handlers reais para funcionar a edição */}
            <TradesList 
              trades={trades.filter(t => t.date === calendarSelectedDate)} 
              onViewTrade={setViewingTrade} 
              onEditTrade={handleEditTrade} 
              onDeleteTrade={handleDeleteTrade}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SetupAnalysis trades={trades} />
        <EmotionAnalysis trades={trades} />
      </div>

      <AddTradeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleSaveTrade} editTrade={editingTrade} loading={isSubmitting} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} />
    </div>
  );
};

export default StudentDashboard;