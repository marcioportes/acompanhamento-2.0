/**
 * #101 — a lista da turma tem dois layouts: cartão no celular, tabela no desktop.
 * Tabela de sete colunas rolando lateralmente é ilegível no telefone, e esta é a
 * tela onde o mentor bate o olho.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TorreTurma from '../../components/torre/TorreTurma';
import { FAIXA } from '../../utils/mentorRiskRadar';

const aluno = (extra = {}) => ({
  studentId: 'a1', name: 'Sandra Maria', email: 's@x.com', whatsappNumber: '+5521999999999',
  atencao: { faixa: FAIXA.RISCO_ALTO, motivo: 'padrão de risco grave na semana' },
  resultadoSemanaR: { valor: -8.3, comR: 9 },
  tradesSemana: new Array(9).fill({}),
  foraDoPlanoSemana: { pct: 22, direcao: 'up', regraPior: 'Risco acima do autorizado' },
  radar: { code: 'DIRECTION_FLIP', family: 'DIRECTION_FLIP', severity: 'HIGH', ocorrencias: 2 },
  pendencias: { feedback: 0 },
  diasSemOperar: 2,
  ...extra,
});

describe('TorreTurma — celular e desktop', () => {
  it('renderiza os dois layouts, cada um escondido no tamanho do outro', () => {
    const { container } = render(<TorreTurma turma={[aluno()]} total={1} />);
    expect(container.querySelector('.sm\\:hidden')).toBeTruthy();      // cartões
    expect(container.querySelector('.hidden.sm\\:block')).toBeTruthy(); // tabela
  });

  it('o cartão do celular carrega o essencial: nome, motivo, semana e risco', () => {
    const { container } = render(<TorreTurma turma={[aluno()]} total={1} />);
    const cartoes = container.querySelector('.sm\\:hidden');
    expect(cartoes.textContent).toContain('Sandra Maria');
    expect(cartoes.textContent).toContain('padrão de risco grave na semana');
    expect(cartoes.textContent).toContain('-8.3R');
    expect(cartoes.textContent).toContain('22% fora');
    expect(cartoes.textContent).toContain('Virada de mão');
  });

  it('o cartão não some com quem nunca operou', () => {
    const semNada = aluno({
      studentId: 'a2', name: 'Wagner Costa', diasSemOperar: null,
      atencao: { faixa: FAIXA.NUNCA_OPEROU, motivo: 'nunca registrou uma operação' },
      resultadoSemanaR: { valor: 0, comR: 0 }, tradesSemana: [], foraDoPlanoSemana: null, radar: null,
    });
    const { container } = render(<TorreTurma turma={[semNada]} total={1} />);
    expect(container.querySelector('.sm\\:hidden').textContent).toContain('Wagner Costa');
  });

  it('lista vazia diz que está vazia, sem renderizar layout nenhum', () => {
    const { container, getByText } = render(<TorreTurma turma={[]} total={10} filtro="hoje" />);
    expect(getByText('Nenhum aluno neste recorte.')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });
});
