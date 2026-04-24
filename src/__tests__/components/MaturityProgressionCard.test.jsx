/**
 * MaturityProgressionCard.test.jsx — issue #119 task 10 (Fase C1).
 *
 * Cobre os estados do card de progressão de maturidade: render happy path,
 * regressão, mastery, narrativa IA, loading, error, maturity null,
 * sparse sample, overflow de gates, variante embedded.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import MaturityProgressionCard from '../../components/MaturityProgressionCard';
import { STAGE_NAMES, STAGE_NAMES_SHORT } from '../../utils/maturityEngine/constants';

function makeGate(overrides = {}) {
  return {
    id: 'gate-x',
    label: 'Gate X',
    dim: 'emo',
    metric: 'metricX',
    op: '>=',
    threshold: 10,
    value: 5,
    met: false,
    gap: 5,
    reason: null,
    ...overrides,
  };
}

function makeMaturity(overrides = {}) {
  return {
    currentStage: 2,
    baselineStage: 1,
    dimensionScores: {
      emotional: 48,
      financial: 65,
      operational: 60,
      maturity: 28,
      composite: 50,
    },
    gates: [],
    gatesMet: 0,
    gatesTotal: 0,
    gatesRatio: 0,
    proposedTransition: { proposed: 'STAY', nextStage: 3, blockers: [], confidence: 'HIGH' },
    signalRegression: { detected: false, suggestedStage: null, reasons: [], severity: null },
    windowSize: 30,
    confidence: 'HIGH',
    sparseSample: false,
    engineVersion: '1.43.0-engine-a',
    aiNarrative: null,
    ...overrides,
  };
}

function stage2Gates({ metCount = 5 } = {}) {
  const catalog = [
    { id: 'emotional-55', label: 'Emocional ≥ 55', dim: 'emo', metric: 'E', op: '>=', threshold: 55, value: 48, met: false, gap: 7 },
    { id: 'financial-solid', label: 'Financial ≥ 70 (SOLID)', dim: 'fin', metric: 'F', op: '>=', threshold: 70, value: 75, met: true, gap: 0 },
    { id: 'operational-65', label: 'Operacional ≥ 65', dim: 'op', metric: 'O', op: '>=', threshold: 65, value: 70, met: true, gap: 0 },
    { id: 'strategy-8-weeks', label: '8 semanas sem trocar estratégia', dim: 'op', metric: 'strategyConsWks', op: '>=', threshold: 8, value: 10, met: true, gap: 0 },
    { id: 'journal-90', label: 'Journal ≥ 90%', dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.90, value: 0.76, met: false, gap: 0.14 },
    { id: 'compliance-95', label: 'Compliance ≥ 95%', dim: 'op', metric: 'complianceRate', op: '>=', threshold: 95, value: 89, met: false, gap: 6 },
    { id: 'winrate-45', label: 'Win rate ≥ 45%', dim: 'fin', metric: 'winRate', op: '>=', threshold: 45, value: 55, met: true, gap: 0 },
    { id: 'payoff-1_2', label: 'Payoff ≥ 1.2', dim: 'fin', metric: 'payoff', op: '>=', threshold: 1.2, value: 1.5, met: true, gap: 0 },
  ].map((g) => ({ ...g, reason: null }));

  // Tune met counts — spec default matches 5 met.
  if (metCount !== 5) {
    // Flip gates to reach desired metCount; deterministic from start.
    let currentMet = catalog.filter((g) => g.met).length;
    let i = 0;
    while (currentMet !== metCount && i < catalog.length) {
      const g = catalog[i];
      if (currentMet > metCount && g.met === true) {
        g.met = false; g.gap = 1; g.value = g.threshold - 1;
        currentMet -= 1;
      } else if (currentMet < metCount && g.met === false) {
        g.met = true; g.gap = 0;
        currentMet += 1;
      }
      i += 1;
    }
  }
  return catalog;
}

describe('MaturityProgressionCard', () => {
  it('happy path: Stage 2 + 5/8 gates + HIGH confidence', () => {
    const maturity = makeMaturity({
      currentStage: 2,
      gates: stage2Gates({ metCount: 5 }),
      gatesMet: 5,
      gatesTotal: 8,
      gatesRatio: 5 / 8,
      confidence: 'HIGH',
    });

    render(<MaturityProgressionCard maturity={maturity} />);

    expect(screen.getByTestId('stage-summary').textContent).toMatch(/Reativo/);
    expect(screen.getByTestId('stage-summary').textContent).toMatch(/5\/8 gates para Metódico/);

    const chip = screen.getByTestId('confidence-chip');
    expect(chip.textContent).toMatch(/HIGH/);

    // Segmento 1 emerald, 2 amber parcial, 3-5 cinza.
    expect(screen.getByTestId('stage-seg-1').className).toMatch(/bg-emerald-500/);
    expect(screen.getByTestId('stage-seg-2').className).toMatch(/bg-gray-700/);
    expect(screen.getByTestId('stage-seg-2-fill').style.width).toBe('62.5%');
    expect(screen.getByTestId('stage-seg-3').className).toMatch(/bg-gray-700/);
    expect(screen.getByTestId('stage-seg-4').className).toMatch(/bg-gray-700/);
    expect(screen.getByTestId('stage-seg-5').className).toMatch(/bg-gray-700/);

    // Gates pendentes listados (≤ 5 bullets).
    const pending = screen.getByTestId('gates-pending');
    const items = within(pending).getAllByRole('listitem');
    expect(items.length).toBeLessThanOrEqual(5);
    expect(within(pending).getByText(/Emocional ≥ 55/)).toBeInTheDocument();
    expect(within(pending).getByText(/você: 48, faltam 7/)).toBeInTheDocument();
  });

  it('regression detected: mostra card vermelho com suggestedStage + primeira reason', () => {
    const maturity = makeMaturity({
      currentStage: 3,
      gates: [],
      gatesMet: 0,
      gatesTotal: 8,
      gatesRatio: 0,
      signalRegression: {
        detected: true,
        suggestedStage: 2,
        reasons: ['maxDD 22% > teto 18%', 'tilt em alta'],
        severity: 'HIGH',
      },
    });

    render(<MaturityProgressionCard maturity={maturity} />);

    const alert = screen.getByTestId('regression-alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/Seus números recentes sugerem revisão/);
    expect(alert.textContent).toMatch(/sinal recente: Stage 2/);
    expect(alert.textContent).toMatch(/maxDD 22% > teto 18%/);
    expect(alert.className).toMatch(/border-red-500/);
  });

  it('mastery (Stage 5): todos segmentos emerald, sem contagem de gates', () => {
    const maturity = makeMaturity({
      currentStage: 5,
      gates: [],
      gatesMet: 0,
      gatesTotal: 0,
      gatesRatio: null,
    });

    render(<MaturityProgressionCard maturity={maturity} />);

    expect(screen.getByTestId('stage-summary').textContent).toMatch(/Maestria/);
    expect(screen.getByTestId('stage-summary').textContent).not.toMatch(/gates para/);
    [1, 2, 3, 4, 5].forEach((s) => {
      expect(screen.getByTestId(`stage-seg-${s}`).className).toMatch(/bg-emerald-500/);
    });
    expect(screen.queryByTestId('gates-pending')).not.toBeInTheDocument();
    expect(screen.getByTestId('mastery-note')).toBeInTheDocument();
  });

  it('aiNarrative presente: renderiza texto com pre-wrap', () => {
    const maturity = makeMaturity({
      aiNarrative:
        'Você consolidou disciplina emocional.\nPróximo passo: estabilidade em Payoff.',
    });

    render(<MaturityProgressionCard maturity={maturity} />);

    const narrative = screen.getByTestId('ai-narrative');
    expect(narrative.textContent).toMatch(/Você consolidou disciplina emocional/);
    expect(narrative.className).toMatch(/whitespace-pre-wrap/);
  });

  it('loading = true: renderiza skeleton sem gates', () => {
    render(<MaturityProgressionCard loading />);

    expect(screen.getByTestId('maturity-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('gates-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stage-summary')).not.toBeInTheDocument();
  });

  it('error truthy: renderiza mensagem de erro e não quebra', () => {
    const err = new Error('firestore permission denied');
    render(<MaturityProgressionCard error={err} />);

    expect(screen.getByText(/Erro ao carregar maturidade/)).toBeInTheDocument();
    expect(screen.queryByTestId('stage-bar')).not.toBeInTheDocument();
  });

  it('maturity null (CF nunca rodou): mensagem pendente + 5 segmentos cinza', () => {
    render(<MaturityProgressionCard maturity={null} />);

    expect(screen.getByText(/Maturidade ainda não foi calculada/)).toBeInTheDocument();
    [1, 2, 3, 4, 5].forEach((s) => {
      expect(screen.getByTestId(`stage-seg-${s}`).className).toMatch(/bg-gray-700/);
    });
  });

  it('sparseSample = true: chip "amostra inicial" visível', () => {
    const maturity = makeMaturity({ sparseSample: true });
    render(<MaturityProgressionCard maturity={maturity} />);

    const chip = screen.getByTestId('sparse-sample-chip');
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toMatch(/amostra inicial/);
    expect(chip.className).toMatch(/text-sky-300/);
  });

  it('embedded = true: não renderiza DebugBadge', () => {
    const maturity = makeMaturity();
    render(<MaturityProgressionCard maturity={maturity} embedded />);
    expect(screen.queryByTestId('debug-badge')).not.toBeInTheDocument();
  });

  it('embedded = false (default): DebugBadge com component="MaturityProgressionCard"', () => {
    const maturity = makeMaturity();
    render(<MaturityProgressionCard maturity={maturity} />);
    const badge = screen.getByTestId('debug-badge');
    expect(badge.textContent).toBe('MaturityProgressionCard');
  });

  it('mais de 5 gates pendentes: mostra 5 + "... e mais N gates"', () => {
    const gates = stage2Gates({ metCount: 0 }); // 8 gates, todos pendentes
    const maturity = makeMaturity({
      gates,
      gatesMet: 0,
      gatesTotal: 8,
      gatesRatio: 0,
    });

    render(<MaturityProgressionCard maturity={maturity} />);

    const pending = screen.getByTestId('gates-pending');
    const items = within(pending).getAllByRole('listitem');
    // 5 bullets de gate + 1 overflow item
    expect(items.length).toBe(6);
    expect(screen.getByTestId('gates-overflow').textContent).toMatch(/\.\.\. e mais 3 gates/);
  });

  it('gate fractional (journal 90%) renderiza "76%" / "14pp"', () => {
    const gates = stage2Gates({ metCount: 5 });
    const maturity = makeMaturity({
      gates,
      gatesMet: 5,
      gatesTotal: 8,
      gatesRatio: 5 / 8,
    });

    render(<MaturityProgressionCard maturity={maturity} />);
    const journalLine = screen.getByTestId('gate-journal-90');
    expect(journalLine.textContent).toMatch(/Journal ≥ 90%/);
    expect(journalLine.textContent).toMatch(/você: 76%/);
    expect(journalLine.textContent).toMatch(/faltam 14pp/);
  });

  it('STAGE_NAMES e STAGE_NAMES_SHORT têm 5 chaves 1..5 coerentes', () => {
    const keys = [1, 2, 3, 4, 5];
    keys.forEach((k) => {
      expect(typeof STAGE_NAMES[k]).toBe('string');
      expect(STAGE_NAMES[k].length).toBeGreaterThan(0);
      expect(typeof STAGE_NAMES_SHORT[k]).toBe('string');
      expect(STAGE_NAMES_SHORT[k].length).toBeGreaterThan(0);
    });
    expect(Object.keys(STAGE_NAMES)).toHaveLength(5);
    expect(Object.keys(STAGE_NAMES_SHORT)).toHaveLength(5);
  });

  describe('mobile collapsible gates (< sm breakpoint)', () => {
    it('colapsado por default: mostra apenas 2 gates + botão "ver todos N"', () => {
      const gates = stage2Gates({ metCount: 0 }); // 8 pendentes
      const maturity = makeMaturity({
        gates,
        gatesMet: 0,
        gatesTotal: 8,
        gatesRatio: 0,
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      const mobile = screen.getByTestId('gates-mobile');
      const items = within(mobile).getAllByRole('listitem');
      expect(items).toHaveLength(2);

      const toggle = within(mobile).getByTestId('mobile-toggle-gates');
      expect(toggle.textContent).toBe('ver todos 8');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-controls')).toBe('maturity-gates-list-mobile');

      const list = mobile.querySelector('#maturity-gates-list-mobile');
      expect(list.getAttribute('data-mobile-expanded')).toBe('false');
    });

    it('click no botão expande para todos os gates + label "recolher"', () => {
      const gates = stage2Gates({ metCount: 0 });
      const maturity = makeMaturity({
        gates,
        gatesMet: 0,
        gatesTotal: 8,
        gatesRatio: 0,
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      const mobile = screen.getByTestId('gates-mobile');
      const toggle = within(mobile).getByTestId('mobile-toggle-gates');
      fireEvent.click(toggle);

      const items = within(mobile).getAllByRole('listitem');
      expect(items).toHaveLength(8);
      expect(toggle.textContent).toBe('recolher');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      const list = mobile.querySelector('#maturity-gates-list-mobile');
      expect(list.getAttribute('data-mobile-expanded')).toBe('true');
    });

    it('pendingGates.length ≤ 2: não renderiza botão mobile', () => {
      const maturity = makeMaturity({
        gates: [
          makeGate({ id: 'g1', label: 'Gate 1' }),
          makeGate({ id: 'g2', label: 'Gate 2' }),
        ],
        gatesMet: 0,
        gatesTotal: 2,
        gatesRatio: 0,
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      const mobile = screen.getByTestId('gates-mobile');
      expect(within(mobile).getAllByRole('listitem')).toHaveLength(2);
      expect(screen.queryByTestId('mobile-toggle-gates')).not.toBeInTheDocument();
    });

    it('sem pendingGates (mastery): não renderiza bloco mobile nem botão', () => {
      const maturity = makeMaturity({
        currentStage: 5,
        gates: [],
        gatesMet: 0,
        gatesTotal: 0,
        gatesRatio: null,
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      expect(screen.queryByTestId('gates-mobile')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-toggle-gates')).not.toBeInTheDocument();
      expect(screen.getByTestId('mastery-note')).toBeInTheDocument();
    });

    it('loading=true: não renderiza botão mobile', () => {
      render(<MaturityProgressionCard loading />);
      expect(screen.queryByTestId('mobile-toggle-gates')).not.toBeInTheDocument();
      expect(screen.queryByTestId('gates-mobile')).not.toBeInTheDocument();
    });
  });

  describe('narrativa IA (task 14)', () => {
    it('aiGenerating=true: renderiza skeleton "Gerando análise"', () => {
      const maturity = makeMaturity();
      render(
        <MaturityProgressionCard maturity={maturity} aiGenerating />
      );
      const gen = screen.getByTestId('ai-generating');
      expect(gen).toBeInTheDocument();
      expect(gen.textContent).toMatch(/Gerando análise detalhada/);
      expect(gen.className).toMatch(/animate-pulse/);
      expect(screen.queryByTestId('ai-section')).not.toBeInTheDocument();
    });

    it('aiError truthy: renderiza fallback discreto "Análise IA temporariamente indisponível"', () => {
      const maturity = makeMaturity();
      render(
        <MaturityProgressionCard maturity={maturity} aiError="rate limit" />
      );
      const err = screen.getByTestId('ai-error');
      expect(err).toBeInTheDocument();
      expect(err.textContent).toMatch(/temporariamente indisponível/);
      expect(err.className).toMatch(/border-slate-700/);
      expect(screen.queryByTestId('ai-generating')).not.toBeInTheDocument();
    });

    it('narrative + patterns + guidance: todas as 3 seções renderizadas', () => {
      const maturity = makeMaturity({
        aiNarrative: 'Consolidou disciplina emocional ao longo das últimas 30 sessões.',
        aiPatternsDetected: [
          'Compliance rate subiu de 70% para 92%',
          'Tilts praticamente zerados após mudança de setup',
        ],
        aiNextStageGuidance: 'Foco em estabilidade operacional pelas próximas 4 semanas.',
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      const section = screen.getByTestId('ai-section');
      expect(section).toBeInTheDocument();

      const narrative = screen.getByTestId('ai-narrative');
      expect(narrative.textContent).toMatch(/Consolidou disciplina emocional/);

      const patterns = screen.getByTestId('ai-patterns');
      const items = within(patterns).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toMatch(/Compliance rate subiu/);

      const guidance = screen.getByTestId('ai-guidance');
      expect(guidance.textContent).toMatch(/Foco em estabilidade operacional/);
    });

    it('narrative presente mas patternsDetected vazio: só narrativa + guidance', () => {
      const maturity = makeMaturity({
        aiNarrative: 'Narrativa gerada',
        aiPatternsDetected: [],
        aiNextStageGuidance: 'Guidance presente',
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      expect(screen.getByTestId('ai-narrative')).toBeInTheDocument();
      expect(screen.getByTestId('ai-guidance')).toBeInTheDocument();
      expect(screen.queryByTestId('ai-patterns')).not.toBeInTheDocument();
    });

    it('campos IA todos nulos + sem aiGenerating + sem aiError: nada renderizado na seção', () => {
      const maturity = makeMaturity();
      render(<MaturityProgressionCard maturity={maturity} />);
      expect(screen.queryByTestId('ai-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ai-generating')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ai-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ai-narrative')).not.toBeInTheDocument();
    });

    it('aiGeneratedAt com toDate(): renderiza "gerado N dias atrás"', () => {
      const days = 3;
      const fakeTimestamp = {
        toDate: () => new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      };
      const maturity = makeMaturity({
        aiNarrative: 'Texto',
        aiGeneratedAt: fakeTimestamp,
      });

      render(<MaturityProgressionCard maturity={maturity} />);

      const ts = screen.getByTestId('ai-timestamp');
      expect(ts.textContent).toMatch(/gerado 3 dias atrás/);
    });
  });

  describe('botão Atualizar agora (task 23 — I1)', () => {
    it('sem onRefresh: botão NÃO renderiza (backwards compat / embedded)', () => {
      const maturity = makeMaturity();
      render(<MaturityProgressionCard maturity={maturity} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('refresh-control')).not.toBeInTheDocument();
    });

    it('com onRefresh + idle: botão renderiza e click chama handler uma vez', () => {
      const maturity = makeMaturity();
      const onRefresh = vi.fn();
      render(<MaturityProgressionCard maturity={maturity} onRefresh={onRefresh} />);

      const btn = screen.getByTestId('refresh-button');
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toMatch(/Atualizar agora/);
      expect(btn).not.toBeDisabled();

      fireEvent.click(btn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('refreshing=true: botão desabilitado com texto "Atualizando..."', () => {
      const maturity = makeMaturity();
      const onRefresh = vi.fn();
      render(
        <MaturityProgressionCard maturity={maturity} onRefresh={onRefresh} refreshing />
      );

      const btn = screen.getByTestId('refresh-button');
      expect(btn).toBeDisabled();
      expect(btn.textContent).toMatch(/Atualizando\.\.\./);
    });

    it('refreshThrottled=true + nextAllowedAt futuro: mostra "Próxima atualização em HH:MM" (BR)', () => {
      const maturity = makeMaturity();
      const onRefresh = vi.fn();
      const future = new Date();
      future.setHours(14, 37, 0, 0);
      render(
        <MaturityProgressionCard
          maturity={maturity}
          onRefresh={onRefresh}
          refreshThrottled
          refreshNextAllowedAt={future.getTime()}
        />
      );

      const msg = screen.getByTestId('refresh-throttled');
      expect(msg).toBeInTheDocument();
      const expected = future.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      expect(msg.textContent).toBe(`Próxima atualização em ${expected}`);
    });

    it('refreshError setado: indicador "Falha ao atualizar" visível', () => {
      const maturity = makeMaturity();
      const onRefresh = vi.fn();
      const err = new Error('functions/unavailable');
      render(
        <MaturityProgressionCard
          maturity={maturity}
          onRefresh={onRefresh}
          refreshError={err}
        />
      );

      const errEl = screen.getByTestId('refresh-error');
      expect(errEl).toBeInTheDocument();
      expect(errEl.textContent).toMatch(/Falha ao atualizar/);
      expect(errEl.getAttribute('title')).toBe('functions/unavailable');
    });

    it('loading=true (skeleton): botão NÃO renderiza mesmo com onRefresh', () => {
      const onRefresh = vi.fn();
      render(<MaturityProgressionCard loading onRefresh={onRefresh} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('error setado: botão renderiza (permite retry do recálculo)', () => {
      const onRefresh = vi.fn();
      render(
        <MaturityProgressionCard error={new Error('boom')} onRefresh={onRefresh} />
      );
      // Após o fix do bug diagnóstico (issue #119), o botão aparece também no
      // estado de erro para o usuário forçar retry sem recarregar a página.
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('maturity null (snapshot ausente): botão renderiza (permite forçar 1º recálculo)', () => {
      const onRefresh = vi.fn();
      render(<MaturityProgressionCard maturity={null} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });
  });

  it('gate com METRIC_UNAVAILABLE exibe "(aguardando dado)"', () => {
    const maturity = makeMaturity({
      gates: [
        makeGate({
          id: 'advanced-metrics',
          label: 'MFE/MAE/Sharpe rastreados',
          metric: 'advancedMetricsPresent',
          op: '==',
          threshold: true,
          value: null,
          met: null,
          gap: null,
          reason: 'METRIC_UNAVAILABLE',
        }),
      ],
      gatesMet: 0,
      gatesTotal: 1,
      gatesRatio: 0,
    });

    render(<MaturityProgressionCard maturity={maturity} />);
    const line = screen.getByTestId('gate-advanced-metrics');
    expect(line.textContent).toMatch(/aguardando dado/);
  });
});
