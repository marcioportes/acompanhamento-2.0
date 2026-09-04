/**
 * AppShell — a casca única do app (issue #144, Fase A1)
 *
 * Era o corpo do `AppContent` em App.jsx: fundo, sidebar, área de conteúdo e o
 * modal de novo trade. O que saiu daqui e não voltou foi a NAVEGAÇÃO — os oito
 * estados de contexto de retorno, o `currentView` e o `renderContent` de 200
 * linhas viraram rotas em `AppRoutes`.
 *
 * Os listeners globais (`useTrades`, `usePlans`, `useAccounts`) continuam sendo
 * assinados UMA vez, aqui, e descem pelas rotas via `Outlet context` — em vez de
 * cada página reassinar por conta própria. Consolidar as duplicações que já
 * existem nas páginas é escopo separado (fora do #144).
 */
import { useState, useMemo, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { installCleanupUtils } from '../utils/cleanupOrphans';
import Sidebar from '../components/Sidebar';
import { useTrades } from '../hooks/useTrades';
import { usePlans } from '../hooks/usePlans';
import { useAccounts } from '../hooks/useAccounts';
import { useAssessment } from '../hooks/useAssessment';

/** Dados globais que as rotas consomem. Substitui o prop-drilling do App.jsx. */
export const useAppData = () => useOutletContext();

const AppShell = () => {
  const { user, isMentor } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Em dev, expõe window.__cleanup com findOrphans/deleteOrphans pra purga
  // pontual do passivo de docs órfãos. Em build de produção é no-op.
  useEffect(() => { installCleanupUtils(); }, []);

  const {
    trades,
    allTrades,
    loading: tradesLoading,
    getTradesAwaitingFeedback,
    getTradesGroupedByStudent,
    getTradesByStudent,
    addFeedbackComment,
    updateTradeStatus,
    getPartials,
    uploadFeedbackImage,
  } = useTrades();
  const { plans } = usePlans();
  const { accounts } = useAccounts();

  // Itens condicionais do menu do aluno. Mentor não tem baseline nem mesa prop
  // próprios — passa `null` pro hook pra não assinar leitura à toa.
  const studentScopedId = !isMentor() ? user?.uid : null;
  const { initialAssessment: studentInitialAssessment } = useAssessment(studentScopedId);
  const { accounts: studentAccounts } = useAccounts(studentScopedId);
  const hasPropAccount = useMemo(
    () => (isMentor() ? false : (studentAccounts?.some((a) => a.type === 'PROP') ?? false)),
    [isMentor, studentAccounts],
  );

  // #423 — os badges do mentor voltam com os itens de menu. O número no menu é o
  // que faz o item ser procurado; sem ele o mentor não sabe que tem trabalho ali.
  const pendingFeedbackCount = useMemo(() => {
    if (!isMentor()) return 0;
    return (getTradesAwaitingFeedback?.() || []).length;
  }, [isMentor, getTradesAwaitingFeedback]);

  const studentsNeedingAttention = useMemo(() => {
    if (!isMentor()) return 0;
    const grouped = getTradesGroupedByStudent?.() || {};
    return Object.values(grouped).filter((lista) => {
      if (lista.length < 5) return false;
      const wins = lista.filter((t) => t.result > 0).length;
      return (wins / lista.length) * 100 < 40;
    }).length;
  }, [isMentor, getTradesGroupedByStudent]);

  // Badge do aluno — trades já revisados que ele ainda não trabalhou (usa
  // `trades`, porque no modo aluno o listener só popula essa lista).
  const unreviewedFeedbackCount = useMemo(() => {
    if (isMentor()) return 0;
    return (trades || []).filter((t) => t.status === 'REVIEWED').length;
  }, [isMentor, trades]);

  // Identidade estável: no #387 um objeto recriado a cada render fez um hook
  // reentrar a cada snapshot do Firestore e a tela pular de altura. Aqui o
  // contexto desce para TODA rota — é o pior lugar possível para churn.
  const contexto = useMemo(() => ({
    trades,
    allTrades,
    tradesLoading,
    plans,
    accounts,
    addFeedbackComment,
    updateTradeStatus,
    getPartials,
    uploadFeedbackImage,
    getTradesAwaitingFeedback,
    getTradesGroupedByStudent,
    getTradesByStudent,
    studentInitialAssessment,
  }), [
    trades, allTrades, tradesLoading, plans, accounts,
    addFeedbackComment, updateTradeStatus, getPartials, uploadFeedbackImage,
    getTradesAwaitingFeedback, getTradesGroupedByStudent, getTradesByStudent,
    studentInitialAssessment,
  ]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        pendingFeedback={pendingFeedbackCount}
        studentsNeedingAttention={studentsNeedingAttention}
        unreviewedFeedback={unreviewedFeedbackCount}
        hasBaseline={!!studentInitialAssessment}
        hasPropAccount={hasPropAccount}
      />

      {/* #144 C1 — o container é do shell. Era declarado por cada página, e cada
          uma escolhia o seu: `p-6 lg:p-8`, `py-6 pb-32`, `p-6`, `p-6 lg:p-8 pb-20`.
          O `pb-20` vale para todas por causa do DebugBadge, que é `fixed bottom-2`
          e cobria conteúdo em toda página com scroll. */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="min-h-screen px-6 lg:px-8 py-6 pb-20">
          <Outlet context={contexto} />
        </div>
      </main>

      {/* #144 A1 — o AddTradeModal que vivia aqui era um SEGUNDO modal, órfão: só
          abria com `currentView === 'add-trade'`, e nenhum item de menu emitia esse
          id. O registro de trade sempre foi o modal do próprio StudentDashboard. */}
    </div>
  );
};

export default AppShell;
