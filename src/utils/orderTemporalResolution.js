/**
 * orderTemporalResolution.js
 * @version 1.0.0 (v1.1.0 — issue #93 redesign)
 * @description Detecta se um conjunto de ordens parseadas foi exportado com
 *   resolução temporal completa (com segundos) ou apenas em minutos.
 *
 * Critério: se TODOS os timestamps das ordens analisadas têm seconds=0 e
 * milliseconds=0, considera que o CSV foi exportado em baixa resolução.
 *
 * Importância: padrões comportamentais que dependem de granularidade de
 * segundos (hesitação < 5s, intervalo entre cliques) ficam como "inconclusive"
 * em vez de gerar falso positivo. Flag propagada nos trades criados pelo
 * Order Import (issue #93 redesign V1.1a).
 *
 * Limitação conhecida: para amostras < 3 ordens, o resultado pode ser
 * coincidência (todas as ordens em :00 segundos por acaso). Para o uso atual
 * (importação típica de 50+ ordens/dia), o falso positivo é negligível.
 */

const TS_FIELDS = ['filledAt', 'submittedAt', 'lastUpdatedAt', 'cancelledAt'];

/**
 * @param {Object[]} orders — ordens parseadas (output de parseProfitChartPro/parseGenericOrders)
 * @returns {boolean} true se todos os timestamps têm seconds=0 (low res), false caso contrário
 */
export function detectLowResolution(orders) {
  if (!orders?.length) return false;
  let analyzed = 0;
  for (const o of orders) {
    for (const field of TS_FIELDS) {
      const ts = o[field];
      if (!ts) continue;
      const d = new Date(ts);
      if (isNaN(d.getTime())) continue;
      analyzed++;
      if (d.getSeconds() !== 0 || d.getMilliseconds() !== 0) {
        return false; // pelo menos um timestamp tem segundos → resolução normal
      }
    }
  }
  // Se nenhum timestamp foi analisado (todos null/inválidos), não é lowRes — é "no data"
  return analyzed > 0;
}
