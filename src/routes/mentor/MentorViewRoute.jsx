/**
 * MentorViewRoute — adapta o MentorDashboard às rotas (issue #144, Fase A1)
 *
 * O MentorDashboard ainda é um container de seis telas selecionadas por string
 * (`currentView`). Nesta fase a string passa a vir da ROTA em vez do estado do
 * App: mesma renderização, endereço de verdade. A quebra do container em páginas
 * próprias — e o fim da barra de abas — é a Fase B3.
 */
import { useNavigate, useParams } from 'react-router-dom';
import MentorDashboard from '../../pages/MentorDashboard';
import { MENTOR_PATHS, SHARED_PATHS } from '../paths';
import { useVoltar } from '../useVoltar';

/**
 * Os quatro destinos que a Torre abre a partir de Minhas Pendências e do rodapé.
 * Traduzir aqui mantém a mudança confinada: nenhum componente filho conhece URL.
 */
const PATH_POR_VIEW = {
  dashboard: MENTOR_PATHS.analises,
  torre: MENTOR_PATHS.torre,
  pending: MENTOR_PATHS.pendenciasFeedback,
  closures: MENTOR_PATHS.pendenciasFechamentos,
  attention: MENTOR_PATHS.pendenciasAtencao,
  students: MENTOR_PATHS.alunos,
  reviews: MENTOR_PATHS.pendenciasRevisoes,
  accounts: SHARED_PATHS.contas,
};

const MentorViewRoute = ({ view }) => {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const voltarDaFicha = useVoltar(MENTOR_PATHS.torre);

  return (
    <MentorDashboard
      currentView={view}
      studentIdSelecionado={studentId ?? null}
      onViewChange={(id) => navigate(PATH_POR_VIEW[id] ?? MENTOR_PATHS.torre)}
      onNavigateToFeedback={(trade) => navigate(SHARED_PATHS.trade(trade.id))}
      // `abrirAluno` nem sempre recebe studentId (alguns alertas só têm email).
      // A ficha aceita os dois como parâmetro de rota e resolve na lista.
      onAbrirAluno={(aluno) => navigate(MENTOR_PATHS.aluno(aluno?.studentId || aluno?.email))}
      onVoltarDaFicha={voltarDaFicha}
      onAbrirPlano={(planoId, alunoId) =>
        navigate(MENTOR_PATHS.alunoPlano(alunoId || studentId, planoId))}
    />
  );
};

export default MentorViewRoute;
