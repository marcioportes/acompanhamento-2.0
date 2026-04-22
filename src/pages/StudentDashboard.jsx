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

import { useState, useEffect, useMemo } from 'react';
import { Wallet, X, Activity, Upload } from 'lucide-react';

// Componentes extraídos
import DashboardHeader from '../components/dashboard/DashboardHeader';
import PlanCardGrid from '../components/dashboard/PlanCardGrid';
import MetricsCards from '../components/dashboard/MetricsCards';
import PendingTakeaways from '../components/reviews/PendingTakeaways';

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
import PlanAuditModal from '../components/dashboard/PlanAuditModal';
import DebugBadge from '../components/DebugBadge';

// CSV Import v2 (staging)
import CsvImportWizard from '../components/csv/CsvImportWizard';
import CsvImportCard from '../components/csv/CsvImportCard';
import CsvImportManager from '../components/csv/CsvImportManager';

// Order Import (CHUNK-10)
import OrderImportPage from '../pages/OrderImportPage';

// Student Onboarding (CHUNK-09) — guard movido para App.jsx (fix loop infinito)

// Hooks
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext';
import useDashboardMetrics from '../hooks/useDashboardMetrics';
import useCsvStaging from '../hooks/useCsvStaging';
import useOrderStaging from '../hooks/useOrderStaging';
import useOrders from '../hooks/useOrders';
import useCrossCheck from '../hooks/useCrossCheck';
import useMasterData from '../hooks/useMasterData';
import { useSetups } from '../hooks/useSetups';

// Contexto unificado (issue #118 — DEC-047)
import StudentContextProvider from '../contexts/StudentContextProvider';
import useStudentContext from '../hooks/useStudentContext';
import ContextBar from '../components/ContextBar';

// Utils
import { searchTrades } from '../utils/calculations';
import { formatCurrencyDynamic, getPlanCurrency } from '../utils/currency';
import { generateIdealEquitySeries, calculateIdealStatus } from '../utils/equityCurveIdeal';


/**
 * @param {Object} viewAs - Dados do aluno sendo visualizado (quando mentor usa View As)
 * @param {Function} onNavigateToFeedback - Callback para navegar para a tela de feedback
 * @param {Function} onOpenLedger - Callback que troca a view para 'ledger' com planId selecionado (Fase 0 #102)
 */
/**
 * StudentDashboardBody — corpo original do dashboard.
 * Envolvido pelo wrapper StudentDashboard que instancia o StudentContextProvider (issue #118).
 * Consome useStudentContext() para conta/plano/ciclo/período globais.
 */
const StudentDashboardBody = ({ viewAs = null, onNavigateToFeedback, onOpenLedger, onRequestRetroactivePlan }) => {
  const { user } = useAuth();
  const overrideStudentId = viewAs?.uid || null;

  // Contexto unificado (issue #118) — fonte de verdade para conta/plano/ciclo/período
  const studentCtx = useStudentContext();

  // === Data hooks ===
  const { trades, loading: tradesLoading, addTrade, updateTrade, deleteTrade, setSuspendListener, getPartials } = useTrades(overrideStudentId);
  const { accounts, loading: accountsLoading, addAccount, updateAccount } = useAccounts(overrideStudentId);
  const { plans, loading: plansLoading, addPlan, updatePlan, deletePlan, auditPlan, diagnosePlan } = usePlans(overrideStudentId);

  // Master data (emotions, tickers) + setups
  const { emotions, tickers: masterTickers } = useMasterData();
  const { setups } = useSetups();

  // CSV Staging
  const {
    stagingTrades, pendingCount, readyCount,
    addStagingBatch, updateStagingTrade, deleteStagingTrade, deleteStagingBatch,
    activateTrade: activateStagingTrade, activateBatch: activateStagingBatch, getBatches,
    loading: stagingLoading,
  } = useCsvStaging(overrideStudentId);

  // Order Import (CHUNK-10)
  const orderStaging = useOrderStaging(overrideStudentId);
  const { orders, stats: orderStats } = useOrders(overrideStudentId);
  const crossCheckHook = useCrossCheck(overrideStudentId);

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
  const [auditPlanId, setAuditPlanId] = useState(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [showCsvWizard, setShowCsvWizard] = useState(false);
  const [showCsvManager, setShowCsvManager] = useState(false);
  const [showOrderImport, setShowOrderImport] = useState(false);

  // Sincronização bidirecional com StudentContext (issue #118 — DEC-047)
  // filters.accountId é fonte local para consumers prop-drilled; contexto é fonte de verdade global.
  // Contexto usa 'all' como null; filters usa 'all' como string 'all'.
  useEffect(() => {
    const ctxAccountId = studentCtx.accountId ?? 'all';
    if (filters.accountId !== ctxAccountId) {
      setFilters(prev => ({ ...prev, accountId: ctxAccountId }));
    }
  }, [studentCtx.accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctxPlanId = studentCtx.planId ?? null;
    if (selectedPlanId !== ctxPlanId) {
      setSelectedPlanId(ctxPlanId);
    }
  }, [studentCtx.planId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reabrir extrato ao voltar do feedback — delegado para App.jsx via handleBackFromFeedback (Fase 0 #102)
  // returnToPlanId consumido diretamente no App.jsx → setLedgerPlanId + currentView='ledger'

  const isLoading = tradesLoading || accountsLoading || plansLoading;

  // === Métricas calculadas (hook extraído) ===
  // accountTypeFilter fixo em 'all' desde #164 (review): seletor de conta foi unificado
  // na ContextBar (#118). O hook ainda aceita o filtro caso volte em issue futuro.
  const metrics = useDashboardMetrics({
    accounts,
    trades,
    plans,
    filters,
    selectedPlanId,
    accountTypeFilter: 'all',
  });

  const {
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
    riskAsymmetry,
    evLeakage,
    payoff,
    asymmetryDiagnostic,
    plContext,
    avgTradeDuration,
    consistencyCV,
    durationDelta,
  } = metrics;

  // === Curva ideal do plano (E5 — issue #164) ===
  // Só ativa quando há plano único selecionado com ciclo ativo (datas válidas).
  const idealEquitySeries = useMemo(() => {
    const plan = studentCtx.selectedPlan;
    const cycle = studentCtx.selectedCycle;
    if (!plan || !cycle?.start || !cycle?.end) return null;
    return generateIdealEquitySeries(plan, { startDate: cycle.start, endDate: cycle.end });
  }, [studentCtx.selectedPlan, studentCtx.selectedCycle]);

  const idealEquityStatus = useMemo(() => {
    if (!idealEquitySeries) return null;
    const pl = aggregatedCurrentBalance - aggregatedInitialBalance;
    return calculateIdealStatus(pl, aggregatedInitialBalance, idealEquitySeries);
  }, [idealEquitySeries, aggregatedCurrentBalance, aggregatedInitialBalance]);

  // SwotAnalysis: quando há conta específica + plano=null, filtrar reviews pelos
  // planos da conta (evita mostrar SWOT de review de outra conta/plano)
  const swotAccountPlanIds = useMemo(() => {
    if (selectedPlanId) return null; // precedência do planId
    if (!studentCtx.accountId) return null; // "todas as contas" → sem filtro
    return plans
      .filter(p => p.accountId === studentCtx.accountId && p.active !== false)
      .map(p => p.id);
  }, [plans, studentCtx.accountId, selectedPlanId]);

  // === Handlers ===
  const handleViewFeedbackHistory = (trade) => {
    setViewingTrade(null);
    if (onNavigateToFeedback) onNavigateToFeedback(trade);
  };

  /** Wrapper para activateTrade que injeta addTrade */
  const handleActivateStagingTrade = async (stagingTrade) => {
    try {
      await activateStagingTrade(stagingTrade, addTrade);
    } catch (err) {
      alert('Erro ao ativar trade: ' + err.message);
    }
  };

  /** Wrapper para activateBatch que injeta addTrade e suspende listener durante batch */
  const handleActivateStagingBatch = async (tradeIds, onProgress) => {
    setSuspendListener(true);
    try {
      return await activateStagingBatch(tradeIds, addTrade, onProgress);
    } finally {
      setSuspendListener(false);
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

  const handleAuditPlan = (planId) => {
    setAuditPlanId(planId);
  };

  const handleDiagnosePlan = () => {
    if (!auditPlanId) return null;
    return diagnosePlan(auditPlanId, trades);
  };

  const handleFixPlan = async () => {
    if (!auditPlanId) return null;
    return await auditPlan(auditPlanId, (progress) => {
      console.log(`[Audit] Step ${progress.step}: ${progress.message}`);
    });
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
      {/* Header (título + ações) */}
      <DashboardHeader
        viewAs={viewAs}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onNewTrade={() => { setEditingTrade(null); setShowAddModal(true); }}
        onCsvImport={() => setShowCsvWizard(true)}
        onOrderImport={() => setShowOrderImport(true)}
      />

      {/* Barra de Contexto Unificado (#118 — DEC-047). Fica logo abaixo do header
          para que os dropdowns (que abrem com top-full) caiam sobre o conteúdo
          neutro abaixo, e não sobre o título/botões. */}
      <ContextBar accounts={accounts} plans={plans} trades={trades} />

      {/* CSV Import — Card de staging */}
      {stagingTrades.length > 0 && (
        <div className="flex items-center">
          <CsvImportCard
            totalCount={stagingTrades.length}
            pendingCount={pendingCount}
            readyCount={readyCount}
            onClick={() => setShowCsvManager(true)}
          />
        </div>
      )}

      {/* Pendências da mentoria — takeaways em aberto (Stage 4.5) */}
      <PendingTakeaways
        studentId={overrideStudentId || user?.uid}
        onNavigateToFeedback={onNavigateToFeedback}
      />

      {/* Cards de Planos */}
      <PlanCardGrid
        availablePlans={availablePlans}
        accounts={accounts}
        trades={trades}
        selectedPlanId={selectedPlanId}
        viewAs={viewAs}
        onSelectPlan={(id) => studentCtx.setPlan(id)}
        onOpenLedger={(plan) => onOpenLedger?.(plan?.id)}
        onEditPlan={(plan) => { setEditingPlan(plan); setShowPlanModal(true); }}
        onDeletePlan={handleDeletePlan}
        onAuditPlan={handleAuditPlan}
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
        riskAsymmetry={riskAsymmetry}
        evLeakage={evLeakage}
        payoff={payoff}
        asymmetryDiagnostic={asymmetryDiagnostic}
        plContext={plContext}
        avgTradeDuration={avgTradeDuration}
        consistencyCV={consistencyCV}
        durationDelta={durationDelta}
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="glass-card h-[400px] w-full relative p-4">
            {filteredTrades.length > 0 ? (
              <EquityCurve
                trades={filteredTrades}
                initialBalance={aggregatedInitialBalance}
                currency={dominantCurrency || 'BRL'}
                currencies={balancesByCurrency}
                accounts={accounts}
                idealSeries={idealEquitySeries}
                idealStatus={idealEquityStatus}
              />
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
        <SwotAnalysis
          studentId={overrideStudentId || user?.uid}
          planId={selectedPlanId}
          accountPlanIds={swotAccountPlanIds}
          /* TODO(#164): onNavigateToReview — aguardando rota aluno para Revisão Semanal
             (hoje 'weekly-review' é restrita a mentor em App.jsx). */
        />
        <SetupAnalysis trades={filteredTrades} />
      </div>
      <div className="mb-6"><EmotionAnalysis trades={filteredTrades} globalWR={stats?.winRate} /></div>

      {/* Modais */}
      <AddTradeModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingTrade(null); }} onSubmit={handleAddTrade} editTrade={editingTrade} loading={isSubmitting} plans={plans} />
      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} plans={plans} orders={orders} onViewFeedbackHistory={handleViewFeedbackHistory} getPartials={getPartials} />
      <PlanManagementModal isOpen={showPlanModal} onClose={() => { setShowPlanModal(false); setEditingPlan(null); }} onSubmit={handleSavePlan} editingPlan={editingPlan} isSubmitting={isSubmitting} defaultAccountId={filters.accountId !== 'all' ? filters.accountId : undefined} />
      {extractPlan && (<PlanExtractModal isOpen={!!extractPlan} onClose={() => setExtractPlan(null)} plan={extractPlan} trades={trades.filter(t => t.planId === extractPlan.id)} />)}
      {/* PlanLedgerExtract: ledger agora é currentView no App.jsx (#102 Fase 0), não modal aqui */}

      {/* Auditoria de Plano */}
      {auditPlanId && (() => {
        const auditPlanObj = plans.find(p => p.id === auditPlanId);
        const auditCurrency = auditPlanObj ? getPlanCurrency(auditPlanObj, accounts) : 'BRL';
        const auditPlanName = auditPlanObj
          ? `${auditPlanObj.name} · ${auditPlanObj.operationPeriod || 'Diário'} · ${auditPlanObj.adjustmentCycle || 'Mensal'}`
          : '';
        return (
          <PlanAuditModal
            isOpen={!!auditPlanId}
            onClose={() => setAuditPlanId(null)}
            planName={auditPlanName}
            currency={auditCurrency}
            onDiagnose={handleDiagnosePlan}
            onFix={handleFixPlan}
          />
        );
      })()}

      {/* CSV Import Modais */}
      {showCsvWizard && (
        <CsvImportWizard
          plans={plans.filter(p => p.active !== false)}
          accounts={accounts}
          masterTickers={masterTickers}
          addStagingBatch={addStagingBatch}
          onClose={() => setShowCsvWizard(false)}
        />
      )}
      <CsvImportManager
        isOpen={showCsvManager}
        onClose={() => setShowCsvManager(false)}
        stagingTrades={stagingTrades}
        emotions={emotions}
        setups={setups}
        onUpdateStagingTrade={updateStagingTrade}
        onDeleteStagingTrade={deleteStagingTrade}
        onDeleteStagingBatch={deleteStagingBatch}
        onActivateTrade={handleActivateStagingTrade}
        onActivateBatch={handleActivateStagingBatch}
        getBatches={getBatches}
      />

      {/* Order Import Modal (CHUNK-10) */}
      {showOrderImport && (
        <OrderImportPage
          onClose={() => setShowOrderImport(false)}
          plans={plans}
          trades={trades}
          orderStaging={orderStaging}
          crossCheck={crossCheckHook}
          userContext={user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null}
          onRequestRetroactivePlan={onRequestRetroactivePlan ? ({ accountId }) => {
            setShowOrderImport(false);
            onRequestRetroactivePlan({ accountId });
          } : undefined}
        />
      )}

      <DebugBadge component="StudentDashboard" />
    </div>
  );
};

/**
 * StudentDashboard — wrapper que instancia StudentContextProvider (issue #118).
 * `key={scopeStudentId}` força remount quando mentor troca de aluno em modo viewAs (E5).
 * Accounts/plans são carregados aqui e passados ao Provider para inicialização do contexto.
 *
 * NOTA: o Provider é instanciado dentro da página (não em App.jsx) nesta sessão para manter
 * o refactor atômico contido em CHUNK-02+CHUNK-13. Migração para App.jsx acontece quando
 * outros consumidores (fora do StudentDashboard) precisarem do contexto — fica como delta
 * no issue file #118.
 */
const StudentDashboard = (props) => {
  const { user } = useAuth();
  const overrideStudentId = props.viewAs?.uid || null;
  const scopeStudentId = overrideStudentId || user?.uid || 'anon';

  const { accounts } = useAccounts(overrideStudentId);
  const { plans } = usePlans(overrideStudentId);

  return (
    <StudentContextProvider
      key={scopeStudentId}
      scopeStudentId={scopeStudentId}
      accounts={accounts}
      plans={plans}
    >
      <StudentDashboardBody {...props} />
    </StudentContextProvider>
  );
};

export default StudentDashboard;
