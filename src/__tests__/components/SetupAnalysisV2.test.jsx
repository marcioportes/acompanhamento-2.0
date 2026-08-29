/**
 * SetupAnalysisV2.test.jsx — render tests for SetupAnalysis V2 (issue #170)
 *
 * Cobre E1 (cards com 4 KPIs + sparkline + aderência condicional),
 * E2 (ordenação por |contribEV| + accordion esporádicos) e E4 (DebugBadge, API).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SetupAnalysis from '../../components/SetupAnalysis';

const mk = (overrides = {}) => ({
  setup: 'A',
  result: 100,
  duration: 10,
  entryTime: '2026-04-15T10:00:00',
  exitTime: '2026-04-15T10:10:00',
  date: '2026-04-15',
  ...overrides,
});

describe('SetupAnalysis V2 — estados vazios', () => {
  it('renderiza mensagem quando trades = []', () => {
    render(<SetupAnalysis trades={[]} />);
    expect(screen.getByText(/nenhum trade registrado/i)).toBeInTheDocument();
  });

  it('renderiza mensagem quando trades = null', () => {
    render(<SetupAnalysis trades={null} />);
    expect(screen.getByText(/nenhum trade registrado/i)).toBeInTheDocument();
  });
});

describe('SetupAnalysis V2 — E1 card com 4 KPIs + header', () => {
  const trades = [
    mk({ setup: 'Breakout', result: 200, duration: 20 }),
    mk({ setup: 'Breakout', result: 100, duration: 20 }),
    mk({ setup: 'Breakout', result: -50, duration: 10 }),
  ];

  it('header mostra nome, N trades, PL total e WR', () => {
    render(<SetupAnalysis trades={trades} />);
    const card = screen.getByTestId('setup-card-Breakout');
    expect(card).toHaveTextContent('Breakout');
    expect(card).toHaveTextContent(/3\s*trades?/i);
    expect(card).toHaveTextContent(/67/); // WR = 2/3 ≈ 66.67% ou 67%
  });

  it('renderiza quadrante EV por trade', () => {
    render(<SetupAnalysis trades={trades} />);
    const card = screen.getByTestId('setup-card-Breakout');
    expect(card).toHaveTextContent(/EV/i);
  });

  it('renderiza quadrante Payoff', () => {
    render(<SetupAnalysis trades={trades} />);
    const card = screen.getByTestId('setup-card-Breakout');
    expect(card).toHaveTextContent(/Payoff/i);
  });

  it('renderiza quadrante ΔT W vs L', () => {
    render(<SetupAnalysis trades={trades} />);
    const card = screen.getByTestId('setup-card-Breakout');
    expect(card).toHaveTextContent(/ΔT/);
  });

  it('renderiza quadrante Contribuição ao EV total', () => {
    render(<SetupAnalysis trades={trades} />);
    const card = screen.getByTestId('setup-card-Breakout');
    expect(card).toHaveTextContent(/Contrib|Impact/i);
  });

  it('renderiza sparkline 6m (SVG testId)', () => {
    render(<SetupAnalysis trades={trades} />);
    expect(screen.getByTestId('setup-sparkline-Breakout')).toBeInTheDocument();
  });

  it('exibe "—" em Payoff quando só há wins', () => {
    const onlyWins = [
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: 50 }),
      mk({ setup: 'A', result: 30 }),
    ];
    render(<SetupAnalysis trades={onlyWins} />);
    const card = screen.getByTestId('setup-card-A');
    expect(card).toHaveTextContent('—');
  });
});

describe('SetupAnalysis V2 — E1 Aderência RR condicional', () => {
  const trades = [
    mk({ setup: 'A', result: 100, rr: 2.0 }),
    mk({ setup: 'A', result: 100, rr: 2.1 }),
    mk({ setup: 'A', result: -50, rr: 1.5 }),
  ];

  it('não mostra linha Aderência RR quando setupsMeta ausente', () => {
    render(<SetupAnalysis trades={trades} />);
    expect(screen.queryByText(/Aderência RR/i)).not.toBeInTheDocument();
  });

  it('não mostra quando setup existe em setupsMeta mas sem targetRR', () => {
    render(<SetupAnalysis trades={trades} setupsMeta={[{ name: 'A' }]} />);
    expect(screen.queryByText(/Aderência RR/i)).not.toBeInTheDocument();
  });

  it('mostra X/N + percentual quando targetRR existe', () => {
    render(
      <SetupAnalysis
        trades={trades}
        setupsMeta={[{ name: 'A', targetRR: 2.0 }]}
      />,
    );
    expect(screen.getByText(/Aderência RR/i)).toBeInTheDocument();
    // 2 dentro da banda (rr=2.0, rr=2.1), 1 fora (rr=1.5 < 1.6)
    const card = screen.getByTestId('setup-card-A');
    expect(card).toHaveTextContent(/2\/3/);
  });
});

describe('SetupAnalysis V2 — E2 ordenação + amostra pequena', () => {
  const trades = [
    // Setup A: n=3, maior impacto negativo
    mk({ setup: 'A', result: -500 }),
    mk({ setup: 'A', result: -500 }),
    mk({ setup: 'A', result: -500 }),
    // Setup B: n=3, impacto positivo menor
    mk({ setup: 'B', result: 100 }),
    mk({ setup: 'B', result: 100 }),
    mk({ setup: 'B', result: 100 }),
    // Setup C: n=2, esporádico
    mk({ setup: 'C', result: 50 }),
    mk({ setup: 'C', result: 50 }),
  ];

  it('cards não-esporádicos vêm ordenados por |contribEV| desc', () => {
    render(<SetupAnalysis trades={trades} />);
    const cards = screen.getAllByTestId(/^setup-card-/);
    // A (|-1500|) > B (|+300|); C tem amostra menor e vem depois, mas VISÍVEL
    const names = cards.map((c) => c.getAttribute('data-testid'));
    expect(names.indexOf('setup-card-A')).toBeLessThan(names.indexOf('setup-card-B'));
  });

  // #101 (29/08) — o accordion "Esporádicos" MORREU. Medido na base: escondia os
  // três melhores setups da ficha do mentor (dois com 2 de 2 acertos) e deixava
  // visíveis só os que perdiam. Amostra pequena virou etiqueta, não fole.
  it('setup com n<3 aparece na tela, sem fole nenhum', () => {
    render(<SetupAnalysis trades={trades} />);
    expect(screen.getByTestId('setup-card-C')).toBeInTheDocument();
    expect(screen.queryByText(/Esporádicos/i)).not.toBeInTheDocument();
  });

  it('a amostra pequena é declarada ao lado do card', () => {
    render(<SetupAnalysis trades={trades} />);
    expect(screen.getByText(/amostra 2/i)).toBeInTheDocument();
  });

  it('todos os setups aparecem mesmo quando nenhum atinge n≥3', () => {
    const tradesEsporadicos = [
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'A', result: 100 }),
      mk({ setup: 'B', result: 50 }),
    ];
    render(<SetupAnalysis trades={tradesEsporadicos} />);
    expect(screen.getByTestId('setup-card-A')).toBeInTheDocument();
    expect(screen.getByTestId('setup-card-B')).toBeInTheDocument();
  });
});

describe('SetupAnalysis V2 — DebugBadge (INV-04)', () => {
  it('renderiza DebugBadge com component="SetupAnalysis"', () => {
    const trades = [mk({ setup: 'A' })];
    const { container } = render(<SetupAnalysis trades={trades} />);
    // DebugBadge usa data-testid ou text com version — aceitamos a presença do version string
    const text = container.textContent || '';
    expect(text).toMatch(/v1\.\d+\.\d+/);
  });
});
