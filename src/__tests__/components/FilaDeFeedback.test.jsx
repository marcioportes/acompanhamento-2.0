/**
 * #408 — a fila em árvore, com a seleção que veio da lista plana (#9).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import FilaDeFeedback from '../../components/feedback/FilaDeFeedback';
import { buildFilaDeFeedback } from '../../utils/filaDeFeedback';

const plano = { id: 'ago', name: 'Ago', pl: 4000, periodStop: 1, riskPerOperation: 1, operationPeriod: 'Diário' };
const sandra = [
  ['s1', '09:07', -40], ['s2', '09:13', -40], ['s3', '09:33', -10],
].map(([id, hora, result]) => ({
  id, studentId: 'sa', studentEmail: 's@x.com', studentName: 'Sandra Maria',
  date: '2026-08-26', status: 'OPEN', ticker: 'WINV26', side: 'SHORT', currency: 'BRL',
  planId: 'ago', result, entryTime: `2026-08-26T${hora}:00-03:00`,
}));
const fila = buildFilaDeFeedback({ pendentes: sandra, plans: [plano] });

describe('FilaDeFeedback', () => {
  it('abre sozinha quando há um aluno só — não obriga um clique inútil', () => {
    const { container } = render(<FilaDeFeedback fila={fila} />);
    expect(container.textContent).toContain('26/08/2026');
    expect(container.textContent).toContain('WINV26');
  });

  it('mostra o dia, a contagem e o plano no cabeçalho', () => {
    const { container } = render(<FilaDeFeedback fila={fila} />);
    expect(container.textContent).toContain('3 operações');
    expect(container.textContent).toContain('plano Ago');
  });

  it('a operação aberta depois do stop é declarada na linha', () => {
    const { container } = render(<FilaDeFeedback fila={fila} />);
    expect(container.textContent).toContain('Aberta depois do stop');
  });

  it('clicar na operação leva ao feedback do trade', () => {
    const abrir = vi.fn();
    const { container } = render(<FilaDeFeedback fila={fila} onAbrirTrade={abrir} />);
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent.includes('WINV26')));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0][0].id).toBe('s1');
  });

  it('a seleção do dia manda todos os ids de uma vez', () => {
    const selecionarDia = vi.fn();
    const { container } = render(
      <FilaDeFeedback fila={fila} selecionados={new Set()} onAlternarSelecao={() => {}} onSelecionarDia={selecionarDia} />,
    );
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'o dia'));
    expect(selecionarDia).toHaveBeenCalledWith(['s1', 's2', 's3']);
  });

  it('a barra de ação só aparece com seleção', () => {
    const { container, rerender } = render(
      <FilaDeFeedback fila={fila} selecionados={new Set()} onAlternarSelecao={() => {}} />,
    );
    expect(container.textContent).not.toContain('Escrever feedback para');
    rerender(<FilaDeFeedback fila={fila} selecionados={new Set(['s1', 's2'])} onAlternarSelecao={() => {}} />);
    expect(container.textContent).toContain('Escrever feedback para 2 operações');
  });

  it('selecionar uma operação não abre o trade', () => {
    const abrir = vi.fn();
    const alternar = vi.fn();
    const { container } = render(
      <FilaDeFeedback fila={fila} onAbrirTrade={abrir} selecionados={new Set()} onAlternarSelecao={alternar} />,
    );
    const caixas = [...container.querySelectorAll('button[title*="Selecionar"]')];
    fireEvent.click(caixas[0]);
    expect(alternar).toHaveBeenCalledWith('s1');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('fila vazia diz que está limpa', () => {
    const { container } = render(<FilaDeFeedback fila={[]} />);
    expect(container.textContent).toContain('A fila está limpa.');
  });
});
