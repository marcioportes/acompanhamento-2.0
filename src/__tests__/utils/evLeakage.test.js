/**
 * Tests: calculateEVLeakage -- v1.19.4
 * @description Testa calculo de EV Leakage (perda de edge por comportamento)
 * 
 * Cenarios:
 * - Execucao perfeita (leakage 0%)
 * - Leakage parcial (sizing inconsistente)
 * - Leakage total (edge perdido = PF 1.0)
 * - Outperformance (leakage negativo)
 * - Edge cases: sem trades, sem plano, plano sem edge
 */

import { describe, it, expect } from 'vitest';
import { calculateEVLeakage } from '../../utils/dashboardMetrics';

const basePlan = {
  id: 'plan1',
  pl: 200000,
  riskPerOperation: 0.5,  // 0.5% = R$1000
  rrTarget: 2              // 2:1
};

describe('calculateEVLeakage', () => {

  it('execucao perfeita -- leakage proximo de 0%', () => {
    // WR = 50%, RR = 2:1, RO = R$1000
    // EV teorico = 1000 * (0.5 * 2 - 0.5) = 1000 * 0.5 = 500/trade
    // Se resultado real = 500/trade => leakage = 0%
    const trades = [
      { planId: 'plan1', result: 2000 },  // win 2R
      { planId: 'plan1', result: -1000 }, // loss 1R
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result).not.toBeNull();
    expect(result.evTheoretical).toBe(500);
    expect(result.evReal).toBe(500);
    expect(result.leakage).toBe(0);
  });

  it('leakage total -- PF = 1.0, edge perdido', () => {
    // Caso do exemplo: 5 wins R$200 + 1 loss R$1000 = P&L zero
    // WR = 5/6 = 83.3%
    // EV teorico = 1000 * (0.833 * 2 - 0.167) = 1000 * 1.5 = ~1500/trade
    // EV real = 0/trade => leakage = 100%
    const trades = [
      { planId: 'plan1', result: 200 },
      { planId: 'plan1', result: 200 },
      { planId: 'plan1', result: 200 },
      { planId: 'plan1', result: 200 },
      { planId: 'plan1', result: 200 },
      { planId: 'plan1', result: -1000 },
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result).not.toBeNull();
    expect(result.evReal).toBeCloseTo(0, 0);
    expect(result.evTheoretical).toBeGreaterThan(0);
    expect(result.leakage).toBeCloseTo(100, 0);
  });

  it('outperformance -- aluno supera EV teorico (leakage negativo)', () => {
    // WR = 50%, mas wins sao maiores que 2R
    const trades = [
      { planId: 'plan1', result: 5000 },  // win 5R (acima do alvo 2R)
      { planId: 'plan1', result: -1000 }, // loss 1R
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    // EV teorico = 1000 * (0.5 * 2 - 0.5) = 500
    // EV real = 2000
    expect(result.evReal).toBe(2000);
    expect(result.leakage).toBeLessThan(0); // superando
  });

  it('retorna null quando trades vazio', () => {
    expect(calculateEVLeakage([], [basePlan])).toBeNull();
  });

  it('retorna null quando plans vazio', () => {
    const trades = [{ planId: 'plan1', result: 1000 }];
    expect(calculateEVLeakage(trades, [])).toBeNull();
  });

  it('retorna null quando inputs null/undefined', () => {
    expect(calculateEVLeakage(null, [basePlan])).toBeNull();
    expect(calculateEVLeakage(undefined, undefined)).toBeNull();
  });

  it('ignora trades sem planId valido', () => {
    const trades = [
      { planId: 'plan1', result: 2000 },
      { planId: 'inexistente', result: 2000 },
      { planId: 'plan1', result: -1000 },
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result.tradeCount).toBe(2); // so 2 com planId valido
  });

  it('plano sem rrTarget -> trades desse plano ignorados', () => {
    const planNoTarget = { id: 'plan2', pl: 50000, riskPerOperation: 1 };
    const trades = [
      { planId: 'plan2', result: 500 },
    ];

    const result = calculateEVLeakage(trades, [planNoTarget]);

    expect(result).toBeNull(); // nenhum trade elegivel
  });

  it('WR = 100% -> EV teorico alto, leakage depende do sizing', () => {
    // So wins, WR = 100%, LossRate = 0
    // EV teorico = 1000 * (1.0 * 2 - 0) = 2000/trade
    const trades = [
      { planId: 'plan1', result: 2000 },
      { planId: 'plan1', result: 2000 },
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result.evTheoretical).toBe(2000);
    expect(result.evReal).toBe(2000);
    expect(result.leakage).toBe(0);
  });

  it('WR = 0% -> EV teorico negativo, leakage null', () => {
    // So losses
    // EV teorico = 1000 * (0 * 2 - 1.0) = -1000 (plano sem edge nesse WR)
    const trades = [
      { planId: 'plan1', result: -1000 },
      { planId: 'plan1', result: -500 },
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result.evTheoretical).toBeLessThan(0);
    expect(result.leakage).toBeNull(); // sem edge, leakage nao faz sentido
  });

  it('totalLeakage = leakageAmount * tradeCount', () => {
    const trades = [
      { planId: 'plan1', result: 2000 },
      { planId: 'plan1', result: -1000 },
      { planId: 'plan1', result: -1000 },
      { planId: 'plan1', result: 2000 },
    ];

    const result = calculateEVLeakage(trades, [basePlan]);

    expect(result.totalLeakage).toBeCloseTo(result.leakageAmount * result.tradeCount, 1);
  });

  it('multiplos planos -- calcula corretamente', () => {
    const plan2 = { id: 'plan2', pl: 50000, riskPerOperation: 1, rrTarget: 3 };
    const trades = [
      { planId: 'plan1', result: 2000 },   // plan1: RO=1000, RR=2
      { planId: 'plan2', result: 1500 },   // plan2: RO=500, RR=3
      { planId: 'plan1', result: -1000 },  // plan1 loss
    ];

    const result = calculateEVLeakage(trades, [basePlan, plan2]);

    expect(result).not.toBeNull();
    expect(result.tradeCount).toBe(3);
  });
});
