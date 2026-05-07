/**
 * kellyCalculator.test.js — issue #259 (1A)
 *
 * Validação contra Worked example Clear-DT FEV/2026 (§11 do draft):
 *   edge=0.277R × 500 = 138.50; kelly_full ≈ 0.383; kelly_safe ≈ 0.096 (Quarter).
 */

import { describe, it, expect } from 'vitest';
import { computeKelly } from '../../../utils/cycleClosure/kellyCalculator';

const PLAN = { pl: 50000, riskPerOperation: 1 };

describe('computeKelly — defaults e cenários básicos', () => {
  it('plan inválido → reason="no_plan"', () => {
    const k = computeKelly([{ result: 500 }], null);
    expect(k.reason).toBe('no_plan');
    expect(k.kellySafe).toBeNull();
  });

  it('zero trades → reason="no_trades"', () => {
    const k = computeKelly([], PLAN);
    expect(k.reason).toBe('no_trades');
  });

  it('amostra menor que minSample → reason="insufficient_sample"', () => {
    const k = computeKelly(
      [{ result: 500 }, { result: -200 }, { result: 800 }],
      PLAN,
    );
    expect(k.reason).toBe('insufficient_sample');
    expect(k.sampleSize).toBe(3);
  });

  it('todas iguais → reason="zero_variance"', () => {
    const k = computeKelly(
      Array.from({ length: 12 }, () => ({ result: 500 })),
      PLAN,
    );
    expect(k.reason).toBe('zero_variance');
  });
});

describe('computeKelly — sample suficiente', () => {
  // Distribuição com edge positivo + variance > 0
  const trades = [
    ...Array.from({ length: 11 }, () => ({ result: 380 })),  // 0.76R wins
    ...Array.from({ length: 7 }, () => ({ result: -240 })),  // -0.48R losses
  ];

  it('reason=null e métricas computadas', () => {
    const k = computeKelly(trades, PLAN);
    expect(k.reason).toBeNull();
    expect(k.sampleSize).toBe(18);
    expect(k.R).toBe(500);
  });

  it('expectancy_R aprox +0.27R (worked example)', () => {
    const k = computeKelly(trades, PLAN);
    expect(k.expectancy_R).toBeGreaterThan(0.25);
    expect(k.expectancy_R).toBeLessThan(0.30);
  });

  it('kellySafe = kellyFull × cap (default Quarter=0.25)', () => {
    const k = computeKelly(trades, PLAN);
    expect(k.cap).toBe(0.25);
    expect(k.kellySafe).toBeCloseTo(k.kellyFull * 0.25, 6);
  });

  it('cap configurável (Half=0.5)', () => {
    const k = computeKelly(trades, PLAN, { cap: 0.5 });
    expect(k.cap).toBe(0.5);
    expect(k.kellySafe).toBeCloseTo(k.kellyFull * 0.5, 6);
  });

  it('cap fora de range cai pro default', () => {
    expect(computeKelly(trades, PLAN, { cap: 0 }).cap).toBe(0.25);
    expect(computeKelly(trades, PLAN, { cap: 2 }).cap).toBe(0.25);
    expect(computeKelly(trades, PLAN, { cap: -0.1 }).cap).toBe(0.25);
  });

  it('kellyFull > 0 quando edge positivo', () => {
    const k = computeKelly(trades, PLAN);
    expect(k.kellyFull).toBeGreaterThan(0);
  });

  it('edge negativo → kellyFull negativo (sinal: não opere)', () => {
    const losing = [
      ...Array.from({ length: 5 }, () => ({ result: 200 })),
      ...Array.from({ length: 13 }, () => ({ result: -300 })),
    ];
    const k = computeKelly(losing, PLAN);
    expect(k.expectancy_R).toBeLessThan(0);
    expect(k.kellyFull).toBeLessThan(0);
  });
});
