/**
 * tradeCalculations.test.js
 * @version 1.0.0 (v1.19.0)
 * @description Testes para calculateAssumedRR (B2 — Issue #71)
 * 
 * DEC-005: RR Assumido — quando trade não tem stop loss, calcula RR
 * baseado no risco planejado (RO$ = PL × RO%) vs resultado efetivo.
 * Currency-agnostic: funciona para qualquer moeda.
 */

import { describe, it, expect } from 'vitest';
import { calculateAssumedRR } from '../../utils/tradeCalculations';

describe('calculateAssumedRR', () => {

  // ===== Cenário base: win que atinge RR alvo =====

  it('calcula RR corretamente para win que atinge o alvo', () => {
    // PL=10000, RO=1% → RO$=100, RR alvo=2 → esperado=200
    // Trade ganhou 200 → RR=2.0, compliant
    const result = calculateAssumedRR({
      result: 200,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 2,
    });
    expect(result).not.toBeNull();
    expect(result.rrAssumed).toBe(true);
    expect(result.roAmount).toBe(100);
    expect(result.rrRatio).toBe(2.0);
    expect(result.expectedResult).toBe(200);
    expect(result.isCompliant).toBe(true);
  });

  // ===== Win que supera o RR alvo =====

  it('calcula RR para win acima do alvo', () => {
    // PL=20000, RO=0.5% → RO$=100, RR alvo=3 → esperado=300
    // Trade ganhou 450 → RR=4.5, compliant
    const result = calculateAssumedRR({
      result: 450,
      planPl: 20000,
      planRiskPerOperation: 0.5,
      planRrTarget: 3,
    });
    expect(result.rrRatio).toBe(4.5);
    expect(result.roAmount).toBe(100);
    expect(result.expectedResult).toBe(300);
    expect(result.isCompliant).toBe(true);
  });

  // ===== Win que NÃO atinge o RR alvo =====

  it('detecta win que não atingiu RR alvo como não-conforme', () => {
    // PL=10000, RO=1% → RO$=100, RR alvo=2 → esperado=200
    // Trade ganhou 150 → RR=1.5, NÃO compliant
    const result = calculateAssumedRR({
      result: 150,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 2,
    });
    expect(result.rrRatio).toBe(1.5);
    expect(result.isCompliant).toBe(false);
  });

  // ===== Loss =====

  it('calcula RR negativo para loss', () => {
    // PL=10000, RO=1% → RO$=100, RR alvo=2
    // Trade perdeu 80 → RR=-0.8
    const result = calculateAssumedRR({
      result: -80,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 2,
    });
    expect(result.rrRatio).toBe(-0.8);
    expect(result.isCompliant).toBe(false);
  });

  // ===== Loss maior que o risco planejado =====

  it('calcula RR para loss maior que RO$', () => {
    // PL=10000, RO=1% → RO$=100
    // Trade perdeu 250 → RR=-2.5 (perdeu 2.5x o risco planejado)
    const result = calculateAssumedRR({
      result: -250,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 2,
    });
    expect(result.rrRatio).toBe(-2.5);
    expect(result.isCompliant).toBe(false);
  });

  // ===== Breakeven =====

  it('calcula RR zero para breakeven', () => {
    const result = calculateAssumedRR({
      result: 0,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 2,
    });
    expect(result.rrRatio).toBe(0);
    expect(result.isCompliant).toBe(false);
  });

  // ===== Conta USD (currency-agnostic) =====

  it('funciona para contas em USD (currency-agnostic)', () => {
    // PL=$25000, RO=2% → RO$=500, RR alvo=1.5 → esperado=750
    // Trade ganhou $800 → RR=1.6, compliant
    const result = calculateAssumedRR({
      result: 800,
      planPl: 25000,
      planRiskPerOperation: 2,
      planRrTarget: 1.5,
    });
    expect(result.roAmount).toBe(500);
    expect(result.rrRatio).toBe(1.6);
    expect(result.expectedResult).toBe(750);
    expect(result.isCompliant).toBe(true);
  });

  // ===== RO% fracionário =====

  it('suporta RO% fracionário (0.25%)', () => {
    // PL=40000, RO=0.25% → RO$=100
    const result = calculateAssumedRR({
      result: 300,
      planPl: 40000,
      planRiskPerOperation: 0.25,
      planRrTarget: 2,
    });
    expect(result.roAmount).toBe(100);
    expect(result.rrRatio).toBe(3.0);
    expect(result.isCompliant).toBe(true);
  });

  // ===== Dados insuficientes =====

  it('retorna null quando PL é zero ou ausente', () => {
    expect(calculateAssumedRR({
      result: 200, planPl: 0, planRiskPerOperation: 1, planRrTarget: 2,
    })).toBeNull();

    expect(calculateAssumedRR({
      result: 200, planPl: null, planRiskPerOperation: 1, planRrTarget: 2,
    })).toBeNull();

    expect(calculateAssumedRR({
      result: 200, planPl: undefined, planRiskPerOperation: 1, planRrTarget: 2,
    })).toBeNull();
  });

  it('retorna null quando RO% é zero ou ausente', () => {
    expect(calculateAssumedRR({
      result: 200, planPl: 10000, planRiskPerOperation: 0, planRrTarget: 2,
    })).toBeNull();

    expect(calculateAssumedRR({
      result: 200, planPl: 10000, planRiskPerOperation: null, planRrTarget: 2,
    })).toBeNull();
  });

  // ===== Sem RR target no plano =====

  it('calcula RR mesmo sem rrTarget (isCompliant=true por default)', () => {
    const result = calculateAssumedRR({
      result: 150,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: null,
    });
    expect(result).not.toBeNull();
    expect(result.rrRatio).toBe(1.5);
    expect(result.roAmount).toBe(100);
    expect(result.expectedResult).toBe(0);
    expect(result.isCompliant).toBe(true);
  });

  it('calcula RR com rrTarget=0 (sem regra de compliance)', () => {
    const result = calculateAssumedRR({
      result: -50,
      planPl: 10000,
      planRiskPerOperation: 1,
      planRrTarget: 0,
    });
    expect(result.rrRatio).toBe(-0.5);
    // rrTarget=0 → isCompliant true (sem regra)
    expect(result.isCompliant).toBe(true);
  });

  // ===== PL negativo =====

  it('retorna null para PL negativo', () => {
    expect(calculateAssumedRR({
      result: 100, planPl: -5000, planRiskPerOperation: 1, planRrTarget: 2,
    })).toBeNull();
  });

  // ===== Arredondamento =====

  it('arredonda rrRatio para 2 casas decimais', () => {
    // PL=10000, RO=3% → RO$=300
    // result=100 → RR = 100/300 = 0.3333... → 0.33
    const result = calculateAssumedRR({
      result: 100,
      planPl: 10000,
      planRiskPerOperation: 3,
      planRrTarget: 2,
    });
    expect(result.rrRatio).toBe(0.33);
  });
});
