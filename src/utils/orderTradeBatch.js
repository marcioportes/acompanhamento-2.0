/**
 * orderTradeBatch.js
 * @version 1.0.0 (v1.1.0 — issue #93 redesign V1.1a)
 * @description Cria trades em batch a partir de operações reconstruídas,
 *   com throttling automático para batches grandes e tracking de resultados.
 *
 * Throttling: batch <= threshold → paralelo (Promise.allSettled). Caso contrário
 * → sequencial (for/await) para evitar contenção nas Cloud Functions
 * (cada createTrade dispara onTradeCreated + onMovementCreated).
 *
 * Cada operação passa por:
 *   1. mapOperationToTradeData (com lowResolution propagado)
 *   2. checkDuplication contra existingTrades
 *   3. createTrade (gateway INV-02) — só se não duplicada
 *
 * INV-01 (Airlock): chamado APÓS confirmação no staging review.
 * INV-02 (Gateway): toda escrita via createTrade.
 * INV-03 (Pipeline): CFs onTradeCreated/onMovementCreated disparam normalmente.
 */

import { mapOperationToTradeData, checkDuplication } from './orderTradeCreation';
import { createTrade as createTradeDefault } from './tradeGateway';

const DEFAULT_THRESHOLD = 20;

/**
 * Cria trades em batch a partir de operações reconstruídas confirmadas.
 *
 * @param {Object} params
 * @param {Object[]} params.toCreate — operações a criar (output de categorizeConfirmedOps.toCreate)
 * @param {string} params.planId
 * @param {string|null} [params.importBatchId]
 * @param {Object|null} [params.tickerRuleMap] — { [instrument]: { tickSize, tickValue, pointValue } }
 * @param {boolean} [params.lowResolution]
 * @param {Object[]} [params.existingTrades] — trades do plano para checkDuplication
 * @param {Object} params.userContext — { uid, email, displayName }
 * @param {Function} [params.onProgress] — callback (current, total, message) → void
 * @param {Function} [params.createTradeFn] — injetável para testes (default: createTrade)
 * @param {number} [params.threshold] — limiar para sequencial (default: 20)
 * @returns {Promise<{
 *   created: Array<{ id: string, ticker: string, qty: string, side: string, result: number, operationId: string|null }>,
 *   duplicates: Array<{ operationId: string|null, ticker: string, reason: string, matchedTradeId: string }>,
 *   failed: Array<{ operationId: string|null, ticker: string, error: string }>
 * }>}
 */
export async function createTradesBatch({
  toCreate,
  planId,
  importBatchId = null,
  tickerRuleMap = null,
  lowResolution = false,
  existingTrades = [],
  userContext,
  onProgress = () => {},
  createTradeFn = createTradeDefault,
  threshold = DEFAULT_THRESHOLD,
}) {
  if (!toCreate?.length) {
    return { created: [], duplicates: [], failed: [] };
  }

  if (!userContext?.uid) {
    return {
      created: [],
      duplicates: [],
      failed: toCreate.map(op => ({
        operationId: op.operationId ?? null,
        ticker: (op.instrument || '').toUpperCase(),
        error: 'Usuário não autenticado',
      })),
    };
  }

  const created = [];
  const duplicates = [];
  const failed = [];

  // Pré-processar: mapear cada op + checkDuplication antes de tocar Firestore.
  // Op com erro de mapeamento ou duplicada não chega a chamar createTrade.
  const prepared = [];
  for (const op of toCreate) {
    try {
      const instrument = (op.instrument || '').toUpperCase();
      const tickerRule = tickerRuleMap?.[instrument] ?? null;
      const tradeData = mapOperationToTradeData(op, planId, importBatchId, tickerRule, lowResolution);
      const dedup = checkDuplication(tradeData, existingTrades);
      if (dedup.isDuplicate) {
        duplicates.push({
          operationId: op.operationId ?? null,
          ticker: tradeData.ticker,
          reason: dedup.reason,
          matchedTradeId: dedup.matchedTradeId,
        });
      } else {
        prepared.push({ op, tradeData });
      }
    } catch (err) {
      failed.push({
        operationId: op.operationId ?? null,
        ticker: (op.instrument || '').toUpperCase(),
        error: err.message,
      });
    }
  }

  if (prepared.length === 0) {
    return { created, duplicates, failed };
  }

  // Throttling: paralelo (≤ threshold) vs sequencial (> threshold).
  // Decisão: muitas CFs simultâneas geram contenção. Threshold de 20
  // é conservador — ver issue #93 redesign seção 1.4.
  if (prepared.length <= threshold) {
    onProgress(0, prepared.length, `Criando ${prepared.length} trade${prepared.length > 1 ? 's' : ''}...`);
    const results = await Promise.allSettled(
      prepared.map(({ tradeData }) => createTradeFn(tradeData, userContext))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const { op, tradeData } = prepared[i];
      if (r.status === 'fulfilled') {
        const newTrade = r.value || {};
        created.push({
          id: newTrade.id,
          ticker: tradeData.ticker,
          qty: tradeData.qty,
          side: tradeData.side,
          result: newTrade.result ?? null,
          operationId: op.operationId ?? null,
        });
      } else {
        const reason = r.reason;
        failed.push({
          operationId: op.operationId ?? null,
          ticker: tradeData.ticker,
          error: reason?.message || String(reason),
        });
      }
    }
  } else {
    // Sequencial com progresso por trade
    for (let i = 0; i < prepared.length; i++) {
      const { op, tradeData } = prepared[i];
      onProgress(i + 1, prepared.length, `Criando trade ${i + 1} de ${prepared.length}...`);
      try {
        const newTrade = await createTradeFn(tradeData, userContext);
        created.push({
          id: newTrade?.id,
          ticker: tradeData.ticker,
          qty: tradeData.qty,
          side: tradeData.side,
          result: newTrade?.result ?? null,
          operationId: op.operationId ?? null,
        });
      } catch (err) {
        failed.push({
          operationId: op.operationId ?? null,
          ticker: tradeData.ticker,
          error: err.message,
        });
      }
    }
  }

  return { created, duplicates, failed };
}
