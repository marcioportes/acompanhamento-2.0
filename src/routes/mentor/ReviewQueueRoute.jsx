/**
 * ReviewQueueRoute — `/pendencias/revisoes` (issue #144, Fase A1/A2)
 *
 * Os dois destinos que a fila abria (extrato em modo revisão e a Revisão
 * Semanal) eram estados do App — `ledgerInitialReviewId` e
 * `weeklyReviewContext`. Viram endereço: o extrato leva a revisão na query
 * string, e a Revisão Semanal tem rota própria sob o aluno.
 */
import { useNavigate } from 'react-router-dom';
import ReviewQueuePage from '../../pages/ReviewQueuePage';
import { MENTOR_PATHS } from '../paths';

const ReviewQueueRoute = () => {
  const navigate = useNavigate();

  return (
    <ReviewQueuePage
      onOpenReviewInLedger={({ planId, reviewId, studentId }) =>
        navigate(`${MENTOR_PATHS.alunoPlano(studentId, planId)}?revisao=${encodeURIComponent(reviewId)}`)}
      onOpenWeeklyReview={({ studentId, reviewId }) =>
        navigate(MENTOR_PATHS.alunoRevisao(studentId, reviewId))}
    />
  );
};

export default ReviewQueueRoute;
