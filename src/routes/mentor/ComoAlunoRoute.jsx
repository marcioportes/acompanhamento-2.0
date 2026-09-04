/**
 * ComoAlunoRoute — `/alunos/:studentId/como-aluno` (issue #144, Fase A3)
 *
 * "Visualizando como aluno" era estado GLOBAL (`viewingAsStudent`) que sequestrava
 * o render do App inteiro e um banner `fixed` que obrigava o shell a compensar
 * com `pt-12`. Vira endereço: quem está nele vê a tela do aluno, quem sai dele
 * volta ao que estava. A faixa de contexto é conteúdo da rota — não flutua sobre
 * o app nem empurra o layout.
 */
import { Eye, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentDashboard from '../../pages/StudentDashboard';
import StudentOnboardingPage from '../../pages/StudentOnboardingPage';
import Loading from '../../components/Loading';
import { useAppData } from '../AppShell';
import { useAssessmentGuard } from '../../components/Onboarding/AssessmentGuard';
import { MENTOR_PATHS, SHARED_PATHS } from '../paths';
import { useVoltar } from '../useVoltar';

export const FaixaDeContexto = ({ nome, email, onSair }) => (
  <div className="sticky top-0 z-30 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
    <div className="flex items-center gap-3">
      <Eye className="w-5 h-5" />
      <span className="font-medium">
        Visualizando como: <strong>{nome || email}</strong>
      </span>
      {email && (
        <span className="text-xs opacity-75 bg-white/20 px-2 py-0.5 rounded">{email}</span>
      )}
    </div>
    <button onClick={onSair} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" title="Sair da visualização">
      <X className="w-4 h-4" />
    </button>
  </div>
);

const ComoAlunoRoute = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { allTrades } = useAppData();
  const voltar = useVoltar(MENTOR_PATHS.aluno(studentId));

  // Assessment ainda não validado: o mentor vê o onboarding do aluno, não o
  // painel — mesmo desvio que o guard fazia no App, agora restrito a esta rota.
  const { shouldRedirect: precisaOnboarding, loading: guardLoading } = useAssessmentGuard(studentId);

  const aluno = allTrades?.find((t) => t.studentId === studentId);
  const viewAs = { studentId, uid: studentId, email: aluno?.studentEmail, name: aluno?.studentName };

  if (guardLoading) return <Loading fullScreen text="Verificando assessment..." />;

  return (
    <>
      <FaixaDeContexto nome={viewAs.name} email={viewAs.email} onSair={voltar} />
      {precisaOnboarding ? (
        <StudentOnboardingPage studentId={studentId} isMentorView />
      ) : (
        <StudentDashboard
          viewAs={viewAs}
          onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
          onOpenLedger={(planId) => navigate(MENTOR_PATHS.alunoPlano(studentId, planId))}
          onRequestRetroactivePlan={({ accountId }) =>
            navigate(`${SHARED_PATHS.contas}?conta=${encodeURIComponent(accountId)}&novoPlano=1`)}
        />
      )}
    </>
  );
};

export default ComoAlunoRoute;
