/**
 * conversationalIngest.js
 * @version 1.0.0 (v1.37.0 — issue #156 Fase E)
 * @description Helpers puros do pipeline conversacional — decisões do aluno
 *   → buckets de ação downstream (enrichTrade / createTradesBatch / discarded).
 *
 * Extraído de OrderImportPage.handleConversationalSubmit para permitir testes
 * de integração sem montar a árvore React inteira (react-dom + jsdom + useTrades
 * + firestore mock + etc).
 *
 * INV-02: não escreve em `trades` — apenas roteia e monta payloads.
 *   A escrita real acontece via enrichTrade / createTrade (tradeGateway).
 */

import { CLASSIFICATION } from './orderTradeCreation';

/**
 * Roteia itens da fila conversacional em buckets de ação downstream.
 *
 * Regra:
 *   - userDecision === 'discarded' → `discarded` (persistir flag, não cria trade)
 *   - userDecision === 'confirmed' | 'adjusted' AND
 *       (classification in {match_confident, ambiguous} OR promotedFrom='new')
 *       AND tradeId presente → `toEnrich`
 *   - demais confirmadas → `toCreate`
 *   - pending (sem decisão) → ignorada (não compõe nenhum bucket)
 *
 * Match_confident sem tradeId nunca acontece em fluxo normal (a Fase B sempre
 * preenche tradeId quando há classificação); ainda assim, o check guarda contra
 * estado corrompido.
 *
 * @param {Array} queue — itens da fila (output de categorizeConfirmedOps + decisão do aluno)
 * @returns {{ toEnrich: Array, toCreate: Array, discarded: Array }}
 */
export function routeConversationalDecisions(queue) {
  const toEnrich = [];
  const toCreate = [];
  const discarded = [];

  if (!Array.isArray(queue) || queue.length === 0) {
    return { toEnrich, toCreate, discarded };
  }

  for (const item of queue) {
    if (!item || !item.operation) continue;

    if (item.userDecision === 'discarded') {
      discarded.push(item);
      continue;
    }

    if (item.userDecision !== 'confirmed' && item.userDecision !== 'adjusted') {
      continue; // pending ou estado desconhecido — não compõe bucket
    }

    const needsEnrich =
      (item.classification === CLASSIFICATION.MATCH_CONFIDENT ||
        item.classification === CLASSIFICATION.AMBIGUOUS ||
        item.promotedFrom === 'new') &&
      !!item.tradeId;

    if (needsEnrich) {
      toEnrich.push(item);
    } else {
      toCreate.push(item.operation);
    }
  }

  return { toEnrich, toCreate, discarded };
}

/**
 * Monta payload de enrichment (formato esperado por tradeGateway.enrichTrade)
 * a partir de um item da fila conversacional.
 *
 * Base: avgEntryPrice / avgExitPrice / totalQty / stopOrders da operação.
 * Override: `item.userAdjustments` (setado via AdjustmentModal) — campo a campo.
 *   Campos ausentes em userAdjustments herdam o valor da operação.
 *
 * @param {Object} item — { operation, tradeId, classification, userAdjustments? }
 * @param {Object} [opts]
 * @param {Object} [opts.tickerRuleMap] — { [symbol]: { tickSize, tickValue, pointValue } }
 * @param {string|null} [opts.importBatchId]
 * @returns {{ _partials, entry, exit, qty, stopLoss, tickerRule, importBatchId }}
 */
export function buildEnrichmentPayload(item, opts = {}) {
  const { tickerRuleMap = {}, importBatchId = null } = opts;
  const op = item.operation;

  const partials = [];
  let seq = 1;
  for (const entry of (op.entryOrders || [])) {
    partials.push({
      type: 'ENTRY',
      price: parseFloat(entry.filledPrice ?? entry.price) || 0,
      qty: parseFloat(entry.filledQuantity ?? entry.quantity) || 0,
      dateTime: entry.filledAt || entry.submittedAt || null,
      seq: seq++,
    });
  }
  for (const exit of (op.exitOrders || [])) {
    partials.push({
      type: 'EXIT',
      price: parseFloat(exit.filledPrice ?? exit.price) || 0,
      qty: parseFloat(exit.filledQuantity ?? exit.quantity) || 0,
      dateTime: exit.filledAt || exit.submittedAt || null,
      seq: seq++,
    });
  }

  let stopLoss = null;
  if (op.hasStopProtection && op.stopOrders?.length > 0) {
    const lastStop = op.stopOrders[op.stopOrders.length - 1];
    stopLoss = parseFloat(lastStop.stopPrice ?? lastStop.price) || null;
  }

  const instrument = (op.instrument || '').toUpperCase();
  const tickerRule = tickerRuleMap[instrument] ?? null;

  const payload = {
    _partials: partials,
    entry: op.avgEntryPrice,
    exit: op.avgExitPrice,
    qty: op.totalQty,
    stopLoss,
    tickerRule,
    importBatchId,
  };

  const adj = item.userAdjustments;
  if (adj && typeof adj === 'object') {
    if (adj.entry != null && adj.entry !== '') payload.entry = parseFloat(adj.entry);
    if (adj.exit != null && adj.exit !== '') payload.exit = parseFloat(adj.exit);
    if (adj.qty != null && adj.qty !== '') payload.qty = parseFloat(adj.qty);
    if ('stopLoss' in adj) {
      payload.stopLoss = adj.stopLoss != null && adj.stopLoss !== ''
        ? parseFloat(adj.stopLoss)
        : null;
    }
  }

  return payload;
}

/**
 * Fingerprint frouxo para casar doc de `orders` (collection ingerida) com uma
 * ordem individual de uma operação reconstruída. Usado pelo wiring de
 * "persistir userDecision=discarded" em orders.
 *
 * Critério: instrument|side|filledAt|quantity (normalizados). `orders` docs
 * NÃO carregam `externalOrderId` hoje — então o fingerprint composto é o
 * único caminho sem mudar a collection (que tem outros consumers).
 *
 * @param {Object} order — ordem (normalized ou doc de `orders`)
 * @returns {string}
 */
export function orderMatchFingerprint(order) {
  const instrument = (order.instrument || '').toUpperCase();
  const side = order.side || '';
  const filledAt = order.filledAt || '';
  const qty = order.filledQuantity ?? order.quantity ?? '';
  return `${instrument}|${side}|${filledAt}|${qty}`;
}

/**
 * Retorna o conjunto de fingerprints de ordens (entry+exit+stop) de uma operação.
 * Usado para marcar docs correspondentes na collection `orders`.
 */
export function operationOrderFingerprints(op) {
  const fps = new Set();
  if (!op) return fps;
  const all = [
    ...(op.entryOrders || []),
    ...(op.exitOrders || []),
    ...(op.stopOrders || []),
  ];
  for (const o of all) {
    fps.add(orderMatchFingerprint(o));
  }
  return fps;
}

/**
 * Executa o batch de enrichment puro — dado um conjunto de itens `toEnrich`
 * e deps injetáveis, chama enrichTradeFn(tradeId, payload, userContext) para cada.
 *
 * @param {Object} params
 * @param {Array} params.toEnrich — items da fila (output de routeConversationalDecisions)
 * @param {Object} params.userContext
 * @param {Object} [params.tickerRuleMap]
 * @param {string|null} [params.importBatchId]
 * @param {Function} params.enrichTradeFn — (tradeId, payload, userContext) => Promise
 * @returns {Promise<{ enriched: Array, failed: Array }>}
 */
export async function enrichConversationalBatch({
  toEnrich,
  userContext,
  tickerRuleMap = {},
  importBatchId = null,
  enrichTradeFn,
}) {
  const enriched = [];
  const failed = [];
  if (!toEnrich?.length) return { enriched, failed };
  if (typeof enrichTradeFn !== 'function') {
    throw new Error('enrichTradeFn é obrigatório');
  }

  for (const item of toEnrich) {
    try {
      const payload = buildEnrichmentPayload(item, { tickerRuleMap, importBatchId });
      const result = await enrichTradeFn(item.tradeId, payload, userContext);
      enriched.push({
        tradeId: item.tradeId,
        operationId: item.operation?.operationId ?? null,
        classification: item.classification,
        before: result?.before ?? null,
        after: result?.after ?? null,
      });
    } catch (err) {
      failed.push({
        tradeId: item.tradeId,
        operationId: item.operation?.operationId ?? null,
        error: err?.message || String(err),
      });
    }
  }

  return { enriched, failed };
}
