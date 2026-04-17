/**
 * extractSummaryMetrics.js
 * @version 1.0.0 (v1.33.0)
 * @description Métricas agregadas do recorte visível no extrato (header resumo):
 *   tradesCount, winCount, winRate.
 *
 *   Convenção alinhada com src/utils/calculations.js: result > 0 = win.
 *   result === 0 não conta como win nem como loss (neutro).
 */

/**
 * @param {Array<{ result: number|string }>} rows
 * @returns {{ tradesCount: number, winCount: number, winRate: number }}
 */
export const computeExtractSummaryMetrics = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const tradesCount = safeRows.length;
  const winCount = safeRows.filter(r => Number(r?.result) > 0).length;
  const winRate = tradesCount > 0 ? (winCount / tradesCount) * 100 : 0;
  return { tradesCount, winCount, winRate };
};
