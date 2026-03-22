/**
 * orderNormalizer.js
 * @version 2.0.0 (v1.20.0)
 * @description Normaliza ordens parseadas (Clear/Profit ou genérico) para schema unificado.
 *   Deduplicação por externalOrderId (ClOrdID na Clear).
 *
 * EXPORTS:
 *   normalizeOrder(parsedOrder) → NormalizedOrder
 *   normalizeBatch(parsedOrders) → { orders[], dedupStats }
 *   generateDedupKey(order) → string
 */

// ============================================
// DEDUP KEY
// ============================================

/**
 * Gera chave de deduplicação.
 * Prioriza externalOrderId (ClOrdID na Clear — único por ordem).
 * Fallback: instrument|side|qty|submittedAt
 */
export const generateDedupKey = (order) => {
  if (order.externalOrderId) return order.externalOrderId;
  return [
    (order.instrument || '').toUpperCase(),
    order.side || '',
    order.quantity ?? '',
    order.orderType || '',
    order.submittedAt || '',
  ].join('|');
};

// ============================================
// NORMALIZE
// ============================================

/**
 * Normaliza uma ordem para o schema do Firestore.
 * Garante tipos corretos e nunca undefined.
 *
 * @param {Object} parsed — output do parser (Clear ou genérico)
 * @returns {Object} NormalizedOrder
 */
export const normalizeOrder = (parsed) => {
  // Price resolution: filledPrice > avgFillPrice > price
  let price = null;
  if (parsed.filledPrice != null) price = parsed.filledPrice;
  else if (parsed.avgFillPrice != null) price = parsed.avgFillPrice;
  else if (parsed.price != null) price = parsed.price;

  const normalized = {
    externalOrderId: parsed.externalOrderId || null,
    instrument: (parsed.instrument || '').toUpperCase().trim() || null,
    orderType: parsed.orderType || null,
    side: parsed.side || null,
    quantity: typeof parsed.quantity === 'number' ? parsed.quantity : null,
    price,
    limitPrice: parsed.price || null, // preço da ordem (Limite)
    stopPrice: parsed.stopPrice || null,
    filledPrice: parsed.filledPrice || parsed.avgFillPrice || null,
    filledQuantity: parsed.filledQuantity ?? parsed.quantity ?? null,
    status: parsed.status || null,
    submittedAt: parsed.submittedAt || null,
    filledAt: parsed.filledAt || null,
    cancelledAt: parsed.cancelledAt || null,
    lastUpdatedAt: parsed.lastUpdatedAt || null,
    modifications: [],
    isStopOrder: parsed.isStopOrder || false,
    // Clear-specific enrichments
    account: parsed.account || null,
    exchange: parsed.exchange || null,
    origin: parsed.origin || null,
    strategy: parsed.strategy || null,
    totalValue: parsed.totalValue || null,
    totalExecutedValue: parsed.totalExecutedValue || null,
    events: parsed.events || [],
    // Internal
    _dedupKey: null,
    _rowIndex: parsed._rowIndex ?? null,
  };

  normalized._dedupKey = generateDedupKey(normalized);
  return normalized;
};

// ============================================
// NORMALIZE BATCH
// ============================================

/**
 * Normaliza array de ordens e remove duplicatas por externalOrderId.
 *
 * @param {Object[]} parsedOrders
 * @returns {{ orders: Object[], dedupStats: { total, unique, duplicates } }}
 */
export const normalizeBatch = (parsedOrders) => {
  if (!parsedOrders?.length) {
    return { orders: [], dedupStats: { total: 0, unique: 0, duplicates: 0 } };
  }

  const seen = new Set();
  const unique = [];
  let duplicates = 0;

  for (const parsed of parsedOrders) {
    const normalized = normalizeOrder(parsed);
    if (seen.has(normalized._dedupKey)) {
      duplicates++;
      continue;
    }
    seen.add(normalized._dedupKey);
    unique.push(normalized);
  }

  return {
    orders: unique,
    dedupStats: { total: parsedOrders.length, unique: unique.length, duplicates },
  };
};
