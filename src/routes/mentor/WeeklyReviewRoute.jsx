/**
 * WeeklyReviewRoute — `/alunos/:studentId/revisao/:reviewId` (issue #144, A1/A2)
 *
 * Era a combinação mais cara do modelo antigo: entrar aqui exigia
 * `weeklyReviewContext`, e sair exigia mais dois estados de retorno
 * (`feedbackReturnReviewContext`, `ledgerReturnReviewContext`) porque o caminho
 * de volta do trade e do extrato tinha de ser reconstruído à mão. Com a revisão
 * no endereço, voltar é voltar.
 */
import { useNavigate, useParams } from 'react-router-dom';
import WeeklyReviewPage from '../../pages/WeeklyReviewPage';
import { MENTOR_PATHS, SHARED_PATHS } from '../paths';
import { useVoltar } from '../useVoltar';

const WeeklyReviewRoute = () => {
  const { studentId, reviewId } = useParams();
  const navigate = useNavigate();
  const voltar = useVoltar(MENTOR_PATHS.pendenciasRevisoes);

  return (
    <WeeklyReviewPage
      studentId={studentId}
      reviewId={reviewId}
      onBack={voltar}
      onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
      onNavigateToLedger={(planId) => navigate(MENTOR_PATHS.alunoPlano(studentId, planId))}
      onNavigateToAssessment={() => navigate(MENTOR_PATHS.alunoAssessment(studentId))}
    />
  );
};

export default WeeklyReviewRoute;
