/**
 * executionBehaviorEngine.js
 * @version 1.0.0 (v1.49.0 — issue #208 Fase 2)
 * @description Sensor comportamental de execução. Lê trades + orders e emite
 *   eventos comportamentais auditáveis para alimentar engine emocional V2 e
 *   gates de maturidade.
 *
 * 5 DETECTORES:
 *   STOP_TAMPERING            — stop reemitido para mais largo durante vida do trade
 *   STOP_PARTIAL_SIZING       — soma stop qty < trade qty (sub-proteção)
 *   RAPID_REENTRY_POST_STOP   — entry mesmo side <10min após exit por stop (loss-chasing)
 *   HESITATION_PRE_ENTRY      — order CANCELLED mesmo side+instrument seguida de FILLED <30min
 *   CHASE_REENTRY             — re-submit mesmo side com preço pior antes do fill final
 *
 * INPUT:
 *   trades  — collection trades: {id, ticker, side, qty, entryTime, exitTime, ...}
 *   orders  — collection orders: {externalOrderId, side, type, status, qty,
 *             price, stopPrice, submittedAt, filledAt, cancelledAt, instrument,
 *             correlatedTradeId, isStopOrder}
 *   config  — { hesitationWindowMs, rapidReentryWindowMs } (optional, defaults)
 *
 * OUTPUT:
 *   [{ type, severity, tradeId?, orderIds[], timestamp, evidence, source, citation }]
 *
 * SOURCE flags:
 *   'literature' — base em paper citável (citation preenchido)
 *   'heuristic'  — extrapolação operacional sem paper direto
 *
 * EXPORTS:
 *   detectExecutionEvents({trades, orders, config})
 *   EVENT_TYPES, EVENT_SEVERITY (constantes)
 */

// ============================================
// CONSTANTS
// ============================================

export const EVENT_TYPES = Object.freeze({
  STOP_TAMPERING: 'STOP_TAMPERING',
  STOP_PARTIAL_SIZING: 'STOP_PARTIAL_SIZING',
  RAPID_REENTRY_POST_STOP: 'RAPID_REENTRY_POST_STOP',
  HESITATION_PRE_ENTRY: 'HESITATION_PRE_ENTRY',
  CHASE_REENTRY: 'CHASE_REENTRY',
});

export const EVENT_SEVERITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

const DEFAULT_CONFIG = Object.freeze({
  hesitationWindowMs: 30 * 60 * 1000,        // 30 min
  rapidReentryWindowMs: 10 * 60 * 1000,      // 10 min
  partialSizingTolerance: 0,                  // stop qty < trade qty (estrito)
});

// ============================================
// HELPERS
// ============================================

const toMs = (value) => {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const sameInstrument = (a, b) => {
  const ax = (a || '').toUpperCase();
  const bx = (b || '').toUpperCase();
  return ax !== '' && ax === bx;
};

/** Side da ordem ↔ side do trade (apenas direção, ignora entry/exit). */
const orderSideMatchesTradeSide = (orderSide, tradeSide) => {
  if (!orderSide || !tradeSide) return false;
  return (orderSide === 'BUY' && tradeSide === 'LONG') ||
         (orderSide === 'SELL' && tradeSide === 'SHORT');
};

/** Determina se o stop foi WIDENED (afastado da entrada → risco maior). */
const isStopWidened = (tradeSide, prevPrice, currPrice) => {
  if (!tradeSide || !prevPrice || !currPrice) return false;
  if (tradeSide === 'LONG') return currPrice < prevPrice;   // stop abaixo da entry; menor = mais distante
  if (tradeSide === 'SHORT') return currPrice > prevPrice;  // stop acima da entry; maior = mais distante
  return false;
};

/** Determina se o preço da nova ordem é "pior" que o anterior (chase). */
const isPriceWorse = (orderSide, prevPrice, currPrice) => {
  if (!orderSide || !prevPrice || !currPrice) return false;
  if (orderSide === 'BUY') return currPrice > prevPrice;    // pagar mais caro
  if (orderSide === 'SELL') return currPrice < prevPrice;   // vender mais barato
  return false;
};

const ordersForTrade = (orders, tradeId) =>
  orders.filter(o => o.correlatedTradeId === tradeId);

/**
 * Trade fechou em loss? Esse é o gatilho comportamental do RAPID_REENTRY:
 * loss-chasing acontece após perda realizada, independente de como (stop
 * disparou OU fechamento manual em loss via ordem limite). Aderente a
 * Coval&Shumway 2005, que mede loss-chasing operacional, não execução literal.
 */
const tradeClosedInLoss = (trade) =>
  typeof trade?.result === 'number' && trade.result < 0;

// ============================================
// DETECTORS
// ============================================

/**
 * STOP_TAMPERING — stop reemitido para mais largo durante vida do trade.
 * Fonte: Kahneman & Tversky 1979 (loss aversion); Shefrin & Statman 1985 (disposition).
 */
const detectStopTampering = (trade, orders) => {
  const stops = ordersForTrade(orders, trade.id)
    .filter(o => o.isStopOrder === true)
    .map(o => ({
      ...o,
      _ts: toMs(o.submittedAt) ?? toMs(o.cancelledAt) ?? toMs(o.filledAt),
      _price: o.stopPrice ?? o.price ?? null,
    }))
    .filter(o => o._ts != null && o._price != null)
    .sort((a, b) => a._ts - b._ts);

  if (stops.length < 2) return [];

  const events = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev._price === curr._price) continue;
    if (!isStopWidened(trade.side, prev._price, curr._price)) continue;

    events.push({
      type: EVENT_TYPES.STOP_TAMPERING,
      severity: EVENT_SEVERITY.HIGH,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt ?? null,
      evidence: {
        from: prev._price,
        to: curr._price,
        direction: 'WIDENED',
        tradeSide: trade.side,
      },
      source: 'literature',
      citation: 'Kahneman & Tversky (1979); Shefrin & Statman (1985)',
    });
  }
  return events;
};

/**
 * STOP_PARTIAL_SIZING — soma de qty dos stops < trade.qty.
 * Fonte: Shefrin & Statman 1985; Odean 1998.
 */
const detectPartialSizing = (trade, orders) => {
  if (trade.qty == null || trade.qty <= 0) return [];

  const stops = ordersForTrade(orders, trade.id).filter(o => o.isStopOrder === true);
  if (!stops.length) return [];

  const totalStopQty = stops.reduce((sum, s) => sum + (s.quantity ?? s.qty ?? 0), 0);
  if (totalStopQty <= 0) return [];
  if (totalStopQty >= trade.qty) return [];

  return [{
    type: EVENT_TYPES.STOP_PARTIAL_SIZING,
    severity: EVENT_SEVERITY.HIGH,
    tradeId: trade.id,
    orderIds: stops.map(s => s.externalOrderId).filter(Boolean),
    timestamp: stops[0].submittedAt ?? null,
    evidence: {
      tradeQty: trade.qty,
      stopQty: totalStopQty,
      ratio: Math.round((totalStopQty / trade.qty) * 100) / 100,
    },
    source: 'literature',
    citation: 'Shefrin & Statman (1985); Odean (1998)',
  }];
};

/**
 * RAPID_REENTRY_POST_STOP — entry mesmo side <10min após exit em LOSS,
 * mesmo instrument. Loss-chasing operacional independente de stop literal.
 * Fonte: Coval & Shumway 2005; Locke & Mann 2005.
 */
const detectRapidReentry = (trades, _orders, config) => {
  const sorted = [...trades]
    .map(t => ({ ...t, _entry: toMs(t.entryTime), _exit: toMs(t.exitTime) }))
    .filter(t => t._entry != null)
    .sort((a, b) => a._entry - b._entry);

  const events = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev._exit) continue;
    if (curr.side !== prev.side) continue;
    if (!sameInstrument(curr.ticker, prev.ticker)) continue;
    const gap = curr._entry - prev._exit;
    if (gap <= 0 || gap >= config.rapidReentryWindowMs) continue;
    if (!tradeClosedInLoss(prev)) continue;

    events.push({
      type: EVENT_TYPES.RAPID_REENTRY_POST_STOP,
      severity: EVENT_SEVERITY.MEDIUM,
      tradeId: curr.id,
      orderIds: [],
      timestamp: curr.entryTime ?? null,
      evidence: {
        prevTradeId: prev.id,
        prevResult: prev.result,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        side: curr.side,
        instrument: curr.ticker,
      },
      source: 'literature',
      citation: 'Coval & Shumway (2005); Locke & Mann (2005)',
    });
  }
  return events;
};

/**
 * HESITATION_PRE_ENTRY — order CANCELLED mesmo side+instrument seguida de
 * FILLED do mesmo side em <30min, sem fill da própria cancel.
 * Fonte: heurística operacional (extrapolação de literatura, sem paper direto).
 */
const detectHesitation = (trade, orders, config) => {
  const tradeOrders = ordersForTrade(orders, trade.id);
  if (!tradeOrders.length) return [];

  const entryFill = tradeOrders.find(o =>
    !o.isStopOrder &&
    (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') &&
    orderSideMatchesTradeSide(o.side, trade.side)
  );
  if (!entryFill) return [];
  const entryTs = toMs(entryFill.filledAt) ?? toMs(entryFill.submittedAt);
  if (!entryTs) return [];

  const cancelled = tradeOrders.filter(o =>
    o.status === 'CANCELLED' &&
    !o.isStopOrder &&
    orderSideMatchesTradeSide(o.side, trade.side) &&
    sameInstrument(o.instrument, trade.ticker)
  );
  if (!cancelled.length) return [];

  const events = [];
  for (const c of cancelled) {
    const cancelTs = toMs(c.cancelledAt) ?? toMs(c.submittedAt);
    if (!cancelTs) continue;
    const gap = entryTs - cancelTs;
    if (gap <= 0 || gap >= config.hesitationWindowMs) continue;

    events.push({
      type: EVENT_TYPES.HESITATION_PRE_ENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [c.externalOrderId, entryFill.externalOrderId].filter(Boolean),
      timestamp: c.cancelledAt ?? null,
      evidence: {
        cancelledAt: c.cancelledAt ?? null,
        filledAt: entryFill.filledAt ?? null,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        side: trade.side,
        instrument: trade.ticker,
      },
      source: 'heuristic',
      citation: null,
    });
  }
  return events;
};

/**
 * CHASE_REENTRY — re-submit no mesmo side com preço pior antes do fill final.
 * Detecta na sequência de orders correlacionadas ao trade: cancelled-then-resubmitted
 * com preço pior (BUY mais caro / SELL mais barato).
 * Fonte: Barber & Odean 2000 (overtrading agregado).
 */
const detectChaseReentry = (trade, orders) => {
  const tradeOrders = ordersForTrade(orders, trade.id)
    .filter(o => !o.isStopOrder && orderSideMatchesTradeSide(o.side, trade.side))
    .map(o => ({ ...o, _ts: toMs(o.submittedAt) ?? toMs(o.filledAt) ?? toMs(o.cancelledAt) }))
    .filter(o => o._ts != null)
    .sort((a, b) => a._ts - b._ts);

  if (tradeOrders.length < 2) return [];

  const events = [];
  for (let i = 1; i < tradeOrders.length; i++) {
    const prev = tradeOrders[i - 1];
    const curr = tradeOrders[i];
    if (prev.status !== 'CANCELLED') continue;
    if (curr.status !== 'FILLED' && curr.status !== 'PARTIALLY_FILLED' && curr.status !== 'WORKING') continue;
    const prevPrice = prev.price ?? null;
    const currPrice = curr.filledPrice ?? curr.price ?? null;
    if (!isPriceWorse(curr.side, prevPrice, currPrice)) continue;

    events.push({
      type: EVENT_TYPES.CHASE_REENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt ?? curr.filledAt ?? null,
      evidence: {
        side: curr.side,
        prevPrice,
        currPrice,
        worseBy: Math.round(Math.abs(currPrice - prevPrice) * 100) / 100,
      },
      source: 'heuristic',
      citation: 'Barber & Odean (2000) — agregado',
    });
  }
  return events;
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Detecta eventos comportamentais de execução.
 *
 * @param {{trades: Object[], orders: Object[], config?: Object}} input
 * @returns {Array<{type, severity, tradeId?, orderIds, timestamp, evidence, source, citation}>}
 */
export const detectExecutionEvents = ({ trades = [], orders = [], config = {} } = {}) => {
  if (!trades.length || !orders.length) return [];

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const events = [];

  for (const trade of trades) {
    if (!trade?.id) continue;
    events.push(...detectStopTampering(trade, orders));
    events.push(...detectPartialSizing(trade, orders));
    events.push(...detectHesitation(trade, orders, cfg));
    events.push(...detectChaseReentry(trade, orders));
  }

  events.push(...detectRapidReentry(trades, orders, cfg));

  events.sort((a, b) => {
    const ta = toMs(a.timestamp) ?? 0;
    const tb = toMs(b.timestamp) ?? 0;
    return ta - tb;
  });

  return events;
};
