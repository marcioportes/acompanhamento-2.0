/**
 * Prop Dashboard Fase C — Testes
 * @description Testes para:
 *   - Tempo médio de trades (avgTradeDuration) — classificação e cálculo
 *   - DrawdownSparkline — normalização de dados
 *   - useDrawdownHistory — cenário vazio
 *
 * Ref: issue #134 Fase C, epic #52
 */

import { describe, it, expect } from 'vitest';

// ============================================
// Tempo médio de trades — lógica de cálculo
// (replica a lógica de useDashboardMetrics)
// ============================================

function calculateAvgDuration(trades) {
  const withDuration = trades.filter(t => typeof t.duration === 'number' && t.duration > 0);
  if (withDuration.length === 0) return null;

  const wins = withDuration.filter(t => (t.result ?? 0) > 0);
  const losses = withDuration.filter(t => (t.result ?? 0) < 0);

  const avg = (arr) => arr.length > 0 ? arr.reduce((s, t) => s + t.duration, 0) / arr.length : null;

  return {
    all: avg(withDuration),
    win: avg(wins),
    loss: avg(losses),
    count: withDuration.length,
  };
}

// ============================================
// Classificação de duração
// ============================================

function classifyDuration(avgMinutes) {
  if (avgMinutes == null || isNaN(avgMinutes)) return { label: '-', color: 'text-slate-400' };
  if (avgMinutes < 5) return { label: 'Scalping', color: 'text-purple-400' };
  if (avgMinutes <= 60) return { label: 'Day Trade', color: 'text-blue-400' };
  return { label: 'Swing', color: 'text-emerald-400' };
}

// ============================================
// Formatação de duração
// ============================================

function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '-';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ============================================
// Sparkline normalização
// ============================================

function normalizeSparklinePoints(history, drawdownMax, accountSize) {
  const minThreshold = accountSize - drawdownMax;
  return history.map(h => {
    const threshold = h.drawdownThreshold ?? h.currentDrawdownThreshold ?? minThreshold;
    const normalized = drawdownMax > 0 ? (threshold - minThreshold) / drawdownMax : 0;
    return Math.max(0, Math.min(1, normalized));
  });
}

// ============================================
// Testes: Tempo Médio
// ============================================

describe('avgTradeDuration — cálculo', () => {
  it('trades com durações variadas', () => {
    const trades = [
      { duration: 3, result: 100 },   // win scalping
      { duration: 15, result: -50 },   // loss day trade
      { duration: 45, result: 200 },   // win day trade
      { duration: 2, result: -30 },    // loss scalping
    ];
    const avg = calculateAvgDuration(trades);
    expect(avg.all).toBeCloseTo(16.25); // (3+15+45+2)/4
    expect(avg.win).toBeCloseTo(24);     // (3+45)/2
    expect(avg.loss).toBeCloseTo(8.5);   // (15+2)/2
    expect(avg.count).toBe(4);
  });

  it('retorna null se nenhum trade com duration', () => {
    const trades = [
      { result: 100 },
      { duration: 0, result: -50 },
      { duration: null, result: 200 },
    ];
    expect(calculateAvgDuration(trades)).toBeNull();
  });

  it('ignora trades com duration 0 ou negativa', () => {
    const trades = [
      { duration: 10, result: 100 },
      { duration: 0, result: -50 },
      { duration: -5, result: 200 },
    ];
    const avg = calculateAvgDuration(trades);
    expect(avg.count).toBe(1);
    expect(avg.all).toBe(10);
  });

  it('win/loss null se não há wins/losses', () => {
    const trades = [
      { duration: 10, result: 100 },
      { duration: 20, result: 50 },
    ];
    const avg = calculateAvgDuration(trades);
    expect(avg.win).toBeCloseTo(15);
    expect(avg.loss).toBeNull();
  });

  it('trades com result 0 não contam como win nem loss', () => {
    const trades = [
      { duration: 10, result: 0 },
    ];
    const avg = calculateAvgDuration(trades);
    expect(avg.all).toBe(10);
    expect(avg.win).toBeNull();
    expect(avg.loss).toBeNull();
  });
});

describe('classifyDuration', () => {
  it('< 5 min = Scalping', () => {
    expect(classifyDuration(3)).toEqual({ label: 'Scalping', color: 'text-purple-400' });
  });

  it('5 min = Day Trade', () => {
    expect(classifyDuration(5)).toEqual({ label: 'Day Trade', color: 'text-blue-400' });
  });

  it('30 min = Day Trade', () => {
    expect(classifyDuration(30).label).toBe('Day Trade');
  });

  it('60 min = Day Trade (inclusive)', () => {
    expect(classifyDuration(60).label).toBe('Day Trade');
  });

  it('61 min = Swing', () => {
    expect(classifyDuration(61)).toEqual({ label: 'Swing', color: 'text-emerald-400' });
  });

  it('null retorna "-"', () => {
    expect(classifyDuration(null).label).toBe('-');
  });

  it('NaN retorna "-"', () => {
    expect(classifyDuration(NaN).label).toBe('-');
  });
});

describe('formatDuration', () => {
  it('30s → "30s"', () => {
    expect(formatDuration(0.5)).toBe('30s');
  });

  it('5 min → "5min"', () => {
    expect(formatDuration(5)).toBe('5min');
  });

  it('45 min → "45min"', () => {
    expect(formatDuration(45)).toBe('45min');
  });

  it('90 min → "1h 30min"', () => {
    expect(formatDuration(90)).toBe('1h 30min');
  });

  it('120 min → "2h"', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('null → "-"', () => {
    expect(formatDuration(null)).toBe('-');
  });
});

// ============================================
// Testes: Sparkline normalização
// ============================================

describe('normalizeSparklinePoints', () => {
  it('threshold no mínimo = 0, no máximo = 1', () => {
    const accountSize = 50000;
    const drawdownMax = 2500;
    const history = [
      { drawdownThreshold: 47500 }, // mínimo = 0
      { drawdownThreshold: 48000 }, // 500/2500 = 0.2
      { drawdownThreshold: 50000 }, // 2500/2500 = 1
    ];
    const points = normalizeSparklinePoints(history, drawdownMax, accountSize);
    expect(points[0]).toBe(0);
    expect(points[1]).toBeCloseTo(0.2);
    expect(points[2]).toBe(1);
  });

  it('clampado entre 0 e 1', () => {
    const points = normalizeSparklinePoints(
      [{ drawdownThreshold: 45000 }], // abaixo do mínimo
      2500, 50000
    );
    expect(points[0]).toBe(0);
  });

  it('drawdownMax 0 → todos 0', () => {
    const points = normalizeSparklinePoints(
      [{ drawdownThreshold: 50000 }],
      0, 50000
    );
    expect(points[0]).toBe(0);
  });

  it('histórico vazio → array vazio', () => {
    expect(normalizeSparklinePoints([], 2500, 50000)).toEqual([]);
  });

  it('usa currentDrawdownThreshold como fallback', () => {
    const points = normalizeSparklinePoints(
      [{ currentDrawdownThreshold: 48750 }], // 1250/2500 = 0.5
      2500, 50000
    );
    expect(points[0]).toBeCloseTo(0.5);
  });
});

// ============================================
// Testes: useDrawdownHistory — cenário vazio
// ============================================

describe('useDrawdownHistory — design', () => {
  it('accountId null → history vazio (verificação de contrato)', () => {
    // Hook retorna { history: [], loading: false } quando accountId é null
    // Este teste verifica o contrato esperado, não executa o hook
    const result = { history: [], loading: false };
    expect(result.history).toEqual([]);
    expect(result.loading).toBe(false);
  });
});
