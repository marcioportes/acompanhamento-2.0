/**
 * orderNormalizer.js
 * @version 1.0.0 (v1.20.0)
 * @description Normaliza ordens parseadas para o schema unificado do Firestore.
 *   Recebe RawOrder (output dos parsers) e produz NormalizedOrder pronto para staging.
 *
 * RESPONSABILIDADES:
 *   - Garantir tipos corretos (number, string, null — nunca undefined)
 *   - Garantir enums válidos
 *   - Gerar dedup key para deduplicação
 *   - Não valida regras de negócio (isso é orderValidation.js)
 *
 * EXPORTS:
 *   normalizeOrder(rawOrder) → NormalizedOrder
 *   normalizeBatch(rawOrders) → { orders: NormalizedOrder[], dedupStats: Object }
 *   generateDedupKey(order) → string
 */

import { normalizeSide, normalizeOrderType, normalizeOrderStatus, parseNumeric, parseTimestamp } from './orderParsers.js';

// ============================================
// DEDUP KEY
// ============================================

/**
 * Gera chave de deduplicação para uma ordem.
 * Formato: instrument|side|qty|orderType|submittedAt
 * Usa campos que juntos identificam univocamente uma ordem.
 *
 * @param {Object} order
 * @returns {string}
 */
export const generateDedupKey = (order) => {
  const parts = [
    (order.instrument || '').toUpperCase(),
    order.side || '',
    order.quantity ?? '',
    order.orderType || '',
    order.submittedAt || '',
    order.externalOrderId || '',
  ];
  return parts.join('|');
};

// ============================================
// NORMALIZE SINGLE ORDER
// ============================================

/**
 * Normaliza uma ordem raw para o schema do Firestore.
 * Garante tipos corretos e nunca undefined.
 *
 * @param {Object} rawOrder — output do parser
 * @returns {Object} NormalizedOrder
 */
export const normalizeOrder = (rawOrder) => {
  const side = normalizeSide(rawOrder.side) ?? rawOrder.side ?? null;
  const orderType = normalizeOrderType(rawOrder.orderType) ?? rawOrder.orderType ?? null;
  const status = normalizeOrderStatus(rawOrder.status) ?? rawOrder.status ?? null;
  const quantity = typeof rawOrder.quantity === 'number' ? rawOrder.quantity : (parseNumeric(rawOrder.quantity) ?? null);
  const limitPrice = typeof rawOrder.limitPrice === 'number' ? rawOrder.limitPrice : (parseNumeric(rawOrder.limitPrice) ?? null);
  const stopPrice = typeof rawOrder.stopPrice === 'number' ? rawOrder.stopPrice : (parseNumeric(rawOrder.stopPrice) ?? null);
  const filledPrice = typeof rawOrder.filledPrice === 'number' ? rawOrder.filledPrice : (parseNumeric(rawOrder.filledPrice) ?? null);
  const filledQuantity = typeof rawOrder.filledQuantity === 'number' ? rawOrder.filledQuantity : (parseNumeric(rawOrder.filledQuantity) ?? null);

  const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT' || (stopPrice != null && stopPrice > 0);

  const submittedAt = rawOrder.submittedAt || null;
  const filledAt = rawOrder.filledAt || null;
  const cancelledAt = rawOrder.cancelledAt || null;

  // Price: para ordens FILLED, usar filledPrice; para LIMIT, usar limitPrice; para STOP, usar stopPrice
  let price = null;
  if (filledPrice != null) price = filledPrice;
  else if (limitPrice != null) price = limitPrice;
  else if (stopPrice != null) price = stopPrice;

  const normalized = {
    externalOrderId: rawOrder.externalOrderId || null,
    instrument: (rawOrder.instrument || '').toUpperCase().trim() || null,
    orderType,
    side,
    quantity,
    price,
    limitPrice,
    stopPrice,
    filledPrice,
    filledQuantity: filledQuantity ?? quantity, // default: qty inteira se não informado
    status,
    submittedAt,
    filledAt,
    cancelledAt,
    modifications: [], // preenchido por detecção posterior se aplicável
    isStopOrder,
    _dedupKey: null, // preenchido abaixo
    _rowIndex: rawOrder._rowIndex ?? null,
  };

  normalized._dedupKey = generateDedupKey(normalized);

  return normalized;
};

// ============================================
// NORMALIZE BATCH
// ============================================

/**
 * Normaliza um array de ordens e remove duplicatas.
 *
 * @param {Object[]} rawOrders
 * @returns {{ orders: Object[], dedupStats: { total: number, unique: number, duplicates: number } }}
 */
export const normalizeBatch = (rawOrders) => {
  if (!rawOrders?.length) {
    return { orders: [], dedupStats: { total: 0, unique: 0, duplicates: 0 } };
  }

  const seen = new Set();
  const unique = [];
  let duplicates = 0;

  for (const raw of rawOrders) {
    const normalized = normalizeOrder(raw);
    if (seen.has(normalized._dedupKey)) {
      duplicates++;
      continue;
    }
    seen.add(normalized._dedupKey);
    unique.push(normalized);
  }

  return {
    orders: unique,
    dedupStats: {
      total: rawOrders.length,
      unique: unique.length,
      duplicates,
    },
  };
};
