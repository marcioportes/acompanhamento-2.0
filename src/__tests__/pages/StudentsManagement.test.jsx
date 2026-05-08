/**
 * StudentsManagement.test.jsx
 * @description Cobre a renderização da tabela com 6 buckets, stats (Alpha
 *              ativos / Espelho ativos / VIP / Vencendo ≤7d) e click→View As.
 * @see src/pages/StudentsManagement.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

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
  id: 's1', name: 'Default', email: 'd@x.com', status: 'active', accessTier: 'alpha', ...over,
});
const sub = (over = {}) => ({
  id: 'su1', studentId: 's1', plan: 'alpha', type: 'paid', status: 'active', ...over,
});

const getStatCardByLabel = (label) => {
  const labelEl = screen.getAllByText(label).find((el) => el.tagName === 'P');
  return labelEl.closest('div');
};

describe('StudentsManagement — tabela + 6 buckets (mockup #237 sobre modelo real)', () => {
  beforeEach(() => {
    mockStudents = [];
    mockSubscriptions = [];
    vi.clearAllMocks();
  });

  it('renderiza stats Alpha/Espelho/VIP/Vencendo ≤7d com classify+isExpiringSoon', () => {
    const inSeven = new Date(Date.now() + 3 * 86_400_000);
    mockStudents = [
      stu({ id: 'a1', name: 'João Alpha',     accessTier: 'alpha' }),
      stu({ id: 'a2', name: 'Maria Alpha',    accessTier: 'alpha' }),
      stu({ id: 'es', name: 'Mat Espelho',    accessTier: 'self_service', email: null }),
      stu({ id: 'vp', name: 'Cristian VIP',   accessTier: 'none' }),
      stu({ id: 'lf', name: 'Lead Fulano',    accessTier: 'none', email: null }),
      stu({ id: 'ex', name: 'Renato Ex',      accessTier: 'none', email: null }),
    ];
    mockSubscriptions = [
      sub({ id: 'sa1', studentId: 'a1', plan: 'alpha', type: 'paid', renewalDate: inSeven }),
      sub({ id: 'sa2', studentId: 'a2', plan: 'alpha', type: 'paid', renewalDate: new Date(Date.now() + 60 * 86_400_000) }),
      sub({ id: 'svp', studentId: 'vp', type: 'vip',                  status: 'active' }),
      sub({ id: 'sex', studentId: 'ex', plan: 'self_service', type: 'paid', status: 'cancelled' }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(getStatCardByLabel('Alpha ativos')).toHaveTextContent('2');
    expect(getStatCardByLabel('Espelho ativos')).toHaveTextContent('1');
    expect(getStatCardByLabel('VIP (não paga)')).toHaveTextContent('1');
    expect(getStatCardByLabel('Vencendo ≤7d')).toHaveTextContent('1'); // só sa1 cabe
  });

  it('chips contam os 6 buckets corretamente', () => {
    mockStudents = [
      stu({ id: 'a',  name: 'A',  accessTier: 'alpha' }),
      stu({ id: 'es', name: 'E',  accessTier: 'self_service' }),
      stu({ id: 'vp', name: 'V',  accessTier: 'none' }),
      stu({ id: 'lf', name: 'L',  accessTier: 'none' }),
      stu({ id: 'ex', name: 'X',  accessTier: 'none' }),
    ];
    mockSubscriptions = [
      sub({ id: 'svp', studentId: 'vp', type: 'vip', status: 'active' }),
      sub({ id: 'sex', studentId: 'ex', type: 'paid', status: 'cancelled' }),
    ];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Todos\s*5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mentoria Alpha\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Espelho\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lead\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ex\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VIP\s*1/i })).toBeInTheDocument();
  });

  it('chip "Lead" filtra para alunos sem sub e accessTier vazio', () => {
    mockStudents = [
      stu({ id: 'a',  name: 'João Alpha', accessTier: 'alpha' }),
      stu({ id: 'lf', name: 'Lead Maria', accessTier: 'none' }),
    ];
    mockSubscriptions = [];

    render(<StudentsManagement onViewAsStudent={vi.fn()} />);

    expect(screen.getByText('João Alpha')).toBeInTheDocument();
    expect(screen.getByText('Lead Maria')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lead\s*1/i }));

    expect(screen.queryByText('João Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Lead Maria')).toBeInTheDocument();
  });

  it('linha clicável (com email) dispara View As', () => {
    mockStudents = [stu({ id: 'a', uid: 'uid-a', name: 'João', email: 'j@x.com', accessTier: 'alpha' })];
    const onViewAs = vi.fn();
    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    const row = screen.getByText('João').closest('[role="button"]');
    fireEvent.click(row);

    expect(onViewAs).toHaveBeenCalledWith({ uid: 'uid-a', email: 'j@x.com', name: 'João' });
  });

  it('linha sem email não tem role=button e não navega', () => {
    mockStudents = [stu({ id: 'a', name: 'Sem Email', email: null, accessTier: 'none' })];
    const onViewAs = vi.fn();
    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    expect(screen.getByText('Sem Email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sem Email/i })).not.toBeInTheDocument();
    expect(onViewAs).not.toHaveBeenCalled();
  });

  it('click em AssessmentToggle não dispara View As', () => {
    mockStudents = [stu({ id: 'a', name: 'João', email: 'j@x.com', accessTier: 'alpha' })];
    const onViewAs = vi.fn();
    render(<StudentsManagement onViewAsStudent={onViewAs} />);

    fireEvent.click(screen.getByTestId('assess-toggle-a'));
    expect(onViewAs).not.toHaveBeenCalled();
  });
});
