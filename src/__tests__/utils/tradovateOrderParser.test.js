/**
 * tradovateOrderParser.test.js — testes do parser Tradovate Orders (issue #142 Fase B).
 *
 * Cobre: shape canônico, detecção automática, mapas status/side/type,
 * datas US (MM/DD/YYYY HH:MM:SS), números US com thousands, orders canceladas
 * sem fill, integração com fixtures reais (April + Feb 2026).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseTradovateOrders,
  detectOrderFormat,
} from '../../utils/orderParsers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/tradovate-orders');
const aprilCSV = readFileSync(resolve(fixturesDir, 'april.csv'), 'utf-8');
const febCSV = readFileSync(resolve(fixturesDir, 'feb.csv'), 'utf-8');

// ── Detecção ────────────────────────────────────────────────

describe('detectOrderFormat — Tradovate', () => {
  const TRADOVATE_HEADERS = [
    'orderId', 'Account', 'Order ID', 'B/S', 'Contract', 'Product', 'Product Description',
    'avgPrice', 'filledQty', 'Fill Time', 'lastCommandId', 'Status', '_priceFormat',
    '_priceFormatType', '_tickSize', 'spreadDefinitionId', 'Version ID', 'Timestamp',
    'Date', 'Quantity', 'Text', 'Type', 'Limit Price', 'Stop Price', 'decimalLimit',
    'decimalStop', 'Filled Qty', 'Avg Fill Price', 'decimalFillAvg', 'Venue',
    'Notional Value', 'Currency',
  ];

  it('detecta formato tradovate por headers reais', () => {
    const result = detectOrderFormat(TRADOVATE_HEADERS);
    expect(result.format).toBe('tradovate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.parser).toBeTypeOf('function');
  });

  it('não confunde Tradovate com ProfitChart-Pro', () => {
    const profitchartHeaders = ['Corretora', 'Conta', 'Ativo', 'Lado', 'Status', 'Criação'];
    const result = detectOrderFormat(profitchartHeaders);
    expect(result.format).not.toBe('tradovate');
  });
});

// ── Parse Tradovate — fixture April ─────────────────────────

describe('parseTradovateOrders — fixture April', () => {
  const result = parseTradovateOrders(aprilCSV);

  it('retorna shape canônico', () => {
    expect(result).toHaveProperty('orders');
    expect(result).toHaveProperty('meta');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('lowResolution');
    expect(Array.isArray(result.orders)).toBe(true);
  });

  it('extrai todas as linhas de dados', () => {
    expect(result.orders.length).toBeGreaterThanOrEqual(30);
  });

  it('meta inclui conta Apex detectada', () => {
    expect(result.meta.corretora).toBe('Tradovate');
    expect(result.meta.conta).toBe('PAAPEX2604610000005');
    expect(result.meta.totalOrders).toBe(result.orders.length);
  });

  it('primeira ordem (Filled Buy Market) tem campos canônicos corretos', () => {
    const first = result.orders[0];
    expect(first.externalOrderId).toBe('376069090383');
    expect(first.account).toBe('PAAPEX2604610000005');
    expect(first.instrument).toBe('MNQM6');
    expect(first.side).toBe('BUY');
    expect(first.status).toBe('FILLED');
    expect(first.orderType).toBe('MARKET');
    expect(first.filledQuantity).toBe(1);
    expect(first.avgFillPrice).toBe(23931);
    expect(first.totalValue).toBe(47862);
  });

  it('converte datas US MM/DD/YYYY HH:MM:SS para ISO', () => {
    const first = result.orders[0];
    expect(first.submittedAt).toMatch(/^2026-04-02T/);
    expect(first.filledAt).toMatch(/^2026-04-02T11:06:37/);
  });

  it('ordem Canceled (Limit) não tem fill mas tem cancel event', () => {
    const canceled = result.orders.find((o) => o.status === 'CANCELLED');
    expect(canceled).toBeDefined();
    expect(canceled.filledQuantity).toBeNull();
    expect(canceled.avgFillPrice).toBeNull();
    expect(canceled.events.length).toBeGreaterThan(0);
    expect(canceled.events[0].type).toBe('CANCEL_EVENT');
  });

  it('ordem Filled gera TRADE_EVENT em events[]', () => {
    const filled = result.orders.find((o) => o.status === 'FILLED');
    expect(filled.events[0]).toMatchObject({
      type: 'TRADE_EVENT',
    });
    expect(filled.events[0].timestamp).toBeTruthy();
    expect(filled.events[0].price).toBeGreaterThan(0);
  });

  it('stop orders são marcadas isStopOrder=true', () => {
    const stopOrder = result.orders.find((o) => o.orderType === 'STOP');
    expect(stopOrder).toBeDefined();
    expect(stopOrder.isStopOrder).toBe(true);
    expect(stopOrder.stopPrice).toBeGreaterThan(0);
  });

  it('números US com thousands são parseados corretamente (ex: "47,862.00")', () => {
    const withThousands = result.orders.find((o) => o.totalValue && o.totalValue > 1000);
    expect(withThousands).toBeDefined();
    expect(withThousands.totalValue).toBeGreaterThan(1000);
    expect(Number.isFinite(withThousands.totalValue)).toBe(true);
  });
});

// ── Parse Tradovate — fixture Feb ───────────────────────────

describe('parseTradovateOrders — fixture Feb', () => {
  const result = parseTradovateOrders(febCSV);

  it('parseia fixture Feb sem crash', () => {
    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.meta.corretora).toBe('Tradovate');
  });

  it('todas as ordens têm instrument válido', () => {
    for (const order of result.orders) {
      expect(order.instrument).toBeTruthy();
      expect(order.instrument).toMatch(/^[A-Z0-9]+$/);
    }
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe('parseTradovateOrders — edge cases', () => {
  it('CSV vazio retorna erro', () => {
    const result = parseTradovateOrders('');
    expect(result.orders).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('só header (sem dados) retorna erro', () => {
    const result = parseTradovateOrders('orderId,Account,B/S,Contract\n');
    expect(result.orders).toHaveLength(0);
  });

  it('ignora linha sem contract', () => {
    const header = 'orderId,Account,B/S,Contract,Status,Type,Timestamp,Quantity';
    const goodRow = '1,ACC,Buy,MNQM6,Filled,Market,04/02/2026 11:06:37,1';
    const badRow = '2,ACC,Buy,,Filled,Market,04/02/2026 11:06:37,1';
    const result = parseTradovateOrders(`${header}\n${goodRow}\n${badRow}\n`);
    expect(result.orders).toHaveLength(1);
    expect(result.errors.some((e) => e.message.includes('ignorada'))).toBe(true);
  });

  it('normaliza leading space em B/S, Status, Type', () => {
    const header = 'orderId,Account,B/S,Contract,Status,Type,Timestamp,Quantity';
    const row = '1,ACC, Sell ,MNQM6, Filled , Limit ,04/02/2026 11:06:37,1';
    const result = parseTradovateOrders(`${header}\n${row}\n`);
    expect(result.orders[0].side).toBe('SELL');
    expect(result.orders[0].status).toBe('FILLED');
    expect(result.orders[0].orderType).toBe('LIMIT');
  });
});
