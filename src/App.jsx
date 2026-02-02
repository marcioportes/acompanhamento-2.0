import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import MentorDashboard from './pages/MentorDashboard';
import AccountsPage from './pages/AccountsPage';
import AdminPage from './pages/AdminPage';
import Sidebar from './components/Sidebar';
import Loading from './components/Loading';
import AddTradeModal from './components/AddTradeModal';
import { useTrades } from './hooks/useTrades';

const AppContent = () => {
  const { user, loading, isMentor } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const { addTrade, getTradesAwaitingFeedback, getTradesGroupedByStudent } = useTrades();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loading state
  if (loading) {
    return <Loading fullScreen text="Carregando..." />;
  }

  // Not logged in
  if (!user) {
    return <LoginPage />;
  }

  // Handle view changes from sidebar
  const handleViewChange = (view) => {
    if (view === 'add-trade') {
      setShowAddTradeModal(true);
    } else {
      setCurrentView(view);
    }
  };

  // Handle add trade
  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      await addTrade(tradeData, htfFile, ltfFile);
      setShowAddTradeModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get counts for sidebar badges (mentor only)
  let pendingFeedbackCount = 0;
  let attentionCount = 0;
  
  if (isMentor()) {
    try {
      const pending = getTradesAwaitingFeedback();
      pendingFeedbackCount = pending?.length || 0;
      
      const grouped = getTradesGroupedByStudent();
      // Simple count of students with low win rate
      Object.values(grouped).forEach(trades => {
        if (trades.length >= 5) {
          const wins = trades.filter(t => t.result > 0).length;
          const winRate = (wins / trades.length) * 100;
          if (winRate < 40) attentionCount++;
        }
      });
    } catch (e) {
      // Ignore errors during initial load
    }
  }

  // Render content based on current view
  const renderContent = () => {
    // View de Contas é comum para aluno e mentor
    if (currentView === 'accounts') {
      return <AccountsPage />;
    }

    // View de Admin (apenas mentor)
    if (currentView === 'admin' && isMentor()) {
      return <AdminPage />;
    }

    // Views específicas por role
    if (isMentor()) {
      return (
        <MentorDashboard 
          currentView={currentView} 
          onViewChange={handleViewChange}
        />
      );
    } else {
      // Student views
      switch (currentView) {
        case 'dashboard':
        case 'analytics':
        default:
          return <StudentDashboard currentView={currentView} />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        pendingFeedback={pendingFeedbackCount}
        studentsNeedingAttention={attentionCount}
      />

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {renderContent()}
      </main>

      {/* Add Trade Modal (for students) */}
      {!isMentor() && (
        <AddTradeModal
          isOpen={showAddTradeModal}
          onClose={() => setShowAddTradeModal(false)}
          onSubmit={handleAddTrade}
          loading={isSubmitting}
        />
      )}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
