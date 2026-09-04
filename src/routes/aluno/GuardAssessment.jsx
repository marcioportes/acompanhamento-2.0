/**
 * GuardAssessment — o aluno sem assessment validado não navega (issue #144, A1)
 *
 * Era um `if` no topo do `renderContent` do App, antes de qualquer view. Vira
 * guard de rota sobre o ramo do aluno: mesma regra, um lugar só, e sem
 * sequestrar o render de telas que não são dele.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAssessmentGuard } from '../../components/Onboarding/AssessmentGuard';
import Loading from '../../components/Loading';
import { SHARED_PATHS } from '../paths';

const GuardAssessment = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { shouldRedirect, loading } = useAssessmentGuard(user?.uid);

  if (loading) return <Loading fullScreen text="Verificando assessment..." />;
  if (shouldRedirect && location.pathname !== SHARED_PATHS.onboarding) {
    return <Navigate to={SHARED_PATHS.onboarding} replace />;
  }
  return <Outlet />;
};

export default GuardAssessment;
