/**
 * orderDedup.js
 * @version 1.0.0 (v1.83.15 — issue #366)
 * @description Regra de entrada do Order Import: reconhecer, antes de gravar
 *   qualquer coisa, quais ordens do arquivo já estão na collection `orders`.
 *
 * POR QUE BI-CHAVE:
 *   `makeOrderKey` (orderKey.js) devolve `eid:<externalOrderId>` quando a ordem
 *   carrega o ClOrdID da corretora e `comp:<composto>` quando não carrega. Até o
 *   #362 o payload de `orders` NÃO gravava `externalOrderId` — então o doc antigo
 *   só sabe produzir `comp:`, enquanto a ordem que chega do CSV produz `eid:`.
 *   As duas chaves nunca colidem: comparar por chave única deixaria todo o legado
 *   passar batido e a duplicata seria criada de novo.
 *
 * POR QUE EM MEMÓRIA:
 *   `firestore.indexes.json` não declara nenhum índice para `orders`. Consultar o
 *   servidor exigiria índice composto novo — e índice ausente falha em silêncio no
 *   onSnapshot. A lista já está carregada no dashboard (`useOrders`), então a
 *   comparação é local e de graça.
 *
 * TENANT: `useOrders`/`useOrderStaging` não filtram `studentId` no dashboard do
 *   mentor sem view-as (a query traz a turma inteira). O escopo é aplicado aqui,
 *   não confiado ao hook — senão o ClOrdID de um aluno marcaria a ordem de outro.
 */

/**
 * Todas as chaves canônicas sob as quais uma ordem pode ser reconhecida.
 * A composta é sempre computável; a `eid:` só quando há ClOrdID.
 *
 * @param {Object} order — ordem normalizada ou doc de `orders`
 * @returns {string[]}
 */
export function orderKeyVariants(order) {
  if (!order) return [];
  const variants = [];
  if (order.externalOrderId) variants.push(`eid:${order.externalOrderId}`);
  variants.push(
    `comp:${order.instrument}|${order.side}|${order.submittedAt || ''}|${order.quantity ?? ''}|${order.filledAt || ''}`,
  );
  return variants;
}

/**
 * Índice das ordens já gravadas, por todas as chaves de cada uma.
 *
 * @param {Object[]} orders — docs de `orders` (de useOrders)
 * @param {string|null} studentId — escopo do aluno; null indexa tudo
 * @returns {Map<string, {planId: string|null, batchId: string|null, importedAt: any}>}
 */
export function indexExistingOrders(orders, studentId = null) {
  const index = new Map();
  for (const order of orders || []) {
    if (!order) continue;
    if (studentId && order.studentId !== studentId) continue;

    const meta = {
      planId: order.planId ?? null,
      batchId: order.batchId ?? null,
      importedAt: order.importedAt ?? null,
    };
    for (const key of orderKeyVariants(order)) {
      if (!index.has(key)) index.set(key, meta);
    }
  }
  return index;
}

/**
 * Marca quais ordens do arquivo já foram importadas.
 *
 * Os índices retornados se referem ao array recebido (posição original) — é o que
 * `OrderPreview` usa para pré-excluir as linhas.
 *
 * @param {Object[]} parsedOrders — ordens normalizadas do arquivo
 * @param {Map} index — saída de indexExistingOrders
 * @returns {{ duplicateIndexes: Set<number>, matches: Array<{index: number, key: string, planId: string|null, batchId: string|null, importedAt: any}> }}
 */
export function detectAlreadyImported(parsedOrders, index) {
  const duplicateIndexes = new Set();
  const matches = [];
  if (!index || index.size === 0) return { duplicateIndexes, matches };

  (parsedOrders || []).forEach((order, i) => {
    for (const key of orderKeyVariants(order)) {
      if (!index.has(key)) continue;
      duplicateIndexes.add(i);
      matches.push({ index: i, key, ...index.get(key) });
      break;
    }
  });

  return { duplicateIndexes, matches };
}
