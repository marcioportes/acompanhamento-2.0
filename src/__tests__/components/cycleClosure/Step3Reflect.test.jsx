/**
 * Step3Reflect.test.jsx — issue #416 (task 04, blocos A4 + B1)
 *
 * A4 — a evidência de "Erro próprio" só declara violação que existe em
 * `patterns.topErrors`. A contagem derivada da taxa de aderência
 * (`(1 - adherence) × count`) contava trades não-aderentes e os chamava de
 * violação: a aba 1 dizia "sem violações" e o Q3 reportava "4 violações".
 *
 * B1 — os sustains de outlier (melhor trade / melhor dia limpo) respeitam o
 * mesmo guard comportamental que o sustain de aderência já tinha, e o melhor
 * dia limpo exige que a soma dos dias limpos também seja positiva.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import Step3Reflect from '../../../components/cycleClosure/steps/Step3Reflect';

const baseMetrics = {
  count: 10,
  winners: 4,
  losers: 6,
  expectancy_R: -0.2,
  ruleAdherenceRate: 1,
};

const baseSnapshot = {
  result: -500,
  resultPercent: -1.5,
  tradesCount: 10,
  stopBreach: { stopBreachIndex: -1, tradesAfterStop: 0 },
};

const noEvents = { tilt: 0, tiltDaysCount: 0, revenge: 0, stopTampering: 0, overtrading: 0 };

/** Renderiza o step com metrics/patterns controlados. */
const renderStep = ({ metrics = {}, patterns = {}, snapshot = {} } = {}) =>
  render(
    <Step3Reflect
      snapshot={{ ...baseSnapshot, ...snapshot }}
      metrics={{ ...baseMetrics, ...metrics }}
      patterns={{ eventCounts: { ...noEvents }, ...patterns }}
      forward={{}}
      aar={{ sustain: [], improve: [], whyDifference: { attributions: [] } }}
      onChange={vi.fn()}
      onVisited={vi.fn()}
    />,
  );

describe('Step3Reflect — A4: evidência de erro não fabrica violação', () => {
  it('aderência 0,60 com zero violação declarada → texto weak, sem número de violações', () => {
    renderStep({ metrics: { ruleAdherenceRate: 0.6, count: 10 }, patterns: { topErrors: [] } });

    expect(
      screen.getByText('Sem violações de regras ou eventos comportamentais detectados.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/violações de regras\./)).toBeNull();
    expect(screen.queryByText(/4 violações/)).toBeNull();
  });

  it('2 tipos declarados em topErrors → "2 tipo(s) de violação"', () => {
    renderStep({
      metrics: { ruleAdherenceRate: 0.6, count: 10 },
      patterns: { topErrors: ['no_stop', 'oversize'] },
    });

    expect(screen.getByText(/2 tipo\(s\) de violação/)).toBeInTheDocument();
  });

  it('aderência baixa não altera a contagem quando há violação declarada', () => {
    renderStep({
      metrics: { ruleAdherenceRate: 0.1, count: 20 },
      patterns: { topErrors: ['no_stop'] },
    });

    expect(screen.getByText(/1 tipo\(s\) de violação/)).toBeInTheDocument();
    expect(screen.queryByText(/18 violações/)).toBeNull();
  });
});

describe('Step3Reflect — B1: guard comportamental nos sustains de outlier', () => {
  const cleanCycle = {
    metrics: { bestTradeR: 2.0 },
    patterns: {
      topErrors: [],
      dayBreakdown: { bestCleanDay: { date: '2026-08-12', pnl: 500, trades: 2 } },
      correlation: { performanceOnCleanDays: 700 },
    },
  };

  it('ciclo limpo → os dois sustains de outlier aparecem', () => {
    renderStep(cleanCycle);

    expect(screen.getByText(/Melhor trade 2\.0R/)).toBeInTheDocument();
    expect(screen.getByText(/Dia 2026-08-12 sem tilt\/vingança/)).toBeInTheDocument();
  });

  it.each([
    ['tilt', { tilt: 2, tiltDaysCount: 1 }],
    ['vingança', { revenge: 3 }],
    ['stop deslocado', { stopTampering: 1 }],
  ])('%s no ciclo → nenhum dos dois sustains aparece', (_label, counts) => {
    renderStep({
      ...cleanCycle,
      patterns: { ...cleanCycle.patterns, eventCounts: { ...noEvents, ...counts } },
    });

    expect(screen.queryByText(/Melhor trade/)).toBeNull();
    expect(screen.queryByText(/2026-08-12 sem tilt\/vingança/)).toBeNull();
  });

  it('stop do ciclo estourado com trades depois → nenhum dos dois sustains aparece', () => {
    renderStep({
      ...cleanCycle,
      snapshot: { stopBreach: { stopBreachIndex: 4, tradesAfterStop: 3 } },
    });

    expect(screen.queryByText(/Melhor trade/)).toBeNull();
    expect(screen.queryByText(/2026-08-12 sem tilt\/vingança/)).toBeNull();
  });

  it('melhor dia +500 com soma dos dias limpos −134 → sem sustain de melhor dia', () => {
    renderStep({
      ...cleanCycle,
      patterns: { ...cleanCycle.patterns, correlation: { performanceOnCleanDays: -134 } },
    });

    expect(screen.queryByText(/2026-08-12 sem tilt\/vingança/)).toBeNull();
    // o sustain do melhor trade não depende dos dias limpos — segue de pé
    expect(screen.getByText(/Melhor trade 2\.0R/)).toBeInTheDocument();
  });

  it('soma dos dias limpos ausente não vira elogio', () => {
    renderStep({
      ...cleanCycle,
      patterns: { ...cleanCycle.patterns, correlation: undefined },
    });

    expect(screen.queryByText(/2026-08-12 sem tilt\/vingança/)).toBeNull();
  });
});
