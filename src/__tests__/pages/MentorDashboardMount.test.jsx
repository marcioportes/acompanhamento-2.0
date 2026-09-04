/**
 * MentorDashboardMount.test.jsx — issue #144, pós-incidente de 04/09/2026.
 *
 * Este teste existe por causa de um bug que foi para PRODUÇÃO com a suíte verde,
 * o build verde e o lint sem erro novo: `selectedStudent` deixou de ser `useState`
 * no topo do componente e virou `useMemo` derivado da rota, mas foi declarado
 * DEPOIS de `selectedStudentTrades`, que o lê durante o render. TDZ —
 * `Cannot access 'K' before initialization` — e a tela do mentor inteira caía
 * em branco.
 *
 * Nada pegou porque **nenhum teste montava o MentorDashboard**: a suíte cobria
 * utilitários, hooks e componentes pequenos, e o teste de rotas stubava a página.
 * Erro de ordem de declaração só aparece executando o corpo do componente.
 *
 * Portanto o valor daqui é montar de verdade, com dado mínimo. Se ele quebrar,
 * a tela do mentor está quebrada — é a única promessa que ele faz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const TRADES = [
  {
    id: 't1', studentId: 'u9', studentEmail: 'aluno@ex.com', studentName: 'Aluno Um',
    ticker: 'WIN', date: '2026-09-01', result: 120, status: 'OPEN', planId: 'p1',
  },
];

vi.mock('../../hooks/useTrades', () => ({
  useTrades: () => ({
    allTrades: TRADES,
    loading: false,
    addFeedback: vi.fn(),
    addBulkFeedback: vi.fn(),
    getTradesByStudent: () => TRADES,
    getTradesGroupedByStudent: () => ({ 'aluno@ex.com': TRADES }),
    getUniqueStudents: () => [{ email: 'aluno@ex.com', name: 'Aluno Um', studentId: 'u9' }],
    getTradesAwaitingFeedback: () => [],
    getTradesByStudentAndStatus: () => [],
  }),
}));

vi.mock('../../hooks/usePlans', () => ({ usePlans: () => ({ plans: [] }) }));
vi.mock('../../hooks/useOrders', () => ({ default: () => ({ orders: [] }) }));
vi.mock('../../hooks/useSetups', () => ({ useSetups: () => ({ setups: [] }) }));
vi.mock('../../hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ subscriptions: [], students: [] }),
}));
vi.mock('../../hooks/useMentorClosureInbox', () => ({
  default: () => ({ inbox: [], pendingCount: 0, loading: false }),
}));
vi.mock('../../hooks/useMentorMaturityOverview', () => ({
  useMentorMaturityOverview: () => ({ map: new Map() }),
}));

// Descendentes que abrem Firestore por conta própria. O contrato deste teste é o
// corpo do MentorDashboard renderizar — não a árvore inteira funcionar offline.
vi.mock('../../components/cycleClosure/CycleExpiredGuard', () => ({ default: () => null }));
vi.mock('../../components/cycleClosure/CycleClosureModal', () => ({ default: () => null }));
vi.mock('../../components/cycleClosure/MentorClosuresInbox', () => ({ default: () => null }));
vi.mock('../../components/cycleClosure/MentorClosureView', () => ({ default: () => null }));
vi.mock('../../components/Students/DetalheDoAluno', () => ({ default: () => null }));
// recharts mede o container com ResizeObserver, que o jsdom não tem.
vi.mock('../../components/EquityCurve', () => ({ default: () => null }));
vi.mock('../../hooks/usePendingReviewsCount', () => ({
  default: () => ({ total: 0, porAluno: {}, alunosComRascunho: [] }),
}));
vi.mock('../../hooks/useMentorRiskRadar', () => ({
  default: () => ({
    dia: '2026-09-04',
    header: { alunos: 1, operaramHoje: 0, precisamDeVoce: 0, foraDoPlano: 0 },
    priority: [],
    turma: [],
    byStudent: [],
    diasDaTurma: {},
  }),
}));

import MentorDashboard from '../../pages/MentorDashboard';

const montar = (props = {}) =>
  render(
    <MemoryRouter>
      <MentorDashboard
        currentView="torre"
        onViewChange={vi.fn()}
        onNavigateToFeedback={vi.fn()}
        onAbrirAluno={vi.fn()}
        onVoltarDaFicha={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

describe('MentorDashboard — monta sem estourar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a Torre renderiza (o caso que caiu em produção)', () => {
    montar();
    expect(screen.getByText('Torre de Controle')).toBeInTheDocument();
  });

  it.each([
    ['overview', 'Análises'],
    ['pending', 'Aguardando Feedback'],
    ['closures', 'Fechamentos'],
    ['attention', 'Precisam Atenção'],
  ])('a view %s renderiza', (view, titulo) => {
    montar({ currentView: view });
    expect(screen.getByText(titulo)).toBeInTheDocument();
  });

  it('a ficha do aluno resolve o parâmetro da rota pelo studentId', () => {
    montar({ currentView: 'ficha', studentIdSelecionado: 'u9' });
    expect(screen.getByText('Aluno Um')).toBeInTheDocument();
  });

  it('a ficha também aceita email como parâmetro', () => {
    montar({ currentView: 'ficha', studentIdSelecionado: 'aluno@ex.com' });
    expect(screen.getByText('Aluno Um')).toBeInTheDocument();
  });

  it('id que não casa com ninguém dá tela de não encontrado, não tela branca', () => {
    montar({ currentView: 'ficha', studentIdSelecionado: 'nao-existe' });
    expect(screen.getByText('Aluno não encontrado')).toBeInTheDocument();
  });
});
