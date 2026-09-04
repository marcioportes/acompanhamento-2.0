/**
 * AppRoutes.test.jsx — issue #144 Fase A1.
 *
 * Smoke da tabela de endereços. Não testa o conteúdo das telas: testa que o
 * endereço leva à tela certa, que `/` conhece a porta de cada papel e que
 * endereço errado não vira tela em branco — os três defeitos que o modelo
 * antigo (`currentView` em string) não tinha como ter, porque não havia
 * endereço nenhum.
 *
 * As páginas são stubadas de propósito: cada uma monta Firestore de verdade e o
 * objetivo aqui é a árvore de rotas, não elas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockAuth = { user: { uid: 'u1' }, loading: false, isMentor: () => true };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }) => children,
}));

// A casca assina os listeners globais; aqui ela só precisa montar.
vi.mock('../../routes/AppShell', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => <div data-testid="shell"><Outlet context={{}} /></div>,
    useAppData: () => ({}),
  };
});

// Factory inline em cada mock: `vi.mock` é içado para o topo do arquivo, então
// um helper declarado aqui em cima ainda não existe quando a fábrica roda.
vi.mock('../../pages/LoginPage', () => ({ default: () => <div>login</div> }));
vi.mock('../../pages/AccountsPage', () => ({ default: () => <div>contas</div> }));
vi.mock('../../pages/SettingsPage', () => ({ default: () => <div>configuracoes</div> }));
vi.mock('../../pages/SubscriptionsPage', () => ({ default: () => <div>assinaturas</div> }));
vi.mock('../../pages/StudentsManagement', () => ({ default: () => <div>acompanhamento</div> }));
vi.mock('../../pages/StudentFeedbackPage', () => ({ default: () => <div>feedback-aluno</div> }));
vi.mock('../../pages/StudentReviewsPage', () => ({ default: () => <div>revisoes-aluno</div> }));
vi.mock('../../pages/StudentOnboardingPage', () => ({ default: () => <div>onboarding</div> }));
vi.mock('../../pages/ClosuresPage', () => ({ default: () => <div>ciclos</div> }));
vi.mock('../../pages/TradeReportPage', () => ({ default: () => <div>relatorio</div> }));
vi.mock('../../pages/PropFirmPage', () => ({ default: () => <div>mesa-prop</div> }));
vi.mock('../../components/Onboarding/BaselineReport', () => ({ default: () => <div>maturidade</div> }));
vi.mock('../../routes/comum/FeedbackRoute', () => ({ default: () => <div>trade</div> }));
vi.mock('../../routes/comum/LedgerRoute', () => ({ default: () => <div>extrato</div> }));
vi.mock('../../routes/mentor/MentorViewRoute', () => ({
  default: ({ view }) => <div>mentor:{view}</div>,
}));
vi.mock('../../routes/mentor/ReviewQueueRoute', () => ({ default: () => <div>fila-de-revisao</div> }));
vi.mock('../../routes/mentor/WeeklyReviewRoute', () => ({ default: () => <div>revisao-semanal</div> }));
vi.mock('../../routes/mentor/ComoAlunoRoute', () => ({ default: () => <div>como-aluno</div> }));
vi.mock('../../routes/aluno/PainelRoute', () => ({ default: () => <div>painel</div> }));
vi.mock('../../routes/aluno/GuardAssessment', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});

import AppRoutes from '../../routes/AppRoutes';

const irPara = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('AppRoutes — mentor', () => {
  beforeEach(() => {
    mockAuth = { user: { uid: 'u1' }, loading: false, isMentor: () => true };
  });

  it('a raiz leva à Torre — é a única porta', () => {
    irPara('/');
    expect(screen.getByText('mentor:torre')).toBeInTheDocument();
  });

  it.each([
    ['/torre', 'mentor:torre'],
    ['/analises', 'mentor:overview'],
    ['/pendencias/feedback', 'mentor:pending'],
    ['/pendencias/fechamentos', 'mentor:closures'],
    ['/pendencias/atencao', 'mentor:attention'],
    ['/pendencias/revisoes', 'fila-de-revisao'],
    ['/alunos', 'acompanhamento'],
    ['/alunos/u9', 'mentor:ficha'],
    ['/alunos/u9/como-aluno', 'como-aluno'],
    ['/alunos/u9/revisao/r1', 'revisao-semanal'],
    ['/alunos/u9/plano/p1', 'extrato'],
    ['/trades/t1', 'trade'],
    ['/contas', 'contas'],
    ['/assinaturas', 'assinaturas'],
    ['/configuracoes', 'configuracoes'],
  ])('%s abre %s', (path, esperado) => {
    irPara(path);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('endereço inexistente do mentor não vira tela em branco', () => {
    irPara('/pendencias/nao-existe');
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
  });
});

describe('AppRoutes — aluno', () => {
  beforeEach(() => {
    mockAuth = { user: { uid: 'u2' }, loading: false, isMentor: () => false };
  });

  it('a raiz leva ao painel', () => {
    irPara('/');
    expect(screen.getByText('painel')).toBeInTheDocument();
  });

  it.each([
    ['/painel', 'painel'],
    ['/feedback', 'feedback-aluno'],
    ['/revisoes', 'revisoes-aluno'],
    ['/ciclos', 'ciclos'],
    ['/relatorio', 'relatorio'],
    ['/mesa-prop', 'mesa-prop'],
    ['/maturidade', 'maturidade'],
    ['/plano/p1', 'extrato'],
    ['/trades/t1', 'trade'],
    ['/contas', 'contas'],
  ])('%s abre %s', (path, esperado) => {
    irPara(path);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('endereço inexistente não vira tela em branco', () => {
    irPara('/nao-existe');
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
  });
});
