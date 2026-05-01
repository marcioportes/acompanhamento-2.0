/**
 * App.jsx
 * @description App principal com roteamento e estado global
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.4.0: StudentFeedbackPage self-contained (master-detail interno)
 * - 1.3.0: TradesJournal navega para FeedbackPage, View As Student
 * - 2.2.1: Fix login carregando na tela errada
 * - 2.2.0: FeedbackPage com trade selecionado
 * - 2.1.0: Adicionado FeedbackPage para alunos
 * - 2.0.0: View As Student feature
 */

import { useState, useMemo } from 'react';
import { X, Eye } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import PropFirmPage from './pages/PropFirmPage';
import MentorDashboard from './pages/MentorDashboard';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import TradesJournal from './pages/TradesJournal';
import StudentsManagement from './pages/StudentsManagement';
import FeedbackPage from './pages/FeedbackPage';
import StudentFeedbackPage from './pages/StudentFeedbackPage';
import StudentOnboardingPage from './pages/StudentOnboardingPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import WeeklyReviewPage from './pages/WeeklyReviewPage';
import StudentReviewsPage from './pages/StudentReviewsPage';
import Sidebar from './components/Sidebar';
import Loading from './components/Loading';
import AddTradeModal from './components/AddTradeModal';
import PlanLedgerExtract from './components/PlanLedgerExtract';
import PendencyGuard from './components/PendencyGuard';
import { useTrades } from './hooks/useTrades';
import { usePlans } from './hooks/usePlans';
import { useAccounts } from './hooks/useAccounts';
import { getPlanCurrency } from './utils/currency';
import { useAssessmentGuard } from './components/Onboarding/AssessmentGuard';
import { useAssessment } from './hooks/useAssessment';
import BaselineReport from './components/Onboarding/BaselineReport';

// Banner de "Visualizando como Aluno"
const ViewAsStudentBanner = ({ student, onClose }) => {
  if (!student) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <span className="font-medium">
          Visualizando como: <strong>{student.name || student.email}</strong>
        </span>
        <span className="text-xs opacity-75 bg-white/20 px-2 py-0.5 rounded">
          {student.email}
        </span>
      </div>
      <button 
        onClick={onClose}
        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
        title="Sair da visualização"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, isMentor } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // SEMPRE inicia em dashboard
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado de View As Student
  const [viewingAsStudent, setViewingAsStudent] = useState(null);
  
  // Estado para FeedbackPage com trade específico
  const [feedbackTrade, setFeedbackTrade] = useState(null);
  // Contexto de retorno: planId do extrato que estava aberto (só quando veio do extrato)
  const [feedbackReturnPlanId, setFeedbackReturnPlanId] = useState(null);

  // Estado do Extrato do Plano como view (Fase 0 #102 — modal → currentView)
  const [ledgerPlanId, setLedgerPlanId] = useState(null);
  // Quando aberto vindo da Fila de Revisão → carrega PlanLedgerExtract em mode='review'
  const [ledgerInitialReviewId, setLedgerInitialReviewId] = useState(null);
  // Tela nova Revisão Semanal (#102, Stage 1) — navegada pela Fila de Revisão.
  // Coexiste com o PlanLedgerExtract 3-col (baseline para comparação).
  const [weeklyReviewContext, setWeeklyReviewContext] = useState(null); // { studentId, reviewId }
  // Contexto de retorno quando usuário vai ao FeedbackPage a partir da WeeklyReviewPage (Stage 3).
  const [feedbackReturnReviewContext, setFeedbackReturnReviewContext] = useState(null);
  // Stage 6: contexto de retorno quando usuário vai ao Ledger a partir da WeeklyReviewPage.
  const [ledgerReturnReviewContext, setLedgerReturnReviewContext] = useState(null);

  // Preseleção de conta na AccountsPage com auto-abertura de PlanManagementModal
  // (usado pelo banner "Criar plano retroativo" do OrderImportPage — issue #156 Fase F).
  // Padrão espelha flag _autoOpenPlanModal do card de conta (#154, v1.36.0).
  const [accountsInitial, setAccountsInitial] = useState(null);
  
  // Hooks
  const { 
    addTrade, 
    trades,
    getTradesAwaitingFeedback, 
    getTradesGroupedByStudent, 
    allTrades,
    addFeedbackComment,
    updateTradeStatus,
    getPartials,
    uploadFeedbackImage
  } = useTrades();
  const { plans } = usePlans();
  const { accounts } = useAccounts();

  // Assessment Guard (CHUNK-09) — intercepta no nível do App para evitar loop no StudentDashboard
  // Mentor visualizando aluno: usa uid do aluno. Aluno logado: usa próprio uid. Mentor no dashboard: null (desativa).
  const guardStudentId = viewingAsStudent?.uid || (!isMentor() ? user?.uid : null);
  const { shouldRedirect: shouldShowOnboarding, loading: guardLoading } = useAssessmentGuard(guardStudentId);

  // Baseline do aluno — para exibir item "Marco Zero" no Sidebar
  // Só ativo para alunos logados (não mentor). Mentor usa StudentOnboardingPage para ver o baseline.
  const studentAssessmentId = !isMentor() ? user?.uid : null;
  const { initialAssessment: studentInitialAssessment } = useAssessment(studentAssessmentId);
  const hasBaseline = !!studentInitialAssessment;

  // Mesa Prop — para exibir item no Sidebar (só alunos logados)
  const studentAccountsId = !isMentor() ? user?.uid : null;
  const { accounts: studentAccounts } = useAccounts(studentAccountsId);
  const hasPropAccount = useMemo(() => {
    if (isMentor()) return false;
    return studentAccounts?.some(a => a.type === 'PROP') ?? false;
  }, [studentAccounts]);

  // Contadores para badges
  const pendingFeedbackCount = useMemo(() => {
    if (!isMentor() || viewingAsStudent) return 0;
    try {
      const pending = getTradesAwaitingFeedback?.() || [];
      return pending.length;
    } catch (e) {
      return 0;
    }
  }, [isMentor, viewingAsStudent, allTrades, getTradesAwaitingFeedback]);

  // Badge para aluno: trades revisados pelo mentor que o aluno ainda não trabalhou
  // Nota: usa `trades` (não `allTrades`) porque no student mode o listener só popula `trades`
  const unreviewedFeedbackCount = useMemo(() => {
    if (isMentor() && !viewingAsStudent) return 0;
    try {
      return (trades || []).filter(t => t.status === 'REVIEWED').length;
    } catch (e) {
      return 0;
    }
  }, [isMentor, viewingAsStudent, trades]);

  const studentsNeedingAttention = useMemo(() => {
    if (!isMentor() || viewingAsStudent) return 0;
    try {
      const grouped = getTradesGroupedByStudent?.() || {};
      let count = 0;
      Object.values(grouped).forEach(trades => {
        if (trades.length >= 5) {
          const wins = trades.filter(t => t.result > 0).length;
          if ((wins / trades.length) * 100 < 40) count++;
        }
      });
      return count;
    } catch (e) {
      return 0;
    }
  }, [isMentor, viewingAsStudent, allTrades, getTradesGroupedByStudent]);

  if (loading) return <Loading fullScreen text="Carregando..." />;
  if (!user) return <LoginPage />;

  // Handler de navegação
  const handleViewChange = (view) => {
    // Sair do modo de visualização ao navegar (exceto students)
    if (viewingAsStudent && view !== 'students') {
      setViewingAsStudent(null);
    }

    // Sair do FeedbackPage se estava nele
    if (feedbackTrade) {
      setFeedbackTrade(null);
    }

    // Limpar extrato se navegando para outra view.
    // Entrada do extrato é exclusivamente pelo pergaminho do PlanCardGrid — sem sidebar.
    if (view !== 'ledger') {
      setLedgerPlanId(null);
      setLedgerReturnReviewContext(null);
    }

    if (view === 'add-trade') {
      setShowAddTradeModal(true);
    } else {
      setCurrentView(view);
    }
  };

  // Handler de View As Student
  const handleViewAsStudent = (studentData) => {
    setViewingAsStudent(studentData);
    setCurrentView('dashboard');
  };

  // Handler de sair do modo de visualização
  const handleExitViewMode = () => {
    setViewingAsStudent(null);
    setCurrentView('students');
  };

  // Handler para abrir extrato do plano como view (Fase 0 #102) — mode='live'
  const handleOpenLedger = (planId) => {
    setLedgerPlanId(planId);
    setLedgerInitialReviewId(null);
    setCurrentView('ledger');
  };

  // Handler para abrir extrato direto em mode='review' (vem da Fila de Revisão — baseline)
  const handleOpenReviewInLedger = ({ planId, reviewId }) => {
    setLedgerPlanId(planId);
    setLedgerInitialReviewId(reviewId);
    setCurrentView('ledger');
  };

  // Handler para abrir a nova tela de Revisão Semanal (Stage 1).
  // Entry point: Fila de Revisão > aluno > click no rascunho.
  const handleOpenWeeklyReview = ({ studentId, reviewId }) => {
    setWeeklyReviewContext({ studentId, reviewId });
    setCurrentView('weekly-review');
  };

  // Handler para abrir AccountsPage com conta preselecionada + modal de novo plano aberto
  // (issue #156 Fase F — banner "Criar plano retroativo" do OrderImportPage).
  const handleRequestRetroactivePlan = ({ accountId }) => {
    if (!accountId) return;
    setAccountsInitial({ accountId, autoOpenPlanModal: true });
    setCurrentView('accounts');
  };

  // Handler para navegar para FeedbackPage com um trade específico
  const handleNavigateToFeedback = (trade) => {
    // Guarda retorno ao extrato se veio do PlanLedgerExtract (flag _fromLedgerPlanId)
    setFeedbackReturnPlanId(trade._fromLedgerPlanId || null);
    // Stage 3: retorno à WeeklyReviewPage se veio de lá (flag _fromReviewContext)
    setFeedbackReturnReviewContext(trade._fromReviewContext || null);
    setFeedbackTrade(trade);
  };

  // Handler para voltar do FeedbackPage
  const handleBackFromFeedback = () => {
    setFeedbackTrade(null);
    // Se veio da WeeklyReviewPage, volta pra ela (prioriza sobre extrato)
    if (feedbackReturnReviewContext) {
      setWeeklyReviewContext(feedbackReturnReviewContext);
      setCurrentView('weekly-review');
      setFeedbackReturnReviewContext(null);
      setFeedbackReturnPlanId(null);
      return;
    }
    // Se veio do extrato, volta para o extrato (não para o dashboard)
    if (feedbackReturnPlanId) {
      setLedgerPlanId(feedbackReturnPlanId);
      setCurrentView('ledger');
      setFeedbackReturnPlanId(null);
    }
  };

  // Handler para adicionar comentário no FeedbackPage
  const handleAddFeedbackComment = async (tradeId, content, isQuestion, imageUrl = null) => {
    const updatedTrade = await addFeedbackComment(tradeId, content, isQuestion, imageUrl);
    // Atualiza o trade local para refletir mudanças imediatas
    setFeedbackTrade(prev => ({
      ...prev,
      ...updatedTrade,
      feedbackHistory: updatedTrade.feedbackHistory,
      status: updatedTrade.status
    }));
  };

  // Handler para atualizar status no FeedbackPage
  const handleUpdateTradeStatus = async (tradeId, newStatus) => {
    await updateTradeStatus(tradeId, newStatus);
    setFeedbackTrade(prev => ({ ...prev, status: newStatus }));
  };

  // Handler de adicionar trade
  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      await addTrade(tradeData, htfFile, ltfFile);
      setShowAddTradeModal(false);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // Renderização do conteúdo principal
  const renderContent = () => {
    // Assessment Guard — redireciona para onboarding ANTES de qualquer view
    if (guardLoading && guardStudentId) return <Loading fullScreen text="Verificando assessment..." />;
    if (shouldShowOnboarding && guardStudentId) {
      return <StudentOnboardingPage studentId={guardStudentId} isMentorView={isMentor() && !!viewingAsStudent} />;
    }

    // Se está no FeedbackPage com um trade específico
    if (feedbackTrade) {
      // Busca trade atualizado do allTrades para dados em tempo real
      const currentTrade = allTrades.find(t => t.id === feedbackTrade.id) || feedbackTrade;
      
      // Enriquece com PL do plano para cálculo de resultado % sobre PL
      const tradePlan = currentTrade.planId ? plans.find(p => p.id === currentTrade.planId) : null;
      const enrichedTrade = tradePlan ? { ...currentTrade, _planPl: tradePlan.pl } : currentTrade;
      
      return (
        <FeedbackPage
          trade={enrichedTrade}
          onBack={handleBackFromFeedback}
          onAddComment={handleAddFeedbackComment}
          onUpdateStatus={handleUpdateTradeStatus}
          getPartials={getPartials}
          uploadFeedbackImage={uploadFeedbackImage}
        />
      );
    }
    
    // Extrato do Plano como view (funciona para aluno direto E mentor-viewing-as-student).
    // Colocado ANTES do early return de viewingAsStudent para evitar hijack.
    if (currentView === 'ledger' && ledgerPlanId) {
      const ledgerPlan = plans.find(p => p.id === ledgerPlanId);
      if (ledgerPlan) {
        const ledgerTrades = trades.filter(t => t.planId === ledgerPlanId);
        const ledgerCurrency = getPlanCurrency(ledgerPlan, accounts);
        return (
          <PlanLedgerExtract
            plan={ledgerPlan}
            trades={ledgerTrades}
            onClose={() => {
              // Se veio da WeeklyReviewPage, volta pra ela em vez de dashboard.
              if (ledgerReturnReviewContext) {
                setWeeklyReviewContext(ledgerReturnReviewContext);
                setLedgerReturnReviewContext(null);
                setLedgerPlanId(null);
                setLedgerInitialReviewId(null);
                setCurrentView('weekly-review');
                return;
              }
              setCurrentView('dashboard');
              setLedgerPlanId(null);
              setLedgerInitialReviewId(null);
            }}
            currency={ledgerCurrency}
            onNavigateToFeedback={(trade) => handleNavigateToFeedback({ ...trade, _fromLedgerPlanId: ledgerPlan.id })}
            embedded
            initialReviewId={ledgerInitialReviewId}
          />
        );
      }
      // Plano ainda não disponível (plans em carregamento async). Renderiza loading.
      // NÃO chamar setState durante render — causa loop infinito.
      return <Loading fullScreen text="Carregando extrato..." />;
    }

    // Student Onboarding (assessment 4D) — mentor visitando aluno via viewingAsStudent.
    // Colocado ANTES do hijack de viewingAsStudent→StudentDashboard para permitir
    // navegação contextual da WeeklyReviewPage sem redirecionar pro dashboard do aluno.
    if (currentView === 'onboarding' && isMentor() && viewingAsStudent) {
      return <StudentOnboardingPage studentId={viewingAsStudent.studentId || viewingAsStudent.uid} isMentorView={true} />;
    }

    // Se está visualizando como aluno, mostra o StudentDashboard com override
    if (viewingAsStudent) {
      return <StudentDashboard viewAs={viewingAsStudent} onNavigateToFeedback={handleNavigateToFeedback} onOpenLedger={handleOpenLedger} onRequestRetroactivePlan={handleRequestRetroactivePlan} returnToPlanId={feedbackReturnPlanId} onReturnConsumed={() => setFeedbackReturnPlanId(null)} />;
    }

    // Páginas específicas
    if (currentView === 'accounts') {
      return <AccountsPage initialAccount={accountsInitial} onInitialConsumed={() => setAccountsInitial(null)} />;
    }
    if (currentView === 'students' && isMentor()) {
      return <StudentsManagement onViewAsStudent={handleViewAsStudent} />;
    }
    if (currentView === 'settings' && isMentor()) return <SettingsPage />;
    if (currentView === 'subscriptions' && isMentor()) return <SubscriptionsPage />;
    if (currentView === 'reviews' && isMentor()) {
      return <ReviewQueuePage
        onOpenReviewInLedger={handleOpenReviewInLedger}
        onOpenWeeklyReview={handleOpenWeeklyReview}
      />;
    }
    if (currentView === 'weekly-review' && isMentor() && weeklyReviewContext) {
      return (
        <WeeklyReviewPage
          studentId={weeklyReviewContext.studentId}
          reviewId={weeklyReviewContext.reviewId}
          onBack={() => { setWeeklyReviewContext(null); setCurrentView('reviews'); }}
          onNavigateToFeedback={(trade) => handleNavigateToFeedback({
            ...trade,
            _fromReviewContext: { studentId: weeklyReviewContext.studentId, reviewId: weeklyReviewContext.reviewId },
          })}
          onNavigateToLedger={(planId) => {
            // Preserva contexto para retorno via onClose do PlanLedgerExtract.
            setLedgerReturnReviewContext({
              studentId: weeklyReviewContext.studentId,
              reviewId: weeklyReviewContext.reviewId,
            });
            setWeeklyReviewContext(null);
            setLedgerPlanId(planId);
            setCurrentView('ledger');
          }}
          onNavigateToAssessment={(studentId) => {
            setViewingAsStudent({ studentId, uid: studentId });
            setWeeklyReviewContext(null);
            setCurrentView('onboarding');
          }}
        />
      );
    }

    // Dashboard principal
    if (isMentor()) {
      return (
        <MentorDashboard 
          currentView={currentView} 
          onViewChange={handleViewChange}
          onNavigateToFeedback={handleNavigateToFeedback}
        />
      );
    } else {
      // Aluno
      switch (currentView) {
        case 'journal':
          return <TradesJournal onNavigateToFeedback={handleNavigateToFeedback} />;
        case 'feedback':
          // v2.0.0: StudentFeedbackPage é self-contained (master-detail)
          return <StudentFeedbackPage />;
        case 'student-reviews':
          return <StudentReviewsPage onNavigateToFeedback={handleNavigateToFeedback} />;
        case 'baseline':
          // Marco Zero — BaselineReport do assessment validado pelo mentor
          return (
            <div className="p-6 max-w-2xl mx-auto">
              <BaselineReport
                assessment={studentInitialAssessment}
                stageDiagnosis={studentInitialAssessment?.stage_diagnosis}
              />
            </div>
          );
        case 'propfirm':
          return <PropFirmPage />;
        case 'ledger': {
          // Extrato do Plano como view (Fase 0 #102 — modal → currentView)
          const ledgerPlan = ledgerPlanId ? plans.find(p => p.id === ledgerPlanId) : null;
          if (!ledgerPlan) {
            // Sem plano selecionado — volta ao dashboard
            setCurrentView('dashboard');
            setLedgerPlanId(null);
            return null;
          }
          const ledgerTrades = trades.filter(t => t.planId === ledgerPlanId);
          const ledgerCurrency = getPlanCurrency(ledgerPlan, accounts);
          return (
            <PlanLedgerExtract
              plan={ledgerPlan}
              trades={ledgerTrades}
              onClose={() => { setCurrentView('dashboard'); setLedgerPlanId(null); }}
              currency={ledgerCurrency}
              onNavigateToFeedback={(trade) => handleNavigateToFeedback({ ...trade, _fromLedgerPlanId: ledgerPlan.id })}
              embedded
            />
          );
        }
        case 'dashboard':
        default:
          return (
            <>
              <StudentDashboard onNavigateToFeedback={handleNavigateToFeedback} onOpenLedger={handleOpenLedger} onRequestRetroactivePlan={handleRequestRetroactivePlan} returnToPlanId={feedbackReturnPlanId} onReturnConsumed={() => setFeedbackReturnPlanId(null)} />
              <PendencyGuard
                studentId={user?.uid}
                onNavigateToFeedback={handleNavigateToFeedback}
                onNavigateToReviews={() => setCurrentView('student-reviews')}
              />
            </>
          );
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Banner de View As Student */}
      <ViewAsStudentBanner 
        student={viewingAsStudent} 
        onClose={handleExitViewMode} 
      />

      {/* Sidebar */}
      <Sidebar
        currentView={feedbackTrade ? 'feedback' : viewingAsStudent ? 'viewing-student' : currentView}
        onViewChange={handleViewChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        pendingFeedback={pendingFeedbackCount}
        studentsNeedingAttention={studentsNeedingAttention}
        unreviewedFeedback={unreviewedFeedbackCount}
        hasBaseline={hasBaseline}
        hasPropAccount={hasPropAccount}
        hasPlans={plans.length > 0}
      />

      {/* Conteúdo principal */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} ${viewingAsStudent ? 'pt-12' : ''}`}>
        {renderContent()}
      </main>

      {/* Modal de adicionar trade (apenas para alunos) */}
      {!isMentor() && (
        <AddTradeModal
          isOpen={showAddTradeModal}
          onClose={() => setShowAddTradeModal(false)}
          onSubmit={handleAddTrade}
          loading={isSubmitting}
          plans={plans}
        />
      )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
