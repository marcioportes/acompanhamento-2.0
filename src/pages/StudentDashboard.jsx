/**
 * StudentDashboard
 * @version 3.0.0 (v1.15.0)
 * @description Dashboard principal do aluno — orquestra estado, hooks e layout.
 *   Lógica de cálculo extraída para useDashboardMetrics.
 *   Componentes visuais extraídos para dashboard/*.
 * 
 * CHANGELOG:
 * - 3.0.0: Particionamento — extrai useDashboardMetrics, PlanCardGrid, MetricsCards, DashboardHeader
 * - 2.0.0: Multi-moeda (#40) — saldos agrupados por currency, formatação dinâmica
 * - 1.10.2: Max Drawdown peak-to-trough, WR Planejado vs Clássico, Taxa de Conformidade
 * - 1.2.0: PlanLedgerExtract (extrato emocional) — Fase 1.5.0
 * - 1.1.0: Filtro master de conta (AccountFilterBar)
 * - 1.0.8: Fix navegação para histórico de feedback
 * - 1.0.7: Fix: Card de Plano exibe saldo verde se > 0
 * - 1.0.6: View As Student suporte
 */

import { useState } from 'react';
import { Wallet, X, Activity } from 'lucide-react';

// Componentes extraídos
import DashboardHeader from '../components/dashboard/DashboardHeader';
import PlanCardGrid from '../components/dashboard/PlanCardGrid';
import MetricsCards from '../components/dashboard/MetricsCards';

// Componentes existentes
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
import PlanLedgerExtract from '../components/PlanLedgerExtract';
import DebugBadge from '../components/DebugBadge';

// Hooks
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext';
import useDashboardMetrics from '../hooks/useDashboardMetrics';

// Utils
import { searchTrades } from '../utils/calculations';
import { formatCurrencyDynamic, getPlanCurrency } from '../utils/currency';

/**
 * @param {Object} viewAs - Dados do aluno sendo visualizado (quando mentor usa View As)
 * @param {Function} onNavigateToFeedback - Callback para navegar para a tela de feedback
 */
const StudentDashboard = ({ viewAs = null, onNavigateToFeedback }) => {
  const { user } = useAuth();
  const overrideStudentId = viewAs?.uid || null;

  // === Data hooks ===
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade } = useTrades(overrideStudentId);
  const { accounts, loading: accountsLoading, addAccount } = useAccounts(overrideStudentId);
  const { plans, loading: plansLoading, addPlan, updatePlan, deletePlan } = usePlans(overrideStudentId);

  // === UI State ===
  const [filters, setFilters] = useState({ period: 'all', ticker: 'all', accountId: 'all', setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [extractPlan, setExtractPlan] = useState(null);
  const [ledgerPlan, setLedgerPlan] = useState(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');

  const isLoading = tradesLoading || accountsLoading || plansLoading;

  // === Métricas calculadas (hook extraído) ===
  const metrics = useDashboardMetrics({
    accounts,
    trades,
    plans,
    filters,
    selectedPlanId,
    accountTypeFilter,
  });

  const {
    filteredAccountsByType,
    allAccountTrades,
    plansToShow,
    availablePlans,
    filteredTrades,
    stats,
    aggregatedInitialBalance,
    aggregatedCurrentBalance,
    balancesByCurrency,
    dominantCurrency,
    drawdown,
    maxDrawdownData,
    winRatePlanned,
    complianceRate,
  } = metrics;

  // === Handlers ===
  const handleViewFeedbackHistory = (trade) => {
    setViewingTrade(null);
    if (onNavigateToFeedback) onNavigateToFeedback(trade);
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
    const targetAccount = accounts.find(a => a.id === planData.accountId);
    if (targetAccount) {
      const accountTotal = Number(targetAccount.currentBalance ?? targetAccount.initialBalance ?? 0);
      const otherActivePlans = plans.filter(p => 
        p.accountId === planData.accountId && p.active && p.id !== editingPlan?.id
      );
      const alreadyAllocated = otherActivePlans.reduce((sum, p) => sum + Number(p.pl || 0), 0);
      const availableBalance = accountTotal - alreadyAllocated;
      const requestedPL = Number(planData.pl);

      if (requestedPL > availableBalance) {
        alert(
          `Saldo insuficiente na conta!\n\n` +
          `Disponível para este Plano: ${formatCurrencyDynamic(availableBalance, targetAccount?.currency)}\n` +
          `Você tentou alocar: ${formatCurrencyDynamic(requestedPL, targetAccount?.currency)}\n\n` +
          `Ajuste o valor do PL ou aumente o saldo da conta.`
        );
        return;
      }
    }

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

  // === Loading / Empty states ===
  if (isLoading) return <Loading fullScreen text="Carregando..." />;

  if (accounts.length === 0 && !wizardComplete && !viewAs) {
    return <AccountSetupWizard onComplete={() => setWizardComplete(true)} onAddAccount={addAccount} onAddPlan={addPlan} />;
  }

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

  // === Render ===
  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header + AccountFilterBar + Card informativo */}
      <DashboardHeader
        viewAs={viewAs}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onNewTrade={() => { setEditingTrade(null); setShowAddModal(true); }}
        accounts={accounts}
        accountTypeFilter={accountTypeFilter}
        onAccountTypeChange={setAccountTypeFilter}
        selectedAccountId={filters.accountId}
        onAccountSelect={(id) => { setFilters(prev => ({ ...prev, accountId: id })); setSelectedPlanId(null); }}
        filteredAccountsByType={filteredAccountsByType}
        aggregatedCurrentBalance={aggregatedCurrentBalance}
        dominantCurrency={dominantCurrency}
        balancesByCurrency={balancesByCurrency}
      />

      {/* Cards de Planos */}
      <PlanCardGrid
        availablePlans={availablePlans}
        accounts={accounts}
        trades={trades}
        selectedPlanId={selectedPlanId}
        viewAs={viewAs}
        onSelectPlan={setSelectedPlanId}
        onOpenLedger={setLedgerPlan}
        onEditPlan={(plan) => { setEditingPlan(plan); setShowPlanModal(true); }}
        onDeletePlan={handleDeletePlan}
        onCreatePlan={() => { setEditingPlan(null); setShowPlanModal(true); }}
      />

      {/* Filtros */}
      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-2">
          <Filters filters={filters} onFilterChange={setFilters} onReset={() => setFilters({period: 'all', ticker: 'all', accountId: filters.accountId, setup: 'all', emotion: 'all', exchange: 'all', result: 'all', search: ''})} tickers={[...new Set(filteredTrades.map(t => t.ticker))]} />
        </div>
      )}

      {/* Cards de Métricas */}
      <MetricsCards
        stats={stats}
        aggregatedCurrentBalance={aggregatedCurrentBalance}
        dominantCurrency={dominantCurrency}
        balancesByCurrency={balancesByCurrency}
        drawdown={drawdown}
        maxDrawdownData={maxDrawdownData}
        winRatePlanned={winRatePlanned}
        complianceRate={complianceRate}
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="glass-card h-[400px] w-full relative p-4">
            {filteredTrades.length > 0 ? (
              <EquityCurve trades={filteredTrades} initialBalance={aggregatedInitialBalance} currency={dominantCurrency || 'BRL'} />
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

      {/* Trades do dia selecionado — totalização */}
      {calendarSelectedDate && (() => {
        const dayTrades = filteredTrades.filter(t => t.date === calendarSelectedDate);
        const dayGain = dayTrades.filter(t => (t.result || 0) > 0).reduce((s, t) => s + t.result, 0);
        const dayLoss = dayTrades.filter(t => (t.result || 0) < 0).reduce((s, t) => s + t.result, 0);
        const dayTotal = dayGain + dayLoss;
        const dayQty = dayTrades.reduce((s, t) => s + (Number(t.qty) || 0), 0);
        const dayCurrency = dominantCurrency || 'BRL';
        return (
        <div id="daily-trades" className="mb-6 animate-in slide-in-from-top-4">
          <div className="glass-card border-l-4 border-blue-500 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white">📅 Trades de {calendarSelectedDate.split('-').reverse().join('/')}</h3>
                <button onClick={() => setCalendarSelectedDate(null)} className="text-sm text-slate-400 hover:text-white flex gap-1"><X className="w-4 h-4"/> Fechar</button>
              </div>
              {dayTrades.length > 0 && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-slate-400">{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{dayQty} contratos</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400">+{formatCurrencyDynamic(dayGain, dayCurrency)}</span>
                  <span className="text-red-400">{formatCurrencyDynamic(dayLoss, dayCurrency)}</span>
                  <span className="text-slate-600">·</span>
                  <span className={`font-bold ${dayTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Total: {dayTotal >= 0 ? '+' : ''}{formatCurrencyDynamic(dayTotal, dayCurrency)}
                  </span>
                </div>
              )}
            </div>
            <TradesList 
              trades={filteredTrades.filter(t => t.date === calendarSelectedDate)} 
              plans={plans}
              onViewTrade={setViewingTrade} 
              onEditTrade={(t) => { setEditingTrade(t); setShowAddModal(true); }} 
              onDeleteTrade={(trade) => deleteTrade(trade.id || trade)} 
            />
          </div>
        </div>
        );
      })()}

      {/* Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SwotAnalysis trades={allAccountTrades} plans={plansToShow} currentBalance={aggregatedCurrentBalance} />
        <SetupAnalysis trades={filteredTrades} />
      </div>
      <div className="mb-6"><EmotionAnalysis trades={filteredTrades} /></div>

      {/* Modais */}
      <AddTradeModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingTrade(null); }} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} plans={plans} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} plans={plans} onViewFeedbackHistory={handleViewFeedbackHistory} />
      <PlanManagementModal isOpen={showPlanModal} onClose={() => { setShowPlanModal(false); setEditingPlan(null); }} onSubmit={handleSavePlan} editingPlan={editingPlan} isSubmitting={isSubmitting} defaultAccountId={filters.accountId !== 'all' ? filters.accountId : undefined} />
      {extractPlan && (<PlanExtractModal isOpen={!!extractPlan} onClose={() => setExtractPlan(null)} plan={extractPlan} trades={trades.filter(t => t.planId === extractPlan.id)} />)}
      {ledgerPlan && (<PlanLedgerExtract plan={ledgerPlan} trades={trades.filter(t => t.planId === ledgerPlan.id)} onClose={() => setLedgerPlan(null)} currency={getPlanCurrency(ledgerPlan, accounts)} />)}

      <DebugBadge component="StudentDashboard" />
    </div>
  );
};

export default StudentDashboard;
