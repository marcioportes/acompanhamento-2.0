import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OpenConversationsNotice from '../../../components/cycleClosure/OpenConversationsNotice';

const trades = [
  { id: 'a', date: '2026-10-30', ticker: 'WINZ26', status: 'REVIEWED' },
  { id: 'b', date: '2026-10-29', ticker: 'WINZ26', status: 'QUESTION' },
];

describe('#497 — OpenConversationsNotice', () => {
  it('sem pendência não renderiza nada', () => {
    const { container } = render(<OpenConversationsNotice trades={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it('lista os trades com data BR e o texto do status', () => {
    render(<OpenConversationsNotice trades={trades} onOpenTrade={() => {}} />);
    expect(screen.getByText('2 trades deste ciclo ainda têm conversa em aberto')).toBeTruthy();
    expect(screen.getByText('30/10')).toBeTruthy();
    expect(screen.getByText('Revisado — falta você encerrar')).toBeTruthy();
    expect(screen.getByText('Dúvida — aguardando o mentor')).toBeTruthy();
  });
  it('singular com 1 trade', () => {
    render(<OpenConversationsNotice trades={[trades[0]]} />);
    expect(screen.getByText('1 trade deste ciclo ainda tem conversa em aberto')).toBeTruthy();
  });
  it('"Abrir" chama onOpenTrade com o trade', () => {
    const onOpen = vi.fn();
    render(<OpenConversationsNotice trades={trades} onOpenTrade={onOpen} />);
    fireEvent.click(screen.getAllByText('Abrir')[1]);
    expect(onOpen).toHaveBeenCalledWith(trades[1]);
  });
  it('sem onOpenTrade (painel do mentor) não mostra o atalho', () => {
    render(<OpenConversationsNotice trades={trades} />);
    expect(screen.queryByText('Abrir')).toBeNull();
  });
});
