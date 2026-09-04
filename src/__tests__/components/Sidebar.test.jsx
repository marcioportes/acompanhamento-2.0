/**
 * Sidebar.test.jsx — issue #119 task 26 (Fase J2); reescrito no #144 Fase A1.
 *
 * Cobre a ordem do menu do aluno ("Revisões" logo após "Feedback") e a separação
 * de papéis (o menu do mentor não tem item de aluno). O que mudou no #144: os
 * itens deixaram de emitir id por callback e viraram LINK — a asserção passa a
 * ser sobre o `href`, que é o contrato novo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockAuthState = {
  user: { email: 'aluno@example.com', displayName: 'Aluno' },
  logout: vi.fn(),
  isMentor: () => false,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../version', () => ({
  VERSION: { display: 'v0.0.0-test' },
  default: { display: 'v0.0.0-test' },
}));

// Hook do mentor inbox usa onSnapshot do Firestore — em jsdom sem mock, o
// `collection(db, ...)` quebra. Mockamos como no-op (pendingCount=0) pra
// preservar o foco do teste no menu sem render side-effects.
vi.mock('../../hooks/useMentorClosureInbox', () => ({
  default: () => ({ inbox: [], pendingCount: 0, loading: false }),
  useMentorClosureInbox: () => ({ inbox: [], pendingCount: 0, loading: false }),
}));

import Sidebar from '../../components/Sidebar';

const baseProps = {
  collapsed: false,
  onToggle: vi.fn(),
};

/** O menu é feito de NavLink: precisa de Router para montar. */
const renderSidebar = (props = {}) =>
  render(
    <MemoryRouter>
      <Sidebar {...baseProps} {...props} />
    </MemoryRouter>,
  );

describe('Sidebar — menu do aluno', () => {
  beforeEach(() => {
    mockAuthState = {
      user: { email: 'aluno@example.com', displayName: 'Aluno' },
      logout: vi.fn(),
      isMentor: () => false,
    };
  });

  it('renderiza item "Revisões" logo após "Feedback"', () => {
    const { container } = renderSidebar();

    const nav = container.querySelector('nav');
    const links = within(nav).getAllByRole('link');
    const labels = links.map((b) => b.textContent);

    const feedbackIdx = labels.findIndex((l) => /Feedback/.test(l));
    const reviewsIdx = labels.findIndex((l) => /^Revisões/.test(l));

    expect(feedbackIdx).toBeGreaterThanOrEqual(0);
    expect(reviewsIdx).toBe(feedbackIdx + 1);
  });

  it('"Revisões" do aluno aponta para /revisoes', () => {
    renderSidebar();
    expect(screen.getByText('Revisões').closest('a')).toHaveAttribute('href', '/revisoes');
  });
});

describe('Sidebar — menu do mentor', () => {
  beforeEach(() => {
    mockAuthState = {
      user: { email: 'mentor@example.com', displayName: 'Mentor' },
      logout: vi.fn(),
      isMentor: () => true,
    };
  });

  it('não mostra item de aluno', () => {
    renderSidebar();
    expect(screen.queryByText('Revisões')).toBeNull();
    expect(screen.queryByText('Ciclos Fechados')).toBeNull();
  });

  it('a Torre é o primeiro item e o destino do login', () => {
    const { container } = renderSidebar();
    const links = within(container.querySelector('nav')).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Torre de Controle');
    expect(links[0]).toHaveAttribute('href', '/torre');
  });

  it('#144 D1 — as quatro filas não são itens irmãos da Torre', () => {
    const { container } = renderSidebar();
    const labels = within(container.querySelector('nav')).getAllByRole('link').map((l) => l.textContent);

    // Elas continuam existindo como TELA (rotas /pendencias/*), mas a porta é a
    // Torre: no menu elas competiam com a triagem e contradiziam a premissa dela.
    for (const fila of ['Fila de Revisão', 'Aguardando Feedback', 'Precisam Atenção', 'Fechamentos']) {
      expect(labels).not.toContain(fila);
    }
    expect(labels).toEqual([
      'Torre de Controle',
      'Acompanhamento',
      'Contas',
      'Assinaturas',
      'Configurações',
    ]);
  });
});
