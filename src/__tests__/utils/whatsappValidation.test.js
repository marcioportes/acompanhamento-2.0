/**
 * Tests: WhatsApp number validation — issue #123
 * @description Testa validação, auto-prefixo +55 e formatação de exibição
 */

import { describe, it, expect } from 'vitest';
import { validateWhatsappNumber, formatWhatsappDisplay } from '../../utils/whatsappValidation';

// ─��� Tests ────────────────────────��──────────────────────

describe('validateWhatsappNumber', () => {
  describe('valores vazios (campo opcional)', () => {
    it('aceita string vazia', () => {
      const result = validateWhatsappNumber('');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('');
      expect(result.formatted).toBe('');
    });

    it('aceita null', () => {
      expect(validateWhatsappNumber(null).valid).toBe(true);
    });

    it('aceita undefined', () => {
      expect(validateWhatsappNumber(undefined).valid).toBe(true);
    });
  });

  describe('auto-prefixo +55 (Brasil default)', () => {
    it('adiciona +55 a número BR com 11 dígitos (DDD + celular 9 dígitos)', () => {
      const result = validateWhatsappNumber('11999887766');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+5511999887766');
    });

    it('adiciona +55 a número BR com 10 dígitos (DDD + fixo 8 dígitos)', () => {
      const result = validateWhatsappNumber('1132456789');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+551132456789');
    });

    it('adiciona +55 a número com formatação BR', () => {
      const result = validateWhatsappNumber('(11) 99988-7766');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+5511999887766');
    });

    it('assume código de país se 12+ dígitos sem +', () => {
      const result = validateWhatsappNumber('5511999887766');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+5511999887766');
    });

    it('mantém +XX se usuário já digitou código de país', () => {
      const result = validateWhatsappNumber('+5511999887766');
      expect(result.sanitized).toBe('+5511999887766');
    });

    it('mantém código de país não-BR', () => {
      const result = validateWhatsappNumber('+14155552671');
      expect(result.sanitized).toBe('+14155552671');
    });
  });

  describe('formatação de exibição', () => {
    it('retorna formatted junto com sanitized', () => {
      const result = validateWhatsappNumber('11999887766');
      expect(result.formatted).toBe('+55 (11) 99988-7766');
    });

    it('formata +55 com DDD e celular', () => {
      const result = validateWhatsappNumber('+5511999887766');
      expect(result.formatted).toBe('+55 (11) 99988-7766');
    });

    it('formata +55 com DDD e fixo', () => {
      const result = validateWhatsappNumber('+551132456789');
      expect(result.formatted).toBe('+55 (11) 3245-6789');
    });
  });

  describe('números válidos com +', () => {
    it('aceita número com espaços e hifens', () => {
      const result = validateWhatsappNumber('+55 11 99988-7766');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+5511999887766');
    });

    it('aceita número com parênteses', () => {
      const result = validateWhatsappNumber('+55 (11) 99988-7766');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+5511999887766');
    });
  });

  describe('números inválidos', () => {
    it('rejeita tipo não-string', () => {
      expect(validateWhatsappNumber(123)).toEqual({ valid: false, error: 'Deve ser texto' });
    });

    it('rejeita letras', () => {
      expect(validateWhatsappNumber('abc123')).toEqual({ valid: false, error: 'Apenas dígitos e + no início' });
    });

    it('rejeita + no meio', () => {
      expect(validateWhatsappNumber('55+11999')).toEqual({ valid: false, error: 'Apenas dígitos e + no início' });
    });

    it('rejeita menos de 10 dígitos sem +', () => {
      const result = validateWhatsappNumber('999887766');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10 dígitos');
    });

    it('rejeita menos de 10 dígitos com +', () => {
      const result = validateWhatsappNumber('+123456789');
      expect(result.valid).toBe(false);
    });

    it('rejeita mais de 15 dígitos', () => {
      const result = validateWhatsappNumber('+1234567890123456');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15 dígitos');
    });
  });
});

describe('formatWhatsappDisplay', () => {
  it('formata BR celular: +55 (11) 99988-7766', () => {
    expect(formatWhatsappDisplay('+5511999887766')).toBe('+55 (11) 99988-7766');
  });

  it('formata BR fixo: +55 (11) 3245-6789', () => {
    expect(formatWhatsappDisplay('+551132456789')).toBe('+55 (11) 3245-6789');
  });

  it('formata internacional genérico em blocos', () => {
    const result = formatWhatsappDisplay('+14155552671');
    expect(result).toMatch(/^\+/);
    expect(result.length).toBeGreaterThan(11);
  });

  it('retorna string vazia para null', () => {
    expect(formatWhatsappDisplay(null)).toBe('');
  });

  it('retorna input inalterado se não começa com +', () => {
    expect(formatWhatsappDisplay('11999887766')).toBe('11999887766');
  });
});
