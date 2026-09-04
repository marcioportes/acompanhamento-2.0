/**
 * LedgerRoute — extrato do plano (issue #144, Fase A1/A2)
 *
 * Dois endereços, um componente: `/plano/:planId` (aluno) e
 * `/alunos/:studentId/plano/:planId` (mentor na ficha). O `initialReviewId`, que
 * antes era estado do App preenchido pela Fila de Revisão, vira query string
 * (`?revisao=`) — é contexto de leitura, não de navegação.
 */
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import PlanLedgerExtract from '../../components/PlanLedgerExtract';
import Loading from '../../components/Loading';
import NaoEncontrado from './NaoEncontrado';
import { useAppData } from '../AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { useVoltar } from '../useVoltar';
import { getPlanCurrency } from '../../utils/currency';
import { homePath, SHARED_PATHS } from '../paths';

const LedgerRoute = () => {
  const { planId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isMentor } = useAuth();
  const { trades, plans, accounts } = useAppData();
  const voltar = useVoltar(homePath(isMentor()));

  const plano = plans.find((p) => p.id === planId);
  if (!plano && plans.length === 0) return <Loading fullScreen text="Carregando extrato..." />;
  if (!plano) return <NaoEncontrado titulo="Plano não encontrado" />;

  return (
    <PlanLedgerExtract
      plan={plano}
      trades={trades.filter((t) => t.planId === planId)}
      onClose={voltar}
      currency={getPlanCurrency(plano, accounts)}
      onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
      embedded
      initialReviewId={searchParams.get('revisao') || null}
    />
  );
};

export default LedgerRoute;
