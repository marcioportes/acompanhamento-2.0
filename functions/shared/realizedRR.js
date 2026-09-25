/**
 * functions/shared/realizedRR.js
 * @version 1.0.0 (v1.83.22 — issue #383)
 * @description SSoT do R:R realizado no lado servidor. Espelho de
 *   `src/utils/compliance.realizedRR`.
 *
 * Existe como módulo próprio porque o defeito que originou o #383 foi justamente a
 * multiplicação da mesma conta: `calculateTradeCompliance` convertia R$ em pontos via
 * tickSize/tickValue, `useTrades` dividia por `pointValue` (null no WIN, fallback 1) e os
 * detectores comportamentais tinham uma terceira cópia. Resultado medido em produção:
 * 9 de 161 trades com o escalar `rrRatio` divergindo do R:R real, incluindo losses que
 * bateram o stop (−1R) gravados como −0,2.
 *
 * Base é GEOMETRIA DE PREÇO — não depende de `tickerRule`, `pointValue` nem `result`.
 */

const { stopDistanceOf } = require('./orderProtection');

/** Ausência não é zero: Number(null) é 0 e passaria por finito (armadilha do #373). */
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {Object} trade — { entry, exit, stopLoss, side }
 * @returns {number|null} R:R realizado, ou null quando falta dado para afirmar.
 */
const realizedRR = (trade) => {
  const entry = num(trade && trade.entry);
  const exit = num(trade && trade.exit);
  const stop = num(trade && trade.stopLoss);
  if (entry == null || exit == null || stop == null) return null;

  // #467 — stop do lado errado da entrada (ou na entrada) não é stop: ausência de razão.
  const risk = stopDistanceOf(trade && trade.side, entry, stop);
  if (risk == null) return null;

  const dir = (trade && trade.side) === 'SHORT' ? -1 : 1;
  return Math.round((((exit - entry) * dir) / risk) * 100) / 100;
};

module.exports = { realizedRR };
