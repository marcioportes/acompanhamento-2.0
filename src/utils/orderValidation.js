/**
 * orderValidation.js
 * @version 1.0.0 (v1.20.0)
 * @description Pipeline de validação de ordens em 3 camadas:
 *   Camada 1 — Structural: campos obrigatórios, tipos
 *   Camada 2 — Consistency: lógica interna da ordem (timestamps, preços)
 *   Camada 3 — Business: regras de domínio (duplicação, volume)
 *
 * EXPORTS:
 *   validateOrder(order) → { valid, errors[], warnings[] }
 *   validateBatch(orders) → { validOrders[], invalidOrders[], errors[], warnings[], stats }
 */

// ============================================
// LAYER 1 — STRUCTURAL
// ============================================

const VALID_SIDES = ['BUY', 'SELL'];
const VALID_ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
const VALID_STATUSES = ['SUBMITTED', 'MODIFIED', 'CANCELLED', 'FILLED', 'PARTIALLY_FILLED', 'REJECTED', 'EXPIRED'];

/**
 * Valida campos obrigatórios e tipos.
 * @param {Object} order — NormalizedOrder
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
const validateStructural = (order) => {
  const errors = [];
  const warnings = [];

  // Campos obrigatórios
  if (!order.instrument) errors.push('Instrumento ausente');
  if (!order.side) errors.push('Lado (B/S) ausente');
  else if (!VALID_SIDES.includes(order.side)) errors.push(`Lado inválido: "${order.side}"`);

  if (order.quantity == null) errors.push('Quantidade ausente');
  else if (order.quantity <= 0) errors.push(`Quantidade inválida: ${order.quantity}`);

  if (!order.orderType) warnings.push('Tipo de ordem ausente — será tratado como MARKET');
  else if (!VALID_ORDER_TYPES.includes(order.orderType)) warnings.push(`Tipo de ordem não reconhecido: "${order.orderType}"`);

  if (!order.status) errors.push('Status ausente');
  else if (!VALID_STATUSES.includes(order.status)) errors.push(`Status não reconhecido: "${order.status}"`);

  if (!order.submittedAt) warnings.push('Timestamp de submissão ausente');

  return { valid: errors.length === 0, errors, warnings };
};

// ============================================
// LAYER 2 — CONSISTENCY
// ============================================

/**
 * Valida consistência lógica interna.
 * @param {Object} order — NormalizedOrder
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
const validateConsistency = (order) => {
  const errors = [];
  const warnings = [];

  // Ordem FILLED deve ter filledPrice ou price
  if (order.status === 'FILLED') {
    if (order.filledPrice == null && order.price == null) {
      warnings.push('Ordem FILLED sem preço de execução');
    }
    if (!order.filledAt && !order.submittedAt) {
      warnings.push('Ordem FILLED sem timestamp de execução');
    }
  }

  // Ordem LIMIT deve ter limitPrice
  if (order.orderType === 'LIMIT' && order.limitPrice == null) {
    warnings.push('Ordem LIMIT sem preço limite');
  }

  // Ordem STOP/STOP_LIMIT deve ter stopPrice
  if ((order.orderType === 'STOP' || order.orderType === 'STOP_LIMIT') && order.stopPrice == null) {
    warnings.push('Ordem STOP sem preço de stop');
  }

  // filledAt deve ser >= submittedAt
  if (order.filledAt && order.submittedAt) {
    const filled = new Date(order.filledAt).getTime();
    const submitted = new Date(order.submittedAt).getTime();
    if (filled < submitted) {
      warnings.push('Timestamp de execução anterior ao de submissão');
    }
  }

  // Preço não pode ser negativo
  if (order.filledPrice != null && order.filledPrice < 0) {
    errors.push(`Preço de execução negativo: ${order.filledPrice}`);
  }
  if (order.limitPrice != null && order.limitPrice < 0) {
    errors.push(`Preço limite negativo: ${order.limitPrice}`);
  }

  // filledQuantity não deve exceder quantity
  if (order.filledQuantity != null && order.quantity != null && order.filledQuantity > order.quantity * 1.01) {
    warnings.push(`Quantidade executada (${order.filledQuantity}) excede quantidade original (${order.quantity})`);
  }

  return { valid: errors.length === 0, errors, warnings };
};

// ============================================
// LAYER 3 — BUSINESS RULES
// ============================================

/**
 * Valida regras de negócio no contexto do batch.
 * Chamada por validateBatch, não por validateOrder individual.
 *
 * @param {Object[]} orders — array de NormalizedOrders
 * @returns {{ warnings: string[] }}
 */
const validateBusinessRules = (orders) => {
  const warnings = [];

  if (orders.length === 0) return { warnings };

  // Verificar se há ordens muito antigas (>1 ano) ou futuras
  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

  let oldOrders = 0;
  let futureOrders = 0;

  for (const order of orders) {
    if (order.submittedAt) {
      const ts = new Date(order.submittedAt).getTime();
      if (ts < oneYearAgo) oldOrders++;
      if (ts > now + 24 * 60 * 60 * 1000) futureOrders++; // +1 dia de tolerância
    }
  }

  if (oldOrders > 0) {
    warnings.push(`${oldOrders} ordem(ns) com mais de 1 ano — verifique o período importado`);
  }

  if (futureOrders > 0) {
    warnings.push(`${futureOrders} ordem(ns) com data futura — verifique o formato de data`);
  }

  // Verificar instrumentos variados (pode indicar múltiplas contas misturadas)
  const instruments = new Set(orders.map(o => o.instrument).filter(Boolean));
  if (instruments.size > 20) {
    warnings.push(`${instruments.size} instrumentos diferentes — verifique se o arquivo não mistura múltiplas contas`);
  }

  // Verificar volume por dia
  const dayMap = {};
  for (const order of orders) {
    if (order.submittedAt) {
      const day = order.submittedAt.slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + 1;
    }
  }
  const maxDaily = Math.max(...Object.values(dayMap), 0);
  if (maxDaily > 200) {
    warnings.push(`Pico de ${maxDaily} ordens em um único dia — verifique se não há duplicação`);
  }

  return { warnings };
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Valida uma ordem individual (camadas 1 e 2).
 *
 * @param {Object} order — NormalizedOrder
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export const validateOrder = (order) => {
  const structural = validateStructural(order);
  const consistency = validateConsistency(order);

  return {
    valid: structural.valid && consistency.valid,
    errors: [...structural.errors, ...consistency.errors],
    warnings: [...structural.warnings, ...consistency.warnings],
  };
};

/**
 * Valida batch completo (camadas 1 + 2 + 3).
 *
 * @param {Object[]} orders — array de NormalizedOrders
 * @returns {{
 *   validOrders: Object[],
 *   invalidOrders: Array<{ order: Object, errors: string[], warnings: string[] }>,
 *   batchWarnings: string[],
 *   stats: { total: number, valid: number, invalid: number, warnings: number }
 * }}
 */
export const validateBatch = (orders) => {
  if (!orders?.length) {
    return {
      validOrders: [],
      invalidOrders: [],
      batchWarnings: [],
      stats: { total: 0, valid: 0, invalid: 0, warnings: 0 },
    };
  }

  const validOrders = [];
  const invalidOrders = [];
  let warningCount = 0;

  for (const order of orders) {
    const result = validateOrder(order);
    if (result.valid) {
      // Attach warnings para display
      order._validationWarnings = result.warnings;
      validOrders.push(order);
      if (result.warnings.length > 0) warningCount++;
    } else {
      invalidOrders.push({
        order,
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }

  // Camada 3: business rules no batch válido
  const { warnings: batchWarnings } = validateBusinessRules(validOrders);

  return {
    validOrders,
    invalidOrders,
    batchWarnings,
    stats: {
      total: orders.length,
      valid: validOrders.length,
      invalid: invalidOrders.length,
      warnings: warningCount + batchWarnings.length,
    },
  };
};
