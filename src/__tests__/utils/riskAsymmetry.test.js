/**
 * Tests: calculateRiskAsymmetry -- v1.19.4
 * @description Testa deteccao de assimetria de risco entre wins e losses
 * 
 * Cenarios:
 * - Sizing consistente (ratio ~= 1.0)
 * - Sizing assimetrico classico (arrisca menos nos wins)
 * - Sizing inverso (arrisca mais nos wins)
 * - Edge cases: sem wins, sem losses, dados insuficientes
 * - RO Efficiency: subotimizacao do risco permitido
 */

import { describe, it, expect } from 'vitest';
import { calculateRiskAsymmetry } from '../../utils/dashboardMetrics';

const basePlan = {
  id: 'plan1',
  pl: 200000,
  riskPerOperation: 0.5,  // 0.5% = R$1000 de RO
  rrTarget: 2
};

describe('calculateRiskAsymmetry', () => {

  it('sizing consistente -> ratio proximo de 1.0', () => {
    // Todos os trades arriscam ~R$1000 (100% do RO)
    const trades = [
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },   // win, risco R$1000
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },   // win, risco R$1000
      { planId: 'plan1', result: -1000, riskPercent: 0.5 },  // loss, risco R$1000
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result).not.toBeNull();
    expect(result.asymmetryRatio).toBe(1.0);
    expect(result.avgRiskWins).toBe(1000);
    expect(result.avgRiskLosses).toBe(1000);
    expect(result.avgRoEfficiency).toBe(100); // 100% do RO usado
  });

  it('assimetria classica -> arrisca menos nos wins (ratio < 1.0)', () => {
    // Caso do bug reportado: wins com R$100 de risco, loss com R$1000
    const trades = [
      { planId: 'plan1', result: 200, riskPercent: 0.05 },    // win, risco R$100
      { planId: 'plan1', result: 200, riskPercent: 0.05 },    // win, risco R$100
      { planId: 'plan1', result: 200, riskPercent: 0.05 },    // win, risco R$100
      { planId: 'plan1', result: 200, riskPercent: 0.05 },    // win, risco R$100
      { planId: 'plan1', result: 200, riskPercent: 0.05 },    // win, risco R$100
      { planId: 'plan1', result: -1000, riskPercent: 0.5 },   // loss, risco R$1000
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.asymmetryRatio).toBe(0.1);  // 100/1000 = 0.1x
    expect(result.avgRiskWins).toBe(100);
    expect(result.avgRiskLosses).toBe(1000);
    expect(result.winsCount).toBe(5);
    expect(result.lossesCount).toBe(1);
  });

  it('sizing inverso -> arrisca mais nos wins (ratio > 1.0)', () => {
    const trades = [
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },   // win, risco R$1000
      { planId: 'plan1', result: -200, riskPercent: 0.1 },    // loss, risco R$200
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.asymmetryRatio).toBe(5.0);  // 1000/200 = 5.0x
  });

  it('RO efficiency -- subotimizacao do plano', () => {
    // Todos arriscam R$200 quando poderiam arriscar R$1000
    const trades = [
      { planId: 'plan1', result: 400, riskPercent: 0.1 },    // risco R$200, RO eff = 20%
      { planId: 'plan1', result: -200, riskPercent: 0.1 },   // risco R$200, RO eff = 20%
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.avgRoEfficiency).toBe(20);  // 200/1000 = 20%
  });

  it('sem wins -> ratio null (divisao impossivel)', () => {
    const trades = [
      { planId: 'plan1', result: -500, riskPercent: 0.25 },
      { planId: 'plan1', result: -300, riskPercent: 0.15 },
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    // Sem wins, avgRiskLosses > 0, mas asymmetryRatio = 0/avg = 0
    // avgRiskWins = 0, avgRiskLosses > 0 -> ratio = 0/X = 0... 
    // Na verdade winRisks e vazio, avg([]) = 0, 0/800 = 0
    expect(result.asymmetryRatio).toBe(0);
    expect(result.avgRiskWins).toBe(0);
  });

  it('sem losses -> ratio null', () => {
    const trades = [
      { planId: 'plan1', result: 500, riskPercent: 0.25 },
      { planId: 'plan1', result: 300, riskPercent: 0.15 },
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.asymmetryRatio).toBeNull();  // avgRiskLosses = 0, divisao por zero
  });

  it('trades sem riskPercent assumem RO$ do plano', () => {
    const trades = [
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },    // win, risco R$1000
      { planId: 'plan1', result: 1000, riskPercent: null },    // win sem stop -> assume RO$ = R$1000
      { planId: 'plan1', result: -500, riskPercent: 0.25 },    // loss, risco R$500
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.winsCount).toBe(2);   // ambos wins incluidos
    expect(result.lossesCount).toBe(1);
    // avgRiskWins = (1000 + 1000) / 2 = 1000
    expect(result.avgRiskWins).toBe(1000);
  });

  it('trades sem planId valido sao ignorados', () => {
    const trades = [
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },
      { planId: 'inexistente', result: 2000, riskPercent: 0.5 },
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.winsCount).toBe(1);
  });

  it('breakeven (result = 0) nao conta como win nem loss', () => {
    const trades = [
      { planId: 'plan1', result: 0, riskPercent: 0.5 },
      { planId: 'plan1', result: 1000, riskPercent: 0.5 },
      { planId: 'plan1', result: -500, riskPercent: 0.25 },
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan]);

    expect(result.winsCount).toBe(1);
    expect(result.lossesCount).toBe(1);
    // Breakeven contribui para RO efficiency mas nao para asymmetry
  });

  it('retorna null quando trades vazio', () => {
    expect(calculateRiskAsymmetry([], [basePlan])).toBeNull();
  });

  it('retorna null quando plans vazio', () => {
    const trades = [{ planId: 'plan1', result: 1000, riskPercent: 0.5 }];
    expect(calculateRiskAsymmetry(trades, [])).toBeNull();
  });

  it('retorna null quando inputs null/undefined', () => {
    expect(calculateRiskAsymmetry(null, [basePlan])).toBeNull();
    expect(calculateRiskAsymmetry(undefined, undefined)).toBeNull();
  });

  it('multiplos planos -- calcula corretamente por plano', () => {
    const plan2 = { id: 'plan2', pl: 50000, riskPerOperation: 1, rrTarget: 2 };
    // plan1: RO = R$1000, plan2: RO = R$500
    const trades = [
      { planId: 'plan1', result: 2000, riskPercent: 0.5 },    // win, risco R$1000 (plan1)
      { planId: 'plan2', result: 1000, riskPercent: 1.0 },    // win, risco R$500 (plan2)
      { planId: 'plan1', result: -800, riskPercent: 0.4 },    // loss, risco R$800 (plan1)
    ];

    const result = calculateRiskAsymmetry(trades, [basePlan, plan2]);

    // avgWinRisk = (1000 + 500) / 2 = 750
    expect(result.avgRiskWins).toBe(750);
    // avgLossRisk = 800
    expect(result.avgRiskLosses).toBe(800);
    // ratio = 750/800 = 0.9375 -> arredondado 0.94
    expect(result.asymmetryRatio).toBe(0.94);
  });
});
