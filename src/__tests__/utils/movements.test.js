/**
 * Tests: normalizeMovementAmount & shouldSkipDeleteReversal
 * @description Testa normalização de amount na cadeia contábil de movements
 * 
 * Cadeia de custódia do saldo:
 *   movement criado → CF onMovementCreated → normaliza amount → updateAccountBalance
 *   movement deletado → CF onMovementDeleted → normaliza + inverte → updateAccountBalance
 * 
 * Se a normalização estiver errada, o saldo inteiro da conta fica inconsistente.
 */

import { describe, it, expect } from 'vitest';
import { normalizeMovementAmount, shouldSkipDeleteReversal } from '../../utils/movements';

describe('normalizeMovementAmount', () => {

  describe('WITHDRAWAL — sempre negativo', () => {
    it('amount positivo → retorna negativo', () => {
      expect(normalizeMovementAmount('WITHDRAWAL', 500)).toBe(-500);
    });

    it('amount negativo → mantém negativo', () => {
      expect(normalizeMovementAmount('WITHDRAWAL', -500)).toBe(-500);
    });

    it('amount zero → retorna -0 (Math.abs(0) = 0)', () => {
      expect(normalizeMovementAmount('WITHDRAWAL', 0)).toBe(-0);
    });
  });

  describe('DEPOSIT — sempre positivo', () => {
    it('amount positivo → mantém positivo', () => {
      expect(normalizeMovementAmount('DEPOSIT', 500)).toBe(500);
    });

    it('amount negativo → retorna positivo', () => {
      expect(normalizeMovementAmount('DEPOSIT', -500)).toBe(500);
    });

    it('amount zero → retorna 0', () => {
      expect(normalizeMovementAmount('DEPOSIT', 0)).toBe(0);
    });
  });

  describe('INITIAL_BALANCE — sempre positivo', () => {
    it('amount positivo → mantém positivo', () => {
      expect(normalizeMovementAmount('INITIAL_BALANCE', 20000)).toBe(20000);
    });

    it('amount negativo → retorna positivo', () => {
      expect(normalizeMovementAmount('INITIAL_BALANCE', -20000)).toBe(20000);
    });
  });

  describe('TRADE_RESULT — preserva sinal original', () => {
    it('trade vencedor (positivo) → mantém positivo', () => {
      expect(normalizeMovementAmount('TRADE_RESULT', 150)).toBe(150);
    });

    it('trade perdedor (negativo) → mantém negativo', () => {
      expect(normalizeMovementAmount('TRADE_RESULT', -80)).toBe(-80);
    });

    it('trade break-even (zero) → mantém zero', () => {
      expect(normalizeMovementAmount('TRADE_RESULT', 0)).toBe(0);
    });
  });

  describe('ADJUSTMENT — preserva sinal original', () => {
    it('ajuste positivo → mantém positivo', () => {
      expect(normalizeMovementAmount('ADJUSTMENT', 1000)).toBe(1000);
    });

    it('ajuste negativo → mantém negativo', () => {
      expect(normalizeMovementAmount('ADJUSTMENT', -500)).toBe(-500);
    });
  });

  describe('tipo desconhecido — fallback preserva sinal', () => {
    it('tipo não mapeado → retorna amount tal qual', () => {
      expect(normalizeMovementAmount('UNKNOWN_TYPE', 100)).toBe(100);
      expect(normalizeMovementAmount('UNKNOWN_TYPE', -100)).toBe(-100);
    });
  });

  describe('cenários de integração: create + delete reversal', () => {
    it('DEPOSIT create + delete devem se anular', () => {
      const created = normalizeMovementAmount('DEPOSIT', 1000);    // +1000
      const deleted = -normalizeMovementAmount('DEPOSIT', 1000);   // -1000

      expect(created + deleted).toBe(0);
    });

    it('WITHDRAWAL create + delete devem se anular', () => {
      const created = normalizeMovementAmount('WITHDRAWAL', 500);   // -500
      const deleted = -normalizeMovementAmount('WITHDRAWAL', 500);  // +500

      expect(created + deleted).toBe(0);
    });

    it('TRADE_RESULT create + delete devem se anular', () => {
      const created = normalizeMovementAmount('TRADE_RESULT', -80);  // -80
      const deleted = -normalizeMovementAmount('TRADE_RESULT', -80); // +80

      expect(created + deleted).toBe(0);
    });
  });
});

describe('shouldSkipDeleteReversal', () => {
  it('INITIAL_BALANCE → skip (true)', () => {
    expect(shouldSkipDeleteReversal('INITIAL_BALANCE')).toBe(true);
  });

  it('DEPOSIT → não skip (false)', () => {
    expect(shouldSkipDeleteReversal('DEPOSIT')).toBe(false);
  });

  it('WITHDRAWAL → não skip (false)', () => {
    expect(shouldSkipDeleteReversal('WITHDRAWAL')).toBe(false);
  });

  it('TRADE_RESULT → não skip (false)', () => {
    expect(shouldSkipDeleteReversal('TRADE_RESULT')).toBe(false);
  });

  it('ADJUSTMENT → não skip (false)', () => {
    expect(shouldSkipDeleteReversal('ADJUSTMENT')).toBe(false);
  });
});
