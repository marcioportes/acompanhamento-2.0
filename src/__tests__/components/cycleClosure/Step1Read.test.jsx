/**
 * Step1Read.test.jsx — issue #282
 * Wiring do wizard de fechamento: grupos Performance (técnico) + Consistência
 * renderizam com a nomenclatura canônica, reusando a SSoT cycleMetricTiles.
 *
 * #416 (A3) — hints dos cards de composição do TPS por predicado sobre o dado.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TPS_HINT_TEXTS } from '../../../utils/cycleClosure/tpsHints';

const MOCK_PLAN = { id: 'p1', pl: 20300, riskPerOperation: 0.5, rrTarget: 2, cycleGoal: 10, cycleStop: 10 };
const MOCK_TRADES = [
  { id: 't1', planId: 'p1', date: '2026-04-01', side: 'LONG', entry: 128000, exit: 128130, result: 200, entryTime: '2026-04-01T09:38:00', exitTime: '2026-04-01T10:10:00' },
  { id: 't2', planId: 'p1', date: '2026-04-02', side: 'SHORT', entry: 128200, exit: 128260, result: -96, entryTime: '2026-04-02T14:15:00', exitTime: '2026-04-02T14:33:00' },
  { id: 't3', planId: 'p1', date: '2026-04-03', side: 'LONG', entry: 128100, exit: 128240, result: 176, entryTime: '2026-04-03T09:50:00', exitTime: '2026-04-03T10:20:00' },
];

// Overrides por teste (o mock lê no momento do render). null = usa o cenário padrão.
let tradesOverride = null;
let planOverride = null;
let cvOverride = null;

vi.mock('../../../hooks/useTrades', () => ({ useTrades: () => ({ trades: tradesOverride ?? MOCK_TRADES, loading: false }) }));
vi.mock('../../../hooks/usePlans', () => ({ usePlans: () => ({ plans: [planOverride ?? MOCK_PLAN], loading: false }) }));
vi.mock('../../../hooks/useCycleConsistency', () => ({
  useCycleConsistency: () => ({
    sharpe: { value: 2.3, source: 'BCB', daysWithTrade: 5 },
    cvNormalized: cvOverride ?? { value: 0.59 },
    avgExcursion: { avgMEP: 1.2, avgMEN: -0.4, coverage: 1, coverageBelowThreshold: false },
    loading: false,
    error: null,
  }),
  default: () => ({}),
}));

afterEach(() => {
  tradesOverride = null;
  planOverride = null;
  cvOverride = null;
});

import Step1Read from '../../../components/cycleClosure/steps/Step1Read';

const baseProps = {
  studentId: 's1', planId: 'p1',
  cycleStart: '2026-04-01', cycleEnd: '2026-04-30',
  onSnapshot: vi.fn(), onMetrics: vi.fn(),
};

describe('Step1Read — paridade de indicadores (#282)', () => {
  it('renderiza grupo PERFORMANCE com nomenclatura técnica', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getByText('Win Rate')).toBeTruthy();
    expect(screen.getByText('Payoff')).toBeTruthy();
    // técnicos que aparecem no tile e também no breakdown do TPS (mesmo nome, contextos distintos)
    expect(screen.getAllByText('Expectancy (R)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profit Factor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Max Drawdown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aderência').length).toBeGreaterThan(0);
  });

  it('renderiza grupo CONSISTÊNCIA com os 4 indicadores do dashboard', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.getByText('Consistência Operacional')).toBeTruthy();
    expect(screen.getByText('Sharpe')).toBeTruthy();
    expect(screen.getByText('CV norm.')).toBeTruthy();
    expect(screen.getByText('MEP médio')).toBeTruthy();
    expect(screen.getByText('MEN médio')).toBeTruthy();
    // valores vindos do hook mockado
    expect(screen.getByText('2.30')).toBeTruthy();   // Sharpe
    expect(screen.getByText('0.59')).toBeTruthy();   // CV norm.
    expect(screen.getByText('+1.2%')).toBeTruthy();  // MEP
    expect(screen.getByText('-0.4%')).toBeTruthy();  // MEN
  });

  it('não usa mais os rótulos didáticos antigos do wizard', () => {
    render(<Step1Read {...baseProps} />);
    expect(screen.queryByText('Lucro ÷ Prejuízo')).toBeNull();
    expect(screen.queryByText('Taxa de acerto')).toBeNull();
  });
});

// Cenário do ciclo real de agosto, reduzido: ganho médio 1,10R e perda média 0,93R
// (payoff 1,18) com mais perdedores que vencedores → Profit Factor 0,89 (nota baixa)
// e drawdown de 3,68% contra um stop de ciclo de 8,5% (nota baixa).
// Os dois cards ficam abaixo de 50% dos pontos e nenhum dos dois hints é verdadeiro.
const LOW_SCORE_PLAN = { id: 'p1', pl: 10000, riskPerOperation: 1, rrTarget: 2, cycleGoal: 10, cycleStop: 8.5 };
const LOW_SCORE_TRADES = [
  { id: 'a1', planId: 'p1', date: '2026-04-01', result: 110 },
  { id: 'a2', planId: 'p1', date: '2026-04-02', result: -93 },
  { id: 'a3', planId: 'p1', date: '2026-04-03', result: -93 },
  { id: 'a4', planId: 'p1', date: '2026-04-06', result: -93 },
  { id: 'a5', planId: 'p1', date: '2026-04-07', result: -93 },
  { id: 'a6', planId: 'p1', date: '2026-04-08', result: 110 },
  { id: 'a7', planId: 'p1', date: '2026-04-09', result: 110 },
];

describe('Step1Read — hints do TPS por predicado (#416 A3)', () => {
  it('fator com pontuação baixa e predicado falso não mostra hint', () => {
    tradesOverride = LOW_SCORE_TRADES;
    planOverride = LOW_SCORE_PLAN;
    render(<Step1Read {...baseProps} />);

    // Profit Factor 0,89 (< 50% dos pontos) mas payoff realizado 1,18 → sem hint.
    expect(screen.queryByText(TPS_HINT_TEXTS.pf)).toBeNull();
    // Drawdown 3,68% (< 50% dos pontos) contra stop de 8,5% → sem hint.
    expect(screen.queryByText(TPS_HINT_TEXTS.dd)).toBeNull();
    // Nenhum trade tem compliance → aderência 0 (nota zero) mas zero violações
    // declaradas → sem hint.
    expect(screen.queryByText(TPS_HINT_TEXTS.rule)).toBeNull();
  });

  it('mostra o hint quando o predicado é verdadeiro', () => {
    tradesOverride = LOW_SCORE_TRADES;
    planOverride = LOW_SCORE_PLAN;
    render(<Step1Read {...baseProps} />);
    // Expectância = 3/7 * 1,10 + 4/7 * (-0,93) = -0,06R → hint verdadeiro.
    expect(screen.getByText(TPS_HINT_TEXTS.exp)).toBeTruthy();
  });

  it('consistência errática (CV > 1,5) mostra hint; CV no plano não', () => {
    tradesOverride = LOW_SCORE_TRADES;
    planOverride = LOW_SCORE_PLAN;
    cvOverride = { value: 1.8 };
    const { unmount } = render(<Step1Read {...baseProps} />);
    expect(screen.getByText(TPS_HINT_TEXTS.consistency)).toBeTruthy();
    unmount();

    cvOverride = { value: 1.1 };
    render(<Step1Read {...baseProps} />);
    expect(screen.queryByText(TPS_HINT_TEXTS.consistency)).toBeNull();
  });

  it('violação declarada mostra o hint de aderência', () => {
    tradesOverride = LOW_SCORE_TRADES.map((t, i) => (
      i === 0 ? { ...t, compliance: { roStatus: 'NAO_CONFORME', violations: [{ type: 'NO_STOP' }] } } : t
    ));
    planOverride = LOW_SCORE_PLAN;
    render(<Step1Read {...baseProps} />);
    expect(screen.getByText(TPS_HINT_TEXTS.rule)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #416 (D1) — maxDD determinístico
//
// Peak-to-trough é path-dependent. Ordenar só por `date` deixava a ordem
// intradiária por conta do array, e o array vem da ordem de ESCRITA em lote:
// permutar a importação mudava o fator de maior peso do TPS (25 pontos).
// ─────────────────────────────────────────────────────────────────────────────
const DD_PLAN = { id: 'p1', pl: 10000, riskPerOperation: 1, rrTarget: 2, cycleGoal: 10, cycleStop: 10 };

// Mesmo dia, três horários. Na ordem real: +500 (pico 10.500) → -300 → -400,
// drawdown -700. Na ordem [b, a, c] do array, o pico nunca chega a 10.500 antes
// da queda e o drawdown vira -400 — a nota do aluno mudava com a ordenação.
const SAME_DAY = {
  a: { id: 'dd-a', planId: 'p1', date: '2026-04-01', result: 500, entryTime: '2026-04-01T09:00:00' },
  b: { id: 'dd-b', planId: 'p1', date: '2026-04-01', result: -300, entryTime: '2026-04-01T10:00:00' },
  c: { id: 'dd-c', planId: 'p1', date: '2026-04-01', result: -400, entryTime: '2026-04-01T11:00:00' },
};

/** Renderiza e devolve o maxDrawdown que o Passo 1 publica no draft. */
function renderMaxDD(trades, plan = DD_PLAN) {
  tradesOverride = trades;
  planOverride = plan;
  const onMetrics = vi.fn();
  const { unmount } = render(<Step1Read {...baseProps} onMetrics={onMetrics} />);
  const last = onMetrics.mock.calls.at(-1)?.[0];
  unmount();
  return last?.maxDrawdown;
}

describe('Step1Read — maxDD determinístico dentro do dia (#416 D1)', () => {
  it('é invariante a permutação do array de trades', () => {
    const { a, b, c } = SAME_DAY;
    const permutacoes = [
      [a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a],
    ];
    const resultados = permutacoes.map((p) => renderMaxDD(p));
    resultados.forEach((r) => {
      expect(r.value).toBe(resultados[0].value);
      expect(r.percent).toBe(resultados[0].percent);
    });
  });

  it('usa a ordem cronológica real, não a ordem do array', () => {
    const { a, b, c } = SAME_DAY;
    // [b, a, c] é exatamente a permutação que o sort por `date` preservava.
    const dd = renderMaxDD([b, a, c]);
    expect(dd.value).toBe(-700);              // antes: -400
    expect(dd.percent).toBeCloseTo(-700 / 10500, 10);
  });

  it('trade sem entryTime cai no meio-dia local — não vai para o fim do dia', () => {
    // -400 às 09:00, +500 sem horário (meio-dia), -300 às 14:00 → pior DD -400.
    // Se o sem-horário fosse jogado para o fim, o DD seria -700.
    const semHorario = [
      { id: 'nt-a', planId: 'p1', date: '2026-04-01', result: -400, entryTime: '2026-04-01T09:00:00' },
      { id: 'nt-b', planId: 'p1', date: '2026-04-01', result: 500 },
      { id: 'nt-c', planId: 'p1', date: '2026-04-01', result: -300, entryTime: '2026-04-01T14:00:00' },
    ];
    const dd = renderMaxDD(semHorario);
    expect(dd.value).toBe(-400);
    expect(dd.percent).toBeCloseTo(-0.04, 10);

    // e segue invariante a permutação
    const permutado = renderMaxDD([semHorario[2], semHorario[0], semHorario[1]]);
    expect(permutado.value).toBe(dd.value);
    expect(permutado.percent).toBe(dd.percent);
  });
});
