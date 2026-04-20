/**
 * orderReconstruction.js
 * @version 1.1.0 (v1.37.0 — issue #156 Fase D)
 * @description Reconstrói operações (trades) a partir de ordens individuais.
 *   Usa algoritmo de net position: agrupa ordens por instrumento, acumula posição,
 *   e quando net position volta a zero → operação completa.
 *
 * ALGORITMO:
 *   0. Agregar fills N×M (mesmo externalOrderId) via aggregateFills
 *   1. Filtrar ordens FILLED, ordenar cronologicamente por filledAt/submittedAt
 *   2. Para cada instrumento, manter net position (BUY soma, SELL subtrai)
 *   3. Quando net position = 0 → operação completa (entradas + saídas agrupadas)
 *   4. Gap temporal > GAP_THRESHOLD_MS entre ops do mesmo instrumento → flag
 *      hasPriorGap=true na operação seguinte
 *   5. Associar stop orders e canceladas ao intervalo temporal da operação
 *
 * GROUND TRUTH: Validado contra 5 operações reais (19/03/2026, WINJ26)
 * ISSUE #156 Fase D: segmentação por ticker explícita + N×M + gap temporal
 *
 * EXPORTS:
 *   reconstructOperations(orders, opts?) → ReconstructedOperation[]
 *   calculateOperationResult(operation) → { resultPoints, avgEntry, avgExit }
 *   associateNonFilledOrders(operations, allOrders) → operations (mutated)
 *   DEFAULT_GAP_THRESHOLD_MS
 */

import { aggregateFills } from './orderFillAggregator';

// Threshold padrão para considerar gap temporal entre operações do mesmo
// instrumento. 60 minutos cobre janela de almoço, pausas longas intraday
// e qualquer carry-over para o dia seguinte (sessões normais duram >>60min
// só em day trade contínuo). Configurável via opts.gapThresholdMs.
export const DEFAULT_GAP_THRESHOLD_MS = 60 * 60 * 1000;

// ============================================
// HELPERS
// ============================================

/**
 * Extrai timestamp em ms para ordenação.
 * Prioriza filledAt (momento real), fallback submittedAt.
 */
const getEffectiveTimestamp = (order) => {
  const ts = order.filledAt || order.submittedAt;
  if (!ts) return 0;
  return new Date(ts).getTime();
};

/**
 * Calcula preço médio ponderado de um conjunto de ordens.
 * @param {Object[]} orders — ordens com filledPrice e filledQuantity/quantity
 * @returns {number}
 */
const weightedAvgPrice = (orders) => {
  let totalValue = 0;
  let totalQty = 0;
  for (const o of orders) {
    const price = o.filledPrice ?? o.avgFillPrice ?? o.price ?? 0;
    const qty = o.filledQuantity ?? o.quantity ?? 0;
    if (price > 0 && qty > 0) {
      totalValue += price * qty;
      totalQty += qty;
    }
  }
  return totalQty > 0 ? Math.round((totalValue / totalQty) * 1000) / 1000 : 0;
};

/**
 * Determina o side da operação a partir da primeira ordem (abertura).
 * BUY first → LONG, SELL first → SHORT
 */
const operationSide = (firstOrder) => {
  return firstOrder.side === 'BUY' ? 'LONG' : 'SHORT';
};

// ============================================
// MAIN: RECONSTRUCT OPERATIONS
// ============================================

/**
 * Reconstrói operações a partir de ordens FILLED.
 *
 * @param {Object[]} orders — todas as ordens (qualquer status)
 * @param {Object} [opts]
 * @param {number} [opts.gapThresholdMs] — gap em ms para flag hasPriorGap (default 60min)
 * @returns {Object[]} ReconstructedOperation[]
 */
export const reconstructOperations = (orders, opts = {}) => {
  if (!orders?.length) return [];

  const gapThresholdMs = typeof opts.gapThresholdMs === 'number'
    ? opts.gapThresholdMs
    : DEFAULT_GAP_THRESHOLD_MS;

  // Step 0: Agregar fills N×M do mesmo externalOrderId numa ordem lógica única
  const aggregated = aggregateFills(orders);

  // Step 1: Separar FILLED das demais
  const filledOrders = aggregated
    .filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
    .map(o => ({ ...o, _ts: getEffectiveTimestamp(o) }))
    .sort((a, b) => a._ts - b._ts);

  if (!filledOrders.length) return [];

  // Step 2: Segmentar por instrumento — cada ticker tem pipeline próprio de net
  // position. Previne contaminação entre tickers num bust day.
  const byInstrument = {};
  for (const order of filledOrders) {
    const key = (order.instrument || 'UNKNOWN').toUpperCase();
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(order);
  }

  const operations = [];
  let opCounter = 0;

  // Step 3: Para cada instrumento, reconstruir operações por net position
  for (const [instrument, instrumentOrders] of Object.entries(byInstrument)) {
    let netPosition = 0;
    let currentEntries = [];
    let currentExits = [];
    let openingSide = null; // side da primeira ordem (define LONG/SHORT)
    let lastOpExitTs = null; // exitTime da última op fechada neste instrumento (para gap)
    let pendingGap = false; // gap detectado antes da operação atual

    for (const order of instrumentOrders) {
      const qty = order.filledQuantity ?? order.quantity ?? 0;
      if (qty === 0) continue;

      const delta = order.side === 'BUY' ? qty : -qty;

      if (netPosition === 0) {
        // Nova operação — detecta gap contra a última op fechada deste instrumento
        if (lastOpExitTs != null && order._ts - lastOpExitTs > gapThresholdMs) {
          pendingGap = true;
        }
        openingSide = order.side;
        currentEntries = [order];
        currentExits = [];
        netPosition = delta;
      } else {
        // Posição aberta — determinar se é entrada adicional ou saída
        const isEntry = (openingSide === 'BUY' && order.side === 'BUY') ||
                        (openingSide === 'SELL' && order.side === 'SELL');

        if (isEntry) {
          currentEntries.push(order);
        } else {
          currentExits.push(order);
        }
        netPosition += delta;
      }

      // Net position zerou → operação completa
      if (netPosition === 0 && currentEntries.length > 0) {
        opCounter++;
        const side = operationSide(currentEntries[0]);
        const avgEntry = weightedAvgPrice(currentEntries);
        const avgExit = weightedAvgPrice(currentExits);

        const totalQty = currentEntries.reduce((sum, o) => sum + (o.filledQuantity ?? o.quantity ?? 0), 0);

        const resultPoints = side === 'LONG'
          ? Math.round((avgExit - avgEntry) * 1000) / 1000
          : Math.round((avgEntry - avgExit) * 1000) / 1000;

        const entryTime = currentEntries[0]._ts;
        const exitTime = currentExits.length > 0 ? currentExits[currentExits.length - 1]._ts : entryTime;
        const durationMs = exitTime - entryTime;
        const durationStr = formatDuration(durationMs);

        operations.push({
          operationId: `OP-${String(opCounter).padStart(3, '0')}`,
          instrument,
          side,
          entryOrders: currentEntries.map(stripInternal),
          exitOrders: currentExits.map(stripInternal),
          stopOrders: [],       // preenchido em associateNonFilledOrders
          cancelledOrders: [],  // preenchido em associateNonFilledOrders
          totalQty,
          avgEntryPrice: avgEntry,
          avgExitPrice: avgExit,
          resultPoints,
          entryTime: new Date(entryTime).toISOString(),
          exitTime: new Date(exitTime).toISOString(),
          duration: durationStr,
          durationMs,
          hasStopProtection: false,   // preenchido em associateNonFilledOrders
          stopExecuted: false,        // preenchido em associateNonFilledOrders
          stopMovements: [],          // preenchido em stopMovementAnalysis
          autoObservation: null,      // preenchido em stopMovementAnalysis
          hasPriorGap: pendingGap,    // Fase D: gap temporal antes desta op
        });

        // Reset — mantém lastOpExitTs para detectar gap na próxima
        lastOpExitTs = exitTime;
        pendingGap = false;
        currentEntries = [];
        currentExits = [];
        openingSide = null;
      }
    }

    // Operação incompleta (posição aberta no final)
    if (netPosition !== 0 && currentEntries.length > 0) {
      opCounter++;
      const side = operationSide(currentEntries[0]);
      const avgEntry = weightedAvgPrice(currentEntries);
      const totalQty = currentEntries.reduce((sum, o) => sum + (o.filledQuantity ?? o.quantity ?? 0), 0);

      operations.push({
        operationId: `OP-${String(opCounter).padStart(3, '0')}`,
        instrument,
        side,
        entryOrders: currentEntries.map(stripInternal),
        exitOrders: currentExits.map(stripInternal),
        stopOrders: [],
        cancelledOrders: [],
        totalQty,
        avgEntryPrice: avgEntry,
        avgExitPrice: currentExits.length > 0 ? weightedAvgPrice(currentExits) : 0,
        resultPoints: null, // posição aberta — sem resultado
        entryTime: new Date(currentEntries[0]._ts).toISOString(),
        exitTime: null,
        duration: null,
        durationMs: null,
        hasStopProtection: false,
        stopExecuted: false,
        stopMovements: [],
        autoObservation: 'POSIÇÃO ABERTA — operação incompleta no período importado',
        hasPriorGap: pendingGap,
        _isOpen: true,
      });
    }
  }

  // Step 4: Ordenar operações cronologicamente
  operations.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());

  // Re-numerar após sort
  operations.forEach((op, i) => {
    op.operationId = `OP-${String(i + 1).padStart(3, '0')}`;
  });

  return operations;
};

// ============================================
// ASSOCIATE NON-FILLED ORDERS
// ============================================

/**
 * Associa ordens não-FILLED (CANCELLED, stops) às operações reconstruídas.
 * Usa janela temporal: ordem associada à operação cujo intervalo [entryTime, exitTime] contém
 * o submittedAt da ordem. Tolerância de 60s antes da entrada e 60s após a saída.
 *
 * @param {Object[]} operations — output de reconstructOperations (mutated in place)
 * @param {Object[]} allOrders — todas as ordens (incluindo CANCELLED, stops)
 * @returns {Object[]} operations (mesma referência, mutated)
 */
export const associateNonFilledOrders = (operations, allOrders) => {
  const TOLERANCE_MS = 60 * 1000; // 60 segundos

  const nonFilled = allOrders.filter(o =>
    o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED' ||
    (o.isStopOrder && o.status !== 'FILLED') // stop orders canceladas
  );

  for (const order of nonFilled) {
    const orderTs = new Date(order.submittedAt || order.cancelledAt || 0).getTime();
    if (!orderTs) continue;

    // Encontrar operação cujo intervalo contém o timestamp desta ordem
    let bestOp = null;
    let bestDistance = Infinity;

    for (const op of operations) {
      const opStart = new Date(op.entryTime).getTime() - TOLERANCE_MS;
      const opEnd = op.exitTime ? new Date(op.exitTime).getTime() + TOLERANCE_MS : opStart + (30 * 60 * 1000);

      if (orderTs >= opStart && orderTs <= opEnd) {
        // Dentro do intervalo — medir distância ao centro para desempate
        const center = (opStart + opEnd) / 2;
        const dist = Math.abs(orderTs - center);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOp = op;
        }
      }
    }

    if (!bestOp) continue;

    // Classificar a ordem
    if (order.isStopOrder) {
      bestOp.stopOrders.push(stripInternal(order));
      bestOp.hasStopProtection = true;
      // Stop executado = stop order que foi FILLED
      if (order.status === 'FILLED') {
        bestOp.stopExecuted = true;
      }
    } else {
      bestOp.cancelledOrders.push(stripInternal(order));
    }
  }

  // Detectar stop executado via saída com origin=Zeragem
  for (const op of operations) {
    if (!op.stopExecuted) {
      const hasZeragem = op.exitOrders.some(o => (o.origin || '').toLowerCase() === 'zeragem');
      if (hasZeragem) {
        op.stopExecuted = true;
      }
    }
  }

  return operations;
};

// ============================================
// CALCULATE OPERATION RESULT
// ============================================

/**
 * Recalcula resultado de uma operação (utility para verificação).
 * @param {Object} operation
 * @returns {{ resultPoints: number, avgEntry: number, avgExit: number }}
 */
export const calculateOperationResult = (operation) => {
  const avgEntry = weightedAvgPrice(operation.entryOrders);
  const avgExit = weightedAvgPrice(operation.exitOrders);

  const resultPoints = operation.side === 'LONG'
    ? Math.round((avgExit - avgEntry) * 1000) / 1000
    : Math.round((avgEntry - avgExit) * 1000) / 1000;

  return { resultPoints, avgEntry, avgExit };
};

// ============================================
// HELPERS (internal)
// ============================================

/**
 * Remove campos internos (_ts, _raw, etc) de uma ordem para serialização limpa.
 */
const stripInternal = (order) => {
  const { _ts, _raw, _dedupKey, _rowIndex, _validationWarnings, ...clean } = order;
  return { ...clean, _rowIndex };
};

/**
 * Formata duração em ms para string legível.
 */
const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') + 'min' : ''}${seconds > 0 ? String(seconds).padStart(2, '0') + 's' : ''}`;
  if (minutes > 0) return `${minutes}min${seconds > 0 ? String(seconds).padStart(2, '0') + 's' : ''}`;
  return `${seconds}s`;
};
