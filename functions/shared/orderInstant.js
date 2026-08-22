/**
 * functions/shared/orderInstant.js
 * @version 1.0.0 (v1.83.24 — issue #388)
 * @description SSoT do instante de uma ordem, resolvido NO FUSO DO TRADE.
 *
 * `orders` guarda instante ingênuo (`"2026-08-21T11:27:51"`); `trades` guarda com offset
 * explícito desde o #285/#292. `new Date()` lê string sem offset no fuso DO PROCESSO, e a
 * Cloud Function roda em UTC — a ordem sai 3h antes do trade dela.
 *
 * O #375 corrigiu isso em `executionBehaviorEngine` e `executionBehaviorMirror`, mas uma
 * TERCEIRA cópia sobreviveu em `shadow/shadowDetectors.detectHesitation` e voltou a
 * produzir defeito em produção (#388). Este módulo existe para que não haja quarta.
 */

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
 * @param {Object} trade — dono da ordem (fonte do fuso)
 * @param {*} value — instante da ordem (string ISO, Timestamp ou Date)
 * @returns {number|null} milissegundos, ou null quando não há instante
 */
function orderInstantMs(trade, value) {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const offset = tradeOffsetOf(trade);
  const raw = (typeof value === 'string' && offset && !OFFSET_RE.test(value))
    ? `${value}${offset}`
    : value;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

module.exports = { orderInstantMs, tradeOffsetOf };
