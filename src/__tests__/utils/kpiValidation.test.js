/**
 * kpiValidation.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes para validação de KPIs contra ordens reais.
 */

import { describe, it, expect } from 'vitest';
import { validateKPIs, generateAlerts, THRESHOLDS, SEVERITY } from '../../utils/kpiValidation';

// ============================================
// FIXTURES
// ============================================

const baseMetrics = (overrides = {}) => ({
  stopOrderRate: 0.50,
  modifyRate: 0.10,
  cancelRate: 0.10,
  marketOrderPct: 0.50,
  avgHoldTimeWin: 5,
  avgHoldTimeLoss: 10,
  holdTimeAsymmetry: 2.0,
  averagingDownCount: 0,
  averagingDownInstances: [],
  ghostOrderCount: 0,
  orderToTradeRatio: 2.0,
  ...overrides,
});

const baseTradeMetrics = (overrides = {}) => ({
  winRate: 0.55,
  totalTrades: 40,
  ...overrides,
});

// ============================================
// validateKPIs — KPI Inflation Detection
// ============================================
describe('validateKPIs — inflation detection', () => {
  it('caso saudável: nenhuma flag', () => {
    const result = validateKPIs(baseMetrics(), baseTradeMetrics());
    expect(result.kpiInflationFlag).toBe(false);
    expect(result.kpiInflationSeverity).toBe(SEVERITY.NONE);
  });

  it('CASO REAL: zero stops + win rate 75% → SEVERE', () => {
    const metrics = baseMetrics({ stopOrderRate: 0 });
    const trades = baseTradeMetrics({ winRate: 0.75 });
    const result = validateKPIs(metrics, trades);
    expect(result.kpiInflationFlag).toBe(true);
    expect(result.kpiInflationSeverity).toBe(SEVERITY.SEVERE);
  });

  it('stopOrderRate baixa + win rate alta → flag', () => {
    const metrics = baseMetrics({ stopOrderRate: 0.15 });
    const trades = baseTradeMetrics({ winRate: 0.65 });
    const result = validateKPIs(metrics, trades);
    expect(result.kpiInflationFlag).toBe(true);
  });

  it('stopOrderRate 0 sozinho → SEVERE (mesmo com win rate moderado)', () => {
    const metrics = baseMetrics({ stopOrderRate: 0 });
    const trades = baseTradeMetrics({ winRate: 0.50 });
    const result = validateKPIs(metrics, trades);
    expect(result.kpiInflationFlag).toBe(true);
    expect(result.kpiInflationSeverity).toBe(SEVERITY.SEVERE);
  });

  it('stop usage acima de 20% + win rate acima de 60% → sem flag', () => {
    const metrics = baseMetrics({ stopOrderRate: 0.30 });
    const trades = baseTradeMetrics({ winRate: 0.70 });
    const result = validateKPIs(metrics, trades);
    expect(result.kpiInflationFlag).toBe(false);
  });

  it('win rate delta alto por ghost orders → flag', () => {
    const metrics = baseMetrics({ ghostOrderCount: 15, stopOrderRate: 0.30 });
    const trades = baseTradeMetrics({ winRate: 0.75, totalTrades: 40 });
    // adjusted: 30 wins / (40 + 15) = 0.545 → delta = 0.205
    const result = validateKPIs(metrics, trades);
    expect(result.kpiInflationFlag).toBe(true);
    expect(result.winRateDelta).toBeGreaterThan(0.10);
  });
});

// ============================================
// validateKPIs — Win Rate Adjustment
// ============================================
describe('validateKPIs — win rate adjustment', () => {
  it('sem ghost orders: adjusted = reported', () => {
    const result = validateKPIs(baseMetrics({ ghostOrderCount: 0 }), baseTradeMetrics({ winRate: 0.60, totalTrades: 50 }));
    expect(result.adjustedWinRate).toBe(0.60);
    expect(result.winRateDelta).toBe(0);
  });

  it('10 ghost orders em 50 trades: adjusted reduzido', () => {
    const result = validateKPIs(
      baseMetrics({ ghostOrderCount: 10 }),
      baseTradeMetrics({ winRate: 0.60, totalTrades: 50 })
    );
    // 30 wins / (50 + 10) = 0.50
    expect(result.adjustedWinRate).toBe(0.50);
    expect(result.winRateDelta).toBe(0.10);
  });

  it('zero trades + zero ghosts = zero adjusted', () => {
    const result = validateKPIs(baseMetrics({ ghostOrderCount: 0 }), baseTradeMetrics({ winRate: 0, totalTrades: 0 }));
    expect(result.adjustedWinRate).toBe(0);
  });
});

// ============================================
// generateAlerts
// ============================================
describe('generateAlerts', () => {
  it('KPI_INFLATION: zero stops + high win rate', () => {
    const alerts = generateAlerts(baseMetrics({ stopOrderRate: 0 }), baseTradeMetrics({ winRate: 0.75 }));
    const found = alerts.find(a => a.type === 'KPI_INFLATION');
    expect(found).toBeTruthy();
    expect(found.severity).toBe(SEVERITY.SEVERE);
  });

  it('HOLD_TIME_ASYMMETRY: ratio > 3', () => {
    const alerts = generateAlerts(
      baseMetrics({ holdTimeAsymmetry: 4.5, avgHoldTimeLoss: 45, avgHoldTimeWin: 10 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HOLD_TIME_ASYMMETRY');
    expect(found).toBeTruthy();
    expect(found.severity).toBe(SEVERITY.MODERATE);
  });

  it('HOLD_TIME_ASYMMETRY SEVERE: ratio > 5', () => {
    const alerts = generateAlerts(
      baseMetrics({ holdTimeAsymmetry: 6.0, avgHoldTimeLoss: 60, avgHoldTimeWin: 10 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HOLD_TIME_ASYMMETRY');
    expect(found).toBeTruthy();
    expect(found.severity).toBe(SEVERITY.SEVERE);
  });

  it('AVERAGING_NO_STOP: averaging + low stops', () => {
    const alerts = generateAlerts(
      baseMetrics({ averagingDownCount: 3, stopOrderRate: 0.10 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'AVERAGING_NO_STOP');
    expect(found).toBeTruthy();
    expect(found.severity).toBe(SEVERITY.SEVERE);
  });

  it('AVERAGING com stops OK: sem alert de AVERAGING_NO_STOP', () => {
    const alerts = generateAlerts(
      baseMetrics({ averagingDownCount: 3, stopOrderRate: 0.60 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'AVERAGING_NO_STOP');
    expect(found).toBeFalsy();
  });

  it('GHOST_ORDERS: >10% ghost rate', () => {
    const alerts = generateAlerts(
      baseMetrics({ ghostOrderCount: 10 }),
      baseTradeMetrics({ totalTrades: 40 })
    );
    const found = alerts.find(a => a.type === 'GHOST_ORDERS');
    expect(found).toBeTruthy();
  });

  it('HIGH_MODIFY_RATE: >30%', () => {
    const alerts = generateAlerts(
      baseMetrics({ modifyRate: 0.35 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HIGH_MODIFY_RATE');
    expect(found).toBeTruthy();
  });

  it('HIGH_CANCEL_RATE: >40%', () => {
    const alerts = generateAlerts(
      baseMetrics({ cancelRate: 0.45 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HIGH_CANCEL_RATE');
    expect(found).toBeTruthy();
  });

  it('HIGH_MARKET_ORDER_PCT: >80%', () => {
    const alerts = generateAlerts(
      baseMetrics({ marketOrderPct: 0.85 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HIGH_MARKET_ORDER_PCT');
    expect(found).toBeTruthy();
  });

  it('HIGH_ORDER_TRADE_RATIO: >5', () => {
    const alerts = generateAlerts(
      baseMetrics({ orderToTradeRatio: 6.0 }),
      baseTradeMetrics()
    );
    const found = alerts.find(a => a.type === 'HIGH_ORDER_TRADE_RATIO');
    expect(found).toBeTruthy();
  });

  it('cenário limpo: nenhum alert', () => {
    const alerts = generateAlerts(baseMetrics(), baseTradeMetrics());
    expect(alerts).toHaveLength(0);
  });

  it('cenário catastrófico (caso real): múltiplos alerts', () => {
    const alerts = generateAlerts(
      baseMetrics({
        stopOrderRate: 0,
        holdTimeAsymmetry: 10.0,
        avgHoldTimeLoss: 47,
        avgHoldTimeWin: 3,
        averagingDownCount: 5,
        marketOrderPct: 0.95,
        ghostOrderCount: 20,
        orderToTradeRatio: 6.0,
      }),
      baseTradeMetrics({ winRate: 0.75, totalTrades: 80 })
    );
    // Deve gerar KPI_INFLATION + HOLD_TIME_ASYMMETRY + AVERAGING_NO_STOP + HIGH_MARKET + GHOST + RATIO
    expect(alerts.length).toBeGreaterThanOrEqual(5);
    const types = alerts.map(a => a.type);
    expect(types).toContain('KPI_INFLATION');
    expect(types).toContain('HOLD_TIME_ASYMMETRY');
    expect(types).toContain('AVERAGING_NO_STOP');
  });
});
