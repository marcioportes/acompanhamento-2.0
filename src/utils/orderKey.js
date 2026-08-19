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

/**
 * ID DETERMINÍSTICO do documento em `orders` (issue #362).
 *
 * Até 19/08/2026 o `ingestBatch` gravava com id automático e **sem** o
 * `externalOrderId` — o `ClOrdID` da corretora, chave única e estável que o
 * parser já lê e o staging já usa. Sem chave natural e sem id previsível, não
 * havia como reconhecer uma ordem já ingerida: cada reimportação do mesmo
 * arquivo criava um conjunto novo de docs. Medido em produção: a mesma perna de
 * stop em 3 batches, 154 documentos apagados na limpeza de 19/08.
 *
 * Com id derivado da identidade da ordem, reimportar vira `set` sobre o MESMO
 * doc — idempotente por construção, sem consulta prévia.
 *
 * Escopo por aluno: dois alunos podem operar na mesma corretora e receber o
 * mesmo `ClOrdID`. O prefixo evita colisão entre contas.
 *
 * Restrições de id do Firestore respeitadas: sem `/`, não pode ser `.` nem `..`,
 * não pode casar `__.*__` (padrão reservado) e vai bem abaixo do teto de 1500
 * bytes. `sanitizeIdPart` cobre os dois primeiros; o separador `_` simples e o
 * prefixo de `studentId` cobrem o terceiro.
 *
 * @param {Object} order — ordem normalizada (com ou sem externalOrderId)
 * @param {string} studentId — dono da ordem
 * @returns {string|null} id do doc, ou null sem studentId (caller decide o fallback)
 */
export function makeOrderDocId(order, studentId) {
  if (!studentId) return null;
  const key = makeOrderKey(order);
  return `${sanitizeIdPart(studentId)}_${sanitizeIdPart(key)}`;
}

/**
 * Torna um trecho seguro para id de documento: troca `/` (proibido) e os demais
 * separadores da chave por `-`, mantendo legibilidade para debug.
 */
export function sanitizeIdPart(value) {
  return String(value ?? '')
    .replace(/[/|:]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+$/, '-');
}
