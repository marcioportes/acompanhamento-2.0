/**
 * #101 — o Stop × Gain virou marcação DENTRO do calendário (29/08, Marcio:
 * "prefiro que essa marcação de stop/gain seja feito num card só... dentro do
 * calendário"). Um gráfico de barras por dia da semana era um calendário com
 * menos informação: agregava semanas diferentes sob "Seg..Sex".
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TradingCalendar from '../../components/TradingCalendar';

const diasMeta = {
  '2026-08-24': { trades: 6, alunos: 2, flags: 1, gains: 2, losses: 4, r: -1.5, comR: 6, nomes: [] },
  '2026-08-27': { trades: 3, alunos: 1, flags: 0, gains: 3, losses: 0, r: 2.5, comR: 3, nomes: [] },
};
const foco = new Date(2026, 7, 15);

const montar = () => render(
  <TradingCalendar trades={[]} daysMeta={diasMeta} selectedDate={null} onSelectDate={() => {}} focusDate={foco} />,
);

describe('TradingCalendar — modo turma', () => {
  it('marca ganho e perda no dia', () => {
    const { getAllByText } = montar();
    expect(getAllByText('2').length).toBeGreaterThan(0); // ganhos de 24/08
    expect(getAllByText('4').length).toBeGreaterThan(0); // perdas de 24/08
  });

  it('soma o mês no cabeçalho: ganhos, perdas e líquido em R', () => {
    const { container } = montar();
    // O cabeçalho escreve "5g" e "4p" — 2+3 ganhos e 4+0 perdas do mês.
    expect(container.textContent).toContain('5g');
    expect(container.textContent).toContain('4p');
    expect(container.textContent).toContain('+1.0R'); // −1,5 + 2,5
  });

  it('não mostra dinheiro em lugar nenhum — a turma opera em duas moedas', () => {
    const { container } = montar();
    expect(container.textContent).not.toMatch(/R\$/);
  });

  it('mostra quantos alunos operaram no dia', () => {
    const { getAllByText } = montar();
    expect(getAllByText('2 alunos').length).toBe(1);
    expect(getAllByText('1 aluno').length).toBe(1);
  });
});
