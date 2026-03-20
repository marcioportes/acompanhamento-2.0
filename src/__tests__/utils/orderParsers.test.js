/**
 * orderParsers.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes para parsers de ordens — Tradovate + genérico + helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  parseTradovate,
  parseGeneric,
  parseNumeric,
  normalizeSide,
  normalizeOrderType,
  normalizeOrderStatus,
  parseTimestamp,
  TRADOVATE_HEADER_MAP,
} from '../../utils/orderParsers';

// ============================================
// parseNumeric
// ============================================
describe('parseNumeric', () => {
  it('parse inteiro', () => {
    expect(parseNumeric('100')).toBe(100);
  });

  it('parse decimal US', () => {
    expect(parseNumeric('1,234.56')).toBe(1234.56);
  });

  it('parse decimal BR', () => {
    expect(parseNumeric('1.234,56')).toBe(1234.56);
  });

  it('parse negativo com parênteses', () => {
    expect(parseNumeric('(93.00)')).toBe(-93);
  });

  it('parse com símbolo de moeda', () => {
    expect(parseNumeric('$1234.50')).toBe(1234.50);
    expect(parseNumeric('R$ 1.234,50')).toBe(1234.50);
  });

  it('retorna null para vazio/null/undefined', () => {
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric(undefined)).toBeNull();
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('   ')).toBeNull();
  });

  it('retorna null para texto não numérico', () => {
    expect(parseNumeric('abc')).toBeNull();
  });

  it('número direto já numérico', () => {
    expect(parseNumeric(42.5)).toBe(42.5);
    expect(parseNumeric(0)).toBe(0);
  });

  it('NaN retorna null', () => {
    expect(parseNumeric(NaN)).toBeNull();
  });
});

// ============================================
// normalizeSide
// ============================================
describe('normalizeSide', () => {
  it('normaliza BUY variants', () => {
    expect(normalizeSide('Buy')).toBe('BUY');
    expect(normalizeSide('B')).toBe('BUY');
    expect(normalizeSide('LONG')).toBe('BUY');
    expect(normalizeSide('C')).toBe('BUY');
    expect(normalizeSide('Compra')).toBe('BUY');
  });

  it('normaliza SELL variants', () => {
    expect(normalizeSide('Sell')).toBe('SELL');
    expect(normalizeSide('S')).toBe('SELL');
    expect(normalizeSide('SHORT')).toBe('SELL');
    expect(normalizeSide('V')).toBe('SELL');
    expect(normalizeSide('Venda')).toBe('SELL');
  });

  it('retorna null para inválido', () => {
    expect(normalizeSide(null)).toBeNull();
    expect(normalizeSide('')).toBeNull();
    expect(normalizeSide('X')).toBeNull();
  });
});

// ============================================
// normalizeOrderType
// ============================================
describe('normalizeOrderType', () => {
  it('normaliza MARKET variants', () => {
    expect(normalizeOrderType('Market')).toBe('MARKET');
    expect(normalizeOrderType('MKT')).toBe('MARKET');
    expect(normalizeOrderType('Mercado')).toBe('MARKET');
  });

  it('normaliza LIMIT variants', () => {
    expect(normalizeOrderType('Limit')).toBe('LIMIT');
    expect(normalizeOrderType('LMT')).toBe('LIMIT');
  });

  it('normaliza STOP variants', () => {
    expect(normalizeOrderType('Stop')).toBe('STOP');
    expect(normalizeOrderType('STP')).toBe('STOP');
  });

  it('normaliza STOP_LIMIT', () => {
    expect(normalizeOrderType('Stop Limit')).toBe('STOP_LIMIT');
    expect(normalizeOrderType('StpLmt')).toBe('STOP_LIMIT');
    expect(normalizeOrderType('STPLIMIT')).toBe('STOP_LIMIT');
  });

  it('retorna null para inválido', () => {
    expect(normalizeOrderType(null)).toBeNull();
    expect(normalizeOrderType('XYZ')).toBeNull();
  });
});

// ============================================
// normalizeOrderStatus
// ============================================
describe('normalizeOrderStatus', () => {
  it('normaliza FILLED variants', () => {
    expect(normalizeOrderStatus('Filled')).toBe('FILLED');
    expect(normalizeOrderStatus('Complete')).toBe('FILLED');
    expect(normalizeOrderStatus('Completed')).toBe('FILLED');
  });

  it('normaliza CANCELLED variants', () => {
    expect(normalizeOrderStatus('Cancelled')).toBe('CANCELLED');
    expect(normalizeOrderStatus('Canceled')).toBe('CANCELLED');
  });

  it('normaliza SUBMITTED variants', () => {
    expect(normalizeOrderStatus('Submitted')).toBe('SUBMITTED');
    expect(normalizeOrderStatus('New')).toBe('SUBMITTED');
    expect(normalizeOrderStatus('Working')).toBe('SUBMITTED');
    expect(normalizeOrderStatus('Pending')).toBe('SUBMITTED');
  });

  it('normaliza PARTIALLY_FILLED', () => {
    expect(normalizeOrderStatus('Partially Filled')).toBe('PARTIALLY_FILLED');
    expect(normalizeOrderStatus('Partial')).toBe('PARTIALLY_FILLED');
  });

  it('normaliza MODIFIED', () => {
    expect(normalizeOrderStatus('Modified')).toBe('MODIFIED');
    expect(normalizeOrderStatus('Replaced')).toBe('MODIFIED');
  });

  it('retorna null para inválido', () => {
    expect(normalizeOrderStatus(null)).toBeNull();
    expect(normalizeOrderStatus('UNKNOWN')).toBeNull();
  });
});

// ============================================
// parseTimestamp
// ============================================
describe('parseTimestamp', () => {
  it('parse ISO format', () => {
    const result = parseTimestamp('2026-03-15T10:30:00');
    expect(result).toBeTruthy();
    expect(new Date(result).getFullYear()).toBe(2026);
  });

  it('parse US format MM/DD/YYYY HH:mm', () => {
    const result = parseTimestamp('03/15/2026 10:30');
    expect(result).toBeTruthy();
  });

  it('parse US format with seconds', () => {
    const result = parseTimestamp('03/15/2026 10:30:45');
    expect(result).toBeTruthy();
  });

  it('retorna null para vazio/null', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('   ')).toBeNull();
  });

  it('retorna null para texto não parseável', () => {
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

// ============================================
// detectFormat
// ============================================
describe('detectFormat', () => {
  it('detecta formato Tradovate por headers', () => {
    const headers = ['Order ID', 'Account', 'Contract', 'B/S', 'Qty', 'Order Type', 'Status', 'Date/Time'];
    const result = detectFormat(headers);
    expect(result.format).toBe('tradovate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('detecta genérico quando headers não batem', () => {
    const headers = ['Coluna1', 'Coluna2', 'Coluna3'];
    const result = detectFormat(headers);
    expect(result.format).toBe('generic');
  });

  it('retorna genérico para headers vazios', () => {
    expect(detectFormat([]).format).toBe('generic');
    expect(detectFormat(null).format).toBe('generic');
  });

  it('detecta Tradovate com variações de nomes', () => {
    const headers = ['OrderId', 'Symbol', 'Side', 'Quantity', 'Type', 'State', 'DateTime'];
    const result = detectFormat(headers);
    expect(result.format).toBe('tradovate');
  });
});

// ============================================
// parseTradovate
// ============================================
describe('parseTradovate', () => {
  const headers = ['Order ID', 'Account', 'Contract', 'B/S', 'Qty', 'Order Type', 'Limit Price', 'Stop Price', 'Fill Price', 'Status', 'Date/Time', 'Fill Date/Time'];

  const makeRow = (overrides = {}) => ({
    'Order ID': '12345',
    'Account': 'DEMO001',
    'Contract': 'ESH6',
    'B/S': 'Buy',
    'Qty': '1',
    'Order Type': 'Market',
    'Limit Price': '',
    'Stop Price': '',
    'Fill Price': '5100.50',
    'Status': 'Filled',
    'Date/Time': '03/15/2026 10:30:00',
    'Fill Date/Time': '03/15/2026 10:30:01',
    ...overrides,
  });

  it('parse ordem básica Tradovate', () => {
    const { orders, errors } = parseTradovate([makeRow()], headers);
    expect(errors).toHaveLength(0);
    expect(orders).toHaveLength(1);
    expect(orders[0].externalOrderId).toBe('12345');
    expect(orders[0].instrument).toBe('ESH6');
    expect(orders[0].side).toBe('BUY');
    expect(orders[0].quantity).toBe(1);
    expect(orders[0].orderType).toBe('MARKET');
    expect(orders[0].filledPrice).toBe(5100.50);
    expect(orders[0].status).toBe('FILLED');
    expect(orders[0].isStopOrder).toBe(false);
  });

  it('identifica stop order', () => {
    const { orders } = parseTradovate([makeRow({ 'Order Type': 'Stop', 'Stop Price': '5050.00' })], headers);
    expect(orders[0].isStopOrder).toBe(true);
    expect(orders[0].orderType).toBe('STOP');
    expect(orders[0].stopPrice).toBe(5050);
  });

  it('identifica stop order por stopPrice mesmo sem orderType STOP', () => {
    const { orders } = parseTradovate([makeRow({ 'Order Type': 'Limit', 'Stop Price': '5050.00' })], headers);
    expect(orders[0].isStopOrder).toBe(true);
  });

  it('parse sell order', () => {
    const { orders } = parseTradovate([makeRow({ 'B/S': 'Sell' })], headers);
    expect(orders[0].side).toBe('SELL');
  });

  it('parse cancelled order', () => {
    const { orders } = parseTradovate([makeRow({ 'Status': 'Cancelled', 'Fill Price': '' })], headers);
    expect(orders[0].status).toBe('CANCELLED');
    expect(orders[0].filledPrice).toBeNull();
  });

  it('pula linhas completamente vazias', () => {
    const emptyRow = { 'Order ID': '', 'Account': '', 'Contract': '', 'B/S': '', 'Qty': '', 'Order Type': '', 'Limit Price': '', 'Stop Price': '', 'Fill Price': '', 'Status': '', 'Date/Time': '', 'Fill Date/Time': '' };
    const { orders } = parseTradovate([emptyRow, makeRow()], headers);
    expect(orders).toHaveLength(1);
  });

  it('registra erro para linha sem dados essenciais', () => {
    const badRow = { ...makeRow(), 'B/S': '', 'Order Type': '', 'Status': '' };
    const { orders, errors } = parseTradovate([badRow], headers);
    expect(orders).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('parse múltiplas ordens', () => {
    const rows = [
      makeRow({ 'Order ID': '1' }),
      makeRow({ 'Order ID': '2', 'B/S': 'Sell' }),
      makeRow({ 'Order ID': '3', 'Order Type': 'Stop', 'Stop Price': '5000' }),
    ];
    const { orders } = parseTradovate(rows, headers);
    expect(orders).toHaveLength(3);
  });

  it('parse limit order com preço', () => {
    const { orders } = parseTradovate([makeRow({ 'Order Type': 'Limit', 'Limit Price': '5100.25' })], headers);
    expect(orders[0].orderType).toBe('LIMIT');
    expect(orders[0].limitPrice).toBe(5100.25);
  });
});

// ============================================
// parseGeneric
// ============================================
describe('parseGeneric', () => {
  const mapping = {
    instrument: 'Ativo',
    side: 'Lado',
    quantity: 'Qtd',
    orderType: 'Tipo',
    status: 'Estado',
    submittedAt: 'Data',
    filledPrice: 'Preço Exec',
  };

  const makeRow = (overrides = {}) => ({
    'Ativo': 'WINFUT',
    'Lado': 'C',
    'Qtd': '5',
    'Tipo': 'Mercado',
    'Estado': 'Filled',
    'Data': '15/03/2026 10:30',
    'Preço Exec': '128500',
    ...overrides,
  });

  it('parse com mapeamento genérico', () => {
    const { orders, errors } = parseGeneric([makeRow()], mapping);
    expect(errors).toHaveLength(0);
    expect(orders).toHaveLength(1);
    expect(orders[0].instrument).toBe('WINFUT');
    expect(orders[0].side).toBe('BUY');
    expect(orders[0].quantity).toBe(5);
    expect(orders[0].orderType).toBe('MARKET');
    expect(orders[0].status).toBe('FILLED');
  });

  it('retorna erro sem mapeamento', () => {
    const { orders, errors } = parseGeneric([makeRow()], {});
    expect(orders).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('pula linhas sem side e status', () => {
    const { orders, errors } = parseGeneric([makeRow({ 'Lado': '', 'Estado': '' })], mapping);
    expect(orders).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
