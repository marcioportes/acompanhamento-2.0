/**
 * parser-stop-semantic.test.js
 * @description Issue #242 — regressão integrada: parse → normalize → validate →
 *   reconstruct → associate → enrichStopSemantic em CSV real Clear DayTrade
 *   (`040526-clear-daytrade.csv`). Verifica a tabela do critério de aceite do
 *   issue: 4 trades com `stopSemantic` e `hasRealStopLoss` corretos.
 *
 * Tabela esperada (DEC-AUTO-242-01 — referência = `entryOrders[0].price`):
 *
 *   # | side  | entryRef | ordem c/ Preço Stop          | Preço Stop | esperado
 *   1 | LONG  | 190.500  | saída exec SELL @ 190.365    | 190.515    | STOP_GAIN
 *   2 | LONG  | 190.565  | saída exec SELL @ 189.980    | 190.130    | STOP_LOSS
 *   3 | LONG  | 190.370  | saída exec SELL @ 189.970    | 190.120    | STOP_LOSS
 *   4 | SHORT | 189.645  | alvo cancelado BUY @ 189.960 | 189.810    | STOP_LOSS
 *
 * `hasRealStopLoss`: false para trade #1 (única proteção é STOP_GAIN);
 * true para #2, #3, #4.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parseProfitChartPro } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';
import { validateBatch } from '../../utils/orderValidation';
import {
  reconstructOperations,
  associateNonFilledOrders,
} from '../../utils/orderReconstruction';
import {
  STOP_SEMANTIC,
  enrichOperationsWithStopSemantic,
} from '../../utils/stopSemantic';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../fixtures/040526-clear-daytrade.csv');
const CSV_TEXT = readFileSync(FIXTURE_PATH, 'utf-8');

// ============================================
// Helpers de busca por trade
// ============================================

const closeTo = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

/**
 * Encontra a operação cuja primeira entrada tem `limitPrice` igual ao informado.
 * Aceita o valor "humano" (ex.: 190.500) — o parser converte para inteiro ×1000
 * (BR `190.500,00` → 190500), então comparamos contra `valor * 1000`.
 */
const findOpByEntryLimit = (ops, side, entryLimitHuman) => {
  const target = entryLimitHuman * 1000;
  return ops.find(
    (op) =>
      op.side === side &&
      op.entryOrders?.length > 0 &&
      closeTo(parseFloat(op.entryOrders[0].limitPrice), target)
  );
};

/**
 * Procura a primeira ordem (em qualquer bucket) com `stopPrice` igual ao
 * informado. Aceita valor "humano" (ex.: 190.515) — comparamos contra ×1000.
 */
const findOrderWithStop = (op, stopPriceHuman) => {
  const target = stopPriceHuman * 1000;
  const buckets = [op.entryOrders, op.exitOrders, op.stopOrders, op.cancelledOrders];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    const found = bucket.find(
      (o) => o.stopPrice != null && closeTo(parseFloat(o.stopPrice), target)
    );
    if (found) return found;
  }
  return null;
};

// ============================================
// Pipeline completo
// ============================================

const runPipeline = () => {
  const parsed = parseProfitChartPro(CSV_TEXT);
  const { orders: normalized } = normalizeBatch(parsed.orders);
  const validation = validateBatch(normalized);
  const ops = reconstructOperations(validation.validOrders);
  associateNonFilledOrders(ops, validation.validOrders);
  enrichOperationsWithStopSemantic(ops);
  return { parsed, validation, ops };
};

describe('parser-stop-semantic — fixture 040526-clear-daytrade.csv', () => {
  const { parsed, validation, ops } = runPipeline();

  it('parse + validate produz ordens utilizáveis (sanity check)', () => {
    expect(parsed.orders.length).toBeGreaterThan(0);
    expect(validation.validOrders.length).toBeGreaterThan(0);
    // Erros de parse só de master truncado são aceitáveis; integridade é sobre validOrders.
    expect(ops.length).toBeGreaterThanOrEqual(4);
  });

  // ---------- Trade #1 — LONG entry 190.500, stop @ 190.515 → STOP_GAIN
  it('trade #1 (LONG entry 190.500): exit com Preço Stop 190.515 → STOP_GAIN', () => {
    const op = findOpByEntryLimit(ops, 'LONG', 190.500);
    expect(op).toBeDefined();

    const order = findOrderWithStop(op, 190.515);
    expect(order).toBeDefined();
    expect(order.stopSemantic).toBe(STOP_SEMANTIC.STOP_GAIN);

    expect(op.hasRealStopLoss).toBe(false);
  });

  // ---------- Trade #2 — LONG entry 190.565, stop @ 190.130 → STOP_LOSS
  it('trade #2 (LONG entry 190.565): exit com Preço Stop 190.130 → STOP_LOSS', () => {
    const op = findOpByEntryLimit(ops, 'LONG', 190.565);
    expect(op).toBeDefined();

    const order = findOrderWithStop(op, 190.130);
    expect(order).toBeDefined();
    expect(order.stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);

    expect(op.hasRealStopLoss).toBe(true);
  });

  // ---------- Trade #3 — LONG entry 190.370, stop @ 190.120 → STOP_LOSS
  it('trade #3 (LONG entry 190.370): exit com Preço Stop 190.120 → STOP_LOSS', () => {
    const op = findOpByEntryLimit(ops, 'LONG', 190.370);
    expect(op).toBeDefined();

    const order = findOrderWithStop(op, 190.120);
    expect(order).toBeDefined();
    expect(order.stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);

    expect(op.hasRealStopLoss).toBe(true);
  });

  // ---------- Trade #4 — SHORT entry 189.645, stop @ 189.810 → STOP_LOSS
  it('trade #4 (SHORT entry 189.645): cancelada BUY com Preço Stop 189.810 → STOP_LOSS', () => {
    const op = findOpByEntryLimit(ops, 'SHORT', 189.645);
    expect(op).toBeDefined();

    const order = findOrderWithStop(op, 189.810);
    expect(order).toBeDefined();
    expect(order.stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);

    expect(op.hasRealStopLoss).toBe(true);
  });

  it('hasRealStopLoss agregado bate com a tabela do issue', () => {
    const op1 = findOpByEntryLimit(ops, 'LONG', 190.500);
    const op2 = findOpByEntryLimit(ops, 'LONG', 190.565);
    const op3 = findOpByEntryLimit(ops, 'LONG', 190.370);
    const op4 = findOpByEntryLimit(ops, 'SHORT', 189.645);

    expect(op1?.hasRealStopLoss).toBe(false);
    expect(op2?.hasRealStopLoss).toBe(true);
    expect(op3?.hasRealStopLoss).toBe(true);
    expect(op4?.hasRealStopLoss).toBe(true);
  });
});
