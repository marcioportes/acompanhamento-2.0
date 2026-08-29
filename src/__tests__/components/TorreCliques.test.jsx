/**
 * #101 — "a maioria dos cards ou informação que é clicável não está funcionando".
 *
 * O defeito era afordância sem função: a linha inteira tinha `hover:bg`, mas só o
 * botão da seta tinha `onClick`. O mentor clicava na linha e nada acontecia.
 * Estes testes travam o contrário: quem parece clicável, clica.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TorreTurma from '../../components/torre/TorreTurma';
import TorrePrioridade from '../../components/torre/TorrePrioridade';
import { FAIXA } from '../../utils/mentorRiskRadar';
import { TRIGGER } from '../../utils/mentorRiskRadar';

const aluno = {
  studentId: 'a1', name: 'Sandra Maria', email: 's@x.com', whatsappNumber: '+5521999999999',
  atencao: { faixa: FAIXA.RISCO_ALTO, motivo: 'padrão de risco grave na semana' },
  resultadoSemanaR: { valor: -8.3, comR: 9 }, tradesSemana: new Array(9).fill({}),
  foraDoPlanoSemana: { pct: 22, direcao: 'up', regraPior: 'Risco acima do autorizado' },
  radar: { code: 'DIRECTION_FLIP', family: 'DIRECTION_FLIP', severity: 'HIGH', ocorrencias: 2 },
  pendencias: { feedback: 0 }, diasSemOperar: 2,
};

describe('cliques da Torre', () => {
  it('a linha da turma abre a ficha, não só a seta', () => {
    const abrir = vi.fn();
    const { container } = render(<TorreTurma turma={[aluno]} total={1} onAbrirAluno={abrir} />);
    fireEvent.click(container.querySelector('tbody tr'));
    expect(abrir).toHaveBeenCalledWith({ email: 's@x.com', name: 'Sandra Maria', studentId: 'a1' });
  });

  it('o cartão do celular também abre a ficha', () => {
    const abrir = vi.fn();
    const { container } = render(<TorreTurma turma={[aluno]} total={1} onAbrirAluno={abrir} />);
    fireEvent.click(container.querySelector('.sm\\:hidden > div'));
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('o WhatsApp não arrasta a linha junto — abre só a conversa', () => {
    const abrir = vi.fn();
    const { container } = render(<TorreTurma turma={[aluno]} total={1} onAbrirAluno={abrir} />);
    const link = container.querySelector('tbody a[href^="https://wa.me"]');
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('nenhuma linha da turma tem hover sem clique', () => {
    const { container } = render(<TorreTurma turma={[aluno]} total={1} onAbrirAluno={() => {}} />);
    const tr = container.querySelector('tbody tr');
    expect(tr.className).toContain('cursor-pointer');
  });

  it('a linha da prioridade abre a ficha', () => {
    const abrir = vi.fn();
    const priority = [{ ...aluno, prioridade: { trigger: TRIGGER.FURIA, motivo: 'reatividade após perda' } }];
    const { container } = render(<TorrePrioridade priority={priority} onAbrirAluno={abrir} />);
    fireEvent.click(container.querySelector('.divide-y > div'));
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe('botões dentro da linha não disparam duas vezes', () => {
  it('a seta abre a ficha uma vez só', () => {
    const abrir = vi.fn();
    const { container } = render(<TorreTurma turma={[aluno]} total={1} onAbrirAluno={abrir} />);
    fireEvent.click(container.querySelector('tbody button[title="Abrir ficha"]'));
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});
