/**
 * #101 — as barras vinham com altura em PORCENTAGEM dentro de um pai sem altura
 * definida: o DOM estava correto e no navegador o gráfico aparecia vazio
 * ("stop e gain não aparece nada", 29/08). Este teste trava a altura em pixels.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TorreStopGain from '../../components/torre/TorreStopGain';

const semana = {
  dias: [
    { label: 'Seg', gains: 2, losses: 4 },
    { label: 'Ter', gains: 1, losses: 6 },
    { label: 'Qua', gains: 1, losses: 7 },
    { label: 'Qui', gains: 0, losses: 3 },
    { label: 'Sex', gains: 0, losses: 1 },
  ],
  liquidoR: -13.36, comR: 25, semR: 0, total: 25,
};

const alturasDasBarras = (container) =>
  [...container.querySelectorAll('div[style*="height"]')]
    .map((el) => el.getAttribute('style'))
    .filter((st) => st.includes('px'));

describe('TorreStopGain', () => {
  it('desenha as barras com altura em pixels, nunca em porcentagem', () => {
    const { container } = render(<TorreStopGain stopGain={semana} />);
    const alturas = alturasDasBarras(container);
    expect(alturas.length).toBeGreaterThan(0);
    expect(alturas.some((st) => st.includes('%'))).toBe(false);
  });

  it('a maior barra é a maior contagem, e nenhuma barra some por ser pequena', () => {
    const { container } = render(<TorreStopGain stopGain={semana} />);
    const px = [...container.querySelectorAll('div[style*="px"]')]
      .map((el) => Number(/height:\s*([\d.]+)px/.exec(el.getAttribute('style'))?.[1] ?? 0))
      .filter((n) => n > 0 && n < 120);
    expect(Math.min(...px)).toBeGreaterThanOrEqual(3); // 1 trade continua visível
    expect(Math.max(...px)).toBeLessThanOrEqual(120);
  });

  it('mostra o líquido da semana em R', () => {
    const { getByText } = render(<TorreStopGain stopGain={semana} />);
    expect(getByText('Liq: -13.4R')).toBeTruthy();
  });

  it('dia sem trade não desenha barra', () => {
    const { container } = render(<TorreStopGain stopGain={{ ...semana, dias: [{ label: 'Seg', gains: 0, losses: 0 }] }} />);
    const px = [...container.querySelectorAll('div[style*="px"]')]
      .map((el) => Number(/height:\s*([\d.]+)px/.exec(el.getAttribute('style'))?.[1] ?? 0));
    expect(px.filter((n) => n > 0 && n < 100)).toEqual([]);
  });

  it('semana vazia diz que está vazia', () => {
    const { getByText } = render(<TorreStopGain stopGain={{ dias: [], liquidoR: 0, comR: 0, semR: 0, total: 0 }} />);
    expect(getByText('Nenhum trade nesta semana.')).toBeTruthy();
  });
});
