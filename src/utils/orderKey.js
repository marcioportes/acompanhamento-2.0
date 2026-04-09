/**
 * orderKey.js
 * @version 1.0.0 (v1.1.0 — issue #93)
 * @description Gera chave canônica de ordem usada por:
 *   - OrderStagingReview.handleSubmit (constrói confirmedOrderKeys)
 *   - useOrderStaging.ingestBatch (filtra staging → orders)
 *   - OrderImportPage.handleStagingConfirm (filtra parsedOrders → confirmedOrders)
 *
 * Critério:
 *   - externalOrderId quando disponível: `eid:<id>`
 *   - fallback composto para parsers que não emitem ID externo:
 *     `comp:<instrument>|<side>|<submittedAt>|<quantity>|<filledAt>`
 *
 * Os 3 consumidores DEVEM usar esta função para garantir que o critério de
 * filtro é o mesmo em todos os pontos do pipeline. Drift entre cópias
 * inline causaria ordens "sumirem" entre staging e ingest.
 */

/**
 * @param {Object} order — ordem normalizada
 * @returns {string} chave canônica
 */
export function makeOrderKey(order) {
  if (order.externalOrderId) return `eid:${order.externalOrderId}`;
  return `comp:${order.instrument}|${order.side}|${order.submittedAt || ''}|${order.quantity ?? ''}|${order.filledAt || ''}`;
}
