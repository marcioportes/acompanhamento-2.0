/**
 * orderFillAggregator.js
 * @version 1.0.0 (v1.37.0 — issue #156 Fase D)
 * @description Agrega fills múltiplos de uma mesma ordem lógica.
 *
 *   Brokers como ProfitChart-Pro podem explodir uma ordem de mercado em N linhas
 *   (um fill por linha), todas com o mesmo `externalOrderId`. Para a reconstrução
 *   de operações, essas linhas representam UMA ordem lógica com quantidade total
 *   = soma dos fills e preço médio ponderado pela quantidade de cada fill.
 *
 *   Tradovate já entrega pré-agregado, então o helper é no-op nesse caso (cada
 *   externalOrderId aparece uma única vez).
 *
 *   INVARIANTES:
 *   - Só agrega FILLED + FILLED com mesmo externalOrderId.
 *   - CANCELLED/REJECTED/EXPIRED nunca se misturam com FILLED (mesmo id).
 *   - Ordens sem externalOrderId passam intactas.
 *   - Grupos de 1 ordem passam intactos.
 *
 * EXPORTS:
 *   aggregateFills(orders) → aggregatedOrders
 */

const effectiveTs = (order) => {
  const ts = order.filledAt || order.submittedAt;
  return ts ? new Date(ts).getTime() : 0;
};

const weightedAvg = (fills) => {
  let totalValue = 0;
  let totalQty = 0;
  for (const f of fills) {
    const qty = f.filledQuantity ?? f.quantity ?? 0;
    const price = f.filledPrice ?? f.avgFillPrice ?? f.price ?? 0;
    if (qty > 0 && price > 0) {
      totalValue += price * qty;
      totalQty += qty;
    }
  }
  return totalQty > 0 ? Math.round((totalValue / totalQty) * 1000) / 1000 : 0;
};

/**
 * Colapsa fills múltiplos (mesmo externalOrderId, status FILLED) em uma ordem
 * lógica única com quantidade somada e preço médio ponderado.
 *
 * @param {Object[]} orders — ordens normalizadas (qualquer status)
 * @returns {Object[]} ordens pós-agregação, preservando ordem cronológica
 */
export const aggregateFills = (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) return [];

  const groups = new Map(); // externalOrderId → Order[]
  const passthrough = []; // ordens sem id ou não-FILLED

  for (const order of orders) {
    const isFilled = order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED';
    if (!isFilled || !order.externalOrderId) {
      passthrough.push(order);
      continue;
    }
    const key = order.externalOrderId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  }

  const aggregated = [];
  for (const [, fills] of groups) {
    if (fills.length === 1) {
      aggregated.push(fills[0]);
      continue;
    }

    // Múltiplos fills do mesmo orderId → colapsar
    const sorted = [...fills].sort((a, b) => effectiveTs(a) - effectiveTs(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalQty = sorted.reduce(
      (sum, f) => sum + (f.filledQuantity ?? f.quantity ?? 0),
      0,
    );
    const avgPrice = weightedAvg(sorted);

    aggregated.push({
      ...first,
      quantity: totalQty,
      filledQuantity: totalQty,
      filledPrice: avgPrice,
      avgFillPrice: avgPrice,
      price: avgPrice,
      submittedAt: first.submittedAt ?? last.submittedAt,
      filledAt: last.filledAt ?? first.filledAt,
      _aggregatedFillCount: sorted.length,
      _aggregatedOrderIds: sorted.map((f) => f._rowIndex ?? null).filter(Boolean),
    });
  }

  // Mantém cronologia global: intercalamos passthrough e aggregated por timestamp.
  const result = [...aggregated, ...passthrough];
  result.sort((a, b) => effectiveTs(a) - effectiveTs(b));
  return result;
};

// Export interno para testes (não usar em produção)
export const __internal = { weightedAvg, effectiveTs };
