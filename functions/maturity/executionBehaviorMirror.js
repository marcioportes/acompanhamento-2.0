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
//   RISK_OVER_RO, UNPROTECTED_SIZE, SIZING_DISCIPLINE (issue #357 — substituem
//   STOP_TAMPERING e STOP_PARTIAL_SIZING), RAPID_REENTRY_POST_STOP,
//   HESITATION_PRE_ENTRY, CHASE_REENTRY,
//   STOP_BREAKEVEN_TOO_EARLY, STOP_HESITATION (issue #229)

const EVENT_TYPES = Object.freeze({
  STOP_TAMPERING: 'STOP_TAMPERING',
  STOP_PARTIAL_SIZING: 'STOP_PARTIAL_SIZING',
  RISK_OVER_RO: 'RISK_OVER_RO',
  UNPROTECTED_SIZE: 'UNPROTECTED_SIZE',
  SIZING_DISCIPLINE: 'SIZING_DISCIPLINE',
  RAPID_REENTRY_POST_STOP: 'RAPID_REENTRY_POST_STOP',
  HESITATION_PRE_ENTRY: 'HESITATION_PRE_ENTRY',
  CHASE_REENTRY: 'CHASE_REENTRY',
  STOP_BREAKEVEN_TOO_EARLY: 'STOP_BREAKEVEN_TOO_EARLY',
  STOP_HESITATION: 'STOP_HESITATION',
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
  breakevenWindowMs: 5 * 60 * 1000,
  hesitationMinReissues: 2,
  breakevenTolerancePctFallback: 0.0005,
});

// Tolerâncias por prefixo de ticker (DEC-AUTO-229-01) — paridade ESM↔CJS.
const INSTRUMENT_TOLERANCE = Object.freeze({
  WIN: 5,
  WDO: 0.5,
  IND: 5,
  MNQ: 0.25,
  MES: 0.25,
  NQ: 0.25,
  ES: 0.25,
});

function getInstrumentTolerance(ticker, entryPrice, fallbackPct) {
  if (typeof ticker === 'string' && ticker.length > 0) {
    var upper = ticker.toUpperCase();
    var sortedKeys = Object.keys(INSTRUMENT_TOLERANCE).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < sortedKeys.length; i++) {
      if (upper.indexOf(sortedKeys[i]) === 0) return INSTRUMENT_TOLERANCE[sortedKeys[i]];
    }
  }
  var pct = fallbackPct != null ? fallbackPct : 0.0005;
  return Math.max(0.01, (entryPrice || 0) * pct);
}

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

// ── RISCO FINANCEIRO vs RO (#357) ──────────────────────────────────────────
// Paridade com src/utils/executionBehaviorEngine.js.

function pointValueOf(trade) {
  const tr = trade && trade.tickerRule;
  if (!tr) return null;
  if (tr.tickSize && tr.tickValue) return tr.tickValue / tr.tickSize;
  return tr.pointValue == null ? null : tr.pointValue;
}

function roAmountOf(trade) {
  const pct = Number(trade && trade.planRoPct);
  const pl = Number(trade && trade.planPl);
  if (!isFinite(pct) || !isFinite(pl) || pct <= 0 || pl <= 0) return null;
  return (pct / 100) * pl;
}

/** Stops VIGENTES no fim da operação — exclui os substituídos (paridade com o ESM). */
const OCO_TOLERANCE_MS = 2000;

function liveStopsAt(trade, stops) {
  let refTs = toMs(trade && trade.exitTime);
  if (refTs == null) {
    refTs = 0;
    for (let i = 0; i < stops.length; i++) {
      const c = stops[i]._cancelTs != null ? stops[i]._cancelTs : (stops[i]._ts || 0);
      if (c > refTs) refTs = c;
    }
  }
  if (!refTs) return stops;
  return stops.filter(function (o) {
    return o._cancelTs == null || o._cancelTs >= refTs - OCO_TOLERANCE_MS;
  });
}

/** Referência de entrada: LIMITE original da 1ª entrada (DEC-AUTO-242-01). */
function entryRefOf(trade, orders) {
  const wanted = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const cand = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.side === wanted && o.isStopOrder !== true; })
    .map(function (o) {
      const ts = toMs(o.filledAt) != null ? toMs(o.filledAt) : (toMs(o.submittedAt) != null ? toMs(o.submittedAt) : 0);
      return { o: o, ts: ts };
    })
    .sort(function (a, b) { return a.ts - b.ts; })[0];
  const lim = cand
    ? (cand.o.limitPrice != null ? cand.o.limitPrice
      : (cand.o.price != null ? cand.o.price
        : (cand.o.filledPrice != null ? cand.o.filledPrice : null)))
    : null;
  const ref = lim != null ? parseFloat(lim) : parseFloat(trade.entry);
  return isFinite(ref) && ref > 0 ? ref : null;
}

/**
 * Pernas de PROTEÇÃO (paridade com o ESM). `isStopOrder` não basta: o bracket OCO
 * da Clear emite a proteção como Limite com `Preço Stop` vazio (#242). Critério:
 * lado oposto à posição + preço adverso à entrada. Deduplica cópias de reimportação.
 */
function protectiveLegsOf(trade, orders) {
  const entryRef = entryRefOf(trade, orders);
  if (entryRef == null || !trade.side) return [];
  const opposite = trade.side === 'LONG' ? 'SELL' : 'BUY';

  const legs = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.side === opposite; })
    .map(function (o) {
      const raw = o.stopPrice != null ? o.stopPrice : (o.limitPrice != null ? o.limitPrice : o.price);
      return Object.assign({}, o, {
        _ts: toMs(o.submittedAt) != null ? toMs(o.submittedAt) : (toMs(o.cancelledAt) != null ? toMs(o.cancelledAt) : toMs(o.filledAt)),
        _cancelTs: toMs(o.cancelledAt),
        _isRealStop: o.isStopOrder === true || o.stopPrice != null,
        _price: parseFloat(raw),
      });
    })
    .filter(function (o) { return isFinite(o._price); })
    .filter(function (o) {
      if (o._isRealStop) return true;
      return trade.side === 'LONG' ? o._price < entryRef : o._price > entryRef;
    });

  const seen = {};
  const out = [];
  for (let i = 0; i < legs.length; i++) {
    const o = legs[i];
    const key = o.side + '|' + o._price + '|' + (o.quantity != null ? o.quantity : o.qty) + '|' + o.submittedAt;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(o);
  }
  return out.sort(function (a, b) { return (a._ts || 0) - (b._ts || 0); });
}

function stopOrdersOf(trade, orders) {
  return protectiveLegsOf(trade, orders);
}

/** Risco dos stops composto POR PERNA — cada entrada pode trazer OCO próprio. */
function stopRiskBreakdown(trade, stops) {
  const pv = pointValueOf(trade);
  const entry = parseFloat(trade && trade.entry);
  if (!isFinite(pv) || pv <= 0 || !isFinite(entry) || entry <= 0) return null;
  if (!stops.length) return null;

  const legs = [];
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    const price = st._price != null ? st._price : (st.stopPrice != null ? st.stopPrice : (st.price != null ? st.price : null));
    const qty = Number(st.quantity != null ? st.quantity : (st.qty != null ? st.qty : 0));
    if (price == null || !isFinite(qty) || qty <= 0) continue;
    const adverse = trade.side === 'LONG' ? entry - Number(price) : Number(price) - entry;
    const distance = adverse > 0 ? adverse : 0;
    legs.push({
      stopPrice: Number(price),
      qty: qty,
      distancePoints: Math.round(distance * 100) / 100,
      riskAmount: Math.round(distance * pv * qty * 100) / 100,
    });
  }
  if (!legs.length) return null;
  let total = 0;
  for (let i = 0; i < legs.length; i++) total += legs[i].riskAmount;
  return { total: Math.round(total * 100) / 100, legs: legs };
}

/** RISK_OVER_RO — substitui STOP_TAMPERING (#357). Gatilho financeiro, não de preço. */
function detectRiskOverRo(trade, orders) {
  const ro = roAmountOf(trade);
  if (ro == null) return [];
  const stops = liveStopsAt(trade, stopOrdersOf(trade, orders));
  const breakdown = stopRiskBreakdown(trade, stops);
  if (!breakdown) return [];
  if (breakdown.total <= ro) return [];

  const pv = pointValueOf(trade);
  const qty = Number(trade.qty || 0);
  const maxDist = (pv && qty) ? Math.round((ro / (pv * qty)) * 100) / 100 : null;

  return [{
    type: EVENT_TYPES.RISK_OVER_RO,
    severity: EVENT_SEVERITY.HIGH,
    tradeId: trade.id,
    orderIds: stops.map(function (o) { return o.externalOrderId; }).filter(Boolean),
    timestamp: stops.length ? (stops[stops.length - 1].submittedAt || null) : null,
    evidence: {
      riskAmount: breakdown.total,
      roAmount: Math.round(ro * 100) / 100,
      excessAmount: Math.round((breakdown.total - ro) * 100) / 100,
      legs: breakdown.legs,
      maxDistancePoints: maxDist,
    },
    source: 'plan',
    citation: 'RO declarado no plano vigente',
  }];
}

/** SIZING_DISCIPLINE — positivo (#357). Aumentou posição e manteve o risco no RO. */
function detectSizingDiscipline(trade, orders) {
  const ro = roAmountOf(trade);
  if (ro == null) return [];
  const partials = (trade && trade._partials) || [];
  const entries = partials.filter(function (pp) { return pp && pp.type === 'ENTRY'; });
  if (entries.length < 2) return [];

  const stops = liveStopsAt(trade, stopOrdersOf(trade, orders));
  const breakdown = stopRiskBreakdown(trade, stops);
  if (!breakdown) return [];
  if (breakdown.total > ro) return [];

  let coveredQty = 0;
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    coveredQty += Number(st.quantity != null ? st.quantity : (st.qty != null ? st.qty : 0));
  }
  if (!(coveredQty >= Number(trade.qty || 0))) return [];

  return [{
    type: EVENT_TYPES.SIZING_DISCIPLINE,
    severity: null,
    tradeId: trade.id,
    orderIds: stops.map(function (o) { return o.externalOrderId; }).filter(Boolean),
    timestamp: trade.exitTime || trade.entryTime || null,
    evidence: {
      entryCount: entries.length,
      riskAmount: breakdown.total,
      roAmount: Math.round(ro * 100) / 100,
      legs: breakdown.legs,
    },
    source: 'plan',
    citation: 'RO declarado no plano vigente',
  }];
}

/** UNPROTECTED_SIZE — substitui STOP_PARTIAL_SIZING (#357). Cobre o caso de ZERO stops. */
function detectUnprotectedSize(trade, orders) {
  const tradeQty = Number((trade && trade.qty) || 0);
  if (!isFinite(tradeQty) || tradeQty <= 0) return [];

  const all = ordersForTrade(orders, trade.id);
  if (!all.length) return [];

  const stops = liveStopsAt(trade, protectiveLegsOf(trade, orders));
  let rawCovered = 0;
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    rawCovered += Number(st.quantity != null ? st.quantity : (st.qty != null ? st.qty : 0));
  }
  const coveredQty = Math.min(rawCovered, tradeQty);
  const uncoveredQty = Math.round((tradeQty - coveredQty) * 100) / 100;
  if (uncoveredQty <= 0) return [];

  return [{
    type: EVENT_TYPES.UNPROTECTED_SIZE,
    severity: EVENT_SEVERITY.HIGH,
    tradeId: trade.id,
    orderIds: stops.map(function (s) { return s.externalOrderId; }).filter(Boolean),
    timestamp: (stops.length && stops[0].submittedAt) || trade.entryTime || null,
    evidence: {
      tradeQty: tradeQty,
      coveredQty: coveredQty,
      uncoveredQty: uncoveredQty,
      hasAnyStop: stops.length > 0,
      rawCoveredQty: rawCovered,
      ratio: Math.round((coveredQty / tradeQty) * 100) / 100,
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

function detectStopBreakevenTooEarly(trade, orders, config) {
  const entryPrice = (trade && (trade.entry != null ? trade.entry : trade.entryPrice)) != null
    ? (trade.entry != null ? trade.entry : trade.entryPrice) : null;
  const entryTs = trade ? toMs(trade.entryTime) : null;
  if (!entryPrice || !entryTs) return [];

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

  const tolerance = getInstrumentTolerance(trade.ticker, entryPrice, config.breakevenTolerancePctFallback);
  const events = [];

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev._price === curr._price) continue;
    if (Math.abs(curr._price - entryPrice) > tolerance) continue;
    const dt = curr._ts - entryTs;
    if (dt < 0 || dt >= config.breakevenWindowMs) continue;

    events.push({
      type: EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY,
      severity: EVENT_SEVERITY.HIGH,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt || null,
      evidence: {
        from: prev._price,
        to: curr._price,
        entry: entryPrice,
        deltaToEntry: Math.round((curr._price - entryPrice) * 10000) / 10000,
        msSinceEntry: dt,
        minutesSinceEntry: Math.round((dt / 60000) * 10) / 10,
        side: trade.side,
        ticker: trade.ticker,
        tolerance: tolerance,
      },
      source: 'literature',
      citation: 'Kahneman & Tversky (1979); Heisler (1994)',
    });
  }
  return events;
}

function detectStopHesitation(trade, orders, config) {
  const entryPrice = (trade && (trade.entry != null ? trade.entry : trade.entryPrice)) != null
    ? (trade.entry != null ? trade.entry : trade.entryPrice) : null;
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

  if (stops.length < 1 + config.hesitationMinReissues) return [];

  const tolerance = getInstrumentTolerance(trade.ticker, entryPrice, config.breakevenTolerancePctFallback);
  let noOpReissues = 0;
  const involvedOrderIds = new Set();

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (Math.abs(prev._price - curr._price) > tolerance) continue;
    noOpReissues += 1;
    if (prev.externalOrderId) involvedOrderIds.add(prev.externalOrderId);
    if (curr.externalOrderId) involvedOrderIds.add(curr.externalOrderId);
  }

  if (noOpReissues < config.hesitationMinReissues) return [];

  return [{
    type: EVENT_TYPES.STOP_HESITATION,
    severity: EVENT_SEVERITY.LOW,
    tradeId: trade.id,
    orderIds: Array.from(involvedOrderIds),
    timestamp: stops[stops.length - 1].submittedAt || null,
    evidence: {
      stopCount: stops.length,
      noOpReissues: noOpReissues,
      stopPrice: stops[0]._price,
      ticker: trade.ticker,
      tolerance: tolerance,
    },
    source: 'heuristic',
    citation: 'Heisler (1994); Locke & Mann (2005)',
  }];
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
    events.push.apply(events, detectRiskOverRo(trade, orders));
    events.push.apply(events, detectUnprotectedSize(trade, orders));
    events.push.apply(events, detectSizingDiscipline(trade, orders));
    events.push.apply(events, detectHesitation(trade, orders, cfg));
    events.push.apply(events, detectChaseReentry(trade, orders));
    events.push.apply(events, detectStopBreakevenTooEarly(trade, orders, cfg));
    events.push.apply(events, detectStopHesitation(trade, orders, cfg));
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
