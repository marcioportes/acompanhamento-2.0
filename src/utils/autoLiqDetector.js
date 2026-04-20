/**
 * autoLiqDetector.js
 * @version 1.0.0 (v1.37.0 — issue #156 Fase B)
 * @description Detecta se uma operação reconstruída contém ordem AutoLiq
 *   (evento de sistema emitido pela corretora em liquidação forçada — bust).
 *
 * Tradovate expõe o indicador via coluna `Text` no CSV. O parser
 * (`orderParsers.js::parseTradovateOrders`) preserva o valor em `order.origin`,
 * e o normalizer (`orderNormalizer.js`) replica em `NormalizedOrder.origin`.
 *
 * O detector aceita tanto `order.origin` quanto `order.text` (fallback
 * para parsers futuros que preservem com nome canônico) e compara case-
 * insensitive após trim — cobre variações "AutoLiq", "autoliq", " AUTOLIQ ".
 *
 * Prevalece sobre matching: se alguma ordem da operação é AutoLiq, a
 * classificação vira `autoliq` independente de existir trade correlacionado.
 */

const AUTO_LIQ_TOKEN = 'autoliq';

/**
 * Retorna true se alguma ordem de entrada/saída/stop/cancelamento da
 * operação carrega indicador AutoLiq.
 *
 * @param {Object} operation - operação reconstruída (output de reconstructOperations)
 * @returns {boolean}
 */
export function detectAutoLiq(operation) {
  if (!operation) return false;
  const pools = [
    operation.entryOrders,
    operation.exitOrders,
    operation.stopOrders,
    operation.cancelledOrders,
  ];
  for (const pool of pools) {
    if (!pool?.length) continue;
    for (const order of pool) {
      if (orderHasAutoLiq(order)) return true;
    }
  }
  return false;
}

/**
 * Verifica uma única ordem. Útil para filtros pontuais fora do escopo
 * de uma operação reconstruída (ex: inspecionar staging cru).
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function orderHasAutoLiq(order) {
  if (!order) return false;
  const candidates = [order.origin, order.text];
  for (const v of candidates) {
    if (v == null) continue;
    if (String(v).trim().toLowerCase() === AUTO_LIQ_TOKEN) return true;
  }
  return false;
}

export default detectAutoLiq;
