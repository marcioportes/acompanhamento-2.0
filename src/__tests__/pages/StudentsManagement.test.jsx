/**
 * StudentsManagement.test.jsx
 * @description Cobre filtro por plano, contagem dos chips, click→View As com
 *              stopPropagation nos botões filhos. Issue #263.
 * @see src/pages/StudentsManagement.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock DebugBadge (não testado aqui).
vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

// Mock AssessmentToggle — botão simples para validar stopPropagation.
vi.mock('../../components/Onboarding/AssessmentToggle', () => ({
  __esModule: true,
  default: ({ studentId }) => (
    <button data-testid={`assess-toggle-${studentId}`} onClick={(e) => e.stopPropagation()}>
      Assess
    </button>
  ),
}));

// Mock onSnapshot do Firestore — dispara síncrono com fixture configurável.
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

// Mock useSubscriptions — fonte do plano por aluno.
let mockSubscriptions = [];
let mockSubsLoading = false;
vi.mock('../../hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({
    subscriptions: mockSubscriptions,
    loading: mockSubsLoading,
  }),
}));

import StudentsManagement from '../../pages/StudentsManagement';

const makeStudent = (overrides = {}) => ({
  id: 'sid-1',
  name: 'Aluno Default',
  email: 'default@email.com',
  status: 'active',
  ...overrides,
});

const makeSub = (overrides = {}) => ({
  id: 'sub-1',
  studentId: 'sid-1',
  plan: 'alpha',
  status: 'active',
  renewalDate: new Date('2026-12-01'),
  ...overrides,
});

// Helper: stats card tem `<p>label</p>`; chip de filtro tem o label direto no <button>.
// Filtrar por tagName='P' desambigua os dois.
const getStatCardByLabel = (label) => {
  const labelEl = screen.getAllByText(label).find((el) => el.tagName === 'P');
  return labelEl.closest('div');
};

describe('StudentsManagement — filtro de plano + click→View As', () => {
  beforeEach(() => {
    mockStudents = [];
    mockSubscriptions = [];
    mockSubsLoading = false;
    vi.clearAllMocks();
  });

  it('conta chips por plano (Alpha + Espelho + Pendentes) e ignora alunos sem sub relevante', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'João Alpha Ativo', status: 'active' }),
      makeStudent({ id: 's2', name: 'Maria Alpha Pending', status: 'pending' }),
      makeStudent({ id: 's3', name: 'Rafael Espelho Ativo', status: 'active' }),
      makeStudent({ id: 's4', name: 'Sem Sub' }),
      makeStudent({ id: 's5', name: 'Cancelado', status: 'active' }),
    ];
    mockSubscriptions = [
      makeSub({ id: 'su1', studentId: 's1', plan: 'alpha', status: 'active' }),
      makeSub({ id: 'su2', studentId: 's2', plan: 'alpha', status: 'active' }),
      makeSub({ id: 'su3', studentId: 's3', plan: 'self_service', status: 'active' }),
      makeSub({ id: 'su5', studentId: 's5', plan: 'alpha', status: 'cancelled' }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    // Stats: Total=3 (s1,s2,s3 — s4 sem sub, s5 cancelada), Alpha=2, Espelho=1, Pendentes=1.
    expect(getStatCardByLabel('Total')).toHaveTextContent('3');
    expect(getStatCardByLabel('Alpha')).toHaveTextContent('2');
    expect(getStatCardByLabel('Espelho')).toHaveTextContent('1');
    expect(getStatCardByLabel('Pendentes')).toHaveTextContent('1');

    // Lista mostra os 3 do universo gerenciado.
    expect(screen.getByText('João Alpha Ativo')).toBeInTheDocument();
    expect(screen.getByText('Maria Alpha Pending')).toBeInTheDocument();
    expect(screen.getByText('Rafael Espelho Ativo')).toBeInTheDocument();
    expect(screen.queryByText('Sem Sub')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
  });

  it('chip "Espelho" filtra a lista para apenas alunos self_service', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'João Alpha' }),
      makeStudent({ id: 's3', name: 'Rafael Espelho' }),
    ];
    mockSubscriptions = [
      makeSub({ id: 'su1', studentId: 's1', plan: 'alpha' }),
      makeSub({ id: 'su3', studentId: 's3', plan: 'self_service' }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByText('João Alpha')).toBeInTheDocument();
    expect(screen.getByText('Rafael Espelho')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Espelho 1/i }));

    expect(screen.queryByText('João Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Rafael Espelho')).toBeInTheDocument();
  });

  it('múltiplas subs ativas: precedência por renewalDate desc (sub mais recente vence)', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'Migrante' }),
    ];
    // Aluno migrou de Espelho para Alpha; sub antiga Espelho ainda ativa.
    mockSubscriptions = [
      makeSub({ id: 'old', studentId: 's1', plan: 'self_service', renewalDate: new Date('2026-01-15') }),
      makeSub({ id: 'new', studentId: 's1', plan: 'alpha',        renewalDate: new Date('2026-06-01') }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    // Aluno aparece sob Alpha (sub mais recente).
    expect(getStatCardByLabel('Alpha')).toHaveTextContent('1');
    expect(getStatCardByLabel('Espelho')).toHaveTextContent('0');
  });

  it('click na row dispara onViewAsStudent com uid/email/name do aluno', () => {
    mockStudents = [
      makeStudent({ id: 's1', uid: 'uid-s1', name: 'João', email: 'joao@x.com' }),
    ];
    mockSubscriptions = [makeSub({ studentId: 's1', plan: 'alpha' })];
    const onViewAs = vi.fn();

    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    const row = screen.getByText('João').closest('[role="button"]');
    fireEvent.click(row);

    expect(onViewAs).toHaveBeenCalledTimes(1);
    expect(onViewAs).toHaveBeenCalledWith({
      uid: 'uid-s1',
      email: 'joao@x.com',
      name: 'João',
    });
  });

  it('click em AssessmentToggle não dispara onViewAsStudent (stopPropagation)', () => {
    mockStudents = [makeStudent({ id: 's1', name: 'João' })];
    mockSubscriptions = [makeSub({ studentId: 's1', plan: 'alpha' })];
    const onViewAs = vi.fn();

    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    fireEvent.click(screen.getByTestId('assess-toggle-s1'));

    expect(onViewAs).not.toHaveBeenCalled();
  });
});
