/**
 * Tests: v1.19.6 — Payoff, semaforo RO bidirecional, diagnostico assimetria, cor PL Atual
 * @description Testes para novas funcoes e logica da v1.19.6
 */

import { describe, it, expect } from 'vitest';
import { calculatePayoff } from '../../utils/dashboardMetrics';
import { getPerformanceInsights } from '../../utils/metricsInsights';

// ============================================
// calculatePayoff
// ============================================

describe('calculatePayoff', () => {

  it('calculo basico — avgWin > avgLoss → ratio > 1', () => {
    const stats = { avgWin: 200, avgLoss: 100, winRate: 60 };
    const result = calculatePayoff(stats);

    expect(result).not.toBeNull();
    expect(result.ratio).toBe(2.0);
    expect(result.avgWin).toBe(200);
    expect(result.avgLoss).toBe(100);
  });

  it('payoff fragil — avgWin ≈ avgLoss → ratio ≈ 1', () => {
    const stats = { avgWin: 107.33, avgLoss: 106.50, winRate: 60 };
    const result = calculatePayoff(stats);

    expect(result.ratio).toBe(1.01);
  });

  it('sem edge — avgWin < avgLoss → ratio < 1', () => {
    const stats = { avgWin: 50, avgLoss: 100, winRate: 70 };
    const result = calculatePayoff(stats);

    expect(result.ratio).toBe(0.5);
  });

  it('calcula WR minimo para breakeven', () => {
    // Payoff 2.0 → minWR = 1/(1+2) = 33.33%
    const stats = { avgWin: 200, avgLoss: 100, winRate: 50 };
    const result = calculatePayoff(stats);

    expect(result.minWRForBreakeven).toBe(33.33);
  });

  it('calcula WR minimo para breakeven — payoff 1.0', () => {
    // Payoff 1.0 → minWR = 1/(1+1) = 50%
    const stats = { avgWin: 100, avgLoss: 100, winRate: 50 };
    const result = calculatePayoff(stats);

    expect(result.minWRForBreakeven).toBe(50);
  });

  it('avgLoss = 0 → ratio null (divisao por zero)', () => {
    const stats = { avgWin: 100, avgLoss: 0, winRate: 100 };
    const result = calculatePayoff(stats);

    expect(result.ratio).toBeNull();
  });

  it('ambos zero → retorna null', () => {
    const stats = { avgWin: 0, avgLoss: 0, winRate: 0 };
    const result = calculatePayoff(stats);

    expect(result).toBeNull();
  });

  it('stats null → retorna null', () => {
    expect(calculatePayoff(null)).toBeNull();
    expect(calculatePayoff(undefined)).toBeNull();
  });

  it('avgLoss negativo (abs) → trata corretamente', () => {
    // calculateStats retorna avgLoss como valor positivo, mas defensivo
    const stats = { avgWin: 150, avgLoss: -75, winRate: 55 };
    const result = calculatePayoff(stats);

    expect(result.ratio).toBe(2.0); // 150/75
    expect(result.avgLoss).toBe(75);
  });
});

// ============================================
// getPerformanceInsights — diagnostico assimetria (v1.19.6)
// ============================================

describe('getPerformanceInsights — diagnostico assimetria', () => {

  it('losses extrapolaram risco → gera insight de inflacao', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 0.5, avgRoEfficiency: 90, winsCount: 3 },
      complianceRate: null,
      asymmetryDiagnostic: { winsNoStop: 0, winsTotal: 3, lossesOverRisk: 2, lossesTotal: 2 }
    });

    expect(insights.some(i => i.text.includes('extrapolaram o risco planejado'))).toBe(true);
  });

  it('todos wins sem stop → gera insight de risco estimado', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 0.7, avgRoEfficiency: 80, winsCount: 3 },
      complianceRate: null,
      asymmetryDiagnostic: { winsNoStop: 3, winsTotal: 3, lossesOverRisk: 0, lossesTotal: 2 }
    });

    expect(insights.some(i => i.text.includes('wins sem stop') && i.text.includes('estimado, nao medido'))).toBe(true);
  });

  it('wins parcialmente sem stop → gera insight de risco parcialmente estimado', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 0.8, avgRoEfficiency: 85, winsCount: 5 },
      complianceRate: null,
      asymmetryDiagnostic: { winsNoStop: 2, winsTotal: 5, lossesOverRisk: 0, lossesTotal: 3 }
    });

    expect(insights.some(i => i.text.includes('parcialmente estimado'))).toBe(true);
  });

  it('sem asymmetryDiagnostic → nao gera insights de diagnostico', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 0.5, avgRoEfficiency: 90, winsCount: 3 },
      complianceRate: null,
      asymmetryDiagnostic: null
    });

    expect(insights.some(i => i.text.includes('extrapolaram'))).toBe(false);
    expect(insights.some(i => i.text.includes('wins sem stop'))).toBe(false);
  });

  it('ratio >= 1 → nao gera diagnostico mesmo com asymmetryDiagnostic', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 90, winsCount: 3 },
      complianceRate: null,
      asymmetryDiagnostic: { winsNoStop: 3, winsTotal: 3, lossesOverRisk: 2, lossesTotal: 2 }
    });

    expect(insights.some(i => i.text.includes('extrapolaram'))).toBe(false);
  });
});

// ============================================
// getPerformanceInsights — semaforo RO bidirecional (v1.19.6)
// ============================================

describe('getPerformanceInsights — semaforo RO bidirecional', () => {

  it('RO > 120% → insight danger extrapolacao severa', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 150, winsCount: 5 },
      complianceRate: null,
      asymmetryDiagnostic: null
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('extrapolacao severa'))).toBe(true);
  });

  it('RO 101-120% → insight warning leve extrapolacao', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 109, winsCount: 5 },
      complianceRate: null,
      asymmetryDiagnostic: null
    });

    expect(insights.some(i => i.severity === 'warning' && i.text.includes('leve extrapolacao'))).toBe(true);
  });

  it('RO < 30% → insight warning subuso', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 20, winsCount: 5 },
      complianceRate: null,
      asymmetryDiagnostic: null
    });

    expect(insights.some(i => i.severity === 'warning' && i.text.includes('abaixo da capacidade'))).toBe(true);
  });

  it('RO 80-100% → nenhum insight de RO (faixa saudavel)', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 90, winsCount: 5 },
      complianceRate: null,
      asymmetryDiagnostic: null
    });

    expect(insights.some(i => i.text.includes('extrapolacao'))).toBe(false);
    expect(insights.some(i => i.text.includes('abaixo da capacidade'))).toBe(false);
  });
});

// ============================================
// ExtractSummary — cor PL Atual (logica isolada)
// ============================================

describe('PL Atual cor tricolor — logica', () => {
  // Testa a logica pura: currentPL <= 0 → red, totalPnL >= 0 → green, else → amber
  const getPlColor = (currentPL, totalPnL) => {
    if (currentPL <= 0) return 'text-red-400';
    if (totalPnL >= 0) return 'text-emerald-400';
    return 'text-amber-400';
  };

  it('resultado positivo → verde', () => {
    expect(getPlColor(8160, 160)).toBe('text-emerald-400');
  });

  it('resultado negativo mas PL positivo → amarelo', () => {
    expect(getPlColor(7874, -126)).toBe('text-amber-400');
  });

  it('capital zerado → vermelho', () => {
    expect(getPlColor(0, -8000)).toBe('text-red-400');
  });

  it('capital negativo → vermelho', () => {
    expect(getPlColor(-500, -8500)).toBe('text-red-400');
  });

  it('breakeven exato → verde (totalPnL = 0)', () => {
    expect(getPlColor(8000, 0)).toBe('text-emerald-400');
  });
});
