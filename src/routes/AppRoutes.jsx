/**
 * AppRoutes — a tabela de endereços do app (issue #144, Fase A1)
 *
 * Substitui o `renderContent` de ~200 linhas do App.jsx, onde a tela era
 * escolhida por uma cadeia de `if (currentView === '...')` e o acesso por papel
 * era um `&& isMentor()` repetido em cada ramo. Aqui o papel é guard de rota e
 * a tela é endereço.
 */
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import LoginPage from '../pages/LoginPage';
import AccountsPage from '../pages/AccountsPage';
import SettingsPage from '../pages/SettingsPage';
import SubscriptionsPage from '../pages/SubscriptionsPage';
import StudentsManagement from '../pages/StudentsManagement';
import StudentFeedbackPage from '../pages/StudentFeedbackPage';
import StudentReviewsPage from '../pages/StudentReviewsPage';
import StudentOnboardingPage from '../pages/StudentOnboardingPage';
import ClosuresPage from '../pages/ClosuresPage';
import TradeReportPage from '../pages/TradeReportPage';
import PropFirmPage from '../pages/PropFirmPage';
import BaselineReport from '../components/Onboarding/BaselineReport';

import AppShell, { useAppData } from './AppShell';
import { RequireAuth, RequireMentor, RequireStudent } from './guards';
import { MENTOR_PATHS, PUBLIC_PATHS, SHARED_PATHS, STUDENT_PATHS, homePath } from './paths';
import NaoEncontrado from './comum/NaoEncontrado';
import FeedbackRoute from './comum/FeedbackRoute';
import LedgerRoute from './comum/LedgerRoute';
import MentorViewRoute from './mentor/MentorViewRoute';
import ReviewQueueRoute from './mentor/ReviewQueueRoute';
import WeeklyReviewRoute from './mentor/WeeklyReviewRoute';
import ComoAlunoRoute from './mentor/ComoAlunoRoute';
import PainelRoute from './aluno/PainelRoute';
import GuardAssessment from './aluno/GuardAssessment';

/** `/` não é tela: é o desvio para a única porta de cada papel. */
const Raiz = () => {
  const { isMentor } = useAuth();
  return <Navigate to={homePath(isMentor())} replace />;
};

/** Login com sessão viva não faz sentido — devolve pra porta. */
const LoginRoute = () => {
  const { user, isMentor } = useAuth();
  if (user) return <Navigate to={homePath(isMentor())} replace />;
  return <LoginPage />;
};

/** Marco Zero do aluno: relatório do assessment já validado pelo mentor. */
const MaturidadeRoute = () => {
  const { studentInitialAssessment } = useAppData();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <BaselineReport
        assessment={studentInitialAssessment}
        stageDiagnosis={studentInitialAssessment?.stage_diagnosis}
      />
    </div>
  );
};

/** Assessment 4D do aluno, aberto pelo mentor a partir da ficha ou da revisão. */
const AssessmentDoAlunoRoute = () => {
  const { studentId } = useParams();
  return <StudentOnboardingPage studentId={studentId} isMentorView />;
};

/** Acompanhamento — a gestão do aluno. "Ver como aluno" vira endereço próprio. */
const AlunosRoute = () => {
  const navigate = useNavigate();
  return (
    <StudentsManagement
      onViewAsStudent={(aluno) => navigate(MENTOR_PATHS.alunoComoAluno(aluno.uid || aluno.email))}
    />
  );
};

/**
 * Contas. A pré-seleção de conta com abertura do modal de plano era estado do
 * App (`accountsInitial`), preenchido pelo banner "criar plano retroativo" do
 * import de ordens. Vira query string: contexto de abertura, não de navegação,
 * e some da URL assim que é consumido.
 */
const ContasRoute = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const contaId = searchParams.get('conta');
  const initial = contaId
    ? { accountId: contaId, autoOpenPlanModal: searchParams.get('novoPlano') === '1' }
    : null;
  return (
    <AccountsPage
      initialAccount={initial}
      onInitialConsumed={() => setSearchParams({}, { replace: true })}
    />
  );
};

/** As duas telas de leitura do aluno que abrem o feedback de um trade. */
const StudentReviewsRoute = () => {
  const navigate = useNavigate();
  return <StudentReviewsPage onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))} />;
};

const RelatorioRoute = () => {
  const navigate = useNavigate();
  return <TradeReportPage onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))} />;
};

const OnboardingRoute = () => {
  const { user } = useAuth();
  return <StudentOnboardingPage studentId={user?.uid} />;
};

const AppRoutes = () => (
  <Routes>
    <Route path={PUBLIC_PATHS.login} element={<LoginRoute />} />

    <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<Raiz />} />

        {/* Compartilhadas — o endereço não muda com o papel. */}
        <Route path={SHARED_PATHS.contas} element={<ContasRoute />} />
        <Route path="/trades/:tradeId" element={<FeedbackRoute />} />

        {/* ---------------- Mentor ---------------- */}
        <Route element={<RequireMentor />}>
          <Route path={MENTOR_PATHS.torre} element={<MentorViewRoute view="torre" />} />
          <Route path={MENTOR_PATHS.analises} element={<MentorViewRoute view="overview" />} />
          <Route path={MENTOR_PATHS.alunos} element={<AlunosRoute />} />
          <Route path="/alunos/:studentId" element={<MentorViewRoute view="ficha" />} />
          <Route path="/alunos/:studentId/como-aluno" element={<ComoAlunoRoute />} />
          <Route path="/alunos/:studentId/plano/:planId" element={<LedgerRoute />} />
          <Route path="/alunos/:studentId/revisao/:reviewId" element={<WeeklyReviewRoute />} />
          <Route path="/alunos/:studentId/assessment" element={<AssessmentDoAlunoRoute />} />
          <Route path={MENTOR_PATHS.pendenciasRevisoes} element={<ReviewQueueRoute />} />
          <Route path={MENTOR_PATHS.pendenciasFeedback} element={<MentorViewRoute view="pending" />} />
          <Route path={MENTOR_PATHS.pendenciasFechamentos} element={<MentorViewRoute view="closures" />} />
          <Route path={MENTOR_PATHS.pendenciasAtencao} element={<MentorViewRoute view="attention" />} />
          <Route path={MENTOR_PATHS.assinaturas} element={<SubscriptionsPage />} />
          <Route path={MENTOR_PATHS.configuracoes} element={<SettingsPage />} />
        </Route>

        {/* ---------------- Aluno ---------------- */}
        <Route element={<RequireStudent />}>
          <Route path={SHARED_PATHS.onboarding} element={<OnboardingRoute />} />
          <Route element={<GuardAssessment />}>
            <Route path={STUDENT_PATHS.painel} element={<PainelRoute />} />
            <Route path={STUDENT_PATHS.feedback} element={<StudentFeedbackPage />} />
            <Route path={STUDENT_PATHS.revisoes} element={<StudentReviewsRoute />} />
            <Route path={STUDENT_PATHS.ciclos} element={<ClosuresPage />} />
            <Route path={STUDENT_PATHS.relatorio} element={<RelatorioRoute />} />
            <Route path={STUDENT_PATHS.mesaProp} element={<PropFirmPage />} />
            <Route path={STUDENT_PATHS.maturidade} element={<MaturidadeRoute />} />
            <Route path="/plano/:planId" element={<LedgerRoute />} />
          </Route>
        </Route>

        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Route>
  </Routes>
);

export default AppRoutes;
