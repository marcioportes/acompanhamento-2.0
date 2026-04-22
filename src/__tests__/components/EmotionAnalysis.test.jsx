/**
 * EmotionAnalysis.test.jsx — issue #164 E3
 *
 * Testa a Matriz Emocional 4D: header, cards com 4 quadrantes (Financial /
 * Operational / Emotional / Maturity), sparkline SVG e insight acionável.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

import EmotionAnalysis from '../../components/EmotionAnalysis';

const mk = (overrides = {}) => ({
  result: 0,
  emotionEntry: 'Calmo',
  date: '2026-04-01',
  ...overrides,
});

describe('EmotionAnalysis (Matriz Emocional 4D)', () => {
  it('header mostra "Matriz Emocional 4D"', () => {
    render(<EmotionAnalysis trades={[mk({ result: 100 })]} />);
    expect(screen.getByText(/Matriz Emocional 4D/i)).toBeInTheDocument();
  });

  it('trades vazio → estado vazio', () => {
    render(<EmotionAnalysis trades={[]} />);
    expect(screen.getByText(/Sem dados emocionais/i)).toBeInTheDocument();
  });

  it('1 emoção → card com 4 quadrantes (Financial/Operational/Emotional/Maturity)', () => {
    const trades = [
      mk({ result: 200 }),
      mk({ result: 100 }),
      mk({ result: -50 }),
    ];
    render(<EmotionAnalysis trades={trades} globalWR={50} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    expect(within(card).getByText(/Financial/i)).toBeInTheDocument();
    expect(within(card).getByText(/Operational/i)).toBeInTheDocument();
    expect(within(card).getByText(/Emotional/i)).toBeInTheDocument();
    expect(within(card).getByText(/Maturity/i)).toBeInTheDocument();
  });

  it('card renderiza sparkline SVG (polyline)', () => {
    const trades = [
      mk({ result: 100, date: '2026-04-01' }),
      mk({ result: 200, date: '2026-04-02' }),
      mk({ result: -50, date: '2026-04-03' }),
    ];
    render(<EmotionAnalysis trades={trades} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    const sparkline = within(card).getByTestId('emotion-sparkline');
    expect(sparkline.tagName.toLowerCase()).toBe('svg');
    expect(sparkline.querySelector('polyline')).not.toBeNull();
  });

  it('badge de contagem aparece no header do card', () => {
    const trades = [mk({ result: 100 }), mk({ result: -10 })];
    render(<EmotionAnalysis trades={trades} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    expect(within(card).getByText('2x')).toBeInTheDocument();
  });

  it('insight acionável: shiftRate alto no maior ofensor', () => {
    // 5 trades Ansioso, 3 deles com exit diferente → shiftRate 60% + prejuízo
    const trades = [
      mk({ emotionEntry: 'Ansioso', emotionExit: 'Calmo', result: -100, date: '2026-04-01' }),
      mk({ emotionEntry: 'Ansioso', emotionExit: 'Calmo', result: -100, date: '2026-04-02' }),
      mk({ emotionEntry: 'Ansioso', emotionExit: 'Ansioso', result: 50, date: '2026-04-03' }),
      mk({ emotionEntry: 'Ansioso', emotionExit: 'Ansioso', result: 50, date: '2026-04-04' }),
      mk({ emotionEntry: 'Ansioso', emotionExit: 'Focado', result: -100, date: '2026-04-05' }),
    ];
    render(<EmotionAnalysis trades={trades} globalWR={50} />);
    const insight = screen.getByTestId('emotion-insight');
    expect(insight.textContent).toMatch(/Ansioso/);
    expect(insight.textContent).toMatch(/shift/i);
  });

  it('insight fallback: nenhum padrão claro → rodapé padrão', () => {
    // 1 trade neutro, sem shift, sem ofensor — fallback genérico
    const trades = [mk({ result: 50 })];
    render(<EmotionAnalysis trades={trades} />);
    const insight = screen.getByTestId('emotion-insight');
    expect(insight.textContent).toMatch(/melhor estado/i);
    expect(insight.textContent).toMatch(/Calmo/);
  });

  it('Δ WR aparece quando globalWR é passado', () => {
    // 2 wins / 1 loss → WR emoção 66.67%, Δ vs 50 = +16.67
    const trades = [
      mk({ result: 100 }),
      mk({ result: 100 }),
      mk({ result: -50 }),
    ];
    render(<EmotionAnalysis trades={trades} globalWR={50} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    // Texto "Δ" ou "+16" em algum lugar do quadrante Emocional
    expect(within(card).getByText(/Δ/i)).toBeInTheDocument();
  });

  it('Δ WR não aparece quando globalWR ausente', () => {
    const trades = [mk({ result: 100 }), mk({ result: -50 })];
    render(<EmotionAnalysis trades={trades} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    expect(within(card).queryByText(/Δ/)).toBeNull();
  });

  it('ordena cards por totalPL desc (maior lucro primeiro)', () => {
    const trades = [
      mk({ emotionEntry: 'Ansioso', result: -100 }),
      mk({ emotionEntry: 'Calmo', result: 300 }),
      mk({ emotionEntry: 'Focado', result: 50 }),
    ];
    render(<EmotionAnalysis trades={trades} />);
    const cards = screen.getAllByTestId(/emotion-card-/);
    expect(cards[0].getAttribute('data-testid')).toBe('emotion-card-Calmo');
    expect(cards[2].getAttribute('data-testid')).toBe('emotion-card-Ansioso');
  });

  it('DebugBadge renderiza com component="EmotionAnalysis"', () => {
    render(<EmotionAnalysis trades={[mk({ result: 10 })]} />);
    expect(screen.getByTestId('debug-badge').textContent).toBe('EmotionAnalysis');
  });
});
