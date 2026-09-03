/**
 * McDistribution.test.jsx — issue #418
 *
 * O desenho anterior derivava a altura das barras do índice, com piso
 * `Math.max(8, …)`: por construção nunca teria bin vazio nem cauda. Estes
 * testes travam o oposto — a forma vem dos dados.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import McDistribution from '../../../components/cycleClosure/McDistribution';

const hist = (counts, min, max) => ({
  bins: counts.length,
  counts,
  min,
  max,
  binWidth: (max - min) / counts.length,
});

describe('McDistribution', () => {
  it('desenha uma barra por bin NÃO vazio — bin vazio não vira barra', () => {
    const { container } = render(
      <McDistribution histogram={hist([0, 3, 9, 4, 0, 1], -300, 300)} p10={-200} p50={0} p90={250} />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(4);
  });

  it('altura proporcional à contagem, com o bin mais cheio ocupando o viewBox', () => {
    const { container } = render(
      <McDistribution histogram={hist([5, 10], -100, 100)} p50={0} />,
    );
    const [a, b] = Array.from(container.querySelectorAll('rect'));
    expect(Number(b.getAttribute('height'))).toBe(100);
    expect(Number(a.getAttribute('height'))).toBe(50);
  });

  it('histograma ausente ou vazio não renderiza nada', () => {
    expect(render(<McDistribution histogram={null} />).container.querySelector('svg')).toBeNull();
    expect(render(<McDistribution histogram={hist([], 0, 0)} />).container.querySelector('svg')).toBeNull();
    expect(render(<McDistribution histogram={hist([0, 0], -1, 1)} />).container.querySelector('svg')).toBeNull();
  });

  it('marca o zero só quando a distribuição cruza o zero', () => {
    const cruza = render(
      <McDistribution histogram={hist([2, 5, 3], -300, 300)} p10={-200} p50={10} p90={250} />,
    ).container;
    const soGanho = render(
      <McDistribution histogram={hist([2, 5, 3], 100, 900)} p10={200} p50={500} p90={800} />,
    ).container;
    // 3 marcações de percentil em ambos; o zero é a quarta linha só no primeiro.
    expect(cruza.querySelectorAll('line')).toHaveLength(4);
    expect(soGanho.querySelectorAll('line')).toHaveLength(3);
  });

  it('distribuição colapsada num ponto renderiza a barra sem marcação nem NaN', () => {
    const { container } = render(
      <McDistribution histogram={{ bins: 1, binWidth: 0, min: 9000, max: 9000, counts: [100] }} p50={9000} />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.querySelectorAll('line')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/NaN/);
  });

  it('barra no vermelho quando o centro do bin é negativo', () => {
    const { container } = render(
      <McDistribution histogram={hist([4, 6], -400, 400)} p50={0} />,
    );
    const [neg, pos] = Array.from(container.querySelectorAll('rect'));
    expect(neg.getAttribute('class')).toMatch(/red/);
    expect(pos.getAttribute('class')).toMatch(/sky/);
  });

  it('descreve a distribuição em palavras para leitor de tela', () => {
    const { container } = render(
      <McDistribution histogram={hist([1, 2], -100, 100)} p50={0} ariaSummary="38% dos cenários no vermelho" />,
    );
    expect(container.querySelector('svg').getAttribute('aria-label')).toBe('38% dos cenários no vermelho');
  });
});
