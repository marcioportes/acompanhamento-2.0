/**
 * Tests: metricsInsights -- v1.19.5
 * @description Testa gerador de conclusoes diagnosticas para tooltips
 */

import { describe, it, expect } from 'vitest';
import { getFinancialInsights, getPerformanceInsights, getPlanVsResultInsights } from '../../utils/metricsInsights';

describe('getFinancialInsights', () => {

  it('expectancy positivo -> insight success', () => {
    const insights = getFinancialInsights({
      stats: { totalPL: 5000, winRate: 60, profitFactor: 1.5 },
      drawdown: 2,
      maxDrawdownData: { maxDD: 500, maxDDPercent: 2.5 },
      evLeakage: { evReal: 664 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.severity === 'success' && i.text.includes('positivo'))).toBe(true);
  });

  it('expectancy negativo -> insight danger', () => {
    const insights = getFinancialInsights({
      stats: { totalPL: -2000, winRate: 30, profitFactor: 0.5 },
      drawdown: 8,
      maxDrawdownData: { maxDD: 3000, maxDDPercent: 8 },
      evLeakage: { evReal: -150 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('negativo'))).toBe(true);
  });

  it('drawdown alto -> insight danger', () => {
    const insights = getFinancialInsights({
      stats: { totalPL: 1000, winRate: 55, profitFactor: 1.2 },
      drawdown: 12,
      maxDrawdownData: { maxDD: 5000, maxDDPercent: 12 },
      evLeakage: { evReal: 100 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('Drawdown'))).toBe(true);
  });

  it('profit factor < 1 -> insight danger', () => {
    const insights = getFinancialInsights({
      stats: { totalPL: -500, winRate: 40, profitFactor: 0.7 },
      drawdown: 3,
      maxDrawdownData: { maxDD: 200, maxDDPercent: 3 },
      evLeakage: { evReal: -50 },
      currency: 'USD'
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('Profit Factor'))).toBe(true);
  });

  it('tudo ok -> insight info parametros', () => {
    const insights = getFinancialInsights({
      stats: { totalPL: 1000, winRate: 55, profitFactor: 1.5 },
      drawdown: 2,
      maxDrawdownData: { maxDD: 100, maxDDPercent: 2 },
      evLeakage: null,
      currency: 'BRL'
    });

    expect(insights.some(i => i.text.includes('parametros'))).toBe(true);
  });

  it('stats null -> retorna vazio', () => {
    const insights = getFinancialInsights({ stats: null, drawdown: 0, maxDrawdownData: {}, evLeakage: null, currency: 'BRL' });
    expect(insights).toEqual([]);
  });
});

describe('getPerformanceInsights', () => {

  it('WR alto + WR planejado baixo -> ansiedade de saida', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 80 },
      winRatePlanned: { rate: 20, gap: 60, disciplinedWins: 2, eligible: 10 },
      riskAsymmetry: null,
      complianceRate: null
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('ansiedade'))).toBe(true);
  });

  it('sizing critico < 0.4 -> insight danger', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: 0.1, avgRoEfficiency: 50, winsCount: 5 },
      complianceRate: null
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('Sizing critico'))).toBe(true);
  });

  it('sizing consistente -> insight success', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: { rate: 55, gap: 5 },
      riskAsymmetry: { asymmetryRatio: 1.0, avgRoEfficiency: 80, winsCount: 10 },
      complianceRate: { rate: 90, violations: 1, total: 10 }
    });

    expect(insights.some(i => i.severity === 'success')).toBe(true);
  });

  it('wins sem stop -> warning', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 60 },
      winRatePlanned: null,
      riskAsymmetry: { asymmetryRatio: null, avgRoEfficiency: 50, winsCount: 0 },
      complianceRate: null
    });

    expect(insights.some(i => i.text.includes('sem stop'))).toBe(true);
  });

  it('compliance baixa -> danger', () => {
    const insights = getPerformanceInsights({
      stats: { winRate: 50 },
      winRatePlanned: null,
      riskAsymmetry: null,
      complianceRate: { rate: 40, violations: 6, total: 10, compliant: 4 }
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('violacoes'))).toBe(true);
  });
});

describe('getPlanVsResultInsights', () => {

  it('leakage > 60% -> critico com valor perdido', () => {
    const insights = getPlanVsResultInsights({
      evLeakage: { leakage: 80, totalLeakage: 5000, evTheoretical: 1000, evReal: 200 },
      riskAsymmetry: null,
      winRatePlanned: null,
      stats: { winRate: 50 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.severity === 'danger' && i.text.includes('critica'))).toBe(true);
  });

  it('leakage < 0 -> superando', () => {
    const insights = getPlanVsResultInsights({
      evLeakage: { leakage: -20, totalLeakage: -1000, evTheoretical: 500, evReal: 600 },
      riskAsymmetry: null,
      winRatePlanned: null,
      stats: { winRate: 70 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.severity === 'success' && i.text.includes('Superando'))).toBe(true);
  });

  it('leakage com ansiedade + sizing -> diagnostica ambas causas', () => {
    const insights = getPlanVsResultInsights({
      evLeakage: { leakage: 50, totalLeakage: 3000, evTheoretical: 800, evReal: 400 },
      riskAsymmetry: { asymmetryRatio: 0.3 },
      winRatePlanned: { rate: 30, gap: 40 },
      stats: { winRate: 70 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.text.includes('saida antecipada') && i.text.includes('sizing'))).toBe(true);
  });

  it('leakage com so ansiedade -> diagnostica causa unica', () => {
    const insights = getPlanVsResultInsights({
      evLeakage: { leakage: 40, totalLeakage: 2000, evTheoretical: 600, evReal: 360 },
      riskAsymmetry: { asymmetryRatio: 0.9 },
      winRatePlanned: { rate: 30, gap: 30 },
      stats: { winRate: 60 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.text.includes('saida antecipada') && !i.text.includes('sizing'))).toBe(true);
  });

  it('sem dados -> insight info', () => {
    const insights = getPlanVsResultInsights({
      evLeakage: null,
      riskAsymmetry: null,
      winRatePlanned: null,
      stats: { winRate: 50 },
      currency: 'BRL'
    });

    expect(insights.some(i => i.text.includes('insuficientes'))).toBe(true);
  });
});
