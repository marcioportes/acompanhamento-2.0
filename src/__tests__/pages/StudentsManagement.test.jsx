/**
 * StudentsManagement.test.jsx
 * @description Tabela com 3 buckets visíveis (Alpha/Espelho/Trial). VIP e
 *              alunos sem sub ativa não aparecem. Issue #263.
 * @see src/pages/StudentsManagement.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

vi.mock('../../components/Onboarding/AssessmentToggle', () => ({
  __esModule: true,
  default: ({ studentId }) => (
    <button data-testid={`assess-toggle-${studentId}`} onClick={(e) => e.stopPropagation()}>
      Assess
    </button>
  ),
}));

let mockStudents = [];
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn((_q, cb) => {
    cb({ docs: mockStudents.map((s) => ({ id: s.id, data: () => s })) });
    return () => {};
  }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { uid: 'new-uid' } })),
}));

vi.mock('../../firebase', () => ({ db: {} }));

let mockSubscriptions = [];
vi.mock('../../hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ subscriptions: mockSubscriptions, loading: false }),
}));

import StudentsManagement from '../../pages/StudentsManagement';

const stu = (over = {}) => ({
  id: 's1', name: 'Default', email: 'd@x.com', status: 'active', ...over,
});
const sub = (over = {}) => ({
  id: 'su1', studentId: 's1', plan: 'alpha', type: 'paid', status: 'active', renewalDate: new Date(Date.now() + 60 * 86_400_000), ...over,
});

const getStatCardByLabel = (label) => {
  const labelEl = screen.getAllByText(label).find((el) => el.tagName === 'P');
  return labelEl.closest('div');
};

describe('StudentsManagement — 3 buckets (Alpha / Espelho / Trial)', () => {
  beforeEach(() => {
    mockStudents = [];
    mockSubscriptions = [];
    vi.clearAllMocks();
  });

  it('stats Alpha/Espelho/Trial/Vencendo ≤7d', () => {
    const inSeven = new Date(Date.now() + 3 * 86_400_000);
    mockStudents = [
      stu({ id: 'a1', name: 'João Alpha' }),
      stu({ id: 'a2', name: 'Maria Alpha' }),
      stu({ id: 'es', name: 'Mat Espelho', email: 'mat@x.com' }),
      stu({ id: 't1', name: 'Pedro Trial Alpha' }),
      stu({ id: 't2', name: 'Ana Trial Espelho', email: 'ana@x.com' }),
    ];
    mockSubscriptions = [
      sub({ id: 'sa1', studentId: 'a1', plan: 'alpha', type: 'paid', renewalDate: inSeven }),
      sub({ id: 'sa2', studentId: 'a2', plan: 'alpha', type: 'paid' }),
      sub({ id: 'ses', studentId: 'es', plan: 'self_service', type: 'paid' }),
      sub({ id: 'st1', studentId: 't1', plan: 'alpha',        type: 'trial', trialEndsAt: new Date(Date.now() + 30 * 86_400_000) }),
      sub({ id: 'st2', studentId: 't2', plan: 'self_service', type: 'trial', trialEndsAt: new Date(Date.now() + 30 * 86_400_000) }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(getStatCardByLabel('Alpha')).toHaveTextContent('2');
    expect(getStatCardByLabel('Espelho')).toHaveTextContent('1');
    expect(getStatCardByLabel('Trial')).toHaveTextContent('2');
    expect(getStatCardByLabel('Vencendo ≤7d')).toHaveTextContent('1');
  });

  it('chips contam Todos/Alpha/Espelho/Trial; Trial agrega trial-alpha + trial-espelho', () => {
    mockStudents = [
      stu({ id: 'a',  name: 'A' }),
      stu({ id: 'es', name: 'E' }),
      stu({ id: 't1', name: 'T1' }),
      stu({ id: 't2', name: 'T2' }),
    ];
    mockSubscriptions = [
      sub({ studentId: 'a',  plan: 'alpha',        type: 'paid' }),
      sub({ studentId: 'es', plan: 'self_service', type: 'paid' }),
      sub({ studentId: 't1', plan: 'alpha',        type: 'trial', trialEndsAt: new Date(Date.now() + 86_400_000 * 30) }),
      sub({ studentId: 't2', plan: 'self_service', type: 'trial', trialEndsAt: new Date(Date.now() + 86_400_000 * 30) }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Todos\s*4/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mentoria Alpha\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Espelho\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trial\s*2/i })).toBeInTheDocument();
  });

  it('VIP ativo some; sem sub + sem ritual sai; sem sub mas em ritual entra (DEC-AUTO-263-10)', () => {
    mockStudents = [
      stu({ id: 'a',  name: 'João Alpha' }),
      stu({ id: 'vp', name: 'Cristian VIP' }),
      stu({ id: 'ex', name: 'Renato Cancelado' }),
      stu({ id: 'lf', name: 'Aluno No Ritual', status: 'pending' }),
    ];
    mockSubscriptions = [
      sub({ studentId: 'a',  plan: 'alpha', type: 'paid', status: 'active' }),
      sub({ studentId: 'vp', type: 'vip',                 status: 'active' }),
      sub({ studentId: 'ex', plan: 'self_service', type: 'paid', status: 'cancelled' }),
      // 'lf' sem sub atribuída — passou pelo callable createStudent (status=pending),
      // entra no bucket "Aguardando plano".
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByText('João Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Cristian VIP')).not.toBeInTheDocument();      // VIP ativo
    expect(screen.queryByText('Renato Cancelado')).not.toBeInTheDocument();  // sub cancelada + sem ritual
    expect(screen.getByText('Aluno No Ritual')).toBeInTheDocument();         // ritual em curso
  });

  it('chip "Aguardando plano" só aparece quando há alguém nesse estado', () => {
    mockStudents = [stu({ id: 'a', name: 'João' })];
    mockSubscriptions = [sub({ studentId: 'a', plan: 'alpha', type: 'paid' })];

    const { unmount } = render(<StudentsManagement onViewAsStudent={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Aguardando plano/i })).not.toBeInTheDocument();
    unmount();

    mockStudents = [
      stu({ id: 'a', name: 'João' }),
      stu({ id: 'b', name: 'Pendente sem plano', status: 'pending' }),
    ];
    render(<StudentsManagement onViewAsStudent={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Aguardando plano\s*1/i })).toBeInTheDocument();
  });

  it('chip Trial filtra para trial-alpha + trial-espelho', () => {
    mockStudents = [
      stu({ id: 'a',  name: 'João Alpha' }),
      stu({ id: 't1', name: 'Pedro Trial' }),
    ];
    mockSubscriptions = [
      sub({ studentId: 'a',  plan: 'alpha', type: 'paid' }),
      sub({ studentId: 't1', plan: 'alpha', type: 'trial', trialEndsAt: new Date(Date.now() + 30 * 86_400_000) }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Trial\s*1/i }));

    expect(screen.queryByText('João Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Pedro Trial')).toBeInTheDocument();
  });

  it('botão Eye dispara View As; aluno sem email aparece como Candidato (DEC-AUTO-263-06 revogada)', () => {
    mockStudents = [
      stu({ id: 'a', uid: 'uid-a', name: 'João', email: 'j@x.com' }),
      stu({ id: 'student_xyz', name: 'Sem Email', email: null }),
    ];
    mockSubscriptions = [
      sub({ studentId: 'a', plan: 'alpha',        type: 'paid' }),
      sub({ studentId: 'student_xyz', plan: 'self_service', type: 'paid' }),
    ];
    const onViewAs = vi.fn();
    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    // B8 (DEC-AUTO-263-08): View As vira ícone próprio, linha não-clickable.
    const eyeBtn = screen.getByLabelText(/Entrar no dashboard de João/);
    fireEvent.click(eyeBtn);
    expect(onViewAs).toHaveBeenCalledWith({ uid: 'uid-a', email: 'j@x.com', name: 'João' });

    // Candidato sem email APARECE em Acompanhamento — Marcio: "Acompanhamento
    // é o lugar do registro" (2026-05-09). Mentor cadastra email no drawer
    // durante o ritual.
    expect(screen.getByText('Sem Email')).toBeInTheDocument();
  });

  it('click em AssessmentToggle não dispara View As', () => {
    mockStudents = [stu({ id: 'a', name: 'João', email: 'j@x.com' })];
    mockSubscriptions = [sub({ studentId: 'a', plan: 'alpha', type: 'paid' })];
    const onViewAs = vi.fn();
    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    fireEvent.click(screen.getByTestId('assess-toggle-a'));
    expect(onViewAs).not.toHaveBeenCalled();
  });
});
