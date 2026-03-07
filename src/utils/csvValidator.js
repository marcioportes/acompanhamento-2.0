/**
 * csvValidator.js
 * @version 1.0.0 (v1.18.0)
 * @description Validação de trades parseados do CSV antes do import.
 *   Verifica tipos, ranges, consistência de dados.
 *
 * EXPORTS:
 *   validateTrade(trade) → { valid: boolean, warnings: string[], errors: string[] }
 *   validateBatch(trades) → { validTrades, invalidTrades, warnings, stats }
 */

/**
 * Valida um trade individual.
 * @param {Object} trade - Trade mapeado do CSV
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export const validateTrade = (trade) => {
  const errors = [];
  const warnings = [];

  if (!trade) return { valid: false, warnings, errors: ['Trade vazio'] };

  // Obrigatórios
  if (!trade.ticker) errors.push('Ticker não informado');
  if (!trade.side || !['LONG', 'SHORT'].includes(trade.side)) errors.push(`Side inválido: "${trade.side || ''}"`);
  if (trade.entry == null || isNaN(trade.entry)) errors.push('Preço entrada inválido');
  if (trade.exit == null || isNaN(trade.exit)) errors.push('Preço saída inválido');
  if (trade.qty == null || isNaN(trade.qty) || trade.qty <= 0) errors.push('Quantidade inválida');
  if (!trade.entryTime) errors.push('Data/hora entrada não informada');

  // Validações de range
  if (trade.entry != null && trade.entry <= 0) errors.push('Preço entrada deve ser positivo');
  if (trade.exit != null && trade.exit <= 0) errors.push('Preço saída deve ser positivo');
  if (trade.qty != null && trade.qty > 10000) warnings.push('Quantidade muito alta (>10.000)');

  // Validação de data
  if (trade.entryTime) {
    const d = new Date(trade.entryTime);
    if (isNaN(d.getTime())) {
      errors.push('Data entrada inválida');
    } else {
      if (d > new Date()) warnings.push('Data entrada no futuro');
      if (d.getFullYear() < 2000) warnings.push('Data entrada anterior a 2000');
    }
  }

  // Consistência entry/exit vs side
  if (trade.entry != null && trade.exit != null && trade.side) {
    const diff = trade.side === 'LONG' ? trade.exit - trade.entry : trade.entry - trade.exit;
    // Não é erro — trades com loss são normais. Mas resultado extremo é warning.
    if (trade.entry > 0) {
      const pctMove = Math.abs(diff / trade.entry) * 100;
      if (pctMove > 20) warnings.push(`Movimento de ${pctMove.toFixed(1)}% — verificar preços`);
    }
  }

  // Stop loss
  if (trade.stopLoss != null) {
    if (isNaN(trade.stopLoss)) warnings.push('Stop loss não numérico');
    if (trade.stopLoss <= 0) warnings.push('Stop loss deve ser positivo');
    if (trade.side === 'LONG' && trade.stopLoss >= trade.entry) {
      warnings.push('Stop loss acima do preço de entrada (LONG)');
    }
    if (trade.side === 'SHORT' && trade.stopLoss <= trade.entry) {
      warnings.push('Stop loss abaixo do preço de entrada (SHORT)');
    }
  }

  // Resultado override
  if (trade.result != null && isNaN(trade.result)) {
    warnings.push('Resultado informado não é numérico — será recalculado');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
};

/**
 * Valida um batch de trades.
 * @param {Object[]} trades - Array de trades mapeados
 * @returns {{ validTrades: Object[], invalidTrades: Object[], warnings: Object[], stats: Object }}
 */
export const validateBatch = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      validTrades: [],
      invalidTrades: [],
      warnings: [],
      stats: { total: 0, valid: 0, invalid: 0, withWarnings: 0 },
    };
  }

  const validTrades = [];
  const invalidTrades = [];
  const allWarnings = [];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const { valid, warnings, errors } = validateTrade(trade);
    const rowIndex = trade._rowIndex || i + 1;

    if (valid) {
      validTrades.push({ ...trade, _warnings: warnings });
      if (warnings.length > 0) {
        allWarnings.push({ row: rowIndex, warnings });
      }
    } else {
      invalidTrades.push({ ...trade, _errors: errors, _warnings: warnings, _rowIndex: rowIndex });
    }
  }

  // Detectar duplicatas (mesmo ticker + side + entryTime)
  const seen = new Set();
  for (const trade of validTrades) {
    const key = `${trade.ticker}|${trade.side}|${trade.entryTime}`;
    if (seen.has(key)) {
      trade._warnings = trade._warnings || [];
      trade._warnings.push('Possível duplicata: mesmo ticker, side e horário');
    }
    seen.add(key);
  }

  return {
    validTrades,
    invalidTrades,
    warnings: allWarnings,
    stats: {
      total: trades.length,
      valid: validTrades.length,
      invalid: invalidTrades.length,
      withWarnings: allWarnings.length,
    },
  };
};

/**
 * Resume estatísticas de campos incompletos num batch.
 * @param {Object[]} trades - Trades válidos
 * @returns {{ field: string, count: number, percent: number }[]}
 */
export const getIncompleteSummary = (trades) => {
  if (!trades || trades.length === 0) return [];

  const total = trades.length;
  const counts = {
    emotionEntry: 0,
    emotionExit: 0,
    stopLoss: 0,
    exitTime: 0,
    setup: 0,
  };

  for (const t of trades) {
    if (!t.emotionEntry) counts.emotionEntry++;
    if (!t.emotionExit) counts.emotionExit++;
    if (t.stopLoss == null) counts.stopLoss++;
    if (!t.exitTime) counts.exitTime++;
    if (!t.setup) counts.setup++;
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([field, count]) => ({
      field,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
};
