// ============================================
// EXECUTION BEHAVIOR MIRROR (CommonJS)
// ============================================
//
// Mirror determinístico de `src/utils/executionBehaviorEngine.js` (ESM) — issue #208.
// Consome trades + orders e emite eventos comportamentais para alimentar maturidade
// (gates 3→4) e engine emocional V2 server-side.
//
// Paridade obrigatória com o source ESM: qualquer mudança aqui exige refletir
// `src/utils/executionBehaviorEngine.js` e vice-versa. Teste de paridade em
// `src/__tests__/functions/maturity/executionBehaviorMirror.parity.test.js`.
//
// Detectores espelhados:
//   STOP_TAMPERING, STOP_PARTIAL_SIZING, RAPID_REENTRY_POST_STOP,
//   HESITATION_PRE_ENTRY, CHASE_REENTRY

const EVENT_TYPES = Object.freeze({
  STOP_TAMPERING: 'STOP_TAMPERING',
  STOP_PARTIAL_SIZING: 'STOP_PARTIAL_SIZING',
  RAPID_REENTRY_POST_STOP: 'RAPID_REENTRY_POST_STOP',
  HESITATION_PRE_ENTRY: 'HESITATION_PRE_ENTRY',
  CHASE_REENTRY: 'CHASE_REENTRY',
});

const EVENT_SEVERITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

const DEFAULT_CONFIG = Object.freeze({
  hesitationWindowMs: 30 * 60 * 1000,
  rapidReentryWindowMs: 10 * 60 * 1000,
  partialSizingTolerance: 0,
});

function toMs(value) {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function sameInstrument(a, b) {
  const ax = (a || '').toUpperCase();
  const bx = (b || '').toUpperCase();
  return ax !== '' && ax === bx;
}

function orderSideMatchesTradeSide(orderSide, tradeSide) {
  if (!orderSide || !tradeSide) return false;
  return (orderSide === 'BUY' && tradeSide === 'LONG') ||
         (orderSide === 'SELL' && tradeSide === 'SHORT');
}

function isStopWidened(tradeSide, prevPrice, currPrice) {
  if (!tradeSide || !prevPrice || !currPrice) return false;
  if (tradeSide === 'LONG') return currPrice < prevPrice;
  if (tradeSide === 'SHORT') return currPrice > prevPrice;
  return false;
}

function isPriceWorse(orderSide, prevPrice, currPrice) {
  if (!orderSide || !prevPrice || !currPrice) return false;
  if (orderSide === 'BUY') return currPrice > prevPrice;
  if (orderSide === 'SELL') return currPrice < prevPrice;
  return false;
}

function ordersForTrade(orders, tradeId) {
  return orders.filter(function (o) { return o.correlatedTradeId === tradeId; });
}

// Trade fechou em loss? Gatilho comportamental do RAPID_REENTRY (Coval&Shumway 2005).
function tradeClosedInLoss(trade) {
  return trade && typeof trade.result === 'number' && trade.result < 0;
}

function detectStopTampering(trade, orders) {
  const stops = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.isStopOrder === true; })
    .map(function (o) {
      return Object.assign({}, o, {
        _ts: toMs(o.submittedAt) || toMs(o.cancelledAt) || toMs(o.filledAt),
        _price: o.stopPrice != null ? o.stopPrice : (o.price != null ? o.price : null),
      });
    })
    .filter(function (o) { return o._ts != null && o._price != null; })
    .sort(function (a, b) { return a._ts - b._ts; });

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
      timestamp: curr.submittedAt || null,
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
}

function detectPartialSizing(trade, orders) {
  if (trade.qty == null || trade.qty <= 0) return [];

  const stops = ordersForTrade(orders, trade.id).filter(function (o) {
    return o.isStopOrder === true;
  });
  if (!stops.length) return [];

  const totalStopQty = stops.reduce(function (sum, s) {
    return sum + (s.quantity != null ? s.quantity : (s.qty != null ? s.qty : 0));
  }, 0);
  if (totalStopQty <= 0) return [];
  if (totalStopQty >= trade.qty) return [];

  return [{
    type: EVENT_TYPES.STOP_PARTIAL_SIZING,
    severity: EVENT_SEVERITY.HIGH,
    tradeId: trade.id,
    orderIds: stops.map(function (s) { return s.externalOrderId; }).filter(Boolean),
    timestamp: stops[0].submittedAt || null,
    evidence: {
      tradeQty: trade.qty,
      stopQty: totalStopQty,
      ratio: Math.round((totalStopQty / trade.qty) * 100) / 100,
    },
    source: 'literature',
    citation: 'Shefrin & Statman (1985); Odean (1998)',
  }];
}

function detectRapidReentry(trades, _orders, config) {
  const sorted = trades.slice()
    .map(function (t) {
      return Object.assign({}, t, {
        _entry: toMs(t.entryTime),
        _exit: toMs(t.exitTime),
      });
    })
    .filter(function (t) { return t._entry != null; })
    .sort(function (a, b) { return a._entry - b._entry; });

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
      timestamp: curr.entryTime || null,
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
}

function detectHesitation(trade, orders, config) {
  const tradeOrders = ordersForTrade(orders, trade.id);
  if (!tradeOrders.length) return [];

  const entryFill = tradeOrders.find(function (o) {
    return !o.isStopOrder &&
           (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') &&
           orderSideMatchesTradeSide(o.side, trade.side);
  });
  if (!entryFill) return [];
  const entryTs = toMs(entryFill.filledAt) || toMs(entryFill.submittedAt);
  if (!entryTs) return [];

  const cancelled = tradeOrders.filter(function (o) {
    return o.status === 'CANCELLED' &&
           !o.isStopOrder &&
           orderSideMatchesTradeSide(o.side, trade.side) &&
           sameInstrument(o.instrument, trade.ticker);
  });
  if (!cancelled.length) return [];

  const events = [];
  for (const c of cancelled) {
    const cancelTs = toMs(c.cancelledAt) || toMs(c.submittedAt);
    if (!cancelTs) continue;
    const gap = entryTs - cancelTs;
    if (gap <= 0 || gap >= config.hesitationWindowMs) continue;

    events.push({
      type: EVENT_TYPES.HESITATION_PRE_ENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [c.externalOrderId, entryFill.externalOrderId].filter(Boolean),
      timestamp: c.cancelledAt || null,
      evidence: {
        cancelledAt: c.cancelledAt || null,
        filledAt: entryFill.filledAt || null,
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
}

function detectChaseReentry(trade, orders) {
  const tradeOrders = ordersForTrade(orders, trade.id)
    .filter(function (o) {
      return !o.isStopOrder && orderSideMatchesTradeSide(o.side, trade.side);
    })
    .map(function (o) {
      return Object.assign({}, o, {
        _ts: toMs(o.submittedAt) || toMs(o.filledAt) || toMs(o.cancelledAt),
      });
    })
    .filter(function (o) { return o._ts != null; })
    .sort(function (a, b) { return a._ts - b._ts; });

  if (tradeOrders.length < 2) return [];

  const events = [];
  for (let i = 1; i < tradeOrders.length; i++) {
    const prev = tradeOrders[i - 1];
    const curr = tradeOrders[i];
    if (prev.status !== 'CANCELLED') continue;
    if (curr.status !== 'FILLED' && curr.status !== 'PARTIALLY_FILLED' && curr.status !== 'WORKING') continue;
    const prevPrice = prev.price != null ? prev.price : null;
    const currPrice = curr.filledPrice != null ? curr.filledPrice : (curr.price != null ? curr.price : null);
    if (!isPriceWorse(curr.side, prevPrice, currPrice)) continue;

    events.push({
      type: EVENT_TYPES.CHASE_REENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt || curr.filledAt || null,
      evidence: {
        side: curr.side,
        prevPrice: prevPrice,
        currPrice: currPrice,
        worseBy: Math.round(Math.abs(currPrice - prevPrice) * 100) / 100,
      },
      source: 'heuristic',
      citation: 'Barber & Odean (2000) — agregado',
    });
  }
  return events;
}

function detectExecutionEvents(input) {
  const _input = input || {};
  const trades = _input.trades || [];
  const orders = _input.orders || [];
  const config = _input.config || {};

  if (!trades.length || !orders.length) return [];

  const cfg = Object.assign({}, DEFAULT_CONFIG, config);
  const events = [];

  for (const trade of trades) {
    if (!trade || !trade.id) continue;
    events.push.apply(events, detectStopTampering(trade, orders));
    events.push.apply(events, detectPartialSizing(trade, orders));
    events.push.apply(events, detectHesitation(trade, orders, cfg));
    events.push.apply(events, detectChaseReentry(trade, orders));
  }

  events.push.apply(events, detectRapidReentry(trades, orders, cfg));

  events.sort(function (a, b) {
    const ta = toMs(a.timestamp) || 0;
    const tb = toMs(b.timestamp) || 0;
    return ta - tb;
  });

  return events;
}

module.exports = {
  detectExecutionEvents: detectExecutionEvents,
  EVENT_TYPES: EVENT_TYPES,
  EVENT_SEVERITY: EVENT_SEVERITY,
};
