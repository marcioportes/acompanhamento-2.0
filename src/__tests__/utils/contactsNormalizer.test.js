/**
 * contactsNormalizer.test.js — issue #237 F1
 *
 * Cobre os 3 normalizadores + helper de bloco. Foco em:
 * - Casos reais da planilha base (Mentoria_Ativa_2404.xlsx)
 * - Edge cases (null, vazio, trailing space, diacrítico, multi-espaço)
 * - DDI por prefixo (BR 12/13, US 11)
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  normalizePhone,
  normalizeEmail,
  normalizeContactInput,
} from '../../utils/contactsNormalizer';

describe('normalizeName', () => {
  it('remove diacríticos', () => {
    expect(normalizeName('Cecília')).toBe('cecilia');
    expect(normalizeName('João Paulo Silva')).toBe('joao paulo silva');
    expect(normalizeName('Maurício Martins')).toBe('mauricio martins');
  });

  it('lower + trim + colapsa espaços', () => {
    expect(normalizeName('Felipe Guida ')).toBe('felipe guida');
    expect(normalizeName('  Carlos  Y.   Mentoria  ')).toBe('carlos y. mentoria');
    expect(normalizeName('JL')).toBe('jl');
  });

  it('null/empty/whitespace → null', () => {
    expect(normalizeName(null)).toBeNull();
    expect(normalizeName(undefined)).toBeNull();
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('   ')).toBeNull();
  });

  it('aceita single-name e iniciais sem rejeitar', () => {
    expect(normalizeName('Lucas')).toBe('lucas');
    expect(normalizeName('JL')).toBe('jl');
    expect(normalizeName('Luiz S S')).toBe('luiz s s');
  });
});

describe('normalizePhone', () => {
  it('BR 13 dígitos (DDI 55 + DDD + celular 9)', () => {
    expect(normalizePhone('5521997118900')).toEqual({
      e164: '+5521997118900',
      countryCode: 'BR',
    });
    expect(normalizePhone('5511991377588')).toEqual({
      e164: '+5511991377588',
      countryCode: 'BR',
    });
  });

  it('BR 12 dígitos (DDI 55 + DDD + 8)', () => {
    expect(normalizePhone('553599880221')).toEqual({
      e164: '+553599880221',
      countryCode: 'BR',
    });
  });

  it('US 11 dígitos (DDI 1 + 10)', () => {
    expect(normalizePhone('17542446143')).toEqual({
      e164: '+17542446143',
      countryCode: 'US',
    });
  });

  it('strip de separadores antes de detectar DDI', () => {
    expect(normalizePhone('+55 (21) 99711-8900')).toEqual({
      e164: '+5521997118900',
      countryCode: 'BR',
    });
  });

  it('sem DDI conhecido → countryCode UNKNOWN (preserva dígitos crus)', () => {
    expect(normalizePhone('(21) 99711-8900')).toEqual({
      e164: '+21997118900',
      countryCode: 'UNKNOWN',
    });
  });

  it('null/empty → null', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull(); // só letras = 0 dígitos
  });
});

describe('normalizeEmail', () => {
  it('lower + trim', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normalizeEmail('UPPER@DOMAIN.IO')).toBe('upper@domain.io');
  });

  it('null/empty → null', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
  });
});

describe('normalizeContactInput (helper de bloco)', () => {
  it('normaliza payload completo da planilha', () => {
    const out = normalizeContactInput({
      nome: 'Bruno Albuquerque',
      celular: '5521997118900',
      email: null,
    });
    expect(out).toEqual({
      nome: 'Bruno Albuquerque',
      nameNormalized: 'bruno albuquerque',
      celular: '+5521997118900',
      countryCode: 'BR',
      email: null,
    });
  });

  it('handle email presente (caso UI pós-bootstrap)', () => {
    const out = normalizeContactInput({
      nome: 'Cecília',
      celular: '553599880221',
      email: '  Cecilia@Test.COM ',
    });
    expect(out).toEqual({
      nome: 'Cecília',
      nameNormalized: 'cecilia',
      celular: '+553599880221',
      countryCode: 'BR',
      email: 'cecilia@test.com',
    });
  });

  it('input vazio → tudo null', () => {
    expect(normalizeContactInput({})).toEqual({
      nome: null,
      nameNormalized: null,
      celular: null,
      countryCode: null,
      email: null,
    });
  });

  it('preserva nome cru (com diacrítico) + nameNormalized separado', () => {
    const out = normalizeContactInput({
      nome: '  João Paulo Silva  ',
      celular: '5511972024319',
    });
    expect(out.nome).toBe('João Paulo Silva');
    expect(out.nameNormalized).toBe('joao paulo silva');
  });
});
