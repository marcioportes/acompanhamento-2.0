/**
 * CycleConsistencyCard.test.jsx — issue #235 F2.2
 *
 * Cobre:
 *  C1 — happy path: 4 métricas + badge BCB + sem coverage warning
 *  C2 — loading=true → métricas síncronas já na tela, só o Sharpe em espera (#387)
 *  C3 — error → mensagem amigável
 *  C4 — Sharpe insufficientReason='min_days' → label "Insuficiente · ≥X dias", sem badge BCB
 *  C5 — CV insufficientReason='no_target_rr' → label do plano sem RR
 *  C6 — coverage abaixo do threshold → badge "MEP/MEN em N de M trades"
 *  C7 — DebugBadge com component="CycleConsistencyCard"
 *
 * Mocka useCycleConsistency para isolar UI da pipeline async (Selic via Firestore).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../hooks/useCycleConsistency', () => ({
  useCycleConsistency: vi.fn(),
}));

import CycleConsistencyCard from '../../../components/dashboard/CycleConsistencyCard';
import { useCycleConsistency } from '../../../hooks/useCycleConsistency';

const baseProps = {
  trades: [],
  plan: { pl: 10000, rrTarget: 2 },
  cycleStart: '2026-02-01',
  cycleEnd: '2026-02-28',
};

const happyState = {
  sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
  cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 12 },
  avgExcursion: {
    avgMEP: 1.8,
    avgMEN: -0.6,
    coverage: 1,
    coverageBelowThreshold: false,
    totalTrades: 12,
    tradesWithData: 12,
  },
  loading: false,
  error: null,
};

describe('CycleConsistencyCard', () => {
  beforeEach(() => {
    vi.mocked(useCycleConsistency).mockReset();
  });

  it('C1 — happy path renderiza 4 métricas, badge BCB e header com cycleLabel derivado', () => {
    vi.mocked(useCycleConsistency).mockReturnValue(happyState);

    render(<CycleConsistencyCard {...baseProps} />);

    // Header
    expect(screen.getByText(/Consistencia Operacional/i)).toBeTruthy();
    expect(screen.getByText(/FEV\/2026/)).toBeTruthy();

    // 4 valores
    expect(screen.getByText('1.42')).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();
    expect(screen.getByText('+1.8%')).toBeTruthy();
    expect(screen.getByText('-0.6%')).toBeTruthy();
    expect(screen.getByText(/MEP médio/)).toBeTruthy();
    expect(screen.getByText(/MEN médio/)).toBeTruthy();

    // Sharpe row label inclui o ciclo
    // Tile label é só "Sharpe" agora; cycleLabel ficou no header (já checado acima)

    // Badge Selic atual presente (BCB), sem coverage warning
    expect(screen.getByText(/Selic atual/)).toBeTruthy();
    expect(screen.queryByText(/MEP\/MEN em/)).toBeNull();
  });

  // #387 — o esqueleto de card inteiro saiu. Enquanto o Sharpe carrega, as três métricas
  // síncronas já aparecem e o layout nasce com a altura final; só a tile do Sharpe troca
  // de conteúdo. Antes o card crescia ao carregar e empurrava os vizinhos da linha.
  it('C2 — loading exibe as métricas síncronas e só o Sharpe em espera', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: null,
      cvNormalized: { value: 1.8, cvObs: 5.2, cvExp: 3, daysWithTrade: 8 },
      avgExcursion: { avgMEP: 0.15, avgMEN: -0.11, coverage: 1, coverageBelowThreshold: false },
      loading: true,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    // As três métricas síncronas já valem — nada de esperar rede pra mostrá-las.
    expect(screen.getByText('CV norm.')).toBeTruthy();
    expect(screen.getByText('1.80')).toBeTruthy();
    expect(screen.getByText('MEP médio')).toBeTruthy();
    expect(screen.getByText('+0.1%')).toBeTruthy();
    expect(screen.getByText('MEN médio')).toBeTruthy();
    expect(screen.getByText('-0.1%')).toBeTruthy();

    // Só o Sharpe espera — placeholder no slot do valor, sem banda e sem badge, pra
    // resolver não acrescentar linha nenhuma à tile.
    expect(screen.getByText('Sharpe')).toBeTruthy();
    expect(screen.getByText('···')).toBeTruthy();
    expect(screen.queryByText('1.42')).toBeNull();
    expect(screen.queryByText(/Selic atual/)).toBeNull();
  });

  // #387 — AP-08: no primeiro tick real o hook ainda não calculou nada e loading já é
  // true. O card tem de renderizar, não estourar.
  it('C2b — loading com cvNormalized/avgExcursion nulos renderiza sem lançar', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: null,
      cvNormalized: null,
      avgExcursion: null,
      loading: true,
      error: null,
    });

    expect(() => render(<CycleConsistencyCard {...baseProps} />)).not.toThrow();
    expect(screen.getByText('Sharpe')).toBeTruthy();
    expect(screen.getByText('CV norm.')).toBeTruthy();
    expect(screen.getByText('···')).toBeTruthy();
  });

  // #387 — o que causava o pulo era o conjunto de blocos ABAIXO do grid mudar entre
  // carregando e resolvido. Este teste trava a paridade: mesmos blocos nos dois estados.
  it('C2c — carregando e resolvido renderizam os mesmos blocos abaixo do grid', () => {
    const withBlocks = {
      ...baseProps,
      avgTradeDuration: { all: 12 },
      durationDelta: { level: 'winners-run', deltaPercent: 40, durationWin: 20, durationLoss: 14 },
    };
    const loadingState = {
      sharpe: null,
      cvNormalized: { value: 1.8, cvObs: 5.2, cvExp: 3, daysWithTrade: 8 },
      avgExcursion: { avgMEP: 0.15, avgMEN: -0.11, coverage: 1, coverageBelowThreshold: false },
      loading: true,
      error: null,
    };

    vi.mocked(useCycleConsistency).mockReturnValue(loadingState);
    const { rerender, unmount } = render(<CycleConsistencyCard {...withBlocks} />);
    expect(screen.getByText('Tempo W vs L')).toBeTruthy();
    expect(screen.getByText(/Tempo medio geral/)).toBeTruthy();

    vi.mocked(useCycleConsistency).mockReturnValue({ ...loadingState, sharpe: happyState.sharpe, loading: false });
    rerender(<CycleConsistencyCard {...withBlocks} />);
    expect(screen.getByText('Tempo W vs L')).toBeTruthy();
    expect(screen.getByText(/Tempo medio geral/)).toBeTruthy();
    expect(screen.getByText('1.42')).toBeTruthy();
    expect(screen.queryByText('···')).toBeNull();
    unmount();
  });

  it('C3 — error exibe mensagem amigável', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: null,
      cvNormalized: null,
      avgExcursion: null,
      loading: false,
      error: new Error('selic boom'),
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/Não foi possível carregar métricas do ciclo/i)).toBeTruthy();
    // Sem nenhuma métrica calculada o grid inteiro sai (#385 mantido pelo #387).
    expect(screen.queryByText('CV norm.')).toBeNull();
    expect(screen.queryByText('Sharpe')).toBeNull();
  });

  it('C4 — Sharpe insufficientReason=min_days mostra label e oculta badge BCB', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: null, daysWithTrade: 2, source: 'BCB', insufficientReason: 'min_days', fallbackUsed: false },
      cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 2 },
      avgExcursion: {
        avgMEP: 1.0, avgMEN: -0.5,
        coverage: 1, coverageBelowThreshold: false,
        totalTrades: 2, tradesWithData: 2,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} opts={{ minDays: 5 }} />);

    expect(screen.getByText(/Insuficiente · ≥5 dias/)).toBeTruthy();
    expect(screen.queryByText(/Selic atual/)).toBeNull();
  });

  it('C5 — CV insufficientReason=no_target_rr mostra label de plano sem RR', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
      cvNormalized: {
        value: null,
        cvObs: null,
        cvExp: null,
        daysWithTrade: 12,
        insufficientReason: 'no_target_rr',
        label: 'Plano sem RR alvo definido — definir para ativar métrica',
      },
      avgExcursion: {
        avgMEP: 1.0, avgMEN: -0.5,
        coverage: 1, coverageBelowThreshold: false,
        totalTrades: 12, tradesWithData: 12,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/Plano sem RR alvo definido/i)).toBeTruthy();
  });

  it('C6 — coverage abaixo do threshold exibe label de cobertura', () => {
    vi.mocked(useCycleConsistency).mockReturnValue({
      sharpe: { value: 1.42, daysWithTrade: 12, source: 'BCB', fallbackUsed: false },
      cvNormalized: { value: 1.05, cvObs: 9.66, cvExp: 9.20, daysWithTrade: 12 },
      avgExcursion: {
        avgMEP: 1.8, avgMEN: -0.6,
        coverage: 0.5, coverageBelowThreshold: true,
        coverageLabel: '⚠ MEP/MEN em 6 de 12 trades',
        totalTrades: 12, tradesWithData: 6,
      },
      loading: false,
      error: null,
    });

    render(<CycleConsistencyCard {...baseProps} />);

    expect(screen.getByText(/MEP\/MEN em 6 de 12 trades/)).toBeTruthy();
  });

  it('C7 — DebugBadge presente com component="CycleConsistencyCard"', () => {
    vi.mocked(useCycleConsistency).mockReturnValue(happyState);

    render(<CycleConsistencyCard {...baseProps} />);

    // DebugBadge default render: "{component} • {VERSION.display}"
    expect(screen.getByText(/CycleConsistencyCard/)).toBeTruthy();
  });
});
