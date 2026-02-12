import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import MentorDashboard from './pages/MentorDashboard';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import TradesJournal from './pages/TradesJournal';
import StudentsManagement from './pages/StudentsManagement';
import Sidebar from './components/Sidebar';
import Loading from './components/Loading';
import AddTradeModal from './components/AddTradeModal';
import { useTrades } from './hooks/useTrades';
import { usePlans } from './hooks/usePlans';

const AppContent = () => {
  const { user, loading, isMentor } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const { addTrade, getTradesAwaitingFeedback, getTradesGroupedByStudent } = useTrades();
  const { plans } = usePlans();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return <Loading fullScreen text="Carregando..." />;
  if (!user) return <LoginPage />;

  const handleViewChange = (view) => {
    if (view === 'add-trade') setShowAddTradeModal(true);
    else setCurrentView(view);
  };

  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      await addTrade(tradeData, htfFile, ltfFile);
      setShowAddTradeModal(false);
    } finally { setIsSubmitting(false); }
  };

  let pendingFeedbackCount = 0;
  let attentionCount = 0;
  
  if (isMentor()) {
    try {
      const pending = getTradesAwaitingFeedback();
      pendingFeedbackCount = pending?.length || 0;
      const grouped = getTradesGroupedByStudent();
      Object.values(grouped).forEach(trades => {
        if (trades.length >= 5) {
          const wins = trades.filter(t => t.result > 0).length;
          if ((wins / trades.length) * 100 < 40) attentionCount++;
        }
      });
    } catch (e) {}
  }

  const renderContent = () => {
    if (currentView === 'accounts') return <AccountsPage />;
    if (currentView === 'students' && isMentor()) return <StudentsManagement />;
    if (currentView === 'settings' && isMentor()) return <SettingsPage />;

    if (isMentor()) {
      return <MentorDashboard currentView={currentView} onViewChange={handleViewChange} />;
    } else {
      switch (currentView) {
        case 'journal': return <TradesJournal />;
        case 'dashboard':
        case 'analytics':
        default: return <StudentDashboard currentView={currentView} />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        pendingFeedback={pendingFeedbackCount}
        studentsNeedingAttention={attentionCount}
      />

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {renderContent()}
      </main>

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

const App = () => <AuthProvider><AppContent /></AuthProvider>;

export default App;
