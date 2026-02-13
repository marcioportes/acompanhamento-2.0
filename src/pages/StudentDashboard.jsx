/**
 * StudentDashboard
 * @version 7.3.2 (UI Consistency)
 * @description Dashboard estável.
 * - FIX: Tamanho da fonte do seletor de contas ajustado para igualar ao TradesJournal (text-lg).
 * - FIX: Dropdown Options mantêm o background escuro.
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, Target, TrendingDown, PlusCircle, 
  Wallet, X, Filter, Activity, ChevronDown, Check,
  Settings, Trash2, RefreshCw, Calendar, ScrollText, 
  AlertTriangle, Skull, Trophy, TrendingUp,
  Smile, Frown, Meh 
} from 'lucide-react';

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
import PlanManagementModal from '../components/PlanManagementModal';
import PlanExtractModal from '../components/PlanExtractModal';

import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { 
  calculateStats, 
  filterTradesByPeriod, 
  filterTradesByDateRange, 
  searchTrades, 
  formatCurrency, 
  formatPercent, 
  analyzePlanCompliance 
} from '../utils/calculations';

const isRealAccount = (acc) => acc.type === 'REAL' || acc.type === 'PROP' || acc.isReal === true;
const isDemoAccount = (acc) => acc.type === 'DEMO' || acc.isReal === false || acc.isReal === undefined;

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
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (t.result || 0), 0);
};

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
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (t.result || 0), 0);
};

const MiniProgressBar = ({ current, target, isLoss }) => {
  const percentage = Math.min(Math.max((Math.abs(current) / Math.abs(target)) * 100, 0), 100);
  const barColor = isLoss ? 'bg-red-500' : 'bg-emerald-500';
  return <div className="w-full h-1.5 rounded-full mt-1.5 bg-slate-700 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentage}%` }} /></div>;
};

const StudentDashboard = () => {
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { plans, loading: plansLoading, addPlan, updatePlan, deletePlan } = usePlans();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [extractPlan, setExtractPlan] = useState(null);

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [filters, setFilters] = useState({ period: 'all', ticker: 'all', accountId: null, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });

  useEffect(() => {
    if (!accountsLoading && accounts.length > 0 && !filters.accountId) {
      const hasReal = accounts.some(isRealAccount);
      let initialAccount = accounts.some(isDemoAccount) ? 'all_demo' : (hasReal ? 'all_real' : accounts[0]?.id);
      setFilters(prev => ({ ...prev, accountId: initialAccount }));
    }
  }, [accountsLoading, accounts, filters.accountId]);

  const selectedAccounts = useMemo(() => {
    if (!filters.accountId) return [];
    if (filters.accountId === 'all_real') return accounts.filter(isRealAccount);
    if (filters.accountId === 'all_demo') return accounts.filter(isDemoAccount);
    return accounts.filter(a => a.id === filters.accountId);
  }, [accounts, filters.accountId]);

  const availablePlans = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    const accountIds = selectedAccounts.map(a => a.id);
    return plans.filter(p => accountIds.includes(p.accountId) && p.active);
  }, [selectedAccounts, plans]);

  useEffect(() => setSelectedPlanId(null), [filters.accountId]);

  const activePlan = useMemo(() => selectedPlanId ? availablePlans.find(p => p.id === selectedPlanId) : null, [selectedPlanId, availablePlans]);

  const filteredTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    const validAccountIds = selectedAccounts.map(a => a.id);
    let result = trades.filter(t => validAccountIds.includes(t.accountId));
    if (selectedPlanId) result = result.filter(t => t.planId === selectedPlanId);
    if (calendarSelectedDate) result = result.filter(t => t.date === calendarSelectedDate);
    if (filters.period !== 'all' && filters.period !== 'custom') result = filterTradesByPeriod(result, filters.period);
    else if (filters.period === 'custom') result = filterTradesByDateRange(result, filters.startDate, filters.endDate);
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    return result;
  }, [trades, filters, selectedAccounts, calendarSelectedDate, selectedPlanId]);

  const allAccountTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    if (selectedPlanId) return trades.filter(t => t.planId === selectedPlanId);
    const validAccountIds = selectedAccounts.map(a => a.id);
    return trades.filter(t => validAccountIds.includes(t.accountId));
  }, [trades, selectedAccounts, selectedPlanId]);

  const aggregatedInitialBalance = useMemo(() => selectedAccounts.reduce((sum, acc) => sum + Number(acc.initialBalance || 0), 0), [selectedAccounts]);
  const aggregatedCurrentBalance = useMemo(() => selectedAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || acc.initialBalance || 0), 0), [selectedAccounts]);
  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);
  const drawdown = useMemo(() => {
    if (aggregatedInitialBalance === 0) return 0;
    const peak = Math.max(aggregatedInitialBalance, aggregatedCurrentBalance);
    return ((peak - aggregatedCurrentBalance) / peak) * 100;
  }, [aggregatedInitialBalance, aggregatedCurrentBalance]);

  const plansToShow = useMemo(() => activePlan ? [activePlan] : availablePlans, [activePlan, availablePlans]);

  const handleAccountChange = (val) => setFilters(prev => ({ ...prev, accountId: val }));
  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try { if (editingTrade) await updateTrade(editingTrade.id, tradeData, htfFile, ltfFile); else await addTrade(tradeData, htfFile, ltfFile); setShowAddModal(false); setEditingTrade(null); } finally { setIsSubmitting(false); }
  };
  const handleSavePlan = async (planData) => {
    setIsSubmitting(true);
    try { if (editingPlan) await updatePlan(editingPlan.id, planData); else await addPlan(planData); setShowPlanModal(false); setEditingPlan(null); } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };
  const handleDeletePlan = async (e, planId) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este plano?')) { await deletePlan(planId); if (selectedPlanId === planId) setSelectedPlanId(null); }
  };
  const renderSentimentIcon = (pnl) => {
    if (pnl > 0) return <Smile className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />;
    if (pnl < 0) return <Frown className="w-6 h-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />;
    return <Meh className="w-6 h-6 text-yellow-400 opacity-90" />;
  };

  if (tradesLoading || accountsLoading || plansLoading) return <Loading fullScreen text="Carregando..." />;
  if (accounts.length === 0 && !wizardCompleted) return <AccountSetupWizard onComplete={() => setWizardCompleted(true)} />;
  const isDemoView = filters.accountId === 'all_demo' || (selectedAccounts.length === 1 && isDemoAccount(selectedAccounts[0]));

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2"><div className={`h-2 w-2 rounded-full ${isDemoView ? 'bg-amber-400' : 'bg-emerald-400'}`} /><span className="text-xs font-bold uppercase tracking-widest text-slate-400">{isDemoView ? 'Ambiente Simulado' : 'Ambiente Real'}</span></div>
          
          {/* SELETOR DE CONTA CORRIGIDO (v7.3.2) */}
          <div className="relative group inline-block">
            <select 
              value={filters.accountId || 'all_demo'} 
              onChange={(e) => handleAccountChange(e.target.value)} 
              // Classes atualizadas para igualar ao TradesJournal (text-lg, text-slate-400)
              className="appearance-none bg-transparent text-lg lg:text-xl text-slate-400 hover:text-white font-medium outline-none cursor-pointer pr-8 transition-colors border-b border-transparent hover:border-slate-600 max-w-[400px] truncate"
            >
              <optgroup label="Visão Geral" className="text-base bg-slate-900 text-slate-400">
                <option value="all_real" className="bg-slate-900 text-white">Todas as Contas Reais</option>
                <option value="all_demo" className="bg-slate-900 text-white">Todas as Contas Demo</option>
              </optgroup>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.name}
                </option>
              ))}
            </select>
            {/* Ícone reduzido para acompanhar o texto menor */}
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

        </div>
        <div className="flex gap-3"><button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}><Filter className="w-4 h-4" /> Filtros</button><button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Novo Trade</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button onClick={() => { setEditingPlan(null); setShowPlanModal(true); }} className="group relative cursor-pointer min-h-[140px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/30 transition-all"><div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors mb-2"><PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-white" /></div><span className="text-sm font-bold text-slate-400 group-hover:text-white">Criar Novo Plano</span></button>
        {availablePlans.map(plan => {
          const isSelected = selectedPlanId === plan.id;
          const planAccount = accounts.find(a => a.id === plan.accountId);
          const planTrades = trades.filter(t => t.planId === plan.id);
          const periodPnL = calculatePeriodPnL(planTrades, plan.operationPeriod);
          const cyclePnL = calculateCyclePnL(planTrades, plan.adjustmentCycle);
          const planInitialPL = Number(plan.pl) || 0;
          const totalPlanPnL = planTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
          const currentPlanBalance = planInitialPL + totalPlanPnL;
          const periodStopVal = (plan.pl * (plan.periodStop / 100));
          const periodGoalVal = (plan.pl * (plan.periodGoal / 100));
          const cycleGoalVal = (plan.pl * (plan.cycleGoal / 100));
          const cycleStopVal = (plan.pl * (plan.cycleStop / 100));
          const currentPeriodTrades = filterTradesByPeriod(planTrades, plan.operationPeriod);
          const compliance = analyzePlanCompliance(currentPeriodTrades, periodStopVal, periodGoalVal);
          const getComplianceBadge = () => {
            const { status } = compliance;
            const baseClass = "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border backdrop-blur-sm shadow-sm";
            if (status === 'LOSS_TO_GOAL') return <div className={`${baseClass} bg-amber-500/10 text-amber-400 border-amber-500/30`} title="Sorte"><Trophy className="w-3 h-3"/> Meta (Sorte)</div>;
            if (status === 'GOAL_IMPROVED') return <div className={`${baseClass} bg-amber-500/10 text-amber-400 border-amber-500/30`} title="Risco"><TrendingUp className="w-3 h-3"/> Overtrading</div>;
            if (status === 'GOAL_GAVE_BACK') return <div className={`${baseClass} bg-amber-500/10 text-amber-400 border-amber-500/30`} title="Ganância"><TrendingDown className="w-3 h-3"/> Devolveu Meta</div>;
            if (status === 'GOAL_TO_STOP') return <div className={`${baseClass} bg-red-500/10 text-red-400 border-red-500/30 animate-pulse`} title="Catástrofe"><Skull className="w-3 h-3"/> Catástrofe</div>;
            if (status === 'STOP_WORSENED' || status === 'STOP_RECOVERED') return <div className={`${baseClass} bg-red-500/10 text-red-400 border-red-500/30 animate-pulse`} title="Disciplina"><Skull className="w-3 h-3"/> Stop Violado</div>;
            if (status === 'GOAL_DISCIPLINED') return <div className={`${baseClass} bg-emerald-500/10 text-emerald-400 border-emerald-500/30`} title="Parabéns"><Check className="w-3 h-3"/> Meta Batida</div>;
            return null;
          };
          return (
            <div key={plan.id} onClick={() => setSelectedPlanId(isSelected ? null : plan.id)} className={`relative cursor-pointer transition-all duration-300 overflow-hidden rounded-2xl border group ${isSelected ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'}`}>
              <div className="absolute top-2 left-2 z-30">{getComplianceBadge()}</div>
              <div className="absolute top-2 right-2 flex gap-1 z-20"><button onClick={(e) => { e.stopPropagation(); setExtractPlan(plan); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" title="Ver Extrato"><ScrollText className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); setShowPlanModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Settings className="w-4 h-4" /></button><button onClick={(e) => handleDeletePlan(e, plan.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></div>
              {isSelected && <div className="absolute bottom-2 right-2 text-blue-400 animate-in zoom-in z-10"><Check className="w-4 h-4" /></div>}
              <div className="p-4 relative z-10 flex flex-col h-full justify-between">
                <div><div className="flex justify-between items-start mb-2 pl-8 mt-6"><div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50 shadow-inner ml-auto"><div className={!plan.active ? 'opacity-50 grayscale' : ''}>{renderSentimentIcon(periodPnL)}</div></div></div><h3 className={`font-bold truncate mb-1 pr-6 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3><p className="text-xs text-slate-500 truncate max-w-[150px]">{planAccount?.name}</p><div className="mt-3 mb-1 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50"><span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block mb-0.5">Saldo do Plano (PL)</span><div className="flex items-baseline gap-2"><span className={`text-lg font-mono font-bold ${currentPlanBalance >= planInitialPL ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(currentPlanBalance)}</span><span className={`text-xs font-mono ${totalPlanPnL >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>{totalPlanPnL >= 0 ? '+' : ''}{formatCurrency(totalPlanPnL)}</span></div></div></div>
                <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-700/50 pt-3"><div className="flex flex-col border-r border-slate-700/50 pr-2"><div className="flex justify-between items-end mb-1"><div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.operationPeriod}</span></div><span className="text-[10px] text-slate-500 font-mono">/ {periodPnL >= 0 ? formatCurrency(periodGoalVal) : `-${formatCurrency(periodStopVal)}`}</span></div><MiniProgressBar current={periodPnL} target={periodPnL >= 0 ? periodGoalVal : periodStopVal} isLoss={periodPnL < 0} /></div><div className="flex flex-col pl-2"><div className="flex justify-between items-end mb-1"><div className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.adjustmentCycle}</span></div><span className="text-[10px] text-slate-500 font-mono">/ {cyclePnL >= 0 ? formatCurrency(cycleGoalVal) : `-${formatCurrency(cycleStopVal)}`}</span></div><MiniProgressBar current={cyclePnL} target={cyclePnL >= 0 ? cycleGoalVal : cycleStopVal} isLoss={cyclePnL < 0} /></div></div></div></div>
          );
        })}
      </div>
      {showFilters && (<div className="mb-6 animate-in slide-in-from-top-2"><Filters filters={filters} onFilterChange={setFilters} onReset={() => setFilters({period: 'all', ticker: 'all', accountId: filters.accountId, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: ''})} tickers={[...new Set(filteredTrades.map(t => t.ticker))]} /></div>)}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6"><div className="glass-card p-5 relative overflow-hidden"><div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-blue-500/20"><Wallet className="w-5 h-5 text-blue-400" /></div><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Total</p><p className="text-xl lg:text-2xl font-bold text-white">{formatCurrency(aggregatedCurrentBalance)}</p></div><div className="glass-card p-5 relative overflow-hidden"><div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.totalPL >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><DollarSign className={`w-5 h-5 ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`} /></div><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">P&L Acumulado</p><p className={`text-xl lg:text-2xl font-bold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.totalPL)}</p></div><div className="glass-card p-5 relative overflow-hidden"><div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.winRate >= 50 ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}><Target className={`w-5 h-5 ${stats.winRate >= 50 ? 'text-blue-400' : 'text-amber-400'}`} /></div><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Win Rate</p><p className="text-xl lg:text-2xl font-bold text-white">{formatPercent(stats.winRate)}</p></div><div className="glass-card p-5 relative overflow-hidden"><div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.profitFactor >= 1 ? 'bg-purple-500/20' : 'bg-red-500/20'}`}><Activity className={`w-5 h-5 ${stats.profitFactor >= 1 ? 'text-purple-400' : 'text-red-400'}`} /></div><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Profit Factor</p><p className="text-xl lg:text-2xl font-bold text-white">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</p></div><div className="glass-card p-5 relative overflow-hidden"><div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${drawdown < 5 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><TrendingDown className={`w-5 h-5 ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`} /></div><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawdown</p><p className={`text-xl lg:text-2xl font-bold ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`}>-{drawdown.toFixed(1)}%</p></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"><div className="lg:col-span-2"><div className="glass-card h-[400px] w-full relative p-4">{filteredTrades.length > 0 ? (<EquityCurve trades={filteredTrades} initialBalance={aggregatedInitialBalance} />) : (<div className="h-full flex flex-col items-center justify-center text-slate-500"><Activity className="w-12 h-12 mb-2 opacity-20" /><p>Sem dados para gerar a curva.</p></div>)}</div></div><div className="lg:col-span-1"><TradingCalendar trades={filteredTrades} selectedDate={calendarSelectedDate} onSelectDate={(date) => { setCalendarSelectedDate(date === calendarSelectedDate ? null : date); if (date !== calendarSelectedDate) setTimeout(() => document.getElementById('daily-trades')?.scrollIntoView({ behavior: 'smooth' }), 100); }} /></div></div>
      {calendarSelectedDate && (<div id="daily-trades" className="mb-6 animate-in slide-in-from-top-4"><div className="glass-card border-l-4 border-blue-500 overflow-hidden"><div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30"><h3 className="font-bold text-white">📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}</h3><button onClick={() => setCalendarSelectedDate(null)} className="text-sm text-slate-400 hover:text-white flex gap-1"><X className="w-4 h-4"/> Fechar</button></div><TradesList trades={filteredTrades.filter(t => t.date === calendarSelectedDate)} onViewTrade={setViewingTrade} onEditTrade={(t) => { setEditingTrade(t); setShowAddModal(true); }} onDeleteTrade={deleteTrade} /></div></div>)}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><SwotAnalysis trades={allAccountTrades} plans={plansToShow} currentBalance={aggregatedCurrentBalance} /><SetupAnalysis trades={filteredTrades} /></div>
      <div className="mb-6"><EmotionAnalysis trades={filteredTrades} /></div>
      <AddTradeModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingTrade(null); }} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} plans={plans} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} />
      <PlanManagementModal isOpen={showPlanModal} onClose={() => { setShowPlanModal(false); setEditingPlan(null); }} onSubmit={handleSavePlan} editingPlan={editingPlan} isSubmitting={isSubmitting} />
      {extractPlan && (<PlanExtractModal isOpen={!!extractPlan} onClose={() => setExtractPlan(null)} plan={extractPlan} trades={trades.filter(t => t.planId === extractPlan.id)} />)}
    </div>
  );
};

export default StudentDashboard;