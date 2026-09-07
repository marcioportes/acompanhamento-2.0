/**
 * Sidebar
 * @version 1.4.0
 * @description Menu lateral com navegação, versão, badges alertas emocionais e feedback aluno
 * 
 * CHANGELOG:
 * - 1.4.0: Item "Marco Zero" no menu do aluno — visível apenas quando hasBaseline=true (assessment concluído)
 * - 1.3.0: Badge de revisões não trabalhadas (REVIEWED) no menu do aluno
 * - 1.2.0: Badge de alertas emocionais no menu mentor — Fase 1.5.0
 * - 1.1.0: Adicionado item "Feedback" no menu do aluno
 */

import {
  LayoutDashboard,
  Users,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,

  AlertTriangle,
  Wallet,
  Settings,
  Brain,
  CreditCard,
  ClipboardCheck,
  Shield,
  FileText,
  History,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EspelhoMark } from './EspelhoLogo';
import useMentorClosureInbox from '../hooks/useMentorClosureInbox';
import { VERSION } from '../version';

const Sidebar = ({ 
  currentView, 
  onViewChange, 
  collapsed = false, 
  onToggle,
  pendingFeedback = 0,
  studentsNeedingAttention = 0,
  emotionalAlerts = 0,
  unreviewedFeedback = 0,
  hasBaseline = false,
  hasPropAccount = false,
  hasPlans = false,
}) => {
  const { user, logout, isMentor } = useAuth();
  const isMentorRole = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);
  // Hook subscreve closures pendentes (janela 7d sem comentário). Só faz sentido
  // pro mentor — rules bloqueiam read pro aluno (e ele só vê os próprios). Passa
  // `enabled` pra evitar firebase call desnecessário (e quebrar tests jsdom).
  const { pendingCount: closuresPendingCount } = useMentorClosureInbox({ enabled: isMentorRole });

  // Menu do Aluno
  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: MessageSquare,
      badge: unreviewedFeedback > 0 ? unreviewedFeedback : null,
      badgeColor: 'green'
    },
    { id: 'student-reviews', label: 'Revisões', icon: ClipboardCheck },
    { id: 'closures', label: 'Ciclos Fechados', icon: History },
    // #414 — o Diário virou o Relatório do Mês (leitura: trade + observação + feedback).
    { id: 'journal', label: 'Relatório', icon: FileText },
    // Extrato do Plano NÃO mora no sidebar — entrada é exclusivamente pelo
    // pergaminho do PlanCardGrid (precisa de contexto de plano específico).
    { id: 'accounts', label: 'Contas', icon: Wallet },
    // Mesa Prop — só aparece se aluno tem conta type PROP
    ...(hasPropAccount ? [{ id: 'propfirm', label: 'Mesa Prop', icon: Shield }] : []),
    // Perfil de Maturidade — só aparece após assessment concluído pelo mentor
    ...(hasBaseline ? [{ id: 'baseline', label: 'Perfil de Maturidade', icon: Brain }] : []),
  ];

  // Menu do Mentor
  const mentorMenuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      badge: emotionalAlerts > 0 ? emotionalAlerts : null,
      badgeColor: 'purple'
    },
    { id: 'reviews', label: 'Fila de Revisão', icon: ClipboardCheck },
    { id: 'students', label: 'Acompanhamento', icon: Users },
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
    {
      id: 'closures',
      label: 'Fechamentos',
      icon: Inbox,
      badge: closuresPendingCount > 0 ? closuresPendingCount : null,
      badgeColor: 'red',
    },
    { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const menuItems = isMentorRole ? mentorMenuItems : studentMenuItems;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 transition-all duration-200 ${
        collapsed ? 'w-[68px]' : 'w-[228px]'
      }`}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}
    >
      <div className="flex flex-col h-full">
        {/* Logo — altura casada com o cabeçalho da página (56px), para que o
            topo da marca e o topo do título fiquem na mesma linha. */}
        <div className="h-14 px-4 flex items-center" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 flex items-center justify-center flex-shrink-0"
              style={{ borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
            >
              <EspelhoMark className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <span className="font-display font-semibold text-[14px] tracking-tight" style={{ color: 'var(--ink)' }}>
                  Espelho
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="absolute -right-2.5 top-[46px] w-5 h-5 rounded-full flex items-center justify-center transition-colors z-10"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--line-strong)', color: 'var(--ink-3)' }}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>

        {/* Menu */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            // #101 — a Torre é ABA do Dashboard, não item de sidebar: estando
            // nela, o Dashboard continua aceso.
            const ativo = (currentView === 'torre' ? 'dashboard' : currentView) === item.id;
            return (
              <button
                key={item.id}
                data-view={item.id}
                onClick={() => onViewChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={`menu-item relative w-full ${collapsed ? 'justify-center px-0' : ''} ${ativo ? 'active' : ''}`}
              >
                <item.icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={1.75} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {/* Contador é informação, não alarme: number tabular em tinta
                        secundária. Vermelho fica reservado para o que exige ação. */}
                    {item.badge && (
                      <span
                        className="text-[11px] font-semibold tabular flex-shrink-0"
                        style={{ color: item.badgeColor === 'red' ? 'var(--neg)' : 'var(--ink-3)' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span
                    className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full"
                    style={{ background: item.badgeColor === 'red' ? 'var(--neg)' : 'var(--ink-3)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé: quem está logado, saída e versão numa faixa só. Três blocos
            separados por filete gastavam 160px de altura para dizer isto. */}
        <div className="px-2 py-2" style={{ borderTop: '1px solid var(--line)' }}>
          <div className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? 'justify-center px-0' : ''}`}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--line-strong)' }}
            >
              <User className="w-3 h-3" style={{ color: 'var(--ink-3)' }} />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                  {user?.displayName || user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                  {isMentor() ? 'Mentor' : 'Aluno'}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Sair"
                className="icon-btn flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {collapsed && (
            <button onClick={handleLogout} title="Sair" className="menu-item w-full justify-center px-0">
              <LogOut className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
          )}

          {!collapsed && (
            <div className="px-2 pb-1">
              <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                {VERSION.display}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
