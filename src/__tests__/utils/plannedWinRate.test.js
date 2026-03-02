/**
 * Tests: calculatePlannedWinRate & calculateComplianceRate
 * @description Testa WR Planejado (mão de alface) e Taxa de Conformidade
 */

import { describe, it, expect } from 'vitest';
import { calculatePlannedWinRate, calculateComplianceRate } from '../../utils/dashboardMetrics';

describe('calculatePlannedWinRate', () => {
  const plans = [
    { id: 'plan1', rrTarget: 2 },
    { id: 'plan2', rrTarget: 3 },
  ];

  it('distingue win disciplinado de "mão de alface"', () => {
    const trades = [
      { result: 100, planId: 'plan1', rrRatio: 2.5 },  // ✅ disciplinado (rr >= 2)
      { result: 50, planId: 'plan1', rrRatio: 1.2 },   // ❌ mão de alface (rr < 2)
      { result: -80, planId: 'plan1', rrRatio: null },  // loss
      { result: 200, planId: 'plan1', rrRatio: 3.0 },  // ✅ disciplinado
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result).not.toBeNull();
    expect(result.eligible).toBe(4);
    expect(result.disciplinedWins).toBe(2);
    expect(result.rate).toBe(50);           // 2/4 = 50%
    expect(result.classicWR).toBe(75);      // 3 positivos / 4 total
    expect(result.gap).toBe(25);            // 75 - 50 = 25%
  });

  it('trade com result > 0 mas rrRatio < target → NÃO é win disciplinado', () => {
    const trades = [
      { result: 10, planId: 'plan1', rrRatio: 0.5 },   // gain but rr < 2
      { result: 20, planId: 'plan1', rrRatio: 1.9 },   // gain but rr < 2
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result.disciplinedWins).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('trade com result <= 0 → nunca é win disciplinado, mesmo com bom rr', () => {
    const trades = [
      { result: -100, planId: 'plan1', rrRatio: 5.0 },  // loss com rr alto (não faz sentido, mas testa)
      { result: 0, planId: 'plan1', rrRatio: 2.0 },      // break-even
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result.disciplinedWins).toBe(0);
  });

  it('trade sem planId com rrTarget → não é eligible', () => {
    const trades = [
      { result: 100, planId: 'plan1', rrRatio: 3.0 },
      { result: 100, planId: null, rrRatio: 3.0 },       // sem plano
      { result: 100, planId: 'inexistente', rrRatio: 3.0 }, // plano não encontrado
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result.eligible).toBe(1);  // Só o primeiro é eligible
  });

  it('plano sem rrTarget → trade não é eligible', () => {
    const plansNoTarget = [{ id: 'plan1' }];  // sem rrTarget
    const trades = [
      { result: 100, planId: 'plan1', rrRatio: 5.0 },
    ];

    const result = calculatePlannedWinRate(trades, plansNoTarget);

    expect(result).toBeNull();  // 0 eligible → null
  });

  it('usa rr como fallback se rrRatio não existe', () => {
    const trades = [
      { result: 100, planId: 'plan1', rr: 2.5 },  // usa campo 'rr'
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result.disciplinedWins).toBe(1);
  });

  it('múltiplos planos com targets diferentes', () => {
    const trades = [
      { result: 100, planId: 'plan1', rrRatio: 2.5 },  // ✅ rr >= 2
      { result: 100, planId: 'plan2', rrRatio: 2.5 },  // ❌ rr < 3 (plan2 target = 3)
    ];

    const result = calculatePlannedWinRate(trades, plans);

    expect(result.eligible).toBe(2);
    expect(result.disciplinedWins).toBe(1);
  });

  it('trades vazio → null', () => {
    expect(calculatePlannedWinRate([], plans)).toBeNull();
  });

  it('plans vazio → null', () => {
    const trades = [{ result: 100, planId: 'plan1', rrRatio: 3.0 }];
    expect(calculatePlannedWinRate(trades, [])).toBeNull();
  });

  it('null inputs → null', () => {
    expect(calculatePlannedWinRate(null, null)).toBeNull();
    expect(calculatePlannedWinRate(null, plans)).toBeNull();
  });
});

describe('calculateComplianceRate', () => {

  it('calcula taxa corretamente — trades com e sem flags', () => {
    const trades = [
      { hasRedFlags: false, redFlags: [] },
      { hasRedFlags: true, redFlags: [{ type: 'X' }] },
      { hasRedFlags: false, redFlags: [] },
      { hasRedFlags: false },  // sem redFlags array
    ];

    const result = calculateComplianceRate(trades);

    expect(result.total).toBe(4);
    expect(result.compliant).toBe(3);
    expect(result.violations).toBe(1);
    expect(result.rate).toBe(75);
  });

  it('todos conformes → 100%', () => {
    const trades = [
      { hasRedFlags: false, redFlags: [] },
      { hasRedFlags: false, redFlags: [] },
    ];

    expect(calculateComplianceRate(trades).rate).toBe(100);
  });

  it('nenhum conforme → 0%', () => {
    const trades = [
      { hasRedFlags: true, redFlags: [{ type: 'X' }] },
      { hasRedFlags: true, redFlags: [{ type: 'Y' }] },
    ];

    expect(calculateComplianceRate(trades).rate).toBe(0);
  });

  it('detecta via redFlags array mesmo se hasRedFlags é false', () => {
    // Caso de inconsistência nos dados
    const trades = [
      { hasRedFlags: false, redFlags: [{ type: 'TRADE_SEM_STOP' }] },
    ];

    const result = calculateComplianceRate(trades);

    expect(result.violations).toBe(1);
  });

  it('trades vazio → null', () => {
    expect(calculateComplianceRate([])).toBeNull();
  });

  it('null → null', () => {
    expect(calculateComplianceRate(null)).toBeNull();
  });

  // Semáforo logic (informativo — a cor é definida na UI)
  it('rate >= 80 → zona verde', () => {
    const trades = Array(10).fill(null).map((_, i) => ({ 
      hasRedFlags: i === 0, 
      redFlags: i === 0 ? [{ type: 'X' }] : [] 
    }));

    const result = calculateComplianceRate(trades);

    expect(result.rate).toBe(90);  // 9/10
    expect(result.rate).toBeGreaterThanOrEqual(80);
  });

  it('rate 60-80 → zona amarela', () => {
    const trades = Array(10).fill(null).map((_, i) => ({ 
      hasRedFlags: i < 3, 
      redFlags: i < 3 ? [{ type: 'X' }] : [] 
    }));

    const result = calculateComplianceRate(trades);

    expect(result.rate).toBe(70);  // 7/10
    expect(result.rate).toBeGreaterThanOrEqual(60);
    expect(result.rate).toBeLessThan(80);
  });
});
