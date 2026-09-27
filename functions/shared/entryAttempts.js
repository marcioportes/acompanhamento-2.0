/**
 * functions/shared/entryAttempts.js
 * @version 1.0.0 (issue #477)
 * @description SSoT de "tentativa de entrada cancelada" — o que a Hesitação conta.
 *
 * Espelho CJS de `src/utils/entryAttempts.js` — manter o CORPO IDÊNTICO (paridade testada
 * em `src/__tests__/functions/shared/issue477Mirror.test.js`). Consumido pelo shadow
 * (`functions/shadow/shadowDetectors.js`) e pelo motor de eventos
 * (`functions/maturity/executionBehaviorMirror.js`).
 */
const { orderInstantMs } = require('./orderInstant');
const { sentPriceOf, stopDistanceOf } = require('./orderProtection');

/** ---- corpo espelhado (#477) ---- */

/**
 * Janela antes da entrada em que um cancelamento ainda é tentativa da MESMA entrada.
 * Mesma meia hora do #369 (`hesitationWindowMs` do motor de eventos): depois disso o
 * trader desmontou, esperou e voltou — é decisão, não indecisão, e o motor já lê isso
 * como RECONSIDERATION. Os dois detectores de hesitação passam a concordar no corte.
 */
const ENTRY_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

/**
 * Cancelar e reenviar em até 30 s, mesmo lado e mesmo tipo, com quantidade ou preço
 * corrigidos, é AJUSTE (sizing, preço digitado errado) — não hesitação (Marcio,
 * 27/09/2026). Corrigir é um gesto só: cancelar, redigitar, enviar — segundos no SuperDOM,
 * e 30 s cobrem o celular e o chart trading. Mais que isso já é voltar ao book e decidir
 * de novo: cancelar, esperar um minuto e reenviar um tick acima é a tentativa que a
 * hesitação conta, e uma janela larga (2 min) a engolia como "ajuste".
 */
const ADJUSTMENT_WINDOW_MS = 30 * 1000;

/**
 * "Perto do preço da entrada": dentro da distância do stop do próprio trade — a unidade de
 * risco que o trader escolheu; uma ordem mais longe que isso é outro setup, não a mesma
 * entrada. Sem stop (ou stop curto), o piso é 0,25% do preço: ~460 pts no WIN a 185 mil
 * (92 ticks de 5), ~14 pts no WDO a 5.500. As ordens das 14:39 do 24/09/2026 estavam a
 * 3.800–4.800 pts da entrada.
 */
const PRICE_TOLERANCE_PCT = 0.0025;

const ATTEMPT_CLASS = Object.freeze({
  ATTEMPT: 'ATTEMPT',         // tentativa de entrada: conta
  ADJUSTMENT: 'ADJUSTMENT',   // cancelou e reenviou corrigido: não conta
  DISTANT: 'DISTANT',         // longe do preço da entrada (ou sem preço): não conta
});

const numOf = (v) => {
  if (v == null || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

const upperOf = (v) => String(v || '').trim().toUpperCase();

/** Lado da ordem que ABRE a posição: LONG → BUY, SHORT → SELL. */
function entrySideOf(tradeSide) {
  if (tradeSide === 'LONG') return 'BUY';
  if (tradeSide === 'SHORT') return 'SELL';
  return null;
}

/** Executou algo? Parcial cancelada é execução, não tentativa. */
function wasExecuted(order) {
  if (!order) return false;
  if (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED') return true;
  const q = numOf(order.filledQuantity);
  return Number.isFinite(q) && q > 0;
}

/** Tolerância de preço do trade (ver PRICE_TOLERANCE_PCT). NaN quando não há entrada. */
function priceToleranceOf(trade) {
  const entrada = numOf(trade && trade.entry);
  if (!Number.isFinite(entrada) || entrada <= 0) return NaN;
  const stop = stopDistanceOf(trade.side, entrada, trade.stopLoss);
  return Math.max(stop == null ? 0 : stop, entrada * PRICE_TOLERANCE_PCT);
}

const cancelMsOf = (trade, o) => orderInstantMs(trade, o.cancelledAt || o.lastUpdatedAt || o.submittedAt);

/**
 * A ordem cancelada foi REENVIADA corrigida? Outra ordem do mesmo lado e mesmo tipo,
 * enviada até 30 s do cancelamento (e depois do envio da original), com preço perto e
 * quantidade OU preço diferentes. Reenvio idêntico não é correção — continua tentativa.
 */
function isAdjustment(order, orders, trade, tolerance) {
  const cancel = cancelMsOf(trade, order);
  const envio = orderInstantMs(trade, order.submittedAt);
  if (cancel == null) return false;
  const preco = sentPriceOf(order);
  const qtd = numOf(order.quantity);
  for (let i = 0; i < (orders || []).length; i++) {
    const r = orders[i];
    if (!r || r === order) continue;
    if (r.externalOrderId != null && r.externalOrderId === order.externalOrderId) continue;
    if (r.side !== order.side) continue;
    if (upperOf(r.orderType) !== upperOf(order.orderType)) continue;
    const ia = upperOf(r.instrument);
    const ib = upperOf(order.instrument);
    if (ia && ib && ia !== ib) continue;
    const reenvio = orderInstantMs(trade, r.submittedAt);
    if (reenvio == null) continue;
    if (envio != null && reenvio <= envio) continue;
    if (Math.abs(reenvio - cancel) > ADJUSTMENT_WINDOW_MS) continue;
    const precoR = sentPriceOf(r);
    const qtdR = numOf(r.quantity);
    const perto = preco == null || precoR == null || !Number.isFinite(tolerance)
      || Math.abs(precoR - preco) <= tolerance;
    if (!perto) continue;
    const mudouQtd = Number.isFinite(qtd) && Number.isFinite(qtdR) && qtd !== qtdR;
    const mudouPreco = preco != null && precoR != null && preco !== precoR;
    if (mudouQtd || mudouPreco) return true;
  }
  return false;
}

/**
 * Classifica UMA ordem cancelada do lado da entrada, já dentro da janela de tempo.
 * @returns {'ATTEMPT'|'ADJUSTMENT'|'DISTANT'}
 */
function classifyCancelledEntry(order, orders, trade) {
  const tol = priceToleranceOf(trade);
  if (isAdjustment(order, orders, trade, tol)) return ATTEMPT_CLASS.ADJUSTMENT;
  const preco = sentPriceOf(order);
  const entrada = numOf(trade && trade.entry);
  // Sem preço enviado não há como provar que era a mesma entrada: não acusa.
  if (preco == null || !Number.isFinite(entrada) || !Number.isFinite(tol)) return ATTEMPT_CLASS.DISTANT;
  return Math.abs(preco - entrada) <= tol ? ATTEMPT_CLASS.ATTEMPT : ATTEMPT_CLASS.DISTANT;
}

/**
 * Tentativas de entrada canceladas de um trade (Marcio, 27/09/2026):
 *   - ordem do LADO DA ENTRADA (proteção é do lado oposto e nunca conta);
 *   - não executada; cancelada ANTES da entrada, até 30 min antes;
 *   - perto do preço da entrada;
 *   - não é ajuste (cancelou e reenviou corrigido).
 *
 * @param {Object} trade — { side, entry, entryTime (ISO+offset), stopLoss?, ticker? }
 * @param {Object[]} orders — ordens do trade (collection `orders`)
 * @returns {{attempts:Object[], adjustments:Object[], distant:Object[], entryMs:number|null, spanMinutes:number|null}}
 */
function entryAttemptsOf(trade, orders) {
  const vazio = { attempts: [], adjustments: [], distant: [], entryMs: null, spanMinutes: null };
  if (!trade || !Array.isArray(orders) || !orders.length) return vazio;
  const lado = entrySideOf(trade.side);
  const d = new Date(trade.entryTime);
  const entryMs = Number.isNaN(d.getTime()) ? null : d.getTime();
  if (!lado || entryMs == null) return vazio;
  const ativo = upperOf(trade.ticker || trade.instrument);

  const out = { attempts: [], adjustments: [], distant: [], entryMs: entryMs, spanMinutes: null };
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (!o || o.status !== 'CANCELLED' || wasExecuted(o)) continue;
    if (o.side !== lado) continue;
    const inst = upperOf(o.instrument);
    if (inst && ativo && inst !== ativo) continue;
    // #396 — sem instante não há "antes da entrada": null < n coage para true.
    const cancel = cancelMsOf(trade, o);
    if (cancel == null || cancel >= entryMs) continue;
    if (entryMs - cancel >= ENTRY_ATTEMPT_WINDOW_MS) continue;
    const c = classifyCancelledEntry(o, orders, trade);
    if (c === ATTEMPT_CLASS.ATTEMPT) out.attempts.push(o);
    else if (c === ATTEMPT_CLASS.ADJUSTMENT) out.adjustments.push(o);
    else out.distant.push(o);
  }
  // Janela da hesitação: do envio da primeira tentativa até a entrada.
  let primeira = null;
  for (let i = 0; i < out.attempts.length; i++) {
    const t = orderInstantMs(trade, out.attempts[i].submittedAt);
    if (t != null && (primeira == null || t < primeira)) primeira = t;
  }
  if (primeira != null) out.spanMinutes = Math.round(((entryMs - primeira) / 60000) * 10) / 10;
  return out;
}

/** ---- fim do corpo espelhado ---- */

module.exports = {
  ENTRY_ATTEMPT_WINDOW_MS,
  ADJUSTMENT_WINDOW_MS,
  PRICE_TOLERANCE_PCT,
  ATTEMPT_CLASS,
  entrySideOf,
  wasExecuted,
  priceToleranceOf,
  isAdjustment,
  classifyCancelledEntry,
  entryAttemptsOf,
};
