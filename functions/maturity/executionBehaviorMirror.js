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
//   HESITATION_PRE_ENTRY, RECONSIDERATION_PRE_ENTRY, ABORTED_ATTEMPT_POST_TRADE (#369),
//   CHASE_REENTRY,
//   STOP_BREAKEVEN_TOO_EARLY, STOP_HESITATION (issue #229)

const EVENT_TYPES = Object.freeze({
  STOP_TAMPERING: 'STOP_TAMPERING',
  STOP_PARTIAL_SIZING: 'STOP_PARTIAL_SIZING',
  RISK_OVER_RO: 'RISK_OVER_RO',
  UNPROTECTED_SIZE: 'UNPROTECTED_SIZE',
  SIZING_DISCIPLINE: 'SIZING_DISCIPLINE',
  RAPID_REENTRY_POST_STOP: 'RAPID_REENTRY_POST_STOP',
  HESITATION_PRE_ENTRY: 'HESITATION_PRE_ENTRY',
  // #369 — ordens que não viraram posição, lidas pelo tempo até o trade vizinho
  RECONSIDERATION_PRE_ENTRY: 'RECONSIDERATION_PRE_ENTRY',
  ABORTED_ATTEMPT_POST_TRADE: 'ABORTED_ATTEMPT_POST_TRADE',
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
  triggerHesitationMs: 5 * 60 * 1000,          // #369
  reconsiderationWindowMs: 2 * 60 * 60 * 1000, // #369
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

/** Sufixo de fuso num ISO: 'Z' ou '+HH:MM' / '-HHMM'. */
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/** Offset gravado no trade (#285/#292 — entryTime/exitTime são ISO+offset). */
function tradeOffsetOf(trade) {
  const cands = [trade && trade.entryTime, trade && trade.exitTime];
  for (let i = 0; i < cands.length; i++) {
    const v = cands[i];
    if (typeof v !== 'string') continue;
    const m = v.match(OFFSET_RE);
    if (m) return m[1] === 'Z' ? '+00:00' : m[1];
  }
  return null;
}

/**
 * Instante de ordem no FUSO DO TRADE (#375). `orders` guarda ingênuo, `trades` guarda
 * com offset; esta CF roda em UTC, então sem isto a ordem sai 3h antes do trade dela e
 * `liveStopsAt` descarta toda proteção. Espelho de `executionBehaviorEngine.orderMs`.
 */
function orderMs(value, offset) {
  if (typeof value === 'string' && offset && value && !OFFSET_RE.test(value)) {
    return toMs(value + offset);
  }
  return toMs(value);
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
  const off = tradeOffsetOf(trade);
  const cand = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.side === wanted && o.isStopOrder !== true; })
    .map(function (o) {
      const ts = orderMs(o.filledAt, off) != null ? orderMs(o.filledAt, off) : (orderMs(o.submittedAt, off) != null ? orderMs(o.submittedAt, off) : 0);
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
  const off = tradeOffsetOf(trade);

  const legs = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.side === opposite; })
    .map(function (o) {
      const raw = o.stopPrice != null ? o.stopPrice : (o.limitPrice != null ? o.limitPrice : o.price);
      return Object.assign({}, o, {
        _ts: orderMs(o.submittedAt, off) != null ? orderMs(o.submittedAt, off) : (orderMs(o.cancelledAt, off) != null ? orderMs(o.cancelledAt, off) : orderMs(o.filledAt, off)),
        _cancelTs: orderMs(o.cancelledAt, off),
        _isRealStop: o.isStopOrder === true || o.stopPrice != null,
        _price: parseFloat(o.stopPrice || o.limitPrice || o.price || NaN),
        // #371 — classifica pelo enviado, mede pelo executado quando houve execução.
        _riskPrice: parseFloat(
          ((o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && o.filledPrice != null)
            ? o.filledPrice
            : (o.stopPrice || o.limitPrice || o.price || NaN),
        ),
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
    const price = st._riskPrice != null ? st._riskPrice : (st._price != null ? st._price : (st.stopPrice != null ? st.stopPrice : (st.price != null ? st.price : null)));
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

/**
 * #376 — padrão POSITIVO não é concedido a trade que quebrou o plano.
 * Espelho de src/utils/executionBehaviorEngine.js; ver a nota longa lá.
 *
 * O detector lê o risco pelas ordens de stop VIVAS e o compliance pelo stop DECLARADO
 * na entrada. No trade WINV26 de +R$ 610 isso produzia "risco excede o máximo do plano"
 * e "o risco continuou dentro do RO" no mesmo card. A violação mora no risco TOMADO
 * (#373).
 */
const REVOKED_RED_FLAG_TYPES = require('./violationFilter').REVOKED_RED_FLAG_TYPES;

function quebrouPlano(trade) {
  if (!trade) return false;
  const limpas = (trade.mentorClearedViolations || []).map(function (x) {
    return typeof x === 'string' ? x : (x && x.type);
  });
  const vigentes = (trade.redFlags || [])
    .map(function (f) { return typeof f === 'string' ? f : (f && f.type); })
    .filter(function (tipo) {
      return tipo && REVOKED_RED_FLAG_TYPES.indexOf(tipo) === -1 && limpas.indexOf(tipo) === -1;
    });
  if (vigentes.length > 0) return true;
  return !!(trade.compliance && trade.compliance.roStatus === 'FORA_DO_PLANO');
}

/** SIZING_DISCIPLINE — positivo (#357). Aumentou posição e manteve o risco no RO. */
function detectSizingDiscipline(trade, orders) {
  if (quebrouPlano(trade)) return [];
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

/** Espelho de REPLACEMENT_TOLERANCE_MS (#375) — 20s, definido por Marcio em 21/08/2026. */
const REPLACEMENT_TOLERANCE_MS = 20000;

/** Espelho de `protectionTimeline` (#375). Ver doc na fonte ESM. */
function protectionTimeline(trade, orders) {
  const vazio = {
    windows: [], totalNakedMs: 0, positionMs: 0, nakedRatio: null,
    neverProtected: false, addedWhileNaked: false, legs: [], replacements: [],
  };
  const tradeQty = Number((trade && trade.qty) || 0);
  if (!isFinite(tradeQty) || tradeQty <= 0) return vazio;

  const all = ordersForTrade(orders, trade.id);
  if (!all.length) return vazio;

  const off = tradeOffsetOf(trade);
  const legs = protectiveLegsOf(trade, orders);
  const entradaSide = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const legIds = {};
  legs.forEach(function (l) { if (l.externalOrderId) legIds[l.externalOrderId] = true; });

  const fills = all
    .filter(function (o) {
      return (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
        && !(o.externalOrderId && legIds[o.externalOrderId]);
    })
    .map(function (o) {
      const ts = orderMs(o.filledAt, off) != null ? orderMs(o.filledAt, off) : orderMs(o.submittedAt, off);
      const qty = Number(o.filledQuantity != null ? o.filledQuantity : (o.quantity != null ? o.quantity : 0));
      return { ts: ts, qty: qty, entrada: o.side === entradaSide };
    })
    .filter(function (f) { return f.ts != null && isFinite(f.qty) && f.qty > 0; });

  if (!fills.length && !legs.length) return vazio;

  const abreTs = toMs(trade.entryTime);
  const fechaTs = toMs(trade.exitTime);
  const entradas = fills.filter(function (f) { return f.entrada; });
  if (!entradas.length) {
    if (abreTs == null) return vazio;
    fills.length = 0;
    fills.push({ ts: abreTs, qty: tradeQty, entrada: true });
    if (fechaTs != null) fills.push({ ts: fechaTs, qty: tradeQty, entrada: false });
  }

  const tsEntradas = fills.filter(function (f) { return f.entrada; }).map(function (f) { return f.ts; });
  const inicioPos = Math.min.apply(null, tsEntradas);
  const fimPos = fechaTs != null ? fechaTs : Math.max.apply(null, fills.map(function (f) { return f.ts; }));

  const eventos = [];
  fills.forEach(function (f) {
    eventos.push({ ts: f.ts, dAberto: f.entrada ? f.qty : -f.qty, dCoberto: 0 });
  });
  legs.forEach(function (l) {
    const qty = Number(l.quantity != null ? l.quantity : (l.qty != null ? l.qty : 0));
    if (!isFinite(qty) || qty <= 0) return;
    const inicioEnvio = orderMs(l.submittedAt, off);
    const inicio = inicioEnvio != null ? inicioEnvio : inicioPos;
    const fillTs = (l.status === 'FILLED' || l.status === 'PARTIALLY_FILLED')
      ? (orderMs(l.filledAt, off) != null ? orderMs(l.filledAt, off) : orderMs(l.submittedAt, off))
      : null;
    const fim = l._cancelTs != null ? l._cancelTs : fillTs;
    eventos.push({ ts: inicio, dAberto: 0, dCoberto: qty });
    if (fim != null) eventos.push({ ts: fim, dAberto: 0, dCoberto: -qty });
    if (fillTs != null) {
      const executada = Number(l.filledQuantity != null ? l.filledQuantity : (l.quantity != null ? l.quantity : qty));
      eventos.push({ ts: fillTs, dAberto: -executada, dCoberto: 0 });
    }
  });
  eventos.sort(function (a, b) { return a.ts - b.ts; });

  const instantes = [];
  let aberto = 0;
  let coberto = 0;
  for (let i = 0; i < eventos.length; i++) {
    const ts = eventos[i].ts;
    aberto += eventos[i].dAberto;
    coberto += eventos[i].dCoberto;
    while (i + 1 < eventos.length && eventos[i + 1].ts === ts) {
      i++;
      aberto += eventos[i].dAberto;
      coberto += eventos[i].dCoberto;
    }
    const nu = Math.max(0, Math.round((aberto - Math.min(coberto, aberto)) * 100) / 100);
    instantes.push({ ts: ts, nu: nu });
  }

  const brutas = [];
  for (let k = 0; k < instantes.length; k++) {
    const ts = instantes[k].ts;
    const nu = instantes[k].nu;
    if (nu <= 0) continue;
    const fimTrecho = k + 1 < instantes.length ? instantes[k + 1].ts : fimPos;
    if (fimTrecho <= ts) continue;
    const ant = brutas[brutas.length - 1];
    if (ant && ant.contracts === nu && ant.endTs === ts) {
      ant.endTs = fimTrecho;
      ant.durationMs = fimTrecho - ant.startTs;
    } else {
      brutas.push({ startTs: ts, endTs: fimTrecho, durationMs: fimTrecho - ts, contracts: nu });
    }
  }

  const windows = brutas.filter(function (w) { return w.durationMs > REPLACEMENT_TOLERANCE_MS; });
  let totalNakedMs = 0;
  windows.forEach(function (w) { totalNakedMs += w.durationMs; });
  const positionMs = Math.max(0, fimPos - inicioPos);

  const replacements = [];
  const entryRef = entryRefOf(trade, orders);
  legs.forEach(function (morta) {
    if (morta._cancelTs == null) return;
    let nova = null;
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (l === morta || l._ts == null) continue;
      if (l._ts >= morta._cancelTs - REPLACEMENT_TOLERANCE_MS && l._ts <= morta._cancelTs + REPLACEMENT_TOLERANCE_MS) {
        nova = l;
        break;
      }
    }
    if (!nova) return;
    const antes = Math.abs(morta._price - entryRef);
    const depois = Math.abs(nova._price - entryRef);
    replacements.push({
      fromOrderId: morta.externalOrderId || null,
      toOrderId: nova.externalOrderId || null,
      fromPrice: morta._price,
      toPrice: nova._price,
      ts: morta._cancelTs,
      direction: depois < antes ? 'TIGHTENED' : (depois > antes ? 'WIDENED' : 'UNCHANGED'),
    });
  });

  const addedWhileNaked = windows.some(function (w) {
    return fills.some(function (f) {
      return f.entrada && f.ts > w.startTs && (w.endTs == null || f.ts <= w.endTs);
    });
  });

  return {
    windows: windows,
    totalNakedMs: totalNakedMs,
    positionMs: positionMs,
    nakedRatio: positionMs > 0 ? Math.round((totalNakedMs / positionMs) * 100) / 100 : null,
    neverProtected: legs.length === 0,
    addedWhileNaked: addedWhileNaked,
    legs: legs,
    replacements: replacements,
  };
}

function detectUnprotectedSize(trade, orders) {
  const tradeQty = Number((trade && trade.qty) || 0);
  if (!isFinite(tradeQty) || tradeQty <= 0) return [];

  const all = ordersForTrade(orders, trade.id);
  if (!all.length) return [];

  // #375 — tempo nu, não foto da saída. Espelho da fonte ESM.
  const tl = protectionTimeline(trade, orders);
  if (!tl.windows.length) return [];

  let maior = tl.windows[0];
  tl.windows.forEach(function (w) { if (w.durationMs > maior.durationMs) maior = w; });
  const uncoveredQty = maior.contracts;
  const coveredQty = Math.max(0, Math.round((tradeQty - uncoveredQty) * 100) / 100);

  const fimPosTs = toMs(trade.exitTime);
  const nuAteASaida = fimPosTs != null && tl.windows.some(function (w) {
    return w.endTs != null && w.endTs >= fimPosTs - REPLACEMENT_TOLERANCE_MS;
  });
  const proporcaoAlta = tl.nakedRatio != null && tl.nakedRatio >= 0.5;
  const severity = (tl.neverProtected || nuAteASaida || proporcaoAlta)
    ? EVENT_SEVERITY.HIGH : EVENT_SEVERITY.MEDIUM;
  // Espelho: só quem RETIROU a proteção carrega emoção. Entrar nu é processo.
  const abertaPorRetirada = tl.windows.some(function (w) {
    return tl.legs.some(function (l) {
      return l._cancelTs != null && Math.abs(l._cancelTs - w.startTs) <= REPLACEMENT_TOLERANCE_MS;
    });
  });
  const emotionMapping = !abertaPorRetirada ? null : (tl.addedWhileNaked ? 'DENIAL' : 'HOPE');

  return [{
    type: EVENT_TYPES.UNPROTECTED_SIZE,
    severity: severity,
    tradeId: trade.id,
    orderIds: tl.legs.map(function (s) { return s.externalOrderId; }).filter(Boolean),
    timestamp: trade.entryTime || null,
    evidence: {
      tradeQty: tradeQty,
      coveredQty: coveredQty,
      uncoveredQty: uncoveredQty,
      hasAnyStop: !tl.neverProtected,
      neverProtected: tl.neverProtected,
      ratio: Math.round((coveredQty / tradeQty) * 100) / 100,
      nakedMs: tl.totalNakedMs,
      nakedSeconds: Math.round(tl.totalNakedMs / 1000),
      nakedRatio: tl.nakedRatio,
      windowCount: tl.windows.length,
      longestWindowMs: maior.durationMs,
      positionMs: tl.positionMs,
      addedWhileNaked: tl.addedWhileNaked,
      replacements: tl.replacements.length,
      emotionMapping: emotionMapping,
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
  const offH = tradeOffsetOf(trade);
  const entryTs = orderMs(entryFill.filledAt, offH) || orderMs(entryFill.submittedAt, offH);
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
    const cancelTs = orderMs(c.cancelledAt, offH) || orderMs(c.submittedAt, offH);
    if (!cancelTs) continue;
    const gap = entryTs - cancelTs;
    if (gap <= 0) continue;

    // #369 — meia hora depois não é indecisão, é decisão. A faixa longa não pontua.
    if (gap >= config.hesitationWindowMs) {
      if (gap >= config.reconsiderationWindowMs) continue;
      events.push({
        type: EVENT_TYPES.RECONSIDERATION_PRE_ENTRY,
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
          pattern: 'RECONSIDERATION',
        },
        source: 'heuristic',
        citation: null,
      });
      continue;
    }

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
        pattern: gap <= config.triggerHesitationMs ? 'TRIGGER' : 'HESITATION',
      },
      source: 'heuristic',
      citation: null,
    });
  }
  return events;
}

/**
 * ABORTED_ATTEMPT_POST_TRADE — ordem montada e desmontada DEPOIS do trade fechar (#369).
 * Espelho de `detectAbortedAttempt` em src/utils/executionBehaviorEngine.js.
 */
function detectAbortedAttempt(trade, orders) {
  const offA = tradeOffsetOf(trade);
  const exitTs = toMs(trade.exitTime) || toMs(trade.closedAt);
  if (!exitTs) return [];

  const cancelled = ordersForTrade(orders, trade.id).filter(function (o) {
    return o.status === 'CANCELLED' &&
           !o.isStopOrder &&
           sameInstrument(o.instrument, trade.ticker);
  });
  if (!cancelled.length) return [];

  const afterLoss = typeof trade.result === 'number' && trade.result < 0;
  const events = [];

  for (const c of cancelled) {
    const submittedTs = orderMs(c.submittedAt, offA) || orderMs(c.cancelledAt, offA);
    if (!submittedTs || submittedTs <= exitTs) continue;

    const gap = submittedTs - exitTs;
    events.push({
      type: EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE,
      severity: afterLoss ? EVENT_SEVERITY.MEDIUM : EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [c.externalOrderId].filter(Boolean),
      timestamp: c.cancelledAt || c.submittedAt || null,
      evidence: {
        submittedAt: c.submittedAt || null,
        cancelledAt: c.cancelledAt || null,
        tradeExitTime: trade.exitTime || null,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        qty: c.quantity != null ? c.quantity : null,
        side: c.side || null,
        instrument: trade.ticker,
        afterLoss: afterLoss,
      },
      source: 'heuristic',
      citation: null,
    });
  }
  return events;
}

function detectChaseReentry(trade, orders) {
  const offC = tradeOffsetOf(trade);
  const tradeOrders = ordersForTrade(orders, trade.id)
    .filter(function (o) {
      return !o.isStopOrder && orderSideMatchesTradeSide(o.side, trade.side);
    })
    .map(function (o) {
      return Object.assign({}, o, {
        _ts: orderMs(o.submittedAt, offC) || orderMs(o.filledAt, offC) || orderMs(o.cancelledAt, offC),
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

  const offB = tradeOffsetOf(trade);
  const stops = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.isStopOrder === true; })
    .map(function (o) {
      return Object.assign({}, o, {
        _ts: orderMs(o.submittedAt, offB) || orderMs(o.cancelledAt, offB) || orderMs(o.filledAt, offB),
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
  const offSH = tradeOffsetOf(trade);
  const entryPrice = (trade && (trade.entry != null ? trade.entry : trade.entryPrice)) != null
    ? (trade.entry != null ? trade.entry : trade.entryPrice) : null;
  const stops = ordersForTrade(orders, trade.id)
    .filter(function (o) { return o.isStopOrder === true; })
    .map(function (o) {
      return Object.assign({}, o, {
        _ts: orderMs(o.submittedAt, offSH) || orderMs(o.cancelledAt, offSH) || orderMs(o.filledAt, offSH),
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
    events.push.apply(events, detectAbortedAttempt(trade, orders));
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
  protectionTimeline: protectionTimeline,
  REPLACEMENT_TOLERANCE_MS: REPLACEMENT_TOLERANCE_MS,
  EVENT_TYPES: EVENT_TYPES,
  EVENT_SEVERITY: EVENT_SEVERITY,
};
