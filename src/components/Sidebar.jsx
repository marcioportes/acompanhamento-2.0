import { 
  LayoutDashboard, 
  Users,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Trophy,
  AlertTriangle,
  Wallet,
  BookOpen,
  LineChart,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ 
  currentView, 
  onViewChange, 
  collapsed = false, 
  onToggle,
  pendingFeedback = 0,
  studentsNeedingAttention = 0
}) => {
  const { user, logout, isMentor } = useAuth();

  // Menu do Aluno
  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'journal', label: 'Diário', icon: BookOpen },
    { id: 'accounts', label: 'Contas', icon: Wallet },
  ];

  // Menu do Mentor
  const mentorMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'accounts', label: 'Contas', icon: Wallet },
    { 
      id: 'pending', 
      label: 'Aguardando Feedback', 
      icon: MessageSquare,
      badge: pendingFeedback > 0 ? pendingFeedback : null,
    },
    { 
      id: 'attention', 
      label: 'Precisam Atenção', 
      icon: AlertTriangle,
      badge: studentsNeedingAttention > 0 ? studentsNeedingAttention : null,
      badgeColor: 'red'
    },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const menuItems = isMentor() ? mentorMenuItems : studentMenuItems;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/50 z-40 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-display font-bold text-white truncate">
                  Tchio
                </h1>
                <p className="text-xs text-slate-500">Alpha</p>
              </div>
            )}
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700/50 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`menu-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`min-w-[20px] h-5 flex items-center justify-center text-xs font-semibold rounded-full ${
                      item.badgeColor === 'red' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-semibold rounded-full bg-red-500 text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800/50">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.displayName || user?.email?.split('@')[0]}
                </p>
                <p className={`text-xs ${
                  isMentor() ? 'text-purple-400' : 'text-slate-500'
                }`}>
                  {isMentor() ? 'Mentor' : 'Aluno'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`mt-4 w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
