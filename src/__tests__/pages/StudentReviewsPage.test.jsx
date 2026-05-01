/**
 * StudentReviewsPage.test.jsx
 * @description Testes da tela somente-leitura de revisões publicadas do aluno.
 *              Issue #119 task 25 / Fase J1.
 * @see src/pages/StudentReviewsPage.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

vi.mock('../../components/reviews/MaturityComparisonSection', () => ({
  __esModule: true,
  default: ({ current, previous }) => (
    <div data-testid="maturity-comparison">
      cmp:{current ? 'C' : '-'}/{previous ? 'P' : '-'}
    </div>
  ),
}));

const mockToggleAlunoDone = vi.fn();
let mockReviewsState = {
  reviews: [],
  isLoading: false,
  error: null,
  actionLoading: false,
  toggleAlunoDone: mockToggleAlunoDone,
};
let mockAuthState = {
  user: { uid: 'student-1' },
  isMentor: () => false,
};

vi.mock('../../hooks/useWeeklyReviews', () => ({
  useWeeklyReviews: () => mockReviewsState,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../hooks/useReviewMaturitySnapshot', () => ({
  useReviewMaturitySnapshot: (_studentId, review /* , planId */) => ({
    current: review?.frozenSnapshot?.maturitySnapshot ?? null,
    previous: null,
    loading: false,
    error: null,
  }),
}));

import StudentReviewsPage from '../../pages/StudentReviewsPage';

const makeReview = (overrides = {}) => ({
  id: 'rev-1',
  status: 'CLOSED',
  weekStart: '2026-04-13',
  weekEnd: '2026-04-19',
  planId: 'plan-1',
  takeawayItems: [],
  alunoDoneIds: [],
  sessionNotes: '',
  frozenSnapshot: {
    planContext: { planId: 'plan-1' },
    maturitySnapshot: { currentStage: 2, dimensionScores: {}, gates: [] },
  },
  ...overrides,
});

describe('StudentReviewsPage', () => {
  beforeEach(() => {
    mockToggleAlunoDone.mockReset();
    mockReviewsState = {
      reviews: [],
      isLoading: false,
      error: null,
      actionLoading: false,
      toggleAlunoDone: mockToggleAlunoDone,
    };
    mockAuthState = {
      user: { uid: 'student-1' },
      isMentor: () => false,
    };
  });

  it('estado vazio: renderiza mensagem "Você ainda não tem revisões publicadas."', () => {
    render(<StudentReviewsPage />);
    expect(
      screen.getByText(/Você ainda não tem revisões publicadas/i),
    ).toBeInTheDocument();
  });

  it('renderiza lista com 2 revisões em ordem desc por weekStart', () => {
    mockReviewsState.reviews = [
      makeReview({ id: 'rev-old', weekStart: '2026-04-06', weekEnd: '2026-04-12' }),
      makeReview({ id: 'rev-new', weekStart: '2026-04-13', weekEnd: '2026-04-19' }),
    ];
    render(<StudentReviewsPage />);
    const items = screen.getAllByTestId(/^review-item-/);
    expect(items).toHaveLength(2);
    // Mais nova primeiro
    expect(items[0].getAttribute('data-testid')).toBe('review-item-rev-new');
    expect(items[1].getAttribute('data-testid')).toBe('review-item-rev-old');
    // Datas BR formatadas
    expect(within(items[0]).getByText(/13\/04\/2026/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/06\/04\/2026/)).toBeInTheDocument();
  });

  it('expande detalhe ao clicar no item e mostra estado mentor-done vs aluno-done', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        takeawayItems: [
          { id: 't-mentor', text: 'Takeaway A (concluído)', done: true },
          { id: 't-aluno', text: 'Takeaway B (auto-marcado)', done: false },
          { id: 't-open', text: 'Takeaway C (pendente)', done: false },
        ],
        alunoDoneIds: ['t-aluno'],
      }),
    ];
    render(<StudentReviewsPage />);
    const item = screen.getByTestId('review-item-rev-1');
    const toggle = within(item).getAllByRole('button')[0];
    fireEvent.click(toggle);

    // Detalhe abriu — texto dos takeaways visível
    expect(screen.getByText('Takeaway A (concluído)')).toBeInTheDocument();
    expect(screen.getByText('Takeaway B (auto-marcado)')).toBeInTheDocument();
    expect(screen.getByText('Takeaway C (pendente)')).toBeInTheDocument();

    // Mentor-done → badge "encerrado pelo mentor" aparece (uma vez, só no t-mentor)
    expect(screen.getByText(/encerrado pelo mentor/i)).toBeInTheDocument();

    // 2 itens com aluno-done=true (t-mentor por done:true, t-aluno por alunoDoneIds)
    const pressed = screen.getAllByLabelText('Desmarcar como feito por mim');
    expect(pressed).toHaveLength(2);
    pressed.forEach((btn) => expect(btn).toHaveAttribute('aria-pressed', 'true'));

    // 1 item ainda em aberto
    const open = screen.getAllByLabelText('Marcar como feito por mim');
    expect(open).toHaveLength(1);
    expect(open[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar em "feito por mim" chama toggleAlunoDone com markDone correto', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        takeawayItems: [
          { id: 't-open', text: 'Item em aberto', done: false },
          { id: 't-aluno', text: 'Já marcado pelo aluno', done: false },
        ],
        alunoDoneIds: ['t-aluno'],
      }),
    ];
    render(<StudentReviewsPage />);
    const item = screen.getByTestId('review-item-rev-1');
    fireEvent.click(within(item).getAllByRole('button')[0]);

    // off → on: único item não-marcado
    const offBtn = screen.getByLabelText('Marcar como feito por mim');
    fireEvent.click(offBtn);
    expect(mockToggleAlunoDone).toHaveBeenCalledWith('rev-1', 't-open', true);

    // on → off: único item já marcado
    const onBtn = screen.getByLabelText('Desmarcar como feito por mim');
    fireEvent.click(onBtn);
    expect(mockToggleAlunoDone).toHaveBeenCalledWith('rev-1', 't-aluno', false);
  });

  it('revisão sem frozenSnapshot.maturitySnapshot exibe fallback "Comparativo indisponível"', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-old',
        frozenSnapshot: { planContext: { planId: 'plan-1' } }, // sem maturitySnapshot
      }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-old')).getAllByRole('button')[0]);
    expect(screen.getByText(/Comparativo indisponível/i)).toBeInTheDocument();
    expect(screen.queryByTestId('maturity-comparison')).toBeNull();
  });

  it('revisão com frozenSnapshot.maturitySnapshot renderiza MaturityComparisonSection', () => {
    mockReviewsState.reviews = [makeReview({ id: 'rev-1' })];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);
    expect(screen.getByTestId('maturity-comparison')).toBeInTheDocument();
  });

  it('mentor logado em view-as-aluno: NÃO renderiza conteúdo, mostra mensagem de redirecionamento', () => {
    mockAuthState = {
      user: { uid: 'mentor-1' },
      isMentor: () => true,
    };
    mockReviewsState.reviews = [makeReview({ id: 'rev-1' })];
    render(<StudentReviewsPage />);
    expect(
      screen.getByText(/Esta tela é do aluno\. Mentor use a Fila de Revisão/i),
    ).toBeInTheDocument();
    // Lista não deve aparecer
    expect(screen.queryByTestId(/^review-item-/)).toBeNull();
    // DebugBadge ainda presente (INV-04)
    expect(screen.getByTestId('debug-badge')).toHaveTextContent('StudentReviewsPage');
  });

  it('inclui DebugBadge component="StudentReviewsPage" (INV-04)', () => {
    render(<StudentReviewsPage />);
    expect(screen.getByTestId('debug-badge')).toHaveTextContent('StudentReviewsPage');
  });

  it('mostra notas do mentor quando sessionNotes preenchido', () => {
    mockReviewsState.reviews = [
      makeReview({ id: 'rev-1', sessionNotes: 'Nota mentor:\nlinha 2' }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);
    expect(screen.getByText(/Nota mentor:/)).toBeInTheDocument();
  });

  it('fallback "Sem notas desta sessão" quando sessionNotes vazio', () => {
    mockReviewsState.reviews = [makeReview({ id: 'rev-1', sessionNotes: '' })];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);
    expect(screen.getByText(/Sem notas desta sessão/i)).toBeInTheDocument();
  });

  it('seção Reunião: renderiza anchors para meetingLink e videoLink quando presentes', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        meetingLink: 'https://zoom.us/j/abc123',
        videoLink: 'https://loom.com/share/xyz',
      }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);

    const section = screen.getByTestId('review-meeting-section');
    const meetingAnchor = within(section).getByRole('link', { name: /Link da reunião/i });
    const videoAnchor = within(section).getByRole('link', { name: /Link da gravação/i });

    expect(meetingAnchor).toHaveAttribute('href', 'https://zoom.us/j/abc123');
    expect(meetingAnchor).toHaveAttribute('target', '_blank');
    expect(meetingAnchor).toHaveAttribute('rel', expect.stringContaining('noopener'));

    expect(videoAnchor).toHaveAttribute('href', 'https://loom.com/share/xyz');
  });

  it('seção Reunião: omitida quando meetingLink e videoLink vazios', () => {
    mockReviewsState.reviews = [makeReview({ id: 'rev-1', meetingLink: '', videoLink: '' })];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);
    expect(screen.queryByTestId('review-meeting-section')).toBeNull();
  });

  it('seção Reunião: renderiza só o link presente (meetingLink sem videoLink)', () => {
    mockReviewsState.reviews = [
      makeReview({ id: 'rev-1', meetingLink: 'https://meet.google.com/abc-def', videoLink: '' }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);

    const section = screen.getByTestId('review-meeting-section');
    expect(within(section).getByRole('link', { name: /Link da reunião/i })).toHaveAttribute(
      'href',
      'https://meet.google.com/abc-def',
    );
    expect(within(section).queryByRole('link', { name: /Link da gravação/i })).toBeNull();
  });

  it('seção Takeaways: NÃO renderiza campo legado review.takeaways (string) — só takeawayItems[]', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        takeaways: 'Observação legacy órfã que NÃO deve aparecer',
        takeawayItems: [],
      }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);

    expect(screen.queryByTestId('review-takeaways-text')).toBeNull();
    expect(screen.queryByText(/Observação legacy órfã/i)).toBeNull();
    expect(screen.getByText(/Nenhum takeaway nesta revisão/i)).toBeInTheDocument();
  });

  it('seção Takeaways: renderiza checklist quando há takeawayItems[]', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        takeaways: 'lixo legado a ignorar',
        takeawayItems: [{ id: 't-1', text: 'Ação estruturada', done: false }],
      }),
    ];
    render(<StudentReviewsPage />);
    fireEvent.click(within(screen.getByTestId('review-item-rev-1')).getAllByRole('button')[0]);
    expect(screen.queryByTestId('review-takeaways-text')).toBeNull();
    expect(screen.getByText('Ação estruturada')).toBeInTheDocument();
  });

  it('header do item: indica "reunião" no resumo quando há link, ignora campo takeaways legado', () => {
    mockReviewsState.reviews = [
      makeReview({
        id: 'rev-1',
        takeaways: 'obs legacy',
        meetingLink: 'https://zoom.us/j/abc',
      }),
    ];
    render(<StudentReviewsPage />);
    const item = screen.getByTestId('review-item-rev-1');
    expect(within(item).queryByText(/com observações/i)).toBeNull();
    expect(within(item).getByText(/reunião/i)).toBeInTheDocument();
  });

  it('header do item: omite marcador "reunião" quando campos vazios', () => {
    mockReviewsState.reviews = [makeReview({ id: 'rev-1' })];
    render(<StudentReviewsPage />);
    const item = screen.getByTestId('review-item-rev-1');
    expect(within(item).queryByText(/·\s*reunião/i)).toBeNull();
  });
});
