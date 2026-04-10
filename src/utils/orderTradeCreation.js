/**
 * orderTradeCreation.js
 * @version 1.0.0 (v1.1.0 — issue #93)
 * @description Modo Criação: identifica operações ghost (sem trade correspondente),
 *   mapeia operação reconstruída → tradeData, e verifica deduplicação.
 *
 * Pipeline: ghostOperations → mapOperationToTradeData → dedup check → createTrade
 *
 * INV-01: Dados de orders NUNCA escrevem direto em trades.
 * INV-02: Toda escrita em trades via createTrade (tradeGateway).
 * INV-12: _partials é campo array inline no documento.
 */

import { CORRELATION_WINDOW_MS } from './orderCorrelation';

// ============================================
// CONFIRMED OPS CATEGORIZATION (issue #93 redesign)
// ============================================

/**
 * Particiona operações confirmadas em três grupos baseado em correlação com trades existentes:
 *   - toCreate: operações sem nenhuma ordem correlacionada → criação automática
 *   - toConfront: operações cujas ordens correlacionam com EXATAMENTE 1 trade → confronto enriquecido
 *   - ambiguous: operações cujas ordens correlacionam com 2+ trades → decisão manual
 *
 * Substitui o uso de identifyGhostOperations + identifyMatchedOperations no fluxo
 * principal. Resolve o bug de operações mistas em limbo (issue #93 redesign).
 *
 * Lookup por _rowIndex (identificador estável do parser) — sem fallback por
 * instrumento que causa falsos positivos.
 *
 * @param {Object[]} operations — operações reconstruídas (output de reconstructOperations)
 * @param {Object[]} correlations — output de correlateOrders().correlations
 * @returns {{
 *   toCreate: Object[],
 *   toConfront: Array<{ operation: Object, tradeId: string }>,
 *   ambiguous: Array<{ operation: Object, tradeIds: string[] }>
 * }}
 */
export function categorizeConfirmedOps(operations, correlations) {
  if (!operations?.length) {
    return { toCreate: [], toConfront: [], ambiguous: [] };
  }

  // Index correlations matched por _rowIndex (identificador estável do parser)
  const tradeIdByRowIndex = new Map();
  if (correlations?.length) {
    for (const c of correlations) {
      if (c.tradeId && c.matchType !== 'ghost') {
        tradeIdByRowIndex.set(c.orderIndex, c.tradeId);
      }
    }
  }

  const toCreate = [];
  const toConfront = [];
  const ambiguous = [];

  for (const op of operations) {
    if (op._isOpen) continue;
    if (!op.entryOrders?.length || !op.exitOrders?.length) continue;

    const filledOrders = [
      ...(op.entryOrders || []),
      ...(op.exitOrders || []),
    ];

    // Coletar tradeIds únicos correlacionados a alguma das ordens da op
    const tradeIds = new Set();
    for (const order of filledOrders) {
      const tid = tradeIdByRowIndex.get(order._rowIndex);
      if (tid) tradeIds.add(tid);
    }

    if (tradeIds.size === 0) {
      toCreate.push(op);
    } else if (tradeIds.size === 1) {
      const [tradeId] = tradeIds;
      toConfront.push({ operation: op, tradeId });
    } else {
      ambiguous.push({ operation: op, tradeIds: [...tradeIds] });
    }
  }

  return { toCreate, toConfront, ambiguous };
}

// ============================================
// OPERATION → TRADE DATA MAPPING
// ============================================

/**
 * Converte uma operação reconstruída em tradeData compatível com createTrade.
 *
 * @param {Object} operation — ReconstructedOperation
 * @param {string} planId — ID do plano selecionado
 * @param {string|null} importBatchId — batch ID da importação de ordens
 * @param {Object|null} tickerRule — { tickSize, tickValue, pointValue } resolvido do master data
 * @param {boolean} lowResolution — flag de resolução temporal do CSV (issue #93 redesign);
 *   quando true, padrões comportamentais que dependem de segundos ficam inconclusive
 * @returns {Object} tradeData pronto para createTrade
 */
export function mapOperationToTradeData(operation, planId, importBatchId = null, tickerRule = null, lowResolution = false) {
  if (!operation || !planId) {
    throw new Error('Operação e planId são obrigatórios');
  }

  // Side: operação já tem LONG/SHORT
  const side = operation.side;

  // Construir _partials a partir das ordens de entrada e saída (INV-12)
  const partials = [];
  let seq = 1;

  for (const entry of (operation.entryOrders || [])) {
    partials.push({
      type: 'ENTRY',
      price: parseFloat(entry.filledPrice || entry.price) || 0,
      qty: parseFloat(entry.filledQuantity || entry.quantity) || 0,
      dateTime: entry.filledAt || entry.submittedAt || null,
      seq: seq++,
    });
  }

  for (const exit of (operation.exitOrders || [])) {
    partials.push({
      type: 'EXIT',
      price: parseFloat(exit.filledPrice || exit.price) || 0,
      qty: parseFloat(exit.filledQuantity || exit.quantity) || 0,
      dateTime: exit.filledAt || exit.submittedAt || null,
      seq: seq++,
    });
  }

  // Stop loss: se operação tem proteção de stop, extrair preço do stop
  let stopLoss = null;
  if (operation.hasStopProtection && operation.stopOrders?.length > 0) {
    // Usar o último stop order configurado (pode ter sido movido)
    const lastStop = operation.stopOrders[operation.stopOrders.length - 1];
    stopLoss = parseFloat(lastStop.stopPrice || lastStop.price) || null;
  }

  return {
    planId,
    ticker: (operation.instrument || '').toUpperCase(),
    side,
    entry: String(operation.avgEntryPrice ?? 0),
    exit: String(operation.avgExitPrice ?? 0),
    qty: String(operation.totalQty ?? 0),
    entryTime: operation.entryTime || null,
    exitTime: operation.exitTime || null,
    stopLoss,
    // Ticker specs para cálculo correto de result em futuros (tickSize/tickValue/pointValue)
    tickerRule: tickerRule ?? null,
    // Campos comportamentais pendentes (aluno complementa depois)
    emotionEntry: null,
    emotionExit: null,
    setup: null,
    // Rastreabilidade (DEC aprovado — source canônico + compatibilidade CSV)
    source: 'order_import',
    importSource: 'order_import',
    importBatchId: importBatchId ?? null,
    // Parciais reconstruídas das ordens reais da corretora (INV-12)
    _partials: partials,
    // Metadado para UI saber que este trade veio de ordens
    operationId: operation.operationId ?? null,
    // Resolução temporal do CSV (issue #93 redesign — shadow detection futuro)
    lowResolution,
  };
}

// ============================================
// DEDUPLICAÇÃO
// ============================================

/**
 * Verifica se já existe um trade com os mesmos dados (ticker + side + entryTime ±5min + qty).
 * Protege contra criação duplicada.
 *
 * @param {Object} tradeData — output de mapOperationToTradeData
 * @param {Object[]} existingTrades — trades existentes do plano
 * @returns {{ isDuplicate: boolean, matchedTradeId: string|null, reason: string|null }}
 */
export function checkDuplication(tradeData, existingTrades) {
  if (!existingTrades?.length) {
    return { isDuplicate: false, matchedTradeId: null, reason: null };
  }

  const ticker = (tradeData.ticker || '').toUpperCase();
  const side = tradeData.side;
  const qty = parseFloat(tradeData.qty) || 0;
  const entryTime = tradeData.entryTime ? new Date(tradeData.entryTime).getTime() : null;

  for (const trade of existingTrades) {
    const tradeTicker = (trade.ticker || '').toUpperCase();
    if (tradeTicker !== ticker) continue;

    const tradeSide = trade.side;
    if (tradeSide !== side) continue;

    const tradeQty = parseFloat(trade.qty) || 0;
    if (Math.abs(tradeQty - qty) > 0.01) continue;

    // Timestamp: ±5 minutos (CORRELATION_WINDOW_MS)
    if (entryTime != null) {
      const tradeEntryTime = trade.entryTime ? new Date(trade.entryTime).getTime() : null;
      if (tradeEntryTime != null) {
        const delta = Math.abs(entryTime - tradeEntryTime);
        if (delta <= CORRELATION_WINDOW_MS) {
          return {
            isDuplicate: true,
            matchedTradeId: trade.id,
            reason: `Trade existente ${trade.id}: ${tradeTicker} ${tradeSide} ${tradeQty}x @ ${trade.entryTime}`,
          };
        }
      } else {
        // Trade sem hora — comparar por data
        const tradeDate = trade.date || (trade.entryTime ? trade.entryTime.split('T')[0] : null);
        const opDate = tradeData.entryTime ? tradeData.entryTime.split('T')[0] : null;
        if (tradeDate && opDate && tradeDate === opDate) {
          return {
            isDuplicate: true,
            matchedTradeId: trade.id,
            reason: `Trade existente ${trade.id}: ${tradeTicker} ${tradeSide} ${tradeQty}x na mesma data ${tradeDate}`,
          };
        }
      }
    }
  }

  return { isDuplicate: false, matchedTradeId: null, reason: null };
}

