/**
 * guards.jsx — autorização na ROTA, não na página (issue #144, Fase A1)
 *
 * Antes, cada tela do mentor carregava seu próprio `&& isMentor()` no meio do
 * `renderContent` do App. Com rota, o papel é condição de acesso ao endereço:
 * a página não precisa saber quem entrou, e um aluno que digita `/torre` na
 * barra é devolvido ao painel dele em vez de ver uma tela em branco.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from '../components/Loading';
import { PUBLIC_PATHS, homePath } from './paths';

/** Sessão obrigatória. Guarda a origem para devolver o usuário ao lugar certo pós-login. */
export const RequireAuth = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading fullScreen text="Carregando..." />;
  if (!user) return <Navigate to={PUBLIC_PATHS.login} state={{ from: location }} replace />;
  return <Outlet />;
};

/** Só mentor. Aluno cai no painel dele — não numa tela de erro. */
export const RequireMentor = () => {
  const { isMentor } = useAuth();
  if (!isMentor()) return <Navigate to={homePath(false)} replace />;
  return <Outlet />;
};

/** Só aluno. Mentor cai na Torre. */
export const RequireStudent = () => {
  const { isMentor } = useAuth();
  if (isMentor()) return <Navigate to={homePath(true)} replace />;
  return <Outlet />;
};
