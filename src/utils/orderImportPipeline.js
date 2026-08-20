/**
 * orderImportPipeline.js
 * @version 1.0.0 (v1.83.15 — issue #366)
 * @description Helpers do passo final do Order Import — o que permite gravar em
 *   `orders` DEPOIS da decisão por operação, e não antes.
 *
 * CONTEXTO (issue #366):
 *   `handleStagingConfirm` ingeria o lote inteiro na Revisão de Operações. Quem o
 *   aluno descartasse na tela seguinte já estava gravado, e o cliente não apaga
 *   `orders` (`firestore.rules`: `allow delete: if false`). Operação deixada em
 *   `pending` não entrava em bucket nenhum e sumia sem registro.
 *
 * ORDEM DE ESCRITA (não inverter):
 *   ordens confirmadas → depois trades. `linkOrdersToCreatedTrade`, chamada dentro
 *   de `onTradeCreated`, faz early-return se `orders where batchId ==` vier vazia;
 *   criar o trade antes devolveria as ordens ao estado órfão do #351.
 *
 * @see src/utils/orderKey.js — chave canônica (SSoT do #93)
 */

import { makeOrderKey } from './orderKey';
import { routeConversationalDecisions } from './conversationalIngest';

/** Decisões que resultam em gravação. `pending` e `discarded` ficam de fora. */
const DECIDIDAS = new Set(['confirmed', 'adjusted']);

/**
 * Todas as ordens de uma operação reconstruída, nas quatro pernas.
 * Espelha o laço de `OrderStagingReview.handleSubmit`.
 *
 * @param {Object} operation
 * @returns {Object[]}
 */
export function operationOrders(operation) {
  if (!operation) return [];
  return [
    ...(operation.entryOrders || []),
    ...(operation.exitOrders || []),
    ...(operation.stopOrders || []),
    ...(operation.cancelledOrders || []),
  ];
}

/**
 * Chaves das ordens que devem ser ingeridas — só as de operações efetivamente
 * decididas pelo aluno.
 *
 * @param {Object[]} queue — conversationalQueue pós-decisão
 * @returns {string[]} chaves canônicas, sem repetição
 */
export function finalOrderKeysFromQueue(queue) {
  const keys = [];
  const seen = new Set();

  for (const item of queue || []) {
    if (!item?.operation || !DECIDIDAS.has(item.userDecision)) continue;
    for (const order of operationOrders(item.operation)) {
      const key = makeOrderKey(order);
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Vínculo ordem → trade, por chave canônica.
 *
 * A correlação automática (calculada contra os trades pré-existentes) é a base; a
 * DECISÃO do aluno sobrescreve. Isso conserta um furo silencioso: quando o aluno
 * resolve um `ambiguous` escolhendo trade diferente do sugerido — ou confirma um
 * enriquecimento — as ordens ficavam órfãs ou apontando para o trade errado, já
 * que `linkOrdersToCreatedTrade` só alcança trade recém-criado, nunca enriquecido.
 *
 * @param {Object[]} queue — conversationalQueue pós-decisão
 * @param {Array<{externalOrderId: string, tradeId: string, confidence: number}>} autoCorrelations
 * @returns {Object<string, {tradeId: string, confidence: number}>}
 */
export function correlationsFromDecisions(queue, autoCorrelations = []) {
  const byKey = {};

  for (const corr of autoCorrelations || []) {
    if (!corr?.tradeId || !corr.externalOrderId) continue;
    byKey[`eid:${corr.externalOrderId}`] = {
      tradeId: corr.tradeId,
      confidence: corr.confidence ?? 0,
    };
  }

  for (const item of queue || []) {
    if (!item?.operation || !DECIDIDAS.has(item.userDecision) || !item.tradeId) continue;
    for (const order of operationOrders(item.operation)) {
      byKey[makeOrderKey(order)] = { tradeId: item.tradeId, confidence: 1 };
    }
  }

  return byKey;
}

/**
 * Executa a gravação do import na ordem obrigatória: ordens confirmadas primeiro,
 * trades depois, enriquecimento por último.
 *
 * A ordem é contrato, não estilo: `linkOrdersToCreatedTrade` roda dentro de
 * `onTradeCreated` e desiste quando não encontra ordens do batch. Criar o trade antes
 * devolveria toda ordem nascida do import ao estado órfão que o #351 mediu (194 de 198).
 *
 * `alreadyIngested` guarda o retry: se a criação de trades falhou depois de uma
 * ingestão bem-sucedida, reenviar não pode reingerir.
 *
 * @param {Object} params
 * @param {Object[]} params.queue — conversationalQueue pós-decisão
 * @param {Array} params.autoCorrelations — correlação automática calculada na revisão
 * @param {Set<string>} [params.existingKeys] — chaves já presentes em `orders`
 * @param {boolean} [params.alreadyIngested] — ingestão deste lote já concluiu
 * @param {Function} params.ingestFn — (correlations, orderKeys, options) => Promise
 * @param {Function} params.createFn — (toCreate) => Promise
 * @param {Function} params.enrichFn — (toEnrich) => Promise
 * @returns {Promise<{ingestResult: any, batchResult: any, enrichResult: any, toCreate: Object[], toEnrich: Object[], discarded: Object[]}>}
 */
export async function persistImportDecisions({
  queue,
  autoCorrelations = [],
  existingKeys = null,
  alreadyIngested = false,
  ingestFn,
  createFn,
  enrichFn,
}) {
  const { toEnrich, toCreate, discarded } = routeConversationalDecisions(queue);

  const ingestResult = alreadyIngested
    ? { alreadyIngested: true }
    : await ingestFn(
      correlationsFromDecisions(queue, autoCorrelations),
      finalOrderKeysFromQueue(queue),
      { existingKeys },
    );

  const batchResult = await createFn(toCreate);
  const enrichResult = await enrichFn(toEnrich);

  return { ingestResult, batchResult, enrichResult, toCreate, toEnrich, discarded };
}

/** Campos de controle do staging — não fazem parte da ordem em si. */
const CAMPOS_DE_CONTROLE = [
  'id', 'importBatchId', 'planId', 'sourceFormat', 'fileName', 'importTimezone',
  'classification', 'userDecision', 'userDecisionAt', 'userAdjustments',
  'matchCandidates', 'isAutoLiq', 'studentId', 'studentEmail', 'studentName', 'createdAt',
];

const chaveDeOrdenacao = (doc) =>
  `${doc.submittedAt || ''}|${doc.filledAt || ''}|${doc.externalOrderId ?? ''}`;

/**
 * Reidrata docs de `ordersStagingArea` no formato que o resto do pipeline espera.
 *
 * `_rowIndex` é a chave de join entre `correlateOrders` e `mapOperationToTradeData`
 * (lookup sem fallback) e NÃO é persistido no staging. Retomar um lote sem
 * reatribuí-lo faz toda correlação casar contra `undefined` — cada operação já
 * confrontada viraria trade novo. A reatribuição é sequencial sobre uma ordenação
 * determinística, porque o índice só precisa ser único e estável dentro da execução.
 *
 * @param {Object[]} docs — docs do staging (com `id`)
 * @returns {Object[]} ordens no formato do parser
 */
export function stagingDocsToOrders(docs) {
  return (docs || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => chaveDeOrdenacao(a).localeCompare(chaveDeOrdenacao(b)))
    .map((doc, i) => {
      const order = { ...doc };
      for (const campo of CAMPOS_DE_CONTROLE) delete order[campo];
      order._rowIndex = i + 1;
      return order;
    });
}
