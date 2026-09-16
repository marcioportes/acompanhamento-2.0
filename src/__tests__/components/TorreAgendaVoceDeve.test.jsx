/**
 * #444 — bloco 3 "Aguardando você" da Torre (M2).
 *
 * A unidade continua sendo a pessoa, mas quem tem trade pesado esperando feedback
 * vem primeiro, com ⚠ e "Priorizar →" levando à aba Precisam atenção.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import TorreAgenda from '../../components/torre/TorreAgenda';

const aluno = (studentId, name, pendencias) => ({ studentId, name, email: `${studentId}@x.com`, pendencias });

const turma = [
  aluno('ana', 'Ana Souza', { feedback: 4, pesados: 0, motivosPesados: [] }),
  aluno('joe', 'Joe Hott', { feedback: 2, pesados: 2, motivosPesados: ['UNPROTECTED_SIZE'] }),
  aluno('sandra', 'Sandra Maria', { feedback: 5, pesados: 3, motivosPesados: ['LOSS_CHASING', 'TILT'] }),
];

const blocoVoceDeve = (container) =>
  [...container.querySelectorAll('section')].find((s) => s.textContent.includes('Aguardando você'));

const linhas = (bloco) => [...bloco.querySelectorAll('section > div')].slice(1);

const renderAgenda = (props = {}) =>
  render(<TorreAgenda radar={{ priority: [], turma }} rascunhos={2} {...props} />);

describe('TorreAgenda — Aguardando você prioriza trades pesados (#444)', () => {
  it('pesados primeiro (por pesados desc), depois os demais', () => {
    const { container } = renderAgenda();
    const nomes = linhas(blocoVoceDeve(container)).map((l) => l.querySelector('.font-medium')?.textContent);
    expect(nomes).toEqual(['Sandra Maria', 'Joe Hott', 'Ana Souza', 'Revisões em rascunho']);
  });

  it('linha pesada: texto "N de M trades pesados · rótulos", ⚠ em warn e "Priorizar"', () => {
    const { container } = renderAgenda();
    const [sandra] = linhas(blocoVoceDeve(container));
    expect(sandra.textContent).toContain('3 de 5 trades pesados · Revenge trading, Tilt / reatividade');
    expect(sandra.textContent).toContain('Priorizar');
    expect(sandra.querySelector('svg').getAttribute('style')).toContain('var(--warn)');
    expect(sandra.getAttribute('style')).toContain('var(--warn)');
    const [, , ana] = linhas(blocoVoceDeve(container));
    expect(ana.querySelector('svg').getAttribute('style')).toContain('var(--info)');
  });

  it('clique na linha e em "Priorizar" chamam onIrParaAtencao, não o feedback', () => {
    const atencao = vi.fn();
    const feedback = vi.fn();
    const { container } = renderAgenda({ onIrParaAtencao: atencao, onIrParaFeedback: feedback });
    const [sandra] = linhas(blocoVoceDeve(container));
    fireEvent.click(sandra);
    fireEvent.click(within(sandra).getByText('Priorizar'));
    expect(atencao).toHaveBeenCalledTimes(2);
    expect(feedback).not.toHaveBeenCalled();
  });

  it('aluno sem pesado segue com ✉ "Escrever" e vai para o feedback', () => {
    const atencao = vi.fn();
    const feedback = vi.fn();
    const { container } = renderAgenda({ onIrParaAtencao: atencao, onIrParaFeedback: feedback });
    const ana = linhas(blocoVoceDeve(container))[2];
    expect(ana.textContent).toContain('4 trades esperam seu feedback');
    fireEvent.click(within(ana).getByText('Escrever'));
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(atencao).not.toHaveBeenCalled();
  });

  it('sem onIrParaAtencao, "Priorizar" cai para onIrParaFeedback', () => {
    const feedback = vi.fn();
    const { container } = renderAgenda({ onIrParaFeedback: feedback });
    fireEvent.click(within(linhas(blocoVoceDeve(container))[0]).getByText('Priorizar'));
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it('o número do bloco continua contando pessoas (3 alunos + rascunhos = 4)', () => {
    const { container } = renderAgenda();
    const cabecalho = blocoVoceDeve(container).querySelector('.panel-head');
    expect(cabecalho.lastElementChild.textContent).toBe('4');
  });

  it('radar antigo sem pesados não quebra: todos seguem como "Escrever"', () => {
    const legado = [aluno('ana', 'Ana Souza', { feedback: 1 })];
    const { container } = render(<TorreAgenda radar={{ priority: [], turma: legado }} />);
    const bloco = blocoVoceDeve(container);
    expect(bloco.textContent).toContain('1 trade espera seu feedback');
    expect(bloco.textContent).not.toContain('Priorizar');
  });
});
