/**
 * orderCorrelation.js
 * @version 1.0.0 (v1.20.0)
 * @description Correlação ordem↔trade. Recebe ordens (FILLED) e trades do mesmo
 *   aluno/plano/instrumento e produz matches com confidence score.
 *
 * ALGORITMO:
 *   1. Filtrar ordens FILLED
 *   2. Para cada ordem, buscar trades com: mesmo instrumento, timestamp próximo, side compatível
 *   3. Scoring: timestamp proximity + side match + quantity match
 *   4. Match único → confidence 1.0
 *   5. Múltiplos matches → melhor score, confidence 0.7-0.9
 *   6. Nenhum match → ghost order (correlatedTradeId = null)
 *
 * EXPORTS:
 *   correlateOrders(orders, trades) → CorrelationResult[]
 *   correlateOrder(order, trades) → { tradeId, confidence, matchType }
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
// BATCH CORRELATION
// ============================================

/**
 * Correlaciona todas as ordens FILLED com trades.
 *
 * @param {Object[]} orders — ordens normalizadas (qualquer status, filtra internamente)
 * @param {Object[]} trades — trades do aluno (com id, ticker, side, qty, entryTime, exitTime)
 * @returns {{
 *   correlations: Array<{ orderId: string, ...correlationResult }>,
 *   stats: { total: number, matched: number, ghost: number, avgConfidence: number }
 * }}
 */
export const correlateOrders = (orders, trades) => {
  const filledOrders = orders.filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED');

  if (!filledOrders.length) {
    return {
      correlations: [],
      stats: { total: 0, matched: 0, ghost: 0, avgConfidence: 0 },
    };
  }

  const correlations = [];
  let matchedCount = 0;
  let totalConfidence = 0;

  // Track which trades have been matched to avoid double-assignment
  const assignedTrades = new Set();

  // Sort orders by timestamp for consistent assignment
  const sortedOrders = [...filledOrders].sort((a, b) => {
    const tsA = new Date(a.filledAt || a.submittedAt || 0).getTime();
    const tsB = new Date(b.filledAt || b.submittedAt || 0).getTime();
    return tsA - tsB;
  });

  for (const order of sortedOrders) {
    // Filtrar trades já atribuídas
    const availableTrades = trades.filter(t => !assignedTrades.has(t.id));
    const result = correlateOrder(order, availableTrades);

    if (result.tradeId) {
      assignedTrades.add(result.tradeId);
      matchedCount++;
      totalConfidence += result.confidence;
    }

    correlations.push({
      orderIndex: order._rowIndex,
      externalOrderId: order.externalOrderId,
      instrument: order.instrument,
      ...result,
    });
  }

  const ghostCount = filledOrders.length - matchedCount;

  return {
    correlations,
    stats: {
      total: filledOrders.length,
      matched: matchedCount,
      ghost: ghostCount,
      avgConfidence: matchedCount > 0 ? Math.round((totalConfidence / matchedCount) * 100) / 100 : 0,
    },
  };
};
