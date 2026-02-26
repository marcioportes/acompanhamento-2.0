/**
 * StudentDashboard
 * @version 1.2.0
 * @description Dashboard com filtro master de conta, View As Student, extrato emocional
 * 
 * CHANGELOG:
 * - 1.2.0: PlanLedgerExtract (extrato emocional) substituindo PlanExtractModal no ícone — Fase 1.5.0
 * - 1.1.0: Filtro master de conta (AccountFilterBar) — tipo + individual, cascata para planos/trades/saldo
 * - 1.0.8: Fix navegação para histórico de feedback (botão "Ver conversa")
 * - 1.0.7: Fix: Card de Plano exibe saldo verde se > 0
 * - 1.0.6: View As Student suporte
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
import AccountFilterBar from '../components/AccountFilterBar';
import Loading from '../components/Loading';
import SwotAnalysis from '../components/SwotAnalysis';
import PlanManagementModal from '../components/PlanManagementModal';
import PlanExtractModal from '../components/PlanExtractModal';
import PlanLedgerExtract from '../components/PlanLedgerExtract';
import DebugBadge from '../components/DebugBadge';

import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext'; // Garantindo import explícito
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
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (Number(t.result) || 0), 0);
};

const calculateCyclePnL = (trades, cycleType) => {
  const now = new Date();
  let startDate;
  switch (cycleType) {
    case 'Semanal': 
      startDate = new Date(now); 
      startDate.setDate(now.getDate() - now.getDay()); 
      startDate.setHours(0, 0, 0, 0); 
      break;
    case 'Mensal': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'Trimestral': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
    default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (Number(t.result) || 0), 0);
};

const MiniProgressBar = ({ current, target, isLoss }) => {
  const percent = Math.min(Math.abs(current) / target * 100, 100);
  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-500 ${isLoss ? 'bg-red-500' : 'bg-emerald-500'}`} 
        style={{ width: `${percent}%` }} 
      />
    </div>
  );
};

const renderSentimentIcon = (pnl) => {
  if (pnl > 0) return <Smile className="w-5 h-5 text-emerald-400" />;
  if (pnl < 0) return <Frown className="w-5 h-5 text-red-400" />;
  return <Meh className="w-5 h-5 text-slate-400" />;
};

/**
 * @param {Object} viewAs - Dados do aluno sendo visualizado (quando mentor usa View As)
 * { uid, email, name }
 * @param {Function} onNavigateToFeedback - Callback para navegar para a tela de feedback
 */
const StudentDashboard = ({ viewAs = null, onNavigateToFeedback }) => {
  const { user } = useAuth(); // Hooks adicionados para consistência se não vier via prop
  
  // Determina o ID do aluno alvo para override dos hooks
  const overrideStudentId = viewAs?.uid || null;
  
  // Hooks COM override quando visualizando como aluno
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades(overrideStudentId);
  const { accounts, loading: accountsLoading, addAccount } = useAccounts(overrideStudentId);
  const { plans, loading: plansLoading, addPlan, updatePlan, deletePlan } = usePlans(overrideStudentId);

  const [filters, setFilters] = useState({ period: 'all', ticker: 'all', accountId: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [extractPlan, setExtractPlan] = useState(null);
  const [ledgerPlan, setLedgerPlan] = useState(null); // Extrato emocional (Fase 1.5.0)
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');

  const isLoading = tradesLoading || accountsLoading || plansLoading;

  const filteredAccountsByType = useMemo(() => {
    if (accountTypeFilter === 'real') return accounts.filter(isRealAccount);
    if (accountTypeFilter === 'demo') return accounts.filter(isDemoAccount);
    return accounts;
  }, [accounts, accountTypeFilter]);

  const selectedAccountIds = useMemo(() => {
    if (filters.accountId === 'all') return filteredAccountsByType.map(a => a.id);
    return [filters.accountId];
  }, [filteredAccountsByType, filters.accountId]);

  const allAccountTrades = useMemo(() => {
    return trades.filter(t => selectedAccountIds.includes(t.accountId));
  }, [trades, selectedAccountIds]);

  const plansToShow = useMemo(() => {
    return plans.filter(p => selectedAccountIds.includes(p.accountId));
  }, [plans, selectedAccountIds]);

  const availablePlans = useMemo(() => {
    return plansToShow.filter(p => p.active !== false);
  }, [plansToShow]);

  const filteredTrades = useMemo(() => {
    let result = allAccountTrades;
    if (selectedPlanId) result = result.filter(t => t.planId === selectedPlanId);
    if (filters.period !== 'all') result = filterTradesByPeriod(result, filters.period);
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.result !== 'all') result = result.filter(t => filters.result === 'win' ? t.result > 0 : t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    return result;
  }, [allAccountTrades, selectedPlanId, filters]);

  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

  const aggregatedInitialBalance = useMemo(() => {
    // Se plano selecionado, usa a conta vinculada ao plano
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        const acc = accounts.find(a => a.id === plan.accountId);
        return acc ? (acc.initialBalance || 0) : 0;
      }
    }
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc ? (acc.initialBalance || 0) : 0;
    }
    return filteredAccountsByType.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
  }, [filteredAccountsByType, filters.accountId, accounts, selectedPlanId, plans]);

  const aggregatedCurrentBalance = useMemo(() => {
    // Se plano selecionado, usa a conta vinculada ao plano
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        const acc = accounts.find(a => a.id === plan.accountId);
        return acc ? (acc.currentBalance || acc.initialBalance || 0) : 0;
      }
    }
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc ? (acc.currentBalance || acc.initialBalance || 0) : 0;
    }
    return filteredAccountsByType.reduce((sum, acc) => sum + (acc.currentBalance || acc.initialBalance || 0), 0);
  }, [filteredAccountsByType, filters.accountId, accounts, selectedPlanId, plans]);

  const drawdown = useMemo(() => {
    if (aggregatedInitialBalance <= 0) return 0;
    const loss = Math.min(0, aggregatedCurrentBalance - aggregatedInitialBalance);
    return Math.abs(loss / aggregatedInitialBalance) * 100;
  }, [aggregatedInitialBalance, aggregatedCurrentBalance]);

  // Handler para navegar para histórico de feedback
  const handleViewFeedbackHistory = (trade) => {
    setViewingTrade(null); // Fecha o modal atual
    if (onNavigateToFeedback) {
      onNavigateToFeedback(trade); // Navega para a página de feedback
    }
  };

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
    } catch (error) {
      console.error('Erro ao salvar trade:', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePlan = async (planData) => {
    // --- VALIDAÇÃO DE SALDO (ADICIONADA) ---
    const targetAccount = accounts.find(a => a.id === planData.accountId);
    if (targetAccount) {
      const accountTotal = Number(targetAccount.currentBalance ?? targetAccount.initialBalance ?? 0);
      
      const otherActivePlans = plans.filter(p => 
        p.accountId === planData.accountId && 
        p.active && 
        p.id !== editingPlan?.id
      );
      
      const alreadyAllocated = otherActivePlans.reduce((sum, p) => sum + Number(p.pl || 0), 0);
      const availableBalance = accountTotal - alreadyAllocated;
      const requestedPL = Number(planData.pl);

      if (requestedPL > availableBalance) {
        alert(
          `Saldo insuficiente na conta!\n\n` +
          `Disponível para este Plano: ${formatCurrency(availableBalance)}\n` +
          `Você tentou alocar: ${formatCurrency(requestedPL)}\n\n` +
          `Ajuste o valor do PL ou aumente o saldo da conta.`
        );
        return;
      }
    }
    // --- FIM VALIDAÇÃO ---

    setIsSubmitting(true);
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, planData);
      } else {
        await addPlan(planData);
      }
      setShowPlanModal(false);
      setEditingPlan(null);
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (e, planId) => {
    e.stopPropagation();
    if (!confirm('Excluir este plano?')) return;
    try {
      await deletePlan(planId);
      if (selectedPlanId === planId) setSelectedPlanId(null);
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  if (isLoading) return <Loading fullScreen text="Carregando..." />;

  // Wizard apenas para aluno próprio, não para View As
  if (accounts.length === 0 && !wizardComplete && !viewAs) {
    return <AccountSetupWizard onComplete={(acc, pln) => { setWizardComplete(true); }} onAddAccount={addAccount} onAddPlan={addPlan} />;
  }

  // Se View As e não há contas
  if (viewAs && accounts.length === 0) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Wallet className="w-20 h-20 mx-auto mb-6 text-slate-600" />
          <h2 className="text-xl font-bold text-white mb-2">{viewAs.name || viewAs.email} ainda não tem contas</h2>
          <p className="text-slate-400">Este aluno ainda não configurou nenhuma conta de trading.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
              {viewAs ? `Dashboard de ${viewAs.name || viewAs.email}` : 'Meu Dashboard'}
            </h1>
            <p className="text-slate-400 mt-1">
              {viewAs ? 'Visualização do mentor' : 'Acompanhe sua performance de trading'}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-500/20 border-blue-500/50' : ''}`}>
              <Filter className="w-4 h-4" /> Filtros
            </button>
            {!viewAs && (
              <button onClick={() => { setEditingTrade(null); setShowAddModal(true); }} className="btn-primary flex items-center gap-2">
                <PlusCircle className="w-5 h-5" /> Novo Trade
              </button>
            )}
          </div>
        </div>

        {/* Filtro Master de Conta */}
        <AccountFilterBar
          accounts={accounts}
          accountTypeFilter={accountTypeFilter}
          onAccountTypeChange={setAccountTypeFilter}
          selectedAccountId={filters.accountId}
          onAccountSelect={(id) => {
            setFilters(prev => ({ ...prev, accountId: id }));
            setSelectedPlanId(null); // Reseta plano ao mudar conta
          }}
        />

        {/* Card informativo: contas incluídas na seleção */}
        {filters.accountId === 'all' && filteredAccountsByType.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-700/30 text-xs text-slate-400 flex-wrap">
            <Wallet className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-slate-500 font-medium">
              {accountTypeFilter === 'real' ? 'Reais:' : accountTypeFilter === 'demo' ? 'Demo:' : 'Contas:'}
            </span>
            {filteredAccountsByType.map((acc, i) => (
              <span key={acc.id} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isRealAccount(acc) ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <span className="text-slate-300">{acc.name}</span>
                {i < filteredAccountsByType.length - 1 && <span className="text-slate-600">·</span>}
              </span>
            ))}
            <span className="ml-auto font-mono text-slate-300">
              {formatCurrency(aggregatedCurrentBalance)}
            </span>
          </div>
        )}
      </div>

      {/* Cards de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {!viewAs && (
          <button onClick={() => { setEditingPlan(null); setShowPlanModal(true); }} className="group relative cursor-pointer min-h-[140px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/30 transition-all">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors mb-2">
              <PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-white" />
            </div>
            <span className="text-sm font-bold text-slate-400 group-hover:text-white">Criar Novo Plano</span>
          </button>
        )}
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
              <div className="absolute top-2 right-2 flex gap-1 z-20">
                <button onClick={(e) => { e.stopPropagation(); setLedgerPlan(plan); }} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100" title="Extrato Emocional"><ScrollText className="w-4 h-4" /></button>
                {!viewAs && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); setShowPlanModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Settings className="w-4 h-4" /></button>
                    <button onClick={(e) => handleDeletePlan(e, plan.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
              {isSelected && <div className="absolute bottom-2 right-2 text-blue-400 animate-in zoom-in z-10"><Check className="w-4 h-4" /></div>}
              <div className="p-4 relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 pl-8 mt-6">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50 shadow-inner ml-auto">
                      <div className={!plan.active ? 'opacity-50 grayscale' : ''}>{renderSentimentIcon(periodPnL)}</div>
                    </div>
                  </div>
                  <h3 className={`font-bold truncate mb-1 pr-6 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[150px]">{planAccount?.name}</p>
                  <div className="mt-3 mb-1 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block mb-0.5">Saldo do Plano (PL)</span>
                    <div className="flex items-baseline gap-2">
                      {/* FIX: Cor baseada em solvência (>0) e não lucro (>= initial) */}
                      <span className={`text-lg font-mono font-bold ${currentPlanBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(currentPlanBalance)}</span>
                      <span className={`text-xs font-mono ${totalPlanPnL >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>{totalPlanPnL >= 0 ? '+' : ''}{formatCurrency(totalPlanPnL)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-700/50 pt-3">
                  <div className="flex flex-col border-r border-slate-700/50 pr-2">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.operationPeriod}</span></div>
                      <span className="text-[10px] text-slate-500 font-mono">/ {periodPnL >= 0 ? formatCurrency(periodGoalVal) : `-${formatCurrency(periodStopVal)}`}</span>
                    </div>
                    <MiniProgressBar current={periodPnL} target={periodPnL >= 0 ? periodGoalVal : periodStopVal} isLoss={periodPnL < 0} />
                  </div>
                  <div className="flex flex-col pl-2">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-slate-500" /><span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">{plan.adjustmentCycle}</span></div>
                      <span className="text-[10px] text-slate-500 font-mono">/ {cyclePnL >= 0 ? formatCurrency(cycleGoalVal) : `-${formatCurrency(cycleStopVal)}`}</span>
                    </div>
                    <MiniProgressBar current={cyclePnL} target={cyclePnL >= 0 ? cycleGoalVal : cycleStopVal} isLoss={cyclePnL < 0} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-2">
          <Filters filters={filters} onFilterChange={setFilters} onReset={() => setFilters({period: 'all', ticker: 'all', accountId: filters.accountId, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: ''})} tickers={[...new Set(filteredTrades.map(t => t.ticker))]} />
        </div>
      )}

      {/* Cards de Métricas */}
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="glass-card h-[400px] w-full relative p-4">
            {filteredTrades.length > 0 ? (
              <EquityCurve trades={filteredTrades} initialBalance={aggregatedInitialBalance} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Activity className="w-12 h-12 mb-2 opacity-20" />
                <p>Sem dados para gerar a curva.</p>
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-1">
          <TradingCalendar trades={filteredTrades} selectedDate={calendarSelectedDate} onSelectDate={(date) => { setCalendarSelectedDate(date === calendarSelectedDate ? null : date); if (date !== calendarSelectedDate) setTimeout(() => document.getElementById('daily-trades')?.scrollIntoView({ behavior: 'smooth' }), 100); }} />
        </div>
      </div>

      {/* Trades do dia selecionado */}
      {calendarSelectedDate && (
        <div id="daily-trades" className="mb-6 animate-in slide-in-from-top-4">
          <div className="glass-card border-l-4 border-blue-500 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="font-bold text-white">📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}</h3>
              <button onClick={() => setCalendarSelectedDate(null)} className="text-sm text-slate-400 hover:text-white flex gap-1"><X className="w-4 h-4"/> Fechar</button>
            </div>
            <TradesList 
              trades={filteredTrades.filter(t => t.date === calendarSelectedDate)} 
              plans={plans}
              onViewTrade={setViewingTrade} 
              onEditTrade={(t) => { setEditingTrade(t); setShowAddModal(true); }} 
              onDeleteTrade={deleteTrade} 
            />
          </div>
        </div>
      )}

      {/* Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SwotAnalysis trades={allAccountTrades} plans={plansToShow} currentBalance={aggregatedCurrentBalance} />
        <SetupAnalysis trades={filteredTrades} />
      </div>
      <div className="mb-6"><EmotionAnalysis trades={filteredTrades} /></div>

      {/* Modais */}
      <AddTradeModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingTrade(null); }} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} plans={plans} />
      
      {/* FIX 1.0.8: Passando onViewFeedbackHistory para habilitar botão de ver conversa.
         O handler handleViewFeedbackHistory fecha o modal e chama a prop de navegação.
      */}
      <TradeDetailModal 
        isOpen={!!viewingTrade} 
        onClose={() => setViewingTrade(null)} 
        trade={viewingTrade} 
        plans={plans} 
        onViewFeedbackHistory={handleViewFeedbackHistory}
      />

      <PlanManagementModal isOpen={showPlanModal} onClose={() => { setShowPlanModal(false); setEditingPlan(null); }} onSubmit={handleSavePlan} editingPlan={editingPlan} isSubmitting={isSubmitting} defaultAccountId={filters.accountId !== 'all' ? filters.accountId : undefined} />
      {extractPlan && (<PlanExtractModal isOpen={!!extractPlan} onClose={() => setExtractPlan(null)} plan={extractPlan} trades={trades.filter(t => t.planId === extractPlan.id)} />)}
      {ledgerPlan && (<PlanLedgerExtract plan={ledgerPlan} trades={trades.filter(t => t.planId === ledgerPlan.id)} onClose={() => setLedgerPlan(null)} />)}

      <DebugBadge component="StudentDashboard" />
    </div>
  );
};

export default StudentDashboard;
// hotfix-v1.10.1
