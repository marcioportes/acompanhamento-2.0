/**
 * stopMovementAnalysis.js
 * @version 1.0.0 (v1.20.0)
 * @description Analisa movimentações de stop orders dentro de operações reconstruídas.
 *   Detecta: cancelamento sem reemissão, trailing (proteção), widening (aumento de risco).
 *   Gera observações pré-preenchidas e red flags factuais (sem julgamento de severity).
 *
 * PRINCÍPIO: Registrar o FATO OBJETIVO. O mentor/aluno decide se foi legítimo.
 *   Red flag = sinal para atenção, não condenação automática.
 *
 * EXPORTS:
 *   analyzeStopMovements(operation, allOrders) → StopAnalysis
 *   enrichOperationsWithStopAnalysis(operations, allOrders) → operations (mutated)
 */

// ============================================
// STOP ANALYSIS
// ============================================

/**
 * Analisa movimentações de stop em uma operação.
 *
 * @param {Object} operation — ReconstructedOperation (com stopOrders, exitOrders)
 * @param {Object[]} allOrders — todas as ordens do batch (para encontrar stops reemitidos)
 * @returns {{
 *   movements: StopMovement[],
 *   flags: StopFlag[],
 *   observation: string|null
 * }}
 */
export const analyzeStopMovements = (operation) => {
  const movements = [];
  const flags = [];
  const observations = [];

  const { stopOrders, exitOrders, entryOrders, side, instrument } = operation;

  // Sem stop orders associadas
  if (!stopOrders?.length) {
    // Verificar se a operação tem stop executado (via Zeragem) mesmo sem stop order explícita
    if (!operation.stopExecuted) {
      flags.push({
        type: 'NO_STOP_ORDER',
        description: `Operação ${side} ${instrument} sem ordem de stop registrada`,
      });
      observations.push('Nenhuma ordem de stop detectada nesta operação');
    }
    return { movements, flags, observation: observations.join('. ') || null };
  }

  // Analisar cada stop order
  const cancelledStops = stopOrders.filter(s => s.status === 'CANCELLED');
  const filledStops = stopOrders.filter(s => s.status === 'FILLED');

  // Caso 1: Stop cancelado sem reemissão
  if (cancelledStops.length > 0 && filledStops.length === 0 && !operation.stopExecuted) {
    for (const stop of cancelledStops) {
      const cancelTime = stop.cancelledAt || stop.lastUpdatedAt;
      movements.push({
        type: 'CANCELLED',
        originalPrice: stop.stopPrice ?? stop.price,
        newPrice: null,
        direction: 'REMOVED',
        timestamp: cancelTime,
        orderId: stop.externalOrderId,
      });
    }
    flags.push({
      type: 'STOP_REMOVED',
      description: `Stop cancelado sem reemissão — operação ficou sem proteção`,
    });
    observations.push(`Stop cancelado (${cancelledStops.map(s => formatPrice(s.stopPrice ?? s.price)).join(', ')}). Operação prosseguiu sem proteção`);
  }

  // Caso 2: Stop cancelado E saída por Zeragem (stop executado por outro mecanismo)
  if (cancelledStops.length > 0 && operation.stopExecuted) {
    for (const stop of cancelledStops) {
      movements.push({
        type: 'CANCELLED_BUT_STOPPED',
        originalPrice: stop.stopPrice ?? stop.price,
        newPrice: null,
        direction: 'REPLACED_BY_ZERAGEM',
        timestamp: stop.cancelledAt || stop.lastUpdatedAt,
        orderId: stop.externalOrderId,
      });
    }
    observations.push(`Stop original cancelado, mas operação encerrada por zeragem (stop manual ou automático)`);
  }

  // Caso 3: Múltiplos stops (cancelamento + reemissão)
  if (stopOrders.length >= 2) {
    // Ordenar por timestamp
    const sorted = [...stopOrders].sort((a, b) =>
      new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevPrice = prev.stopPrice ?? prev.price ?? 0;
      const currPrice = curr.stopPrice ?? curr.price ?? 0;

      if (prevPrice > 0 && currPrice > 0 && prevPrice !== currPrice) {
        const direction = determineStopDirection(side, prevPrice, currPrice);
        movements.push({
          type: 'REISSUE',
          originalPrice: prevPrice,
          newPrice: currPrice,
          direction,
          timestamp: curr.submittedAt,
          orderId: curr.externalOrderId,
        });

        if (direction === 'WIDENED') {
          flags.push({
            type: 'STOP_WIDENED',
            description: `Stop movido de ${formatPrice(prevPrice)} para ${formatPrice(currPrice)} — risco inicial aumentado`,
          });
          observations.push(`Stop ampliado: ${formatPrice(prevPrice)} → ${formatPrice(currPrice)} (risco aumentou)`);
        } else if (direction === 'TIGHTENED') {
          observations.push(`Stop ajustado: ${formatPrice(prevPrice)} → ${formatPrice(currPrice)} (proteção de lucro)`);
        }
      }
    }
  }

  // Caso 4: Stop executado (FILLED)
  if (filledStops.length > 0) {
    flags.push({
      type: 'STOP_EXECUTED',
      description: `Stop executado — perda controlada conforme plano`,
    });
  }

  return {
    movements,
    flags,
    observation: observations.join('. ') || null,
  };
};

// ============================================
// ENRICH OPERATIONS
// ============================================

/**
 * Enriquece operações reconstruídas com análise de stop movements.
 * Mutates operations in place.
 *
 * @param {Object[]} operations — output de reconstructOperations + associateNonFilledOrders
 * @returns {Object[]} mesma referência, mutated
 */
export const enrichOperationsWithStopAnalysis = (operations) => {
  for (const op of operations) {
    const analysis = analyzeStopMovements(op);
    op.stopMovements = analysis.movements;
    op.stopFlags = analysis.flags;
    if (analysis.observation) {
      op.autoObservation = analysis.observation;
    }
  }
  return operations;
};

// ============================================
// HELPERS
// ============================================

/**
 * Determina se o stop foi ampliado (mais risco) ou apertado (menos risco).
 *
 * LONG: stop abaixo do entry. Se novo stop < antigo → WIDENED (mais longe). Se > → TIGHTENED.
 * SHORT: stop acima do entry. Se novo stop > antigo → WIDENED. Se < → TIGHTENED.
 *
 * @param {'LONG'|'SHORT'} side
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {'WIDENED'|'TIGHTENED'|'UNCHANGED'}
 */
const determineStopDirection = (side, oldPrice, newPrice) => {
  if (oldPrice === newPrice) return 'UNCHANGED';

  if (side === 'LONG') {
    // LONG: stop está abaixo. Se novo preço é mais baixo → mais longe → mais risco
    return newPrice < oldPrice ? 'WIDENED' : 'TIGHTENED';
  } else {
    // SHORT: stop está acima. Se novo preço é mais alto → mais longe → mais risco
    return newPrice > oldPrice ? 'WIDENED' : 'TIGHTENED';
  }
};

/**
 * Formata preço para exibição em observações.
 */
const formatPrice = (price) => {
  if (price == null) return '—';
  return price.toLocaleString('pt-BR');
};
