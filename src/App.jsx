/**
 * App.jsx
 * @version 2.3.0
 * @description App completo com navegação para FeedbackPage em todas as rotas
 * 
 * CHANGELOG:
 * - 2.3.0: TradesJournal também navega para FeedbackPage
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
import MentorDashboard from './pages/MentorDashboard';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import TradesJournal from './pages/TradesJournal';
import StudentsManagement from './pages/StudentsManagement';
import FeedbackPage from './pages/FeedbackPage';
import StudentFeedbackPage from './pages/StudentFeedbackPage';
import Sidebar from './components/Sidebar';
import Loading from './components/Loading';
import AddTradeModal from './components/AddTradeModal';
import { useTrades } from './hooks/useTrades';
import { usePlans } from './hooks/usePlans';

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
  
  // Hooks
  const { 
    addTrade, 
    getTradesAwaitingFeedback, 
    getTradesGroupedByStudent, 
    allTrades,
    addFeedbackComment,
    updateTradeStatus
  } = useTrades();
  const { plans } = usePlans();

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

  // Handler para navegar para FeedbackPage com um trade específico
  const handleNavigateToFeedback = (trade) => {
    setFeedbackTrade(trade);
  };

  // Handler para voltar do FeedbackPage
  const handleBackFromFeedback = () => {
    setFeedbackTrade(null);
  };

  // Handler para adicionar comentário no FeedbackPage
  const handleAddFeedbackComment = async (tradeId, content, isQuestion) => {
    const updatedTrade = await addFeedbackComment(tradeId, content, isQuestion);
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
    // Se está no FeedbackPage com um trade específico
    if (feedbackTrade) {
      // Busca trade atualizado do allTrades para dados em tempo real
      const currentTrade = allTrades.find(t => t.id === feedbackTrade.id) || feedbackTrade;
      
      return (
        <FeedbackPage
          trade={currentTrade}
          onBack={handleBackFromFeedback}
          onAddComment={handleAddFeedbackComment}
          onUpdateStatus={handleUpdateTradeStatus}
        />
      );
    }
    
    // Se está visualizando como aluno, mostra o StudentDashboard com override
    if (viewingAsStudent) {
      return <StudentDashboard viewAs={viewingAsStudent} />;
    }
    
    // Páginas específicas
    if (currentView === 'accounts') return <AccountsPage />;
    if (currentView === 'students' && isMentor()) {
      return <StudentsManagement onViewAsStudent={handleViewAsStudent} />;
    }
    if (currentView === 'settings' && isMentor()) return <SettingsPage />;

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
          return <StudentFeedbackPage onNavigateToFeedback={handleNavigateToFeedback} />;
        case 'dashboard':
        default: 
          return <StudentDashboard onNavigateToFeedback={handleNavigateToFeedback} />;
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
