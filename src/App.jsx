import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TradesJournal from './pages/TradesJournal'; // NOVA PÁGINA
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
  const [showAddTradeModal, setShowAddTradeModal] = useState(false); // Mantido para caso queira um atalho global (opcional)
  const { addTrade } = useTrades(); // Simplificado
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loading state
  if (loading) return <Loading fullScreen text="Carregando..." />;

  // Not logged in
  if (!user) return <LoginPage />;

  // Handle view changes
  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  // Render content logic
  const renderContent = () => {
    // Views Globais
    if (currentView === 'accounts') return <AccountsPage />;
    
    // Mentor View
    if (isMentor()) {
      if (currentView === 'admin') return <AdminPage />;
      return <MentorDashboard currentView={currentView} onViewChange={handleViewChange} />;
    } 
    
    // Aluno Views
    else {
      switch (currentView) {
        case 'dashboard':
          return <StudentDashboard />;
        case 'journal':
          return <TradesJournal />; // ROTA DO NOVO DIÁRIO
        default:
          return <StudentDashboard />;
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
      />

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;