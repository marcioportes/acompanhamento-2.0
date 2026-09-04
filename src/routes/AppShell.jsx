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
import AddTradeModal from '../components/AddTradeModal';
import { useTrades } from '../hooks/useTrades';
import { usePlans } from '../hooks/usePlans';
import { useAccounts } from '../hooks/useAccounts';
import { useAssessment } from '../hooks/useAssessment';

/** Dados globais que as rotas consomem. Substitui o prop-drilling do App.jsx. */
export const useAppData = () => useOutletContext();

const AppShell = () => {
  const { user, isMentor } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Em dev, expõe window.__cleanup com findOrphans/deleteOrphans pra purga
  // pontual do passivo de docs órfãos. Em build de produção é no-op.
  useEffect(() => { installCleanupUtils(); }, []);

  const {
    addTrade,
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

  // Badges do menu. O do mentor conta trades esperando resposta; o do aluno,
  // trades já revisados que ele ainda não trabalhou (usa `trades`, porque no
  // modo aluno o listener só popula essa lista).
  const pendingFeedbackCount = useMemo(() => {
    if (!isMentor()) return 0;
    return (getTradesAwaitingFeedback?.() || []).length;
  }, [isMentor, allTrades, getTradesAwaitingFeedback]);

  const unreviewedFeedbackCount = useMemo(() => {
    if (isMentor()) return 0;
    return (trades || []).filter((t) => t.status === 'REVIEWED').length;
  }, [isMentor, trades]);

  // Badge de "Precisam Atenção". Sai do menu na Fase B2 (D1 — vira filtro da
  // Torre); enquanto o item existe, o número continua sendo o mesmo.
  const studentsNeedingAttention = useMemo(() => {
    if (!isMentor()) return 0;
    const grouped = getTradesGroupedByStudent?.() || {};
    return Object.values(grouped).filter((lista) => {
      if (lista.length < 5) return false;
      const wins = lista.filter((t) => t.result > 0).length;
      return (wins / lista.length) * 100 < 40;
    }).length;
  }, [isMentor, allTrades, getTradesGroupedByStudent]);

  const handleAddTrade = async (tradeData, htfFile, ltfFile) => {
    setIsSubmitting(true);
    try {
      await addTrade(tradeData, htfFile, ltfFile);
      setShowAddTradeModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const contexto = {
    trades,
    allTrades,
    tradesLoading,
    plans,
    accounts,
    addTrade,
    addFeedbackComment,
    updateTradeStatus,
    getPartials,
    uploadFeedbackImage,
    getTradesAwaitingFeedback,
    getTradesGroupedByStudent,
    getTradesByStudent,
    studentInitialAssessment,
    onAddTrade: () => setShowAddTradeModal(true),
  };

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

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Outlet context={contexto} />
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

export default AppShell;
