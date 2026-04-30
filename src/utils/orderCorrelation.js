/**
 * orderCorrelation.js
 * @version 2.0.0 (v1.49.0 — issue #208 Fase 1)
 * @description Correlação ordem↔trade. N:1 — múltiplas orders por trade (entry + exit + parciais).
 *
 * ALGORITMO (N:1):
 *   1. Filtrar ordens FILLED|PARTIALLY_FILLED
 *   2. Para cada ordem, encontrar o melhor par (trade, role∈{entry,exit}) por:
 *      - instrument match
 *      - timestamp dentro da janela do entryTime ou exitTime do trade
 *      - side compatível com role (entry: BUY↔LONG, SELL↔SHORT; exit: inverso)
 *   3. Múltiplas orders podem casar com o MESMO trade (entry + exit + fills parciais)
 *   4. Stats reportam coverage por trade: full (entry+exit), partial (só uma role), zero
 *
 * Resolve bug v1.0.0: correlator anterior fazia 1:1 exclusivo — em bracket OCO o
 * exit virava ghost falso porque entry consumia o trade. Agora exit também casa.
 *
 * EXPORTS:
 *   correlateOrders(orders, trades) → CorrelationResult[]
 *   correlateOrder(order, trades) → { tradeId, confidence, matchType } (single-order, retrocompat)
 *   CORRELATION_WINDOW_MS — janela de correlação (5 min default)
 */

// ============================================
// CONSTANTS
// ============================================

/** Janela de correlação em ms (5 minutos) */
export const CORRELATION_WINDOW_MS = 5 * 60 * 1000;

/** Janela expandida para trades sem hora (correlação por dia) */
export const CORRELATION_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

/** Tolerância de quantidade (±10%) */
const QTY_TOLERANCE = 0.10;

// ============================================
// HELPERS
// ============================================

/**
 * Extrai timestamp em ms de um campo que pode ser ISO string, Firestore Timestamp, ou date string.
 * @param {*} value
 * @returns {number|null}
 */
const toMs = (value) => {
  if (!value) return null;
  // Firestore Timestamp object
  if (value.seconds != null) return value.seconds * 1000;
  if (value.toMillis) return value.toMillis();
  // ISO string ou date string
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Checa se um timestamp de trade tem componente de hora (vs. apenas data).
 * Trades importados por CSV podem ter só data (YYYY-MM-DD ou DD/MM/YYYY sem hora).
 * @param {*} value
 * @returns {boolean}
 */
const hasTimeComponent = (value) => {
  if (!value) return false;
  const str = typeof value === 'string' ? value : '';
  // Se contém T e não é meia-noite exata
  if (str.includes('T') && !str.includes('T00:00:00')) return true;
  // Se contém hora:minuto
  if (/\d{1,2}:\d{2}/.test(str)) return true;
  return false;
};

/**
 * Mapeia side de ordem (BUY/SELL) para side de trade (LONG/SHORT).
 * Ordem BUY para abrir = LONG; Ordem SELL para abrir = SHORT.
 * Mas uma ordem BUY pode também ser fechamento de SHORT e vice-versa.
 *
 * Para correlação: BUY correlaciona com LONG (abertura) ou SHORT (fechamento).
 *
 * @param {string} orderSide
 * @param {string} tradeSide
 * @returns {boolean}
 */
const sidesCompatible = (orderSide, tradeSide) => {
  if (!orderSide || !tradeSide) return true; // se missing, não penalizar
  // BUY pode ser abertura de LONG ou fechamento de SHORT
  // SELL pode ser abertura de SHORT ou fechamento de LONG
  // Portanto qualquer combinação é potencialmente válida
  // Mas a combinação mais provável é: BUY↔LONG, SELL↔SHORT para abertura
  return true; // Não restringir — o timestamp e instrumento são os critérios fortes
};

/**
 * Score de proximidade de side.
 * BUY↔LONG ou SELL↔SHORT = 1.0 (match perfeito para abertura)
 * Outros = 0.5 (possível fechamento)
 */
const sideScore = (orderSide, tradeSide) => {
  if (!orderSide || !tradeSide) return 0.5;
  const directMatch = (orderSide === 'BUY' && tradeSide === 'LONG') ||
                       (orderSide === 'SELL' && tradeSide === 'SHORT');
  return directMatch ? 1.0 : 0.5;
};

// ============================================
// SINGLE ORDER CORRELATION
// ============================================

/**
 * Correlaciona uma única ordem FILLED com um array de trades.
 *
 * @param {Object} order — ordem normalizada (FILLED)
 * @param {Object[]} trades — trades do mesmo aluno
 * @returns {{ tradeId: string|null, confidence: number, matchType: 'exact'|'best'|'ghost', details: string }}
 */
export const correlateOrder = (order, trades) => {
  if (!order || !trades?.length) {
    return { tradeId: null, confidence: 0, matchType: 'ghost', details: 'Sem trades para correlação' };
  }

  const orderTs = toMs(order.filledAt || order.submittedAt);
  if (!orderTs) {
    return { tradeId: null, confidence: 0, matchType: 'ghost', details: 'Ordem sem timestamp' };
  }

  const candidates = [];

  for (const trade of trades) {
    // Filtro 1: instrumento
    const tradeInstrument = (trade.ticker || '').toUpperCase();
    const orderInstrument = (order.instrument || '').toUpperCase();
    if (orderInstrument && tradeInstrument && orderInstrument !== tradeInstrument) continue;

    // Filtro 2: timestamp — usar entryTime para ordens de abertura, exitTime para fechamento
    const tradeEntryTs = toMs(trade.entryTime || trade.openedAt);
    const tradeExitTs = toMs(trade.exitTime || trade.closedAt);

    // Determinar se a trade tem hora ou só data
    const tradeHasTime = hasTimeComponent(trade.entryTime) || hasTimeComponent(trade.exitTime);
    const window = tradeHasTime ? CORRELATION_WINDOW_MS : CORRELATION_WINDOW_DAY_MS;

    let bestTimeDelta = Infinity;
    let matchedTimestamp = null;

    if (tradeEntryTs) {
      const delta = Math.abs(orderTs - tradeEntryTs);
      if (delta < window && delta < bestTimeDelta) {
        bestTimeDelta = delta;
        matchedTimestamp = 'entry';
      }
    }
    if (tradeExitTs) {
      const delta = Math.abs(orderTs - tradeExitTs);
      if (delta < window && delta < bestTimeDelta) {
        bestTimeDelta = delta;
        matchedTimestamp = 'exit';
      }
    }

    if (!matchedTimestamp) continue;

    // Score components
    const timeScore = 1.0 - (bestTimeDelta / window); // 0-1, closer = higher
    const sScore = sideScore(order.side, trade.side);

    // Quantity score
    let qtyScore = 0.5; // default se não comparável
    if (order.quantity != null && trade.qty != null && trade.qty > 0) {
      const ratio = order.quantity / trade.qty;
      if (Math.abs(ratio - 1.0) <= QTY_TOLERANCE) {
        qtyScore = 1.0;
      } else if (ratio > 0 && ratio < 2.0) {
        qtyScore = 0.7;
      } else {
        qtyScore = 0.3;
      }
    }

    // Composite score (weighted)
    const compositeScore = (timeScore * 0.5) + (sScore * 0.2) + (qtyScore * 0.3);

    candidates.push({
      tradeId: trade.id,
      score: compositeScore,
      timeDelta: bestTimeDelta,
      matchedTimestamp,
      timeScore,
      sideScore: sScore,
      qtyScore,
    });
  }

  if (candidates.length === 0) {
    return { tradeId: null, confidence: 0, matchType: 'ghost', details: 'Nenhum trade dentro da janela de correlação' };
  }

  // Ordenar por score desc
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (candidates.length === 1) {
    return {
      tradeId: best.tradeId,
      confidence: Math.min(best.score + 0.1, 1.0), // bonus por match único
      matchType: 'exact',
      details: `Match único via ${best.matchedTimestamp} (delta: ${Math.round(best.timeDelta / 1000)}s)`,
    };
  }

  // Múltiplos: se o melhor é significativamente melhor que o segundo, confidence alta
  const second = candidates[1];
  const gap = best.score - second.score;
  const confidence = gap > 0.2 ? Math.min(best.score, 0.9) : Math.min(best.score, 0.7);

  return {
    tradeId: best.tradeId,
    confidence: Math.round(confidence * 100) / 100,
    matchType: 'best',
    details: `Melhor de ${candidates.length} candidatos (gap: ${gap.toFixed(2)})`,
  };
};

// ============================================
// BATCH CORRELATION (N:1 — múltiplas orders por trade)
// ============================================

/**
 * Side compatibility por role do trade:
 *   entry: BUY↔LONG, SELL↔SHORT
 *   exit:  SELL↔LONG, BUY↔SHORT
 * Ordens sem side declarado passam (não penalizar — timestamp + instrument já filtram).
 */
const isSideCompatibleForRole = (orderSide, tradeSide, role) => {
  if (!orderSide || !tradeSide) return true;
  if (role === 'entry') {
    return (orderSide === 'BUY' && tradeSide === 'LONG') ||
           (orderSide === 'SELL' && tradeSide === 'SHORT');
  }
  if (role === 'exit') {
    return (orderSide === 'SELL' && tradeSide === 'LONG') ||
           (orderSide === 'BUY' && tradeSide === 'SHORT');
  }
  return true;
};

/**
 * Snapshot mínimo do order para inspeção downstream (UI ghost expand, sensor comportamental).
 */
const snapshotOrder = (order) => ({
  side: order.side ?? null,
  qty: order.filledQuantity ?? order.quantity ?? null,
  price: order.filledPrice ?? order.price ?? null,
  stopPrice: order.stopPrice ?? null,
  type: order.type ?? null,
  status: order.status ?? null,
  submittedAt: order.submittedAt ?? null,
  filledAt: order.filledAt ?? null,
  cancelledAt: order.cancelledAt ?? null,
});

/**
 * Correlaciona todas as ordens FILLED com trades. N:1 — uma order casa com 1 trade,
 * mas múltiplas orders podem casar com o mesmo trade (entry, exit, fills parciais).
 *
 * Resolve bug v1.0.0: correlator anterior fazia 1:1 exclusivo — em bracket OCO o
 * exit virava ghost falso porque entry consumia o trade.
 *
 * @param {Object[]} orders — ordens normalizadas (qualquer status, filtra internamente)
 * @param {Object[]} trades — trades do aluno (com id, ticker, side, qty, entryTime, exitTime)
 * @returns {{
 *   correlations: Array<{ orderId, tradeId, role, matchType, confidence, ... }>,
 *   stats: {
 *     total, matched, ghost, avgConfidence,
 *     tradesWithFullCoverage, tradesWithPartialCoverage, tradesWithoutOrders,
 *     orphanFills,
 *   }
 * }}
 */
export const correlateOrders = (orders, trades) => {
  const filledOrders = orders.filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED');

  if (!filledOrders.length) {
    return {
      correlations: [],
      stats: {
        total: 0, matched: 0, ghost: 0, avgConfidence: 0,
        tradesWithFullCoverage: 0,
        tradesWithPartialCoverage: 0,
        tradesWithoutOrders: trades?.length || 0,
        orphanFills: 0,
      },
    };
  }

  // Ordena cronologicamente para correlations[] preservar fluxo temporal.
  const sortedOrders = [...filledOrders].sort((a, b) => {
    const tsA = new Date(a.filledAt || a.submittedAt || 0).getTime();
    const tsB = new Date(b.filledAt || b.submittedAt || 0).getTime();
    return tsA - tsB;
  });

  const correlations = [];
  let totalConfidence = 0;
  let matchedCount = 0;

  for (const order of sortedOrders) {
    const orderTs = toMs(order.filledAt || order.submittedAt);

    if (!orderTs) {
      correlations.push({
        orderIndex: order._rowIndex,
        externalOrderId: order.externalOrderId,
        instrument: order.instrument,
        order: snapshotOrder(order),
        tradeId: null,
        role: null,
        confidence: 0,
        matchType: 'ghost',
        details: 'Ordem sem timestamp',
      });
      continue;
    }

    // Procura melhor (trade, role∈{entry,exit}). Múltiplas orders podem casar
    // com o mesmo trade — sem exclusão mútua.
    let best = null;
    const orderInstrument = (order.instrument || '').toUpperCase();

    for (const trade of trades) {
      const tradeInstrument = (trade.ticker || '').toUpperCase();
      if (orderInstrument && tradeInstrument && orderInstrument !== tradeInstrument) continue;

      const tradeEntryTs = toMs(trade.entryTime || trade.openedAt);
      const tradeExitTs = toMs(trade.exitTime || trade.closedAt);
      const tradeHasTime = hasTimeComponent(trade.entryTime) || hasTimeComponent(trade.exitTime);
      const window = tradeHasTime ? CORRELATION_WINDOW_MS : CORRELATION_WINDOW_DAY_MS;

      if (tradeEntryTs) {
        const delta = Math.abs(orderTs - tradeEntryTs);
        if (delta < window) {
          const sideOk = isSideCompatibleForRole(order.side, trade.side, 'entry');
          const timeScore = 1.0 - (delta / window);
          const sScore = sideOk ? 1.0 : 0.3;
          const score = (timeScore * 0.6) + (sScore * 0.4);
          if (!best || score > best.score) {
            best = { tradeId: trade.id, role: 'entry', score, delta, sideOk };
          }
        }
      }

      if (tradeExitTs) {
        const delta = Math.abs(orderTs - tradeExitTs);
        if (delta < window) {
          const sideOk = isSideCompatibleForRole(order.side, trade.side, 'exit');
          const timeScore = 1.0 - (delta / window);
          const sScore = sideOk ? 1.0 : 0.3;
          const score = (timeScore * 0.6) + (sScore * 0.4);
          if (!best || score > best.score) {
            best = { tradeId: trade.id, role: 'exit', score, delta, sideOk };
          }
        }
      }
    }

    if (best) {
      const confidence = Math.round(best.score * 100) / 100;
      matchedCount++;
      totalConfidence += confidence;
      correlations.push({
        orderIndex: order._rowIndex,
        externalOrderId: order.externalOrderId,
        instrument: order.instrument,
        order: snapshotOrder(order),
        tradeId: best.tradeId,
        role: best.role,
        confidence,
        matchType: 'exact',
        details: `Match ${best.role} (delta: ${Math.round(best.delta / 1000)}s${best.sideOk ? '' : ', side mismatch'})`,
      });
    } else {
      correlations.push({
        orderIndex: order._rowIndex,
        externalOrderId: order.externalOrderId,
        instrument: order.instrument,
        order: snapshotOrder(order),
        tradeId: null,
        role: null,
        confidence: 0,
        matchType: 'ghost',
        details: 'Nenhum trade dentro da janela de correlação',
      });
    }
  }

  // Coverage por trade: full (entry+exit), partial (só uma role), zero (sem orders).
  const coverage = new Map();
  for (const c of correlations) {
    if (!c.tradeId) continue;
    const cov = coverage.get(c.tradeId) || { entry: false, exit: false };
    if (c.role === 'entry') cov.entry = true;
    if (c.role === 'exit') cov.exit = true;
    coverage.set(c.tradeId, cov);
  }

  let tradesWithFullCoverage = 0;
  let tradesWithPartialCoverage = 0;
  for (const cov of coverage.values()) {
    if (cov.entry && cov.exit) tradesWithFullCoverage++;
    else tradesWithPartialCoverage++;
  }
  const tradesWithoutOrders = (trades?.length || 0) - coverage.size;
  const ghostCount = filledOrders.length - matchedCount;

  return {
    correlations,
    stats: {
      total: filledOrders.length,
      matched: matchedCount,
      ghost: ghostCount,
      avgConfidence: matchedCount > 0 ? Math.round((totalConfidence / matchedCount) * 100) / 100 : 0,
      tradesWithFullCoverage,
      tradesWithPartialCoverage,
      tradesWithoutOrders,
      orphanFills: ghostCount,
    },
  };
};

// ============================================
// CANCELLED ORDER CORRELATION
// ============================================
//
// Cancels precisam de correlatedTradeId populado para o sensor comportamental
// detectar STOP_TAMPERING / HESITATION_PRE_ENTRY / CHASE_REENTRY (issue #208).
// `correlateOrders` filtra cancels (status !== FILLED), então este helper opera
// só sobre cancels e usa critério diferente: a vida útil [submittedAt, cancelledAt]
// da ordem precisa intersectar a vida útil do trade [entryTs - 60s, exitTs + 60s].
//
// Confidence é fixo em 0.7 — heurística temporal é menos confiável que match de
// fill por timestamp pontual, mas suficiente para o detector comportamental.

const CANCEL_TRADE_PADDING_MS = 60 * 1000;

/**
 * Correlaciona ordens canceladas (CANCELLED/REJECTED/EXPIRED) com trades por
 * sobreposição temporal e match de instrumento.
 *
 * @param {Object[]} cancelledOrders — orders com status CANCELLED/REJECTED/EXPIRED
 * @param {Object[]} trades — trades do plano
 * @returns {Array<{externalOrderId, tradeId, confidence}>}
 */
export const correlateCancelledOrders = (cancelledOrders, trades) => {
  if (!Array.isArray(cancelledOrders) || !Array.isArray(trades)) return [];

  const results = [];
  for (const order of cancelledOrders) {
    const status = order?.status;
    if (status !== 'CANCELLED' && status !== 'REJECTED' && status !== 'EXPIRED') continue;

    const submittedTs = toMs(order.submittedAt);
    const cancelledTs = toMs(order.cancelledAt) || toMs(order.filledAt) || submittedTs;
    if (!submittedTs && !cancelledTs) continue;

    const orderStart = submittedTs ?? cancelledTs;
    const orderEnd = cancelledTs ?? submittedTs;
    const orderInstrument = (order.instrument || '').toUpperCase();

    let bestMatch = null;
    let bestOverlap = 0;

    for (const trade of trades) {
      const tradeInstrument = (trade.ticker || trade.instrument || '').toUpperCase();
      if (orderInstrument && tradeInstrument && orderInstrument !== tradeInstrument) continue;

      const entryTs = toMs(trade.entryTime || trade.openedAt);
      const exitTs = toMs(trade.exitTime || trade.closedAt);
      if (!entryTs) continue;

      const tradeStart = entryTs - CANCEL_TRADE_PADDING_MS;
      const tradeEnd = (exitTs || entryTs) + CANCEL_TRADE_PADDING_MS;

      const overlapStart = Math.max(orderStart, tradeStart);
      const overlapEnd = Math.min(orderEnd, tradeEnd);
      const overlap = overlapEnd - overlapStart;

      if (overlap >= 0 && overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = trade;
      }
    }

    if (bestMatch) {
      results.push({
        externalOrderId: order.externalOrderId,
        tradeId: bestMatch.id,
        confidence: 0.7,
      });
    }
  }
  return results;
};
