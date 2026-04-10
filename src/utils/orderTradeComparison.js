/**
 * orderTradeComparison.js
 * @version 1.0.0 (v1.1.0 — issue #93, V1.1b)
 * @description Modo Confronto: compara operações reconstruídas da corretora
 *   com trades existentes no diário, detecta divergências e prepara batch
 *   para ações do aluno ("Aceitar como está" ou "Atualizar com corretora").
 *
 * Divergências por severidade:
 *   - HIGH: entry, exit, qty (números financeiros)
 *   - MEDIUM: stopLoss (gestão de risco), contagem de parciais
 *   - LOW: timing dentro da janela de correlação (±5min)
 *
 * INV-01: Dados de orders NUNCA escrevem direto em trades.
 * INV-02: Atualizacao faz DELETE + CREATE via tradeGateway (nunca updateTrade).
 */

import { CORRELATION_WINDOW_MS } from './orderCorrelation';

// ============================================
// CONSTANTS
// ============================================

/** Tolerância para comparação de preços (em unidades do ativo) */
const PRICE_TOLERANCE = 0.01;

/** Tolerância para comparação de stopLoss */
const STOP_TOLERANCE = 0.01;

export const DIVERGENCE_SEVERITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const DIVERGENCE_FIELD = {
  ENTRY: 'entry',
  EXIT: 'exit',
  QTY: 'qty',
  SIDE: 'side',
  STOP_LOSS: 'stopLoss',
  ENTRY_TIME: 'entryTime',
  EXIT_TIME: 'exitTime',
  PARTIALS_COUNT: 'partialsCount',
};

// ============================================
// DIVERGENCE DETECTION
// ============================================

/**
 * Compara campo por campo operação vs trade, retorna divergências encontradas.
 *
 * @param {Object} operation — ReconstructedOperation
 * @param {Object} trade — trade existente
 * @returns {{ divergences: Object[], hasDivergences: boolean, maxSeverity: string|null }}
 */
export function compareOperationWithTrade(operation, trade) {
  const divergences = [];

  // Side (alto — inconsistência lógica fundamental)
  if (operation.side !== trade.side) {
    divergences.push({
      field: DIVERGENCE_FIELD.SIDE,
      severity: DIVERGENCE_SEVERITY.HIGH,
      operationValue: operation.side,
      tradeValue: trade.side,
      label: 'Direção',
    });
  }

  // Entry price (HIGH)
  const opEntry = Number(operation.avgEntryPrice);
  const trEntry = Number(trade.entry);
  if (Number.isFinite(opEntry) && Number.isFinite(trEntry) && Math.abs(opEntry - trEntry) > PRICE_TOLERANCE) {
    divergences.push({
      field: DIVERGENCE_FIELD.ENTRY,
      severity: DIVERGENCE_SEVERITY.HIGH,
      operationValue: opEntry,
      tradeValue: trEntry,
      delta: Math.round((opEntry - trEntry) * 100) / 100,
      label: 'Preço médio de entrada',
    });
  }

  // Exit price (HIGH)
  const opExit = Number(operation.avgExitPrice);
  const trExit = Number(trade.exit);
  if (Number.isFinite(opExit) && Number.isFinite(trExit) && Math.abs(opExit - trExit) > PRICE_TOLERANCE) {
    divergences.push({
      field: DIVERGENCE_FIELD.EXIT,
      severity: DIVERGENCE_SEVERITY.HIGH,
      operationValue: opExit,
      tradeValue: trExit,
      delta: Math.round((opExit - trExit) * 100) / 100,
      label: 'Preço médio de saída',
    });
  }

  // Qty (HIGH — exato)
  const opQty = Number(operation.totalQty);
  const trQty = Number(trade.qty);
  if (Number.isFinite(opQty) && Number.isFinite(trQty) && opQty !== trQty) {
    divergences.push({
      field: DIVERGENCE_FIELD.QTY,
      severity: DIVERGENCE_SEVERITY.HIGH,
      operationValue: opQty,
      tradeValue: trQty,
      delta: opQty - trQty,
      label: 'Quantidade',
    });
  }

  // Stop loss (MEDIUM) — compara presença e valor
  const opStopPrice = operation.stopOrders?.length > 0
    ? Number(operation.stopOrders[operation.stopOrders.length - 1].stopPrice
        ?? operation.stopOrders[operation.stopOrders.length - 1].price)
    : null;
  const trStop = trade.stopLoss != null ? Number(trade.stopLoss) : null;

  const opHasStop = opStopPrice != null && Number.isFinite(opStopPrice);
  const trHasStop = trStop != null && Number.isFinite(trStop);

  if (opHasStop !== trHasStop) {
    divergences.push({
      field: DIVERGENCE_FIELD.STOP_LOSS,
      severity: DIVERGENCE_SEVERITY.MEDIUM,
      operationValue: opHasStop ? opStopPrice : null,
      tradeValue: trHasStop ? trStop : null,
      label: opHasStop ? 'Stop presente na corretora, ausente no diário' : 'Stop no diário, ausente na corretora',
    });
  } else if (opHasStop && trHasStop && Math.abs(opStopPrice - trStop) > STOP_TOLERANCE) {
    divergences.push({
      field: DIVERGENCE_FIELD.STOP_LOSS,
      severity: DIVERGENCE_SEVERITY.MEDIUM,
      operationValue: opStopPrice,
      tradeValue: trStop,
      delta: Math.round((opStopPrice - trStop) * 100) / 100,
      label: 'Stop loss',
    });
  }

  // Partials count (MEDIUM) — operação reconstruída tem N ordens, trade tem N parciais
  const opPartialsCount = (operation.entryOrders?.length || 0) + (operation.exitOrders?.length || 0);
  const trPartialsCount = trade._partials?.length || 0;
  if (opPartialsCount !== trPartialsCount && trPartialsCount > 0) {
    divergences.push({
      field: DIVERGENCE_FIELD.PARTIALS_COUNT,
      severity: DIVERGENCE_SEVERITY.MEDIUM,
      operationValue: opPartialsCount,
      tradeValue: trPartialsCount,
      delta: opPartialsCount - trPartialsCount,
      label: 'Número de parciais',
    });
  }

  // Entry time (LOW) — diferença > janela de correlação
  if (operation.entryTime && trade.entryTime) {
    const opTime = new Date(operation.entryTime).getTime();
    const trTime = new Date(trade.entryTime).getTime();
    if (Number.isFinite(opTime) && Number.isFinite(trTime)) {
      const deltaMs = Math.abs(opTime - trTime);
      if (deltaMs > CORRELATION_WINDOW_MS) {
        divergences.push({
          field: DIVERGENCE_FIELD.ENTRY_TIME,
          severity: DIVERGENCE_SEVERITY.LOW,
          operationValue: operation.entryTime,
          tradeValue: trade.entryTime,
          deltaMinutes: Math.round(deltaMs / 60000),
          label: 'Horário de entrada',
        });
      }
    }
  }

  // Exit time (LOW)
  if (operation.exitTime && trade.exitTime) {
    const opTime = new Date(operation.exitTime).getTime();
    const trTime = new Date(trade.exitTime).getTime();
    if (Number.isFinite(opTime) && Number.isFinite(trTime)) {
      const deltaMs = Math.abs(opTime - trTime);
      if (deltaMs > CORRELATION_WINDOW_MS) {
        divergences.push({
          field: DIVERGENCE_FIELD.EXIT_TIME,
          severity: DIVERGENCE_SEVERITY.LOW,
          operationValue: operation.exitTime,
          tradeValue: trade.exitTime,
          deltaMinutes: Math.round(deltaMs / 60000),
          label: 'Horário de saída',
        });
      }
    }
  }

  // Severidade máxima (ordem: HIGH > MEDIUM > LOW)
  const severityRank = { high: 3, medium: 2, low: 1 };
  let maxSeverity = null;
  let maxRank = 0;
  for (const d of divergences) {
    if (severityRank[d.severity] > maxRank) {
      maxRank = severityRank[d.severity];
      maxSeverity = d.severity;
    }
  }

  return {
    divergences,
    hasDivergences: divergences.length > 0,
    maxSeverity,
  };
}

// ============================================
// BATCH PREPARATION
// ============================================
