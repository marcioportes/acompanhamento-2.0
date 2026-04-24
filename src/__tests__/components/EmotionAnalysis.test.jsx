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

  it('1 emoção → card com 4 quadrantes (Financial/Operational/Emotional/Maturidade)', () => {
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
    // DEC-014 pt-BR: "Maturity" renomeado para "Maturidade"
    expect(within(card).getByText(/Maturidade/i)).toBeInTheDocument();
  });

  // issue #119 task 11: sparkline antiga do quadrante Maturidade foi removida.
  // Consolidação INV-17 — detalhe rico mora no MaturityProgressionCard.
  it('sparkline antiga do quadrante Maturidade não é mais renderizada', () => {
    const trades = [
      mk({ result: 100, date: '2026-04-01' }),
      mk({ result: 200, date: '2026-04-02' }),
      mk({ result: -50, date: '2026-04-03' }),
    ];
    render(<EmotionAnalysis trades={trades} />);
    const card = screen.getByTestId('emotion-card-Calmo');
    expect(within(card).queryByTestId('emotion-sparkline')).toBeNull();
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

  // ── Quadrante Maturidade (issue #119 task 11) ────────────────────────────
  // Detalhe rico mora no MaturityProgressionCard (INV-17 consolidação).
  // Teaser compacto no quadrante: stage label + mini-barra + fração de gates.
  describe('quadrante Maturidade (issue #119)', () => {
    it('maturity com currentStage=2 e 5/8 gates → "Reativo" + barra parcial', () => {
      const maturity = {
        currentStage: 2,
        gatesMet: 5,
        gatesTotal: 8,
        gatesRatio: 5 / 8,
      };
      render(
        <EmotionAnalysis trades={[mk({ result: 100 })]} maturity={maturity} />,
      );
      const card = screen.getByTestId('emotion-card-Calmo');
      expect(within(card).getByTestId('maturity-mini-stage').textContent).toBe(
        'Reativo',
      );
      // Seg 1 passado = emerald; seg 2 atual = container gray + fill amber;
      // segs 3-5 futuros = gray.
      const seg1 = within(card).getByTestId('maturity-mini-seg-1');
      expect(seg1.className).toMatch(/bg-emerald-500/);
      const seg2 = within(card).getByTestId('maturity-mini-seg-2');
      expect(seg2.className).toMatch(/bg-gray-700/);
      const fill = within(card).getByTestId('maturity-mini-seg-2-fill');
      expect(fill.className).toMatch(/bg-amber-400/);
      expect(fill.style.width).toBe('62.5%');
      for (const s of [3, 4, 5]) {
        const seg = within(card).getByTestId(`maturity-mini-seg-${s}`);
        expect(seg.className).toMatch(/bg-gray-700/);
        expect(seg.className).not.toMatch(/bg-emerald-500/);
      }
      expect(within(card).getByTestId('maturity-mini-gates').textContent).toMatch(
        /5\/8 gates para próximo/,
      );
    });

    it('maturity com currentStage=5 → "Maestria", todos segmentos emerald', () => {
      const maturity = {
        currentStage: 5,
        gatesMet: 0,
        gatesTotal: 0,
        gatesRatio: 0,
      };
      render(
        <EmotionAnalysis trades={[mk({ result: 100 })]} maturity={maturity} />,
      );
      const card = screen.getByTestId('emotion-card-Calmo');
      expect(within(card).getByTestId('maturity-mini-stage').textContent).toBe(
        'Maestria',
      );
      for (const s of [1, 2, 3, 4, 5]) {
        const seg = within(card).getByTestId(`maturity-mini-seg-${s}`);
        expect(seg.className).toMatch(/bg-emerald-500/);
      }
      expect(
        within(card).queryByTestId('maturity-mini-seg-5-fill'),
      ).toBeNull();
      expect(within(card).getByTestId('maturity-mini-gates').textContent).toBe(
        'Mastery',
      );
    });

    it('maturity === null → placeholder "Aguardando primeiro trade" + 5 segmentos cinza', () => {
      render(
        <EmotionAnalysis trades={[mk({ result: 100 })]} maturity={null} />,
      );
      const card = screen.getByTestId('emotion-card-Calmo');
      expect(
        within(card).getByTestId('maturity-mini-placeholder').textContent,
      ).toMatch(/Aguardando primeiro trade/i);
      for (const s of [1, 2, 3, 4, 5]) {
        const seg = within(card).getByTestId(`maturity-mini-seg-${s}`);
        expect(seg.className).toMatch(/bg-gray-700/);
        expect(seg.className).not.toMatch(/bg-emerald-500/);
      }
      expect(within(card).queryByTestId('maturity-mini-stage')).toBeNull();
      expect(within(card).queryByTestId('maturity-mini-gates')).toBeNull();
    });

    it('maturity prop omitida (undefined) → mesmo placeholder que null', () => {
      render(<EmotionAnalysis trades={[mk({ result: 100 })]} />);
      const card = screen.getByTestId('emotion-card-Calmo');
      expect(
        within(card).getByTestId('maturity-mini-placeholder'),
      ).toBeInTheDocument();
    });
  });
});
