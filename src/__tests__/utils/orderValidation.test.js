/**
 * orderValidation.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes para pipeline de validação de ordens em 3 camadas.
 */

import { describe, it, expect } from 'vitest';
import { validateOrder, validateBatch } from '../../utils/orderValidation';

// ============================================
// FIXTURES
// ============================================

const validOrder = (overrides = {}) => ({
  instrument: 'ESH6',
  side: 'BUY',
  quantity: 1,
  orderType: 'MARKET',
  status: 'FILLED',
  submittedAt: '2026-03-15T10:30:00Z',
  filledAt: '2026-03-15T10:30:01Z',
  filledPrice: 5100.50,
  limitPrice: null,
  stopPrice: null,
  filledQuantity: 1,
  isStopOrder: false,
  ...overrides,
});

// ============================================
// validateOrder — Layer 1 (Structural)
// ============================================
describe('validateOrder — Structural', () => {
  it('ordem válida completa passa', () => {
    const result = validateOrder(validOrder());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('instrumento ausente → erro', () => {
    const result = validateOrder(validOrder({ instrument: null }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Instrumento ausente');
  });

  it('side ausente → erro', () => {
    const result = validateOrder(validOrder({ side: null }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lado (B/S) ausente');
  });

  it('side inválido → erro', () => {
    const result = validateOrder(validOrder({ side: 'X' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Lado inválido'))).toBe(true);
  });

  it('quantidade ausente → erro', () => {
    const result = validateOrder(validOrder({ quantity: null }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Quantidade ausente');
  });

  it('quantidade negativa → erro', () => {
    const result = validateOrder(validOrder({ quantity: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Quantidade inválida'))).toBe(true);
  });

  it('quantidade zero → erro', () => {
    const result = validateOrder(validOrder({ quantity: 0 }));
    expect(result.valid).toBe(false);
  });

  it('status ausente → erro', () => {
    const result = validateOrder(validOrder({ status: null }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Status ausente');
  });

  it('status desconhecido → erro', () => {
    const result = validateOrder(validOrder({ status: 'INVALID' }));
    expect(result.valid).toBe(false);
  });

  it('orderType ausente → warning (não erro)', () => {
    const result = validateOrder(validOrder({ orderType: null }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('Tipo de ordem ausente'))).toBe(true);
  });

  it('timestamp ausente → warning', () => {
    const result = validateOrder(validOrder({ submittedAt: null }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('Timestamp de submissão ausente'))).toBe(true);
  });
});

// ============================================
// validateOrder — Layer 2 (Consistency)
// ============================================
describe('validateOrder — Consistency', () => {
  it('FILLED sem preço → warning', () => {
    const result = validateOrder(validOrder({ filledPrice: null, price: null }));
    expect(result.warnings.some(w => w.includes('sem preço de execução'))).toBe(true);
  });

  it('LIMIT sem limitPrice → warning', () => {
    const result = validateOrder(validOrder({ orderType: 'LIMIT', limitPrice: null }));
    expect(result.warnings.some(w => w.includes('sem preço limite'))).toBe(true);
  });

  it('STOP sem stopPrice → warning', () => {
    const result = validateOrder(validOrder({ orderType: 'STOP', stopPrice: null }));
    expect(result.warnings.some(w => w.includes('sem preço de stop'))).toBe(true);
  });

  it('filledAt antes de submittedAt → warning', () => {
    const result = validateOrder(validOrder({
      submittedAt: '2026-03-15T10:30:00Z',
      filledAt: '2026-03-15T10:29:00Z',
    }));
    expect(result.warnings.some(w => w.includes('anterior ao de submissão'))).toBe(true);
  });

  it('preço negativo → erro', () => {
    const result = validateOrder(validOrder({ filledPrice: -100 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('negativo'))).toBe(true);
  });

  it('filledQuantity > quantity → warning', () => {
    const result = validateOrder(validOrder({ quantity: 1, filledQuantity: 5 }));
    expect(result.warnings.some(w => w.includes('excede quantidade original'))).toBe(true);
  });

  it('CANCELLED sem preço não gera warning de preço', () => {
    const result = validateOrder(validOrder({ status: 'CANCELLED', filledPrice: null, price: null }));
    // Não deve ter warning sobre preço — CANCELLED não precisa de preço
    expect(result.warnings.some(w => w.includes('sem preço de execução'))).toBe(false);
  });
});

// ============================================
// validateBatch — Layer 3 (Business)
// ============================================
describe('validateBatch', () => {
  it('batch vazio retorna stats zerados', () => {
    const result = validateBatch([]);
    expect(result.stats.total).toBe(0);
    expect(result.validOrders).toHaveLength(0);
    expect(result.invalidOrders).toHaveLength(0);
  });

  it('batch com ordens válidas e inválidas separa corretamente', () => {
    const orders = [
      validOrder(),
      validOrder({ instrument: null }), // inválida
      validOrder({ side: 'BUY' }),
    ];
    const result = validateBatch(orders);
    expect(result.stats.total).toBe(3);
    expect(result.stats.valid).toBe(2);
    expect(result.stats.invalid).toBe(1);
  });

  it('warning de ordens com data futura', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const orders = [validOrder({ submittedAt: futureDate })];
    const result = validateBatch(orders);
    expect(result.batchWarnings.some(w => w.includes('data futura'))).toBe(true);
  });

  it('warning de muitos instrumentos', () => {
    const orders = [];
    for (let i = 0; i < 25; i++) {
      orders.push(validOrder({ instrument: `INST${i}` }));
    }
    const result = validateBatch(orders);
    expect(result.batchWarnings.some(w => w.includes('instrumentos diferentes'))).toBe(true);
  });

  it('mantém _validationWarnings em ordens válidas', () => {
    const orders = [validOrder({ orderType: null })]; // gera warning
    const result = validateBatch(orders);
    expect(result.validOrders[0]._validationWarnings.length).toBeGreaterThan(0);
  });
});
