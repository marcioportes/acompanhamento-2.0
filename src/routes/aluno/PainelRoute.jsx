/**
 * PainelRoute — `/painel`, a porta do aluno (issue #144, Fase A1)
 */
import { useNavigate } from 'react-router-dom';
import StudentDashboard from '../../pages/StudentDashboard';
import PendencyGuard from '../../components/PendencyGuard';
import { useAuth } from '../../contexts/AuthContext';
import { SHARED_PATHS, STUDENT_PATHS } from '../paths';

const PainelRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <StudentDashboard
        onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
        onOpenLedger={(planId) => navigate(STUDENT_PATHS.plano(planId))}
        onRequestRetroactivePlan={({ accountId }) =>
          navigate(`${SHARED_PATHS.contas}?conta=${encodeURIComponent(accountId)}&novoPlano=1`)}
      />
      <PendencyGuard
        studentId={user?.uid}
        onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
        onNavigateToReviews={() => navigate(STUDENT_PATHS.revisoes)}
      />
    </>
  );
};

export default PainelRoute;
