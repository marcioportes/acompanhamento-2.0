/**
 * currency.test.js
 * @version 1.0.0 (v1.15.0)
 * @description Testes unitários para src/utils/currency.js
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrencyDynamic,
  formatCurrencyCompact,
  getCurrencySymbol,
  resolveCurrency,
  isSameCurrency,
  groupByCurrency,
  aggregateBalancesByCurrency,
  getPlanCurrency,
} from '../../utils/currency';

// ===== resolveCurrency =====

describe('resolveCurrency', () => {
  it('retorna BRL para null/undefined/vazio', () => {
    expect(resolveCurrency(null)).toBe('BRL');
    expect(resolveCurrency(undefined)).toBe('BRL');
    expect(resolveCurrency('')).toBe('BRL');
  });

  it('retorna código uppercase para moedas conhecidas', () => {
    expect(resolveCurrency('usd')).toBe('USD');
    expect(resolveCurrency('Eur')).toBe('EUR');
    expect(resolveCurrency('BRL')).toBe('BRL');
    expect(resolveCurrency('gbp')).toBe('GBP');
    expect(resolveCurrency('ars')).toBe('ARS');
  });

  it('retorna BRL para moedas desconhecidas', () => {
    expect(resolveCurrency('XYZ')).toBe('BRL');
    expect(resolveCurrency('BITCOIN')).toBe('BRL');
  });

  it('retorna BRL para tipos não-string', () => {
    expect(resolveCurrency(123)).toBe('BRL');
    expect(resolveCurrency({})).toBe('BRL');
    expect(resolveCurrency([])).toBe('BRL');
  });
});

// ===== formatCurrencyDynamic =====

describe('formatCurrencyDynamic', () => {
  it('formata BRL corretamente', () => {
    const result = formatCurrencyDynamic(1234.56, 'BRL');
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });

  it('formata USD corretamente (DEC-004: locale pt-BR)', () => {
    const result = formatCurrencyDynamic(1234.56, 'USD');
    // DEC-004: todas as moedas usam locale pt-BR (ponto milhar, vírgula decimal)
    expect(result).toContain('1.234,56');
    expect(result).toContain('US$');
  });

  it('formata EUR corretamente', () => {
    const result = formatCurrencyDynamic(1234.56, 'EUR');
    // EUR usa separador de milhar ponto e decimal vírgula no locale alemão
    expect(result).toContain('€');
  });

  it('usa BRL como default quando sem parâmetro', () => {
    const result = formatCurrencyDynamic(100);
    expect(result).toContain('R$');
  });

  it('trata null/undefined/0 como zero', () => {
    expect(formatCurrencyDynamic(null, 'BRL')).toContain('0,00');
    // DEC-004: USD também usa locale pt-BR → vírgula decimal
    expect(formatCurrencyDynamic(undefined, 'USD')).toContain('0,00');
    expect(formatCurrencyDynamic(0, 'BRL')).toContain('0,00');
  });

  it('formata valores negativos', () => {
    const result = formatCurrencyDynamic(-500.25, 'BRL');
    expect(result).toContain('500,25');
    // Intl pode usar sinal negativo ou parênteses dependendo do locale
  });

  it('usa BRL para moeda desconhecida', () => {
    const result = formatCurrencyDynamic(100, 'XYZ');
    expect(result).toContain('R$');
  });
});

// ===== formatCurrencyCompact =====

describe('formatCurrencyCompact', () => {
  it('formata valores grandes de forma compacta', () => {
    const result = formatCurrencyCompact(25000, 'BRL');
    // Deve conter "mil" ou ser compacto
    expect(result).toContain('R$');
    expect(result.length).toBeLessThan(formatCurrencyDynamic(25000, 'BRL').length);
  });

  it('formata USD compacto', () => {
    const result = formatCurrencyCompact(25000, 'USD');
    expect(result).toContain('$');
  });

  it('trata zero corretamente', () => {
    const result = formatCurrencyCompact(0, 'BRL');
    expect(result).toContain('R$');
  });
});

// ===== getCurrencySymbol =====

describe('getCurrencySymbol', () => {
  it('retorna símbolo correto para moedas conhecidas', () => {
    expect(getCurrencySymbol('BRL')).toBe('R$');
    // DEC-004: símbolo USD alterado de '$' para 'US$' para clareza no contexto BR
    expect(getCurrencySymbol('USD')).toBe('US$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('retorna R$ para moeda desconhecida ou null', () => {
    expect(getCurrencySymbol('XYZ')).toBe('R$');
    expect(getCurrencySymbol(null)).toBe('R$');
    expect(getCurrencySymbol(undefined)).toBe('R$');
  });
});

// ===== isSameCurrency =====

describe('isSameCurrency', () => {
  it('retorna true para array vazio', () => {
    expect(isSameCurrency([])).toBe(true);
  });

  it('retorna true para conta única', () => {
    expect(isSameCurrency([{ currency: 'BRL' }])).toBe(true);
  });

  it('retorna true quando todas as contas têm mesma moeda', () => {
    expect(isSameCurrency([
      { currency: 'USD' },
      { currency: 'USD' },
      { currency: 'USD' },
    ])).toBe(true);
  });

  it('retorna false quando há moedas mistas', () => {
    expect(isSameCurrency([
      { currency: 'BRL' },
      { currency: 'USD' },
    ])).toBe(false);
  });

  it('trata contas sem currency como BRL (mesmo grupo)', () => {
    expect(isSameCurrency([
      { currency: 'BRL' },
      { currency: null },
      { currency: undefined },
      {},
    ])).toBe(true);
  });

  it('retorna false quando uma conta tem moeda diferente e outras sem currency', () => {
    expect(isSameCurrency([
      { currency: 'USD' },
      {},
    ])).toBe(false);
  });

  it('retorna true para input não-array', () => {
    expect(isSameCurrency(null)).toBe(true);
    expect(isSameCurrency(undefined)).toBe(true);
  });
});

// ===== groupByCurrency =====

describe('groupByCurrency', () => {
  it('retorna Map vazio para input inválido', () => {
    expect(groupByCurrency(null).size).toBe(0);
    expect(groupByCurrency(undefined).size).toBe(0);
    expect(groupByCurrency([]).size).toBe(0);
  });

  it('agrupa corretamente por moeda', () => {
    const accounts = [
      { id: '1', currency: 'BRL' },
      { id: '2', currency: 'USD' },
      { id: '3', currency: 'BRL' },
      { id: '4', currency: 'USD' },
      { id: '5', currency: 'EUR' },
    ];
    const groups = groupByCurrency(accounts);
    expect(groups.size).toBe(3);
    expect(groups.get('BRL').length).toBe(2);
    expect(groups.get('USD').length).toBe(2);
    expect(groups.get('EUR').length).toBe(1);
  });

  it('agrupa contas sem currency no grupo BRL', () => {
    const accounts = [
      { id: '1' },
      { id: '2', currency: null },
      { id: '3', currency: 'USD' },
    ];
    const groups = groupByCurrency(accounts);
    expect(groups.get('BRL').length).toBe(2);
    expect(groups.get('USD').length).toBe(1);
  });
});

// ===== aggregateBalancesByCurrency =====

describe('aggregateBalancesByCurrency', () => {
  it('retorna Map vazio para input inválido', () => {
    expect(aggregateBalancesByCurrency(null).size).toBe(0);
    expect(aggregateBalancesByCurrency([]).size).toBe(0);
  });

  it('agrega saldos de mesma moeda corretamente', () => {
    const accounts = [
      { currency: 'BRL', initialBalance: 10000, currentBalance: 11000 },
      { currency: 'BRL', initialBalance: 5000, currentBalance: 4500 },
    ];
    const result = aggregateBalancesByCurrency(accounts);
    expect(result.size).toBe(1);
    const brl = result.get('BRL');
    expect(brl.initial).toBe(15000);
    expect(brl.current).toBe(15500);
    expect(brl.pnl).toBe(500);
    expect(brl.count).toBe(2);
  });

  it('não soma cross-currency', () => {
    const accounts = [
      { currency: 'BRL', initialBalance: 10000, currentBalance: 11000 },
      { currency: 'USD', initialBalance: 25000, currentBalance: 24989.5 },
    ];
    const result = aggregateBalancesByCurrency(accounts);
    expect(result.size).toBe(2);
    expect(result.get('BRL').current).toBe(11000);
    expect(result.get('USD').current).toBe(24989.5);
  });

  it('trata currentBalance === 0 corretamente (não cai para initialBalance)', () => {
    const accounts = [
      { currency: 'BRL', initialBalance: 10000, currentBalance: 0 },
    ];
    const result = aggregateBalancesByCurrency(accounts);
    const brl = result.get('BRL');
    // CRITICAL: currentBalance = 0 deve ser zero, não fallback para 10000
    expect(brl.current).toBe(0);
    expect(brl.pnl).toBe(-10000);
  });

  it('usa initialBalance como fallback quando currentBalance ausente', () => {
    const accounts = [
      { currency: 'USD', initialBalance: 5000 },
    ];
    const result = aggregateBalancesByCurrency(accounts);
    expect(result.get('USD').current).toBe(5000);
    expect(result.get('USD').pnl).toBe(0);
  });

  it('trata conta sem currency como BRL', () => {
    const accounts = [
      { initialBalance: 1000, currentBalance: 1100 },
    ];
    const result = aggregateBalancesByCurrency(accounts);
    expect(result.has('BRL')).toBe(true);
    expect(result.get('BRL').current).toBe(1100);
  });
});

// ===== getPlanCurrency =====

describe('getPlanCurrency', () => {
  const accounts = [
    { id: 'acc1', currency: 'USD' },
    { id: 'acc2', currency: 'BRL' },
    { id: 'acc3' }, // sem currency
  ];

  it('retorna moeda da conta-pai do plano', () => {
    expect(getPlanCurrency({ accountId: 'acc1' }, accounts)).toBe('USD');
    expect(getPlanCurrency({ accountId: 'acc2' }, accounts)).toBe('BRL');
  });

  it('retorna BRL para conta sem currency', () => {
    expect(getPlanCurrency({ accountId: 'acc3' }, accounts)).toBe('BRL');
  });

  it('retorna BRL quando conta não encontrada', () => {
    expect(getPlanCurrency({ accountId: 'inexistente' }, accounts)).toBe('BRL');
  });

  it('retorna BRL para input inválido', () => {
    expect(getPlanCurrency(null, accounts)).toBe('BRL');
    expect(getPlanCurrency({ accountId: 'acc1' }, null)).toBe('BRL');
    expect(getPlanCurrency(null, null)).toBe('BRL');
  });
});
