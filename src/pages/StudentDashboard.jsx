/**
 * StudentDashboard
 * @version 5.7.0 (Final UI Polish)
 * @description Dashboard com sinalização visual semântica (Cores de Tráfego) para Emoções e Resultados.
 * * CHANGE LOG 5.7.0:
 * - UI: Emoji de sentimento agora segue regra de cor (Verde=Gain, Vermelho=Loss, Amarelo=Neutro).
 * - UI: Badges de Compliance com cores de alto contraste para leitura rápida.
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, Target, TrendingDown, PlusCircle, 
  Wallet, X, Filter, Activity, ChevronDown, Check,
  Settings, Trash2, RefreshCw, Calendar, ScrollText, 
  AlertTriangle, Skull, Trophy, TrendingUp
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
import PlanProgress from '../components/PlanProgress';
import PlanManagementModal from '../components/PlanManagementModal';
import PlanExtractModal from '../components/PlanExtractModal';

import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { calculateStats, filterTradesByPeriod, filterTradesByDateRange, formatCurrency, formatPercent, analyzePlanCompliance } from '../utils/calculations';

// Helpers
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
  const [filters, setFilters] = useState({ 
    period: 'all', ticker: 'all', accountId: null, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' 
  });

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

  const activePlan = useMemo(() => 
    selectedPlanId ? availablePlans.find(p => p.id === selectedPlanId) : null, 
  [selectedPlanId, availablePlans]);

  const filteredTrades = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    
    const validAccountIds = selectedAccounts.map(a => a.id);
    let result = trades.filter(t => validAccountIds.includes(t.accountId));

    if (selectedPlanId) {
       result = result.filter(t => t.planId === selectedPlanId);
    }

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

  const plansToShow = useMemo(() => {
    if (activePlan) return [activePlan];
    return availablePlans;
  }, [activePlan, availablePlans]);

  const handleAccountChange = (val) => setFilters(prev => ({ ...prev, accountId: val }));
  
  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      if (editingTrade) await updateTrade(editingTrade.id, tradeData, htfFile, ltfFile);
      else await addTrade(tradeData, htfFile, ltfFile);
      setShowAddModal(false); setEditingTrade(null);
    } finally { setIsSubmitting(false); }
  };

  const handleSavePlan = async (planData) => {
    setIsSubmitting(true);
    try {
      if (editingPlan) await updatePlan(editingPlan.id, planData);
      else await addPlan(planData);
      setShowPlanModal(false); setEditingPlan(null);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleDeletePlan = async (e, planId) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este plano?')) {
      await deletePlan(planId);
      if (selectedPlanId === planId) setSelectedPlanId(null);
    }
  };

  // Helper de Sentimento (Emoji)
  const getPlanSentiment = (pnl) => {
    if (pnl > 0) return '😊';
    if (pnl < 0) return '😟';
    return '😐';
  };

  // Helper de Cor do Sentimento (Novo Requisito)
  const getSentimentClass = (pnl) => {
    if (pnl > 0) return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'; // Verde + Glow
    if (pnl < 0) return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';     // Vermelho + Glow
    return 'text-yellow-400 opacity-90';                                              // Amarelo
  };

  if (tradesLoading || accountsLoading || plansLoading) return <Loading fullScreen text="Carregando..." />;
  if (accounts.length === 0 && !wizardCompleted) return <AccountSetupWizard onComplete={() => setWizardCompleted(true)} />;

  const isDemoView = filters.accountId === 'all_demo' || (selectedAccounts.length === 1 && isDemoAccount(selectedAccounts[0]));

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-2 w-2 rounded-full ${isDemoView ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {isDemoView ? 'Ambiente Simulado' : 'Ambiente Real'}
            </span>
          </div>
          <div className="relative group">
            <select
              value={filters.accountId || 'all_demo'}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="appearance-none bg-transparent text-3xl lg:text-4xl font-display font-bold text-white outline-none cursor-pointer pr-10 hover:text-blue-400 transition-colors w-full max-w-[400px] truncate"
            >
              <optgroup label="Visão Geral" className="text-base bg-slate-900 text-slate-400"><option value="all_real">Todas as Contas Reais</option><option value="all_demo">Todas as Contas Demo</option></optgroup>
              {accounts.map(acc => <option key={acc.id} value={acc.id} className="text-white bg-slate-900">{acc.name}</option>)}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}><Filter className="w-4 h-4" /> Filtros</button>
          <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Novo Trade</button>
        </div>
      </div>

      {/* ÁREA DE PLANOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button 
          onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}
          className="group relative cursor-pointer min-h-[140px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/30 transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors mb-2">
            <PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-400 group-hover:text-white">Criar Novo Plano</span>
        </button>

        {availablePlans.map(plan => {
          const isSelected = selectedPlanId === plan.id;
          const planAccount = accounts.find(a => a.id === plan.accountId);
          
          const planTrades = trades.filter(t => t.planId === plan.id);
          const periodPnL = calculatePeriodPnL(planTrades, plan.operationPeriod);
          const cyclePnL = calculateCyclePnL(planTrades, plan.adjustmentCycle);
          
          // Dados Visuais
          const sentiment = getPlanSentiment(periodPnL);
          const sentimentClass = getSentimentClass(periodPnL);

          // AUDITORIA (Compliance)
          const periodStopVal = (plan.pl * (plan.periodStop / 100));
          const periodGoalVal = (plan.pl * (plan.periodGoal / 100));
          const currentPeriodTrades = filterTradesByPeriod(planTrades, plan.operationPeriod);
          const compliance = analyzePlanCompliance(currentPeriodTrades, periodStopVal, periodGoalVal);

          // Renderização de Badges
          const getComplianceBadge = () => {
            const { status } = compliance;
            
            // Vitória com Alerta (Amarelo/Laranja)
            if (status === 'LOSS_TO_GOAL') {
              return <div className="badge-warning flex items-center gap-1" title="Sorte: Atingiu meta após estourar stop"><Trophy className="w-3 h-3"/> Meta (Sorte)</div>;
            }
            if (status === 'GOAL_IMPROVED') {
              return <div className="badge-warning flex items-center gap-1" title="Risco: Continuou operando após bater a meta"><TrendingUp className="w-3 h-3"/> Overtrading</div>;
            }
            if (status === 'GOAL_GAVE_BACK') {
              return <div className="badge-warning flex items-center gap-1" title="Ganância: Devolveu parte do lucro da meta"><TrendingDown className="w-3 h-3"/> Devolveu Meta</div>;
            }

            // Derrota/Perigo (Vermelho)
            if (status === 'GOAL_TO_STOP') {
              return <div className="badge-critical flex items-center gap-1" title="Catástrofe: Bateu meta e entregou tudo até o stop"><Skull className="w-3 h-3"/> Catástrofe</div>;
            }
            if (status === 'STOP_WORSENED' || status === 'STOP_RECOVERED') {
              return <div className="badge-critical flex items-center gap-1" title="Disciplina: Continuou operando após o stop"><Skull className="w-3 h-3"/> Stop Violado</div>;
            }

            // Sucesso Limpo (Verde)
            if (status === 'GOAL_DISCIPLINED') {
              return <div className="badge-success flex items-center gap-1" title="Parabéns: Meta batida e parou"><Check className="w-3 h-3"/> Meta Batida</div>;
            }

            return null;
          };

          return (
            <div 
              key={plan.id}
              onClick={() => setSelectedPlanId(isSelected ? null : plan.id)}
              className={`
                relative cursor-pointer transition-all duration-300 overflow-hidden rounded-2xl border group
                ${isSelected 
                  ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'}
              `}
            >
              {/* BADGE DE COMPLIANCE */}
              <div className="absolute top-2 left-2 z-30">
                {getComplianceBadge()}
              </div>

              {/* Action Bar */}
              <div className="absolute top-2 right-2 flex gap-1 z-20">
                 <button 
                  onClick={(e) => { e.stopPropagation(); setExtractPlan(plan); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" 
                  title="Ver Extrato e Auditoria"
                 >
                   <ScrollText className="w-4 h-4" />
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); setShowPlanModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Settings className="w-4 h-4" /></button>
                 <button onClick={(e) => handleDeletePlan(e, plan.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
              </div>
              
              {isSelected && <div className="absolute bottom-2 right-2 text-blue-400 animate-in zoom-in z-10"><Check className="w-4 h-4" /></div>}
              
              <div className="p-4 relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className={`flex justify-between items-start mb-2 pl-8 ${compliance.status !== 'NORMAL' ? 'mt-6' : ''}`}>
                    {/* EMOJI COLORIDO */}
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50 text-2xl shadow-inner ml-auto">
                      <span className={`${!plan.active ? 'opacity-50 grayscale' : sentimentClass}`} title="Sentimento Atual">{sentiment}</span>
                    </div>
                  </div>
                  <h3 className={`font-bold truncate mb-1 pr-6 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[150px]">{planAccount?.name}</p>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-700/50 pt-3">
                  <div className="flex flex-col border-r border-slate-700/50 pr-2">
                    <div className="flex items-center gap-1 mb-1">
                       <Calendar className="w-3 h-3 text-slate-500" />
                       <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.operationPeriod}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${periodPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(periodPnL)}</span>
                  </div>
                  <div className="flex flex-col pl-2">
                    <div className="flex items-center gap-1 mb-1">
                       <RefreshCw className="w-3 h-3 text-slate-500" />
                       <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.adjustmentCycle}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${cyclePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(cyclePnL)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .badge-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; backdrop-filter: blur(4px); box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .badge-critical { background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; backdrop-filter: blur(4px); animation: pulse-slow 2s infinite; }
        .badge-success { background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; backdrop-filter: blur(4px); }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
      `}</style>

      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-2">
          <Filters filters={filters} onFilterChange={setFilters} onReset={() => setFilters({period: 'all', ticker: 'all', accountId: filters.accountId, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: ''})} tickers={[...new Set(filteredTrades.map(t => t.ticker))]} />
        </div>
      )}

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-blue-500/20"><Wallet className="w-5 h-5 text-blue-400" /></div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Total</p>
          <p className="text-xl lg:text-2xl font-bold text-white">{formatCurrency(aggregatedCurrentBalance)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.totalPL >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><DollarSign className={`w-5 h-5 ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`} /></div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">P&L Acumulado</p>
          <p className={`text-xl lg:text-2xl font-bold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.totalPL)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.winRate >= 50 ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}><Target className={`w-5 h-5 ${stats.winRate >= 50 ? 'text-blue-400' : 'text-amber-400'}`} /></div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Win Rate</p>
          <p className="text-xl lg:text-2xl font-bold text-white">{formatPercent(stats.winRate)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stats.profitFactor >= 1 ? 'bg-purple-500/20' : 'bg-red-500/20'}`}><Activity className={`w-5 h-5 ${stats.profitFactor >= 1 ? 'text-purple-400' : 'text-red-400'}`} /></div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Profit Factor</p>
          <p className="text-xl lg:text-2xl font-bold text-white">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${drawdown < 5 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><TrendingDown className={`w-5 h-5 ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`} /></div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawdown</p>
          <p className={`text-xl lg:text-2xl font-bold ${drawdown < 5 ? 'text-emerald-400' : 'text-red-400'}`}>-{drawdown.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 animate-in slide-in-from-left-4 flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
           {plansToShow.length > 0 ? plansToShow.map(plan => {
             const pTrades = allAccountTrades.filter(t => t.planId === plan.id);
             const pPeriodPnL = calculatePeriodPnL(pTrades, plan.operationPeriod);
             const pCyclePnL = calculateCyclePnL(pTrades, plan.adjustmentCycle);
             return (
               <PlanProgress 
                  key={plan.id}
                  plan={plan}
                  periodPnL={pPeriodPnL}
                  cyclePnL={pCyclePnL}
                  currentBalance={aggregatedCurrentBalance}
               />
             );
           }) : (
             <div className="p-6 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
               Nenhum plano ativo para exibir.
             </div>
           )}
        </div>
        
        <div className="glass-card min-h-[380px] lg:col-span-2">
          <EquityCurve trades={filteredTrades} initialBalance={aggregatedInitialBalance} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TradingCalendar trades={filteredTrades} selectedDate={calendarSelectedDate} onSelectDate={(date) => { setCalendarSelectedDate(date === calendarSelectedDate ? null : date); if (date !== calendarSelectedDate) setTimeout(() => document.getElementById('daily-trades')?.scrollIntoView({ behavior: 'smooth' }), 100); }} />
        <SwotAnalysis trades={allAccountTrades} plans={plansToShow} currentBalance={aggregatedCurrentBalance} />
      </div>

      {calendarSelectedDate && (
        <div id="daily-trades" className="mb-6 animate-in slide-in-from-top-4">
          <div className="glass-card border-l-4 border-blue-500 overflow-hidden">
             <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="font-bold text-white">📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}</h3>
              <button onClick={() => setCalendarSelectedDate(null)} className="text-sm text-slate-400 hover:text-white flex gap-1"><X className="w-4 h-4"/> Fechar</button>
            </div>
            <TradesList trades={filteredTrades.filter(t => t.date === calendarSelectedDate)} onViewTrade={setViewingTrade} onEditTrade={(t) => { setEditingTrade(t); setShowAddModal(true); }} onDeleteTrade={deleteTrade} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SetupAnalysis trades={filteredTrades} />
        <EmotionAnalysis trades={filteredTrades} />
      </div>

      <AddTradeModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingTrade(null); }} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} plans={plans} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} />
      <PlanManagementModal isOpen={showPlanModal} onClose={() => { setShowPlanModal(false); setEditingPlan(null); }} onSubmit={handleSavePlan} editingPlan={editingPlan} isSubmitting={isSubmitting} />
      
      {extractPlan && (
        <PlanExtractModal 
          isOpen={!!extractPlan}
          onClose={() => setExtractPlan(null)}
          plan={extractPlan}
          trades={trades.filter(t => t.planId === extractPlan.id)}
        />
      )}
    </div>
  );
};

export default StudentDashboard;