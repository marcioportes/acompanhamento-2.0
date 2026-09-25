/**
 * functions/shared/orderProtection.js
 * @version 1.0.0 (v1.92.10 — issue #466, épico #462 F3)
 * @description SSoT de "perna" e "proteção" de uma posição, lado servidor.
 *
 * Espelho CJS de `src/utils/orderProtection.js` — manter o CORPO IDÊNTICO (paridade
 * testada em `src/__tests__/functions/shared/orderProtectionMirror.test.js`). O porquê
 * de cada critério está documentado no corpo, que é o mesmo texto dos dois lados.
 *
 * Consumido por `functions/maturity/executionBehaviorMirror.js` (`protectiveLegsOf`).
 */
const { offsetOf, instantAtOffsetMs } = require('./orderInstant');

/** Janela do bracket: a proteção nasce junto com a perna (entrada ± 60s). */
const PROTECTION_WINDOW_MS = 60 * 1000;

/** Origem que nunca é proteção: a corretora já está fechando ou virando a posição. */
const EXCLUDED_ORIGIN_RE = /zerag|invers/i;

/** Origem de bracket (ProfitChart-Pro grava "Estratégia" nas pernas do OCO). */
const BRACKET_ORIGIN_RE = /estrat/i;

/** Motivo de uma perna sem stop comprovado — ou `COMPROVADO`. */
const LEG_STOP_REASON = Object.freeze({
  COMPROVADO: 'COMPROVADO',
  STOP_DE_GANHO: 'STOP_DE_GANHO',
  SEM_PROTECAO: 'SEM_PROTECAO',
  PROTECAO_PARCIAL: 'PROTECAO_PARCIAL',
});

const num = (v) => {
  if (v == null || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

const upper = (v) => String(v || '').trim().toUpperCase();

/** Ordem com gatilho de stop (tipo STOP/STOP_LIMIT ou `Preço Stop` preenchido). */
const temGatilho = (order) => !!order && (order.isStopOrder === true || order.stopPrice != null);

/**
 * Preço ENVIADO da ordem — onde a proteção estava, nunca onde executou (#371, #449).
 * `stopPrice` (gatilho) > `limitPrice` (limite enviado; o normalizer o preenche sempre,
 * porque sobrescreve `price` com o executado) > `price` (só para a forma crua do parser,
 * sem normalizar, em que `price` ainda é o enviado — mesma precedência de antes e do
 * harness do #463).
 * @returns {number|null}
 */
function sentPriceOf(order) {
  if (!order) return null;
  const candidatos = [order.stopPrice, order.limitPrice, order.price];
  for (let i = 0; i < candidatos.length; i++) {
    const v = num(candidatos[i]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/** Lado da ordem que protege a posição: LONG → SELL, SHORT → BUY. */
function protectionSideOf(positionSide) {
  if (positionSide === 'LONG') return 'SELL';
  if (positionSide === 'SHORT') return 'BUY';
  return null;
}

/** Preço adverso à referência: abaixo num LONG, acima num SHORT. Empate NÃO é adverso. */
function isAdversePrice(price, positionSide, ref) {
  if (!Number.isFinite(price) || !Number.isFinite(ref)) return false;
  if (positionSide === 'LONG') return price < ref;
  if (positionSide === 'SHORT') return price > ref;
  return false;
}

/**
 * Leitor de instante para as ordens de uma posição. `ctx.instant` (função) tem
 * precedência — é o leitor do lote na reconstrução. Sem ele, o offset explícito
 * (`ctx.offset`) ou o da própria posição (`entryTime` ISO+offset, #292).
 */
function instantReaderOf(position, ctx) {
  if (ctx && typeof ctx.instant === 'function') return ctx.instant;
  const off = (ctx && ctx.offset) || offsetOf(position && position.entryTime) || offsetOf(position && position.exitTime);
  return function (value) { return instantAtOffsetMs(value, off || null); };
}

/**
 * Pernas da posição: cada fill de entrada — ou grupo de fills no MESMO instante — com a
 * própria quantidade e o próprio preço executado, em ordem de tempo (nunca a do array).
 *
 * @param {Object} position — operação reconstruída (`entryOrders`, `side`) ou equivalente
 * @param {Object} [ctx] — { instant?: (v)=>ms, offset?: string }
 * @returns {Array<{ts:number, price:number, qty:number, orders:Object[]}>}
 */
function legsOf(position, ctx) {
  const instant = instantReaderOf(position, ctx);
  const fills = [];
  const entradas = (position && position.entryOrders) || [];
  for (let i = 0; i < entradas.length; i++) {
    const o = entradas[i];
    const ts = instant(o.filledAt || o.submittedAt);
    const price = num(o.filledPrice != null ? o.filledPrice : (o.avgFillPrice != null ? o.avgFillPrice : o.price));
    const qty = num(o.filledQuantity != null ? o.filledQuantity : o.quantity);
    if (ts == null || !Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) continue;
    fills.push({ ts: ts, price: price, qty: qty, order: o });
  }
  fills.sort(function (a, b) { return a.ts - b.ts || a.price - b.price; });

  const legs = [];
  for (let i = 0; i < fills.length; i++) {
    const f = fills[i];
    const ultima = legs[legs.length - 1];
    if (ultima && ultima.ts === f.ts) {
      const qty = ultima.qty + f.qty;
      ultima.price = Math.round(((ultima.price * ultima.qty + f.price * f.qty) / qty) * 1e6) / 1e6;
      ultima.qty = qty;
      ultima.orders.push(f.order);
    } else {
      legs.push({ ts: f.ts, price: f.price, qty: f.qty, orders: [f.order] });
    }
  }
  return legs;
}

/**
 * Critérios de proteção que não dependem do tempo nem do preço da perna.
 * Devolve o motivo da recusa, ou null quando a ordem passa.
 *
 *   - mesmo ativo (ordem sem ativo não é prova de "outro ativo" — passa);
 *   - lado oposto à posição;
 *   - origem não é Zeragem nem Inversão;
 *   - não é SAÍDA MANUAL: ordem LIMITE sem gatilho, enviada fora de estratégia
 *     (SuperDOM, Gráfico, Mobile). Limite de venda só executa DAQUI PARA CIMA (de compra,
 *     daqui para baixo): não segura a queda de um LONG — é saída pedida, não proteção.
 *     No caso do Italo de 18/08/2026, a venda limite a 169.915 enviada pelo Gráfico 9s
 *     depois de uma compra a 169.955 executou 29 min depois, no repique. O único limite
 *     adverso que É proteção é a perna de stop do bracket, que o ProfitChart-Pro exporta
 *     como "Limite" sem "Preço Stop" e com origem "Estratégia" (DEC-AUTO-242-01). Sem
 *     origem no dado (outras corretoras, e a collection `orders`, que não grava `origin`),
 *     o limite adverso continua valendo — não há como provar que foi manual;
 *   - tem preço enviado.
 */
function baseRejectionOf(order, position) {
  if (!order || !position) return 'SEM_DADOS';
  const inst = upper(order.instrument);
  const alvo = upper(position.instrument || position.ticker);
  if (inst && alvo && inst !== alvo) return 'OUTRO_ATIVO';
  if (order.side !== protectionSideOf(position.side)) return 'MESMO_LADO';
  const origem = String(order.origin || '');
  if (EXCLUDED_ORIGIN_RE.test(origem)) return 'ZERAGEM_OU_INVERSAO';
  if (!temGatilho(order) && origem && !BRACKET_ORIGIN_RE.test(origem)) return 'SAIDA_MANUAL';
  if (sentPriceOf(order) == null) return 'SEM_PRECO_ENVIADO';
  return null;
}

/**
 * A ordem cumpre os critérios de proteção DESTA perna, exceto o preço?
 * Tempo: enviada em [entrada − 60s, entrada + 60s] e não cancelada antes da entrada.
 * @returns {string|null} motivo da recusa, ou null
 */
function legRejectionOf(order, leg, position, ctx) {
  const base = baseRejectionOf(order, position);
  if (base) return base;
  const instant = instantReaderOf(position, ctx);
  const enviada = instant(order.submittedAt);
  if (enviada == null || Math.abs(enviada - leg.ts) > PROTECTION_WINDOW_MS) return 'FORA_DA_JANELA_DA_PERNA';
  const cancelada = instant(order.cancelledAt);
  if (cancelada != null && cancelada < leg.ts) return 'CANCELADA_ANTES_DA_ENTRADA';
  return null;
}

/** A ordem é proteção desta perna: todos os critérios + preço enviado adverso ao EXECUTADO da perna. */
function isProtectionOfLeg(order, leg, position, ctx) {
  if (legRejectionOf(order, leg, position, ctx)) return false;
  return isAdversePrice(sentPriceOf(order), position.side, leg.price);
}

/** Quantidade que a ordem protege; sem quantidade no dado, não há como limitar. */
const capacidadeDe = (order) => {
  const q = num(order && order.quantity);
  return Number.isFinite(q) && q > 0 ? q : Infinity;
};

/**
 * Stop inicial da perna: a proteção mais ANTIGA pelo instante de envio — nunca pela
 * posição no array (o "último da lista" seguia a ordem do arquivo, e importar e retomar
 * o staging davam stops diferentes).
 *
 * Sem proteção adversa, mas com ordem de gatilho do lado do ganho ou no empate → a perna
 * fica SEM stop comprovado (`STOP_DE_GANHO`, #455): o stop assumido na entrada não está no
 * arquivo, e o sistema não o inventa. Limite sem gatilho do lado do ganho é alvo — ignorado.
 *
 * `usado` (opcional, Map ordem → qtd já atribuída) impede que a MESMA ordem seja o stop de
 * mais contratos do que ela protege: com duas pernas a menos de 60s uma da outra, o bracket
 * da segunda cabia também na janela da primeira e protegia 10 contratos com uma ordem de 5
 * (Italo, 18/08/2026). Proteção adversa que não cobre a quantidade da perna →
 * `PROTECAO_PARCIAL`: a fórmula de risco multiplica pela quantidade da perna, e contrato
 * sem stop não tem risco comprovável.
 *
 * @returns {{stop:number|null, order:Object|null, reason:string}}
 */
function initialStopOfLeg(leg, orders, position, ctx, usado) {
  const instant = instantReaderOf(position, ctx);
  const elegiveis = [];
  const vistas = new Set();
  for (let i = 0; i < (orders || []).length; i++) {
    const o = orders[i];
    if (!o || vistas.has(o)) continue;
    vistas.add(o);
    if (legRejectionOf(o, leg, position, ctx)) continue;
    elegiveis.push({ o: o, ts: instant(o.submittedAt), price: sentPriceOf(o) });
  }
  elegiveis.sort(function (a, b) {
    if (a.ts !== b.ts) return a.ts - b.ts;
    const ia = String(a.o.externalOrderId || '');
    const ib = String(b.o.externalOrderId || '');
    if (ia !== ib) return ia < ib ? -1 : 1;
    return a.price - b.price;
  });
  let parcial = false;
  for (let i = 0; i < elegiveis.length; i++) {
    const e = elegiveis[i];
    if (!isAdversePrice(e.price, position.side, leg.price)) continue;
    const livre = capacidadeDe(e.o) - ((usado && usado.get(e.o)) || 0);
    if (livre < leg.qty) { parcial = true; continue; }
    if (usado) usado.set(e.o, ((usado.get(e.o)) || 0) + leg.qty);
    return { stop: e.price, order: e.o, reason: LEG_STOP_REASON.COMPROVADO };
  }
  if (parcial) return { stop: null, order: null, reason: LEG_STOP_REASON.PROTECAO_PARCIAL };
  const deGanho = elegiveis.some(function (e) { return temGatilho(e.o); });
  return {
    stop: null,
    order: null,
    reason: deGanho ? LEG_STOP_REASON.STOP_DE_GANHO : LEG_STOP_REASON.SEM_PROTECAO,
  };
}

/** Ordens da operação onde a proteção pode estar: stops associados + saídas executadas. */
function candidateOrdersOf(operation) {
  const out = [];
  const add = function (list) { for (let i = 0; i < (list || []).length; i++) if (out.indexOf(list[i]) === -1) out.push(list[i]); };
  add(operation && operation.stopOrders);
  add(operation && operation.exitOrders);
  return out;
}

/**
 * Stop do trade a partir das pernas (decisão do Marcio, 25/09/2026).
 *
 * Risco do trade = Σ |entrada da perna − stop da perna| × qtd da perna × valor do ponto.
 * Perna sem stop comprovado → o trade fica SEM stop (null) e o aluno informa (#455).
 *
 * Gravação sem campo novo (INV-15): `stopLoss` é o STOP EQUIVALENTE —
 *   médio de entrada ∓ Σ(risco da perna em pontos × qtd da perna) / qtd total
 * (abaixo do médio num LONG, acima num SHORT). A fórmula atual do compliance,
 * |entrada − stop| × qtd × valor do ponto, devolve então exatamente a soma. Com uma perna
 * só, o stop equivalente é o próprio stop. O detalhe por perna fica em `orders`.
 *
 * Ordens órfãs (atribuídas fora do intervalo da operação) vão para `cancelledOrders` e
 * não são candidatas; e nenhuma cabe na janela de uma perna.
 *
 * @param {Object} operation — operação reconstruída
 * @param {Object[]} [orders] — candidatas (default: `stopOrders` + `exitOrders`)
 * @param {Object} [ctx] — { instant?, offset?, pointValue? }
 * @returns {{stopLoss:number|null, riskPoints:number|null, riskAmount:number|null, legs:Array}}
 */
function tradeStopFromLegs(operation, orders, ctx) {
  const candidatas = orders || candidateOrdersOf(operation);
  const usado = new Map();
  const legs = legsOf(operation, ctx).map(function (leg) {
    const s = initialStopOfLeg(leg, candidatas, operation, ctx, usado);
    return { ts: leg.ts, price: leg.price, qty: leg.qty, orders: leg.orders, stop: s.stop, order: s.order, reason: s.reason };
  });
  const vazio = { stopLoss: null, riskPoints: null, riskAmount: null, legs: legs };
  if (!legs.length || legs.some(function (l) { return l.stop == null; })) return vazio;

  // risco em pontos × qtd, por perna — sempre positivo (a proteção é adversa).
  let riscoPtsQtd = 0;
  let qtdTotal = 0;
  for (let i = 0; i < legs.length; i++) {
    riscoPtsQtd += Math.abs(legs[i].price - legs[i].stop) * legs[i].qty;
    qtdTotal += legs[i].qty;
  }
  let stopLoss;
  if (legs.length === 1) {
    stopLoss = legs[0].stop;
  } else {
    const medio = num(operation && operation.avgEntryPrice);
    const base = Number.isFinite(medio) ? medio
      : legs.reduce(function (s, l) { return s + l.price * l.qty; }, 0) / qtdTotal;
    const desloc = riscoPtsQtd / qtdTotal;
    stopLoss = operation.side === 'LONG' ? base - desloc : base + desloc;
    // Duas casas: o resto de ponto flutuante da média (187719.999667) aparecia na tela.
    // O desvio é ≤ 0,005 pt por contrato — abaixo do centavo em qualquer contrato da B3.
    stopLoss = Math.round(stopLoss * 100) / 100;
  }
  const pv = num(ctx && ctx.pointValue);
  return {
    stopLoss: stopLoss,
    riskPoints: Math.round(riscoPtsQtd * 1e6) / 1e6,
    riskAmount: Number.isFinite(pv) ? Math.round(riscoPtsQtd * pv * 100) / 100 : null,
    legs: legs,
  };
}

/**
 * Proteção da POSIÇÃO ao longo da vida dela — o que pode compor a sequência de stops
 * (reemissão, arraste, trail), não só o stop inicial:
 *   - critérios-base (ativo, lado, origem, saída manual, preço enviado);
 *   - enviada entre a primeira entrada − 60s e a saída + 60s (quando `opts.lifetime`);
 *   - não cancelada antes da primeira entrada;
 *   - ordem com gatilho vale em qualquer preço (trail/breakeven limita a perda — é
 *     proteção, ainda que não seja stop inicial); limite sem gatilho só vale adverso ao
 *     preço executado da perna a que se refere (`legOfOrder`) — do lado do ganho é alvo.
 *     Sem perna nenhuma nas ordens, a referência é a entrada declarada do trade.
 * Todo stop inicial de perna passa neste filtro (a janela da perna está dentro da vida).
 *
 * @param {Object} order
 * @param {Object} position — { side, instrument|ticker, entryOrders, entryTime, exitTime, entry? }
 * @param {Object} [ctx] — { instant?, offset?, legs?, lifetime?: boolean (default true) }
 */
function isPositionProtection(order, position, ctx) {
  if (baseRejectionOf(order, position)) return false;
  const legs = (ctx && ctx.legs) || legsOf(position, ctx);
  const instant = instantReaderOf(position, ctx);
  const primeira = legs.length ? legs[0].ts : instant(position.entryTime);
  const checaVida = !(ctx && ctx.lifetime === false);
  if (checaVida && primeira != null) {
    const enviada = instant(order.submittedAt);
    const fim = position.exitTime ? instant(position.exitTime) : null;
    if (enviada == null || enviada < primeira - PROTECTION_WINDOW_MS) return false;
    if (fim != null && enviada > fim + PROTECTION_WINDOW_MS) return false;
  }
  const cancelada = instant(order.cancelledAt);
  if (primeira != null && cancelada != null && cancelada < primeira) return false;
  if (temGatilho(order)) return true;
  const preco = sentPriceOf(order);
  const perna = legOfOrder(order, legs, position, ctx);
  if (perna) return isAdversePrice(preco, position.side, perna.price);
  return isAdversePrice(preco, position.side, num(position.entry != null ? position.entry : position.avgEntryPrice));
}

/**
 * Perna a que uma ordem de proteção se refere: a perna em cuja janela ela nasceu; fora de
 * qualquer janela, a última perna aberta até o envio (a primeira, se veio antes de todas).
 */
function legOfOrder(order, legs, position, ctx) {
  if (!legs || !legs.length) return null;
  const instant = instantReaderOf(position, ctx);
  const enviada = instant(order && order.submittedAt);
  if (enviada == null) return legs[0];
  let melhor = null;
  for (let i = 0; i < legs.length; i++) {
    const d = Math.abs(enviada - legs[i].ts);
    if (d <= PROTECTION_WINDOW_MS && (!melhor || d < Math.abs(enviada - melhor.ts))) melhor = legs[i];
  }
  if (melhor) return melhor;
  let ultima = legs[0];
  for (let i = 0; i < legs.length; i++) if (legs[i].ts <= enviada) ultima = legs[i];
  return ultima;
}

module.exports = {
  PROTECTION_WINDOW_MS,
  LEG_STOP_REASON,
  sentPriceOf,
  protectionSideOf,
  isAdversePrice,
  legsOf,
  baseRejectionOf,
  legRejectionOf,
  isProtectionOfLeg,
  initialStopOfLeg,
  tradeStopFromLegs,
  isPositionProtection,
  legOfOrder,
};
