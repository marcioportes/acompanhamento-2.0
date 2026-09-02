/**
 * Step2Notice.test.jsx — issue #416 (task 02, blocos A5+A6)
 *
 * A seção "Custo emocional do ciclo" colore por valência comportamental, não
 * pelo sinal do P&L: dia com tilt/vingança que deu lucro NÃO pode aparecer em
 * verde nem trocar o ícone da seção por um sorriso (reforço intermitente).
 * Dia sem tilt/vingança continua colorido pelo sinal.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ trades: [], tiltDates: [] }));

vi.mock('../../../hooks/useTrades', () => ({
  useTrades: () => ({ trades: h.trades, loading: false }),
  default: () => ({ trades: h.trades, loading: false }),
}));
vi.mock('../../../hooks/useOrders', () => ({ default: () => ({ orders: [] }) }));
vi.mock('../../../hooks/useMasterData', () => ({
  useMasterData: () => ({ getEmotionConfig: () => ({}) }),
  default: () => ({ getEmotionConfig: () => ({}) }),
}));
vi.mock('../../../utils/executionBehaviorEngine', () => ({
  detectExecutionEvents: () => [],
  EVENT_TYPES: {},
}));
vi.mock('../../../utils/emotionalAnalysisV2', () => ({
  analyzeEmotionsV2: () => ({
    tilt: { sequences: h.tiltDates.map((date) => ({ trades: [{ date }] })) },
    revenge: { instances: [] },
    overtrading: { days: [] },
  }),
}));

import Step2Notice from '../../../components/cycleClosure/steps/Step2Notice';

const baseProps = {
  studentId: 's1', planId: 'p1',
  cycleStart: '2026-08-01', cycleEnd: '2026-08-31',
  onPatterns: vi.fn(),
};

const trade = (date, result) => ({ id: `${date}-${result}`, planId: 'p1', date, result });

/** Renderiza o step com o P&L do dia sujo e do dia limpo controlados. */
function renderCycle({ dirtyPnl = null, cleanPnl = null } = {}) {
  const trades = [];
  h.tiltDates = [];
  if (dirtyPnl !== null) {
    trades.push(trade('2026-08-03', dirtyPnl));
    h.tiltDates = ['2026-08-03'];
  }
  if (cleanPnl !== null) trades.push(trade('2026-08-10', cleanPnl));
  h.trades = trades;
  return render(<Step2Notice {...baseProps} />);
}

/** O <p> do valor é irmão imediato do <p> do rótulo — ancora label → número. */
const valueFor = (labelRe) => screen.getByText(labelRe).nextElementSibling;
const flat = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('Step2Notice — custo emocional por valência (#416 A5)', () => {
  it('dia com tilt/vingança e P&L positivo fica em vermelho, com o + visível', () => {
    renderCycle({ dirtyPnl: 560, cleanPnl: -120 });
    const dirty = valueFor(/Em dias com tilt\/vingança/);
    expect(dirty.className).toContain('text-red-400');
    expect(dirty.className).not.toContain('text-emerald-400');
    expect(flat(dirty)).toBe('+R$ 560');
  });

  it('dia com tilt/vingança e P&L negativo continua em vermelho', () => {
    renderCycle({ dirtyPnl: -430, cleanPnl: 200 });
    const dirty = valueFor(/Em dias com tilt\/vingança/);
    expect(dirty.className).toContain('text-red-400');
    expect(flat(dirty)).toBe('R$ -430');
  });

  it('dia sem tilt/vingança segue o sinal: negativo em vermelho', () => {
    renderCycle({ dirtyPnl: 560, cleanPnl: -120 });
    const clean = valueFor(/Em dias sem tilt\/vingança/);
    expect(clean.className).toContain('text-red-400');
    expect(clean.className).not.toContain('text-emerald-400');
  });

  it('dia sem tilt/vingança segue o sinal: positivo em emerald', () => {
    renderCycle({ dirtyPnl: -430, cleanPnl: 200 });
    const clean = valueFor(/Em dias sem tilt\/vingança/);
    expect(clean.className).toContain('text-emerald-400');
    expect(clean.className).not.toContain('text-red-400');
  });
});

describe('Step2Notice — ícone por valência, não por resultado (#416 A5)', () => {
  const SMILE = 'Ciclo sem dias em tilt/vingança';
  const FROWN = 'Ciclo com dias em tilt/vingança';

  it('não sorri quando o dia sujo deu lucro', () => {
    renderCycle({ dirtyPnl: 560, cleanPnl: -120 });
    expect(screen.queryByLabelText(SMILE)).toBeNull();
    expect(screen.getByLabelText(FROWN)).toBeTruthy();
  });

  it('mantém o mesmo ícone quando só o sinal do P&L do dia sujo muda', () => {
    renderCycle({ dirtyPnl: -430, cleanPnl: -120 });
    expect(screen.getByLabelText(FROWN)).toBeTruthy();
    expect(screen.queryByLabelText(SMILE)).toBeNull();
  });

  it('sorri só quando o ciclo não tem dia em tilt/vingança', () => {
    renderCycle({ cleanPnl: 200 });
    expect(screen.getByLabelText(SMILE)).toBeTruthy();
    expect(screen.queryByLabelText(FROWN)).toBeNull();
  });
});

describe('Step2Notice — rótulo honesto sobre o que o dado cobre (#416 A6)', () => {
  it('usa "dias sem tilt/vingança" no lugar de "dias limpos" nos dois cards', () => {
    const { container } = renderCycle({ dirtyPnl: 560, cleanPnl: -120 });
    expect(container.textContent).toContain('dias sem tilt/vingança');
    expect(container.textContent).not.toContain('dias limpos');
  });

  it('usa o rótulo honesto também no ciclo sem dia sujo', () => {
    const { container } = renderCycle({ cleanPnl: 200 });
    expect(container.textContent).toContain('dias sem tilt/vingança');
    expect(container.textContent).not.toContain('dias limpos');
  });
});
