/**
 * StudentsManagement.test.jsx
 * @description Cobre filtro Alpha/Espelho derivado de student.accessTier (hipótese 3),
 *              click→View As com stopPropagation, bloqueio de click sem email.
 *              Issue #263.
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

import StudentsManagement from '../../pages/StudentsManagement';

const makeStudent = (overrides = {}) => ({
  id: 'sid-1',
  name: 'Aluno Default',
  email: 'default@email.com',
  status: 'active',
  accessTier: 'alpha',
  ...overrides,
});

// Helper: stats card tem `<p>label</p>`; chip de filtro tem o label direto no <button>.
const getStatCardByLabel = (label) => {
  const labelEl = screen.getAllByText(label).find((el) => el.tagName === 'P');
  return labelEl.closest('div');
};

describe('StudentsManagement — hipótese 3 (accessTier-based)', () => {
  beforeEach(() => {
    mockStudents = [];
    vi.clearAllMocks();
  });

  it('Alpha = accessTier="alpha"; Espelho = todo o resto (none, self_service, null, undefined)', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'João Alpha',           accessTier: 'alpha' }),
      makeStudent({ id: 's2', name: 'Maria Alpha Pendente', accessTier: 'alpha',        status: 'pending' }),
      makeStudent({ id: 's3', name: 'Matheus Espelho',      accessTier: 'self_service', email: null }),
      makeStudent({ id: 's4', name: 'Renato Cancelado',     accessTier: 'none',         email: null }),
      makeStudent({ id: 's5', name: 'Lead Sem Tier',        accessTier: undefined,      email: null }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(getStatCardByLabel('Total')).toHaveTextContent('5');
    expect(getStatCardByLabel('Alpha')).toHaveTextContent('2');
    expect(getStatCardByLabel('Espelho')).toHaveTextContent('3');
    expect(getStatCardByLabel('Pendentes')).toHaveTextContent('1');

    expect(screen.getByText('João Alpha')).toBeInTheDocument();
    expect(screen.getByText('Maria Alpha Pendente')).toBeInTheDocument();
    expect(screen.getByText('Matheus Espelho')).toBeInTheDocument();
    expect(screen.getByText('Renato Cancelado')).toBeInTheDocument();
    expect(screen.getByText('Lead Sem Tier')).toBeInTheDocument();
  });

  it('chip "Espelho" filtra para alunos com accessTier !== "alpha"', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'João Alpha',     accessTier: 'alpha' }),
      makeStudent({ id: 's2', name: 'Matheus Espelho', accessTier: 'self_service' }),
      makeStudent({ id: 's3', name: 'Renato None',     accessTier: 'none' }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByText('João Alpha')).toBeInTheDocument();
    expect(screen.getByText('Matheus Espelho')).toBeInTheDocument();
    expect(screen.getByText('Renato None')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Espelho 2/i }));

    expect(screen.queryByText('João Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Matheus Espelho')).toBeInTheDocument();
    expect(screen.getByText('Renato None')).toBeInTheDocument();
  });

  it('click na row dispara onViewAsStudent quando aluno tem email', () => {
    mockStudents = [
      makeStudent({ id: 's1', uid: 'uid-s1', name: 'João', email: 'joao@x.com', accessTier: 'alpha' }),
    ];
    const onViewAs = vi.fn();

    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    const row = screen.getByText('João').closest('[role="button"]');
    fireEvent.click(row);

    expect(onViewAs).toHaveBeenCalledWith({
      uid: 'uid-s1',
      email: 'joao@x.com',
      name: 'João',
    });
  });

  it('aluno sem email não tem role=button (não navega) e mostra "sem email"', () => {
    mockStudents = [
      makeStudent({ id: 's1', name: 'Lead Sem Email', email: null, accessTier: 'none' }),
    ];
    const onViewAs = vi.fn();

    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    expect(screen.getByText('sem email')).toBeInTheDocument();
    // Sem role=button na row → não há candidato pra fireEvent.click navegar.
    expect(screen.queryByRole('button', { name: /Lead Sem Email/i })).not.toBeInTheDocument();
    expect(onViewAs).not.toHaveBeenCalled();
  });

  it('click em AssessmentToggle não dispara onViewAsStudent (stopPropagation)', () => {
    mockStudents = [makeStudent({ id: 's1', name: 'João', accessTier: 'alpha' })];
    const onViewAs = vi.fn();

    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    fireEvent.click(screen.getByTestId('assess-toggle-s1'));

    expect(onViewAs).not.toHaveBeenCalled();
  });
});
