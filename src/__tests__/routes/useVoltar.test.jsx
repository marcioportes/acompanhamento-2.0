/**
 * useVoltar.test.jsx — issue #144 Fase A2.
 *
 * O "voltar" deixou de ser regra escrita à mão por par origem→destino (eram oito
 * estados de retorno no App). Sobrou UM caso que o histórico não resolve: quem
 * abriu o link direto — do WhatsApp, em aba nova — não tem para onde voltar, e
 * aí o botão precisa levar à porta do papel em vez de tirar a pessoa do app.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { useVoltar } from '../../routes/useVoltar';

const Tela = ({ nome }) => {
  const voltar = useVoltar('/torre');
  return (
    <div>
      <span>{nome}</span>
      <button onClick={voltar}>voltar</button>
    </div>
  );
};

const montar = (entrada) =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/torre" element={<div>torre<Link to="/trades/t1">ir</Link></div>} />
        <Route path="/trades/:id" element={<Tela nome="trade" />} />
      </Routes>
    </MemoryRouter>,
  );

describe('useVoltar', () => {
  it('entrada direta no endereço volta para o fallback, não para fora do app', async () => {
    montar('/trades/t1');
    screen.getByText('voltar').click();
    expect(await screen.findByText('torre')).toBeInTheDocument();
  });

  it('quem navegou até aqui volta para a tela anterior', async () => {
    montar('/torre');
    screen.getByText('ir').click();
    expect(await screen.findByText('trade')).toBeInTheDocument();
    screen.getByText('voltar').click();
    expect(await screen.findByText('torre')).toBeInTheDocument();
  });
});
