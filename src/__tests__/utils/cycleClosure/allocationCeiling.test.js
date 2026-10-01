/**
 * allocationCeiling.test.js — issue #480
 *
 * Teto do capital do plano no fechamento: max(equity do ciclo, lastro da conta).
 * Caso real: plano de 25.645,60 fecha setembro em −287,80 e o aluno quer subir pra 60k.
 */
import { describe, it, expect } from 'vitest';
import {
  ALLOCATION_TOLERANCE,
  computeAllocationCeiling,
  exceedsAllocationCeiling,
  resolveNextCyclePl,
} from '../../../utils/cycleClosure/allocationCeiling';

describe('#480 · computeAllocationCeiling', () => {
  it('conta sem aporte: o teto é o equity do ciclo', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 25357.8 });
    expect(out.ceiling).toBe(25357.8);
    expect(out.source).toBe('cycle');
  });

  it('aporte lançado na conta sobe o teto até o saldo livre', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 60000 });
    expect(out.ceiling).toBe(60000);
    expect(out.source).toBe('account');
  });

  it('PL dos outros planos ativos da conta não é lastro deste plano', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 60000, otherPlansPl: 20000 });
    expect(out.ceiling).toBe(40000);
  });

  it('resultado de trades posteriores ao ciclo sai do lastro (já conta no ciclo aberto)', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 61500, postCycleResult: 1500 });
    expect(out.ceiling).toBe(60000);
  });

  it('prejuízo posterior ao ciclo devolve o lastro que a conta já perdeu', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 59000, postCycleResult: -1000 });
    expect(out.ceiling).toBe(60000);
  });

  it('nunca fica mais rígido que o equity do ciclo, mesmo com a conta abaixo dele', () => {
    const out = computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: 1997 });
    expect(out.ceiling).toBe(25357.8);
    expect(out.source).toBe('cycle');
  });

  it('conta ausente ou saldo ilegível: cai no equity do ciclo', () => {
    expect(computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: null }).ceiling).toBe(25357.8);
    expect(computeAllocationCeiling({ cycleEquity: 25357.8, accountBalance: NaN }).ceiling).toBe(25357.8);
    expect(computeAllocationCeiling({ cycleEquity: 25357.8 }).ceiling).toBe(25357.8);
  });

  it('equity ausente ou não-positivo: sem gate', () => {
    expect(computeAllocationCeiling({ cycleEquity: null, accountBalance: 60000 }).ceiling).toBeNull();
    expect(computeAllocationCeiling({ cycleEquity: 0, accountBalance: 60000 }).ceiling).toBeNull();
    expect(computeAllocationCeiling({ cycleEquity: -50, accountBalance: 60000 }).ceiling).toBeNull();
    expect(computeAllocationCeiling().ceiling).toBeNull();
  });
});

describe('#480 · exceedsAllocationCeiling', () => {
  it('bloqueia acima do teto e libera dentro da folga de centavos', () => {
    expect(exceedsAllocationCeiling(60000, 60000)).toBe(false);
    expect(exceedsAllocationCeiling(60000 + ALLOCATION_TOLERANCE, 60000)).toBe(false);
    expect(exceedsAllocationCeiling(60000.11, 60000)).toBe(true);
    expect(exceedsAllocationCeiling(25645.6, 25357.8)).toBe(true);
  });

  it('teto null não bloqueia', () => {
    expect(exceedsAllocationCeiling(1e9, null)).toBe(false);
    expect(exceedsAllocationCeiling(1e9, undefined)).toBe(false);
  });
});

describe('#480 · resolveNextCyclePl', () => {
  it('sem ajuste, o PL rola pro equity do ciclo — não fica no capital antigo', () => {
    expect(resolveNextCyclePl({ adjustment: null, cycleEquity: 25357.8, currentPl: 25645.6 })).toBe(25357.8);
    expect(resolveNextCyclePl({
      adjustment: { changed: false, newPl: 25645.6 }, cycleEquity: 25357.8, currentPl: 25645.6,
    })).toBe(25357.8);
  });

  it('ajuste explícito do aluno tem prioridade', () => {
    expect(resolveNextCyclePl({
      adjustment: { changed: true, newPl: 60000 }, cycleEquity: 25357.8, currentPl: 25645.6,
    })).toBe(60000);
  });

  it('ajuste sem PL válido não vira PL', () => {
    expect(resolveNextCyclePl({
      adjustment: { changed: true, newPl: 0 }, cycleEquity: 25357.8, currentPl: 25645.6,
    })).toBe(25357.8);
  });

  it('equity não-positivo mantém o PL que já estava', () => {
    expect(resolveNextCyclePl({ adjustment: null, cycleEquity: 0, currentPl: 25645.6 })).toBe(25645.6);
    expect(resolveNextCyclePl({ adjustment: null, cycleEquity: null, currentPl: 25645.6 })).toBe(25645.6);
  });
});
