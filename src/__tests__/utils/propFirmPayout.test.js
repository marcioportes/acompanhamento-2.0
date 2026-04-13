/**
 * propFirmPayout — Testes
 * @description Testes para qualifying days, payout eligibility, simulador de saque,
 *   histórico de withdrawals. Cenários reais Apex/Ylos.
 *
 * Ref: issue #134 Fase D, epic #52
 */

import { describe, it, expect } from 'vitest';
import {
  calculateQualifyingDays,
  calculatePayoutEligibility,
  simulateWithdrawal,
  getWithdrawalHistory,
} from '../../utils/propFirmPayout';

// ============================================
// Qualifying Days
// ============================================

describe('calculateQualifyingDays', () => {
  it('Apex: 5 qualifying days com profit $100-$300', () => {
    const history = [
      { date: '2026-04-01', dailyPnL: 150 },
      { date: '2026-04-02', dailyPnL: 250 },
      { date: '2026-04-03', dailyPnL: 50 },   // abaixo do min
      { date: '2026-04-04', dailyPnL: 100 },
      { date: '2026-04-07', dailyPnL: 200 },
      { date: '2026-04-08', dailyPnL: 350 },   // acima do max
      { date: '2026-04-09', dailyPnL: 300 },
      { date: '2026-04-10', dailyPnL: -100 },  // negativo
      { date: '2026-04-11', dailyPnL: 180 },
    ];
    const config = { count: 5, minProfit: 100, maxProfit: 300 };
    const result = calculateQualifyingDays(history, config);

    expect(result.qualifyingDays).toBe(6); // 150, 250, 100, 200, 300, 180
    expect(result.requiredDays).toBe(5);
    expect(result.met).toBe(true);
    expect(result.dailyBreakdown).toHaveLength(9);
  });

  it('Apex: insuficiente — 3 de 5 qualifying days', () => {
    const history = [
      { date: '2026-04-01', dailyPnL: 150 },
      { date: '2026-04-02', dailyPnL: 200 },
      { date: '2026-04-03', dailyPnL: 50 },
      { date: '2026-04-04', dailyPnL: 120 },
      { date: '2026-04-07', dailyPnL: -50 },
    ];
    const config = { count: 5, minProfit: 100, maxProfit: 300 };
    const result = calculateQualifyingDays(history, config);

    expect(result.qualifyingDays).toBe(3);
    expect(result.met).toBe(false);
  });

  it('Ylos: 7 qualifying days com profit >= $50 (sem teto)', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      dailyPnL: (i + 1) * 30, // 30, 60, 90, ... 300
    }));
    const config = { count: 7, minProfit: 50, maxProfit: null };
    const result = calculateQualifyingDays(history, config);

    // Dias com >= 50: dias 2+ (60, 90, ..., 300) = 9 dias
    expect(result.qualifyingDays).toBe(9);
    expect(result.met).toBe(true);
  });

  it('sem requisito de qualifying days → met true, qualifyingDays null', () => {
    const config = { count: null, minProfit: null, maxProfit: null };
    const result = calculateQualifyingDays([], config);

    expect(result.qualifyingDays).toBeNull();
    expect(result.requiredDays).toBeNull();
    expect(result.met).toBe(true);
  });

  it('config undefined → met true', () => {
    const result = calculateQualifyingDays([], undefined);
    expect(result.met).toBe(true);
  });

  it('múltiplos trades no mesmo dia → usa último doc (dailyPnL acumulado)', () => {
    const history = [
      { date: '2026-04-01', dailyPnL: 50 },  // 1º trade do dia
      { date: '2026-04-01', dailyPnL: 150 },  // 2º trade — acumulado do dia
    ];
    const config = { count: 1, minProfit: 100, maxProfit: null };
    const result = calculateQualifyingDays(history, config);

    // Último doc do dia 04-01 tem dailyPnL 150 → qualifica
    expect(result.qualifyingDays).toBe(1);
    expect(result.met).toBe(true);
  });

  it('histórico vazio → 0 qualifying days', () => {
    const config = { count: 5, minProfit: 100, maxProfit: 300 };
    const result = calculateQualifyingDays([], config);
    expect(result.qualifyingDays).toBe(0);
    expect(result.met).toBe(false);
  });
});

// ============================================
// Payout Eligibility
// ============================================

describe('calculatePayoutEligibility', () => {
  const baseTemplate = {
    accountSize: 50000,
    drawdown: { maxAmount: 2500, type: 'TRAILING_EOD' },
    payout: {
      minAmount: 500,
      minTradingDays: 8,
      qualifyingDays: { count: 5, minProfit: 100, maxProfit: 300 },
      split: 0.90,
      firstTierAmount: 25000,
      firstTierSplit: 1.00,
    },
  };

  it('elegível quando todos os critérios atendidos', () => {
    const result = calculatePayoutEligibility({
      template: baseTemplate,
      propFirm: { phase: 'SIM_FUNDED', tradingDays: 12 },
      currentBalance: 53000,
      accountSize: 50000,
      qualifyingResult: { qualifyingDays: 6, requiredDays: 5, met: true },
    });

    expect(result.eligible).toBe(true);
    expect(result.checks.every(c => c.met)).toBe(true);
  });

  it('não elegível na fase EVALUATION', () => {
    const result = calculatePayoutEligibility({
      template: baseTemplate,
      propFirm: { phase: 'EVALUATION', tradingDays: 15 },
      currentBalance: 55000,
      accountSize: 50000,
      qualifyingResult: { qualifyingDays: 7, requiredDays: 5, met: true },
    });

    expect(result.eligible).toBe(false);
    const phaseCheck = result.checks.find(c => c.rule.includes('Funded'));
    expect(phaseCheck.met).toBe(false);
  });

  it('não elegível com poucos trading days', () => {
    const result = calculatePayoutEligibility({
      template: baseTemplate,
      propFirm: { phase: 'SIM_FUNDED', tradingDays: 5 },
      currentBalance: 53000,
      accountSize: 50000,
      qualifyingResult: { qualifyingDays: 6, requiredDays: 5, met: true },
    });

    expect(result.eligible).toBe(false);
    const daysCheck = result.checks.find(c => c.rule.includes('dias'));
    expect(daysCheck.met).toBe(false);
  });

  it('não elegível com profit negativo', () => {
    const result = calculatePayoutEligibility({
      template: baseTemplate,
      propFirm: { phase: 'SIM_FUNDED', tradingDays: 12 },
      currentBalance: 49000, // abaixo do accountSize
      accountSize: 50000,
      qualifyingResult: { qualifyingDays: 6, requiredDays: 5, met: true },
    });

    expect(result.eligible).toBe(false);
    const profitCheck = result.checks.find(c => c.rule.includes('Profit'));
    expect(profitCheck.met).toBe(false);
  });

  it('availableForWithdrawal calcula corretamente', () => {
    // minBalance = 50000 - 2500 + 100 = 47600
    // available = 53000 - 47600 = 5400
    const result = calculatePayoutEligibility({
      template: baseTemplate,
      propFirm: { phase: 'SIM_FUNDED', tradingDays: 12 },
      currentBalance: 53000,
      accountSize: 50000,
      qualifyingResult: { qualifyingDays: 6, requiredDays: 5, met: true },
    });

    expect(result.availableForWithdrawal).toBe(5400);
    expect(result.minBalance).toBe(47600);
  });

  it('sem template payout → não elegível', () => {
    const result = calculatePayoutEligibility({
      template: { accountSize: 50000, drawdown: { maxAmount: 2500 } },
      propFirm: { phase: 'SIM_FUNDED' },
      currentBalance: 53000,
      accountSize: 50000,
      qualifyingResult: { met: true },
    });

    expect(result.eligible).toBe(false);
  });
});

// ============================================
// Simulador de Saque
// ============================================

describe('simulateWithdrawal', () => {
  const base = {
    currentBalance: 53000,
    currentDrawdownThreshold: 50000,
    accountSize: 50000,
    drawdownMax: 2500,
    isLocked: false,
    payoutSplit: 0.90,
    firstTierAmount: 25000,
    firstTierSplit: 1.00,
    totalWithdrawn: 0,
  };

  it('saque válido com split tier 1 (100%)', () => {
    const result = simulateWithdrawal({
      ...base,
      withdrawalAmount: 2000,
    });

    expect(result.valid).toBe(true);
    expect(result.traderReceives).toBe(2000); // 100% no tier 1
    expect(result.firmKeeps).toBe(0);
    expect(result.newBalance).toBe(51000);
    expect(result.effectiveSplit).toBe(1);
  });

  it('saque no tier 2 (90%) quando ultrapassou firstTierAmount', () => {
    const result = simulateWithdrawal({
      ...base,
      withdrawalAmount: 2000,
      totalWithdrawn: 24000, // 24K já sacado, 1K restante no tier 1
    });

    // 1000 × 1.00 + 1000 × 0.90 = 1000 + 900 = 1900
    expect(result.valid).toBe(true);
    expect(result.traderReceives).toBe(1900);
    expect(result.firmKeeps).toBe(100);
  });

  it('saque inválido — excede máximo', () => {
    // maxWithdrawal = 53000 - (50000 - 2500 + 100) = 53000 - 47600 = 5400
    const result = simulateWithdrawal({
      ...base,
      withdrawalAmount: 6000,
    });

    expect(result.valid).toBe(false);
    expect(result.maxWithdrawal).toBe(5400);
  });

  it('saque inválido — valor zero', () => {
    const result = simulateWithdrawal({ ...base, withdrawalAmount: 0 });
    expect(result.valid).toBe(false);
  });

  it('saque inválido — valor negativo', () => {
    const result = simulateWithdrawal({ ...base, withdrawalAmount: -100 });
    expect(result.valid).toBe(false);
  });

  it('threshold recalcula em trailing (não locked)', () => {
    const result = simulateWithdrawal({
      ...base,
      withdrawalAmount: 2000,
    });

    // newBalance = 51000, newThreshold = max(47500, 51000 - 2500) = 48500
    expect(result.newThreshold).toBe(48500);
  });

  it('threshold NÃO muda se locked', () => {
    const result = simulateWithdrawal({
      ...base,
      isLocked: true,
      withdrawalAmount: 2000,
    });

    expect(result.newThreshold).toBe(50000); // mantém original
  });

  it('threshold NÃO muda se trail frozen', () => {
    const result = simulateWithdrawal({
      ...base,
      isLocked: true, // trailFrozen é passado como isLocked externamente
      withdrawalAmount: 2000,
    });

    expect(result.newThreshold).toBe(50000);
  });

  it('threshold nunca abaixo do mínimo absoluto', () => {
    // newBalance = 48100, newThreshold = max(47500, 48100 - 2500) = max(47500, 45600) = 47500
    const result = simulateWithdrawal({
      ...base,
      currentBalance: 50100,
      currentDrawdownThreshold: 47600,
      withdrawalAmount: 2000,
    });

    expect(result.newThreshold).toBe(47500);
  });

  it('newDistanceToDD calculado corretamente', () => {
    const result = simulateWithdrawal({
      ...base,
      withdrawalAmount: 2000,
    });

    // newBalance = 51000, newThreshold = 48500
    // distanceToDD = (51000 - 48500) / 2500 = 1.0
    expect(result.newDistanceToDD).toBe(1);
  });

  it('cenário Apex EOD 50K — saque de $3000 após $20K sacado', () => {
    const result = simulateWithdrawal({
      currentBalance: 55000,
      currentDrawdownThreshold: 50000,
      accountSize: 50000,
      drawdownMax: 2500,
      isLocked: false,
      payoutSplit: 0.90,
      firstTierAmount: 25000,
      firstTierSplit: 1.00,
      totalWithdrawn: 20000,
      withdrawalAmount: 3000,
    });

    // Tier 1 restante: 25000 - 20000 = 5000 → 3000 cabe no tier 1
    expect(result.traderReceives).toBe(3000);
    expect(result.newBalance).toBe(52000);
  });

  it('cenário Ylos — sem firstTierAmount', () => {
    const result = simulateWithdrawal({
      currentBalance: 27000,
      currentDrawdownThreshold: 23500,
      accountSize: 25000,
      drawdownMax: 1500,
      isLocked: false,
      payoutSplit: 0.90,
      firstTierAmount: 15000,
      firstTierSplit: 1.00,
      totalWithdrawn: 0,
      withdrawalAmount: 1000,
    });

    // totalWithdrawn 0, firstTier 15000 → 1000 no tier 1 → 100%
    expect(result.traderReceives).toBe(1000);
  });
});

// ============================================
// Withdrawal History
// ============================================

describe('getWithdrawalHistory', () => {
  it('filtra apenas WITHDRAWAL', () => {
    const movements = [
      { id: '1', type: 'DEPOSIT', amount: 1000, date: '2026-04-01' },
      { id: '2', type: 'WITHDRAWAL', amount: -500, date: '2026-04-05', description: 'Saque 1' },
      { id: '3', type: 'TRADE_RESULT', amount: 200, date: '2026-04-06' },
      { id: '4', type: 'WITHDRAWAL', amount: -300, date: '2026-04-10', description: 'Saque 2' },
    ];

    const result = getWithdrawalHistory(movements);
    expect(result.count).toBe(2);
    expect(result.totalWithdrawn).toBe(800); // 500 + 300 (abs)
    expect(result.withdrawals[0].amount).toBe(500);
    expect(result.withdrawals[1].amount).toBe(300);
  });

  it('movements vazio → zero', () => {
    const result = getWithdrawalHistory([]);
    expect(result.count).toBe(0);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('movements null → zero', () => {
    const result = getWithdrawalHistory(null);
    expect(result.count).toBe(0);
  });

  it('amount já positivo (edge case) → usa abs', () => {
    const movements = [
      { id: '1', type: 'WITHDRAWAL', amount: 500, date: '2026-04-05' },
    ];
    const result = getWithdrawalHistory(movements);
    expect(result.totalWithdrawn).toBe(500);
  });
});
