/**
 * guards.test.jsx — issue #144 Fase A1.
 *
 * Antes, o papel era um `&& isMentor()` repetido em cada ramo do renderContent:
 * quem errasse o ramo entregava tela em branco. Com guard de rota, o aluno que
 * digita `/torre` é devolvido ao painel dele — e o mentor que cai numa rota de
 * aluno volta pra Torre.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let mockAuth = { user: { uid: 'u1' }, loading: false, isMentor: () => true };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

import { RequireAuth, RequireMentor, RequireStudent } from '../../routes/guards';

const montar = (entrada) =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/login" element={<div>tela de login</div>} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireMentor />}>
            <Route path="/torre" element={<div>torre</div>} />
          </Route>
          <Route element={<RequireStudent />}>
            <Route path="/painel" element={<div>painel</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('guards de rota', () => {
  beforeEach(() => {
    mockAuth = { user: { uid: 'u1' }, loading: false, isMentor: () => true };
  });

  it('mentor entra na Torre', () => {
    montar('/torre');
    expect(screen.getByText('torre')).toBeInTheDocument();
  });

  it('aluno que digita /torre cai no painel dele — não em tela de erro', () => {
    mockAuth = { user: { uid: 'u2' }, loading: false, isMentor: () => false };
    montar('/torre');
    expect(screen.getByText('painel')).toBeInTheDocument();
  });

  it('mentor que cai numa rota de aluno volta pra Torre', () => {
    montar('/painel');
    expect(screen.getByText('torre')).toBeInTheDocument();
  });

  it('sem sessão, qualquer endereço leva ao login', () => {
    mockAuth = { user: null, loading: false, isMentor: () => false };
    montar('/painel');
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('enquanto a sessão carrega, não decide papel nenhum', () => {
    mockAuth = { user: null, loading: true, isMentor: () => false };
    montar('/torre');
    expect(screen.queryByText('tela de login')).toBeNull();
    expect(screen.queryByText('torre')).toBeNull();
  });
});
