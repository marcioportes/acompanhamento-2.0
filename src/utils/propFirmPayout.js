/**
 * propFirmPayout — Lógica pura de payout tracking para contas PROP
 * @description Qualifying days, payout eligibility, simulador de saque.
 *   Toda lógica é pura (sem side-effects, sem Firestore).
 *   Dados derivados de drawdownHistory + template + account.propFirm.
 *
 * Ref: issue #134 Fase D, epic #52
 */

// ============================================
// Qualifying Days — dias com profit no range da mesa
// ============================================

/**
 * Calcula qualifying days a partir do histórico de drawdown.
 * Agrupa trades por data, soma dailyPnL por dia, conta dias no range.
 *
 * @param {Array} drawdownHistory - docs da subcollection drawdownHistory (cronológico)
 * @param {Object} qualifyingConfig - template.payout.qualifyingDays
 * @param {number|null} qualifyingConfig.count - número de qualifying days necessários (null = sem requisito)
 * @param {number|null} qualifyingConfig.minProfit - profit mínimo por dia para qualificar
 * @param {number|null} qualifyingConfig.maxProfit - profit máximo por dia (null = sem teto)
 * @returns {Object} { qualifyingDays, requiredDays, met, dailyBreakdown }
 */
export function calculateQualifyingDays(drawdownHistory, qualifyingConfig) {
  const required = qualifyingConfig?.count ?? null;

  if (required === null) {
    return { qualifyingDays: null, requiredDays: null, met: true, dailyBreakdown: [] };
  }

  const minProfit = qualifyingConfig?.minProfit ?? 0;
  const maxProfit = qualifyingConfig?.maxProfit ?? null;

  // Agrupar por data — usar o último doc de cada dia (tem o dailyPnL acumulado do dia)
  const byDate = new Map();
  for (const doc of drawdownHistory) {
    const date = doc.date;
    if (!date) continue;
    // Último doc de cada data = dailyPnL acumulado final do dia
    byDate.set(date, doc);
  }

  const dailyBreakdown = [];
  let qualifyingCount = 0;

  for (const [date, doc] of byDate) {
    const dailyPnL = doc.dailyPnL ?? 0;
    const meetsMin = dailyPnL >= minProfit;
    const meetsMax = maxProfit === null || dailyPnL <= maxProfit;
    const qualifies = meetsMin && meetsMax;

    if (qualifies) qualifyingCount++;

    dailyBreakdown.push({
      date,
      dailyPnL,
      qualifies,
      reason: !meetsMin
        ? `P&L ${dailyPnL.toFixed(2)} < min ${minProfit}`
        : !meetsMax
          ? `P&L ${dailyPnL.toFixed(2)} > max ${maxProfit}`
          : 'OK',
    });
  }

  return {
    qualifyingDays: qualifyingCount,
    requiredDays: required,
    met: qualifyingCount >= required,
    dailyBreakdown,
  };
}

// ============================================
// Payout Eligibility — pode sacar?
// ============================================

/**
 * Calcula se o trader pode sacar.
 *
 * @param {Object} params
 * @param {Object} params.template - propFirmTemplates doc
 * @param {Object} params.propFirm - account.propFirm
 * @param {number} params.currentBalance - saldo atual da conta
 * @param {number} params.accountSize - tamanho da conta
 * @param {Object} params.qualifyingResult - resultado de calculateQualifyingDays
 * @returns {Object} { eligible, checks }
 */
export function calculatePayoutEligibility({
  template,
  propFirm,
  currentBalance,
  accountSize,
  qualifyingResult,
}) {
  const payout = template?.payout;
  if (!payout) {
    return { eligible: false, checks: [{ rule: 'Template sem regras de payout', met: false }] };
  }

  const phase = propFirm?.phase ?? 'EVALUATION';
  const tradingDays = propFirm?.tradingDays ?? 0;
  const drawdownMax = template?.drawdown?.maxAmount ?? 0;
  const minBalance = accountSize - drawdownMax + 100; // DD + $100 (padrão da maioria das mesas)
  const currentProfit = currentBalance - accountSize;

  const checks = [];

  // C1: Fase — deve ser SIM_FUNDED ou LIVE (não pode sacar na EVALUATION)
  const phaseMet = phase === 'SIM_FUNDED' || phase === 'LIVE';
  checks.push({
    rule: 'Fase Funded ou Live',
    met: phaseMet,
    detail: phaseMet ? phase : `Fase atual: ${phase} (requer Funded/Live)`,
  });

  // C2: Min trading days
  const minDays = payout.minTradingDays ?? 0;
  const daysMet = tradingDays >= minDays;
  checks.push({
    rule: `Min ${minDays} dias operados`,
    met: daysMet,
    detail: `${tradingDays}/${minDays} dias`,
  });

  // C3: Qualifying days
  if (qualifyingResult.requiredDays !== null) {
    checks.push({
      rule: `Min ${qualifyingResult.requiredDays} qualifying days`,
      met: qualifyingResult.met,
      detail: `${qualifyingResult.qualifyingDays}/${qualifyingResult.requiredDays} dias`,
    });
  }

  // C4: Min amount
  const minAmount = payout.minAmount ?? 0;
  const availableForWithdrawal = Math.max(0, currentBalance - minBalance);
  const amountMet = availableForWithdrawal >= minAmount;
  checks.push({
    rule: `Min saque ${minAmount > 0 ? `$${minAmount}` : 'sem mínimo'}`,
    met: amountMet,
    detail: `Disponível: $${availableForWithdrawal.toFixed(2)} (saldo - DD - $100)`,
  });

  // C5: Profit positivo
  const profitMet = currentProfit > 0;
  checks.push({
    rule: 'Profit positivo',
    met: profitMet,
    detail: `Profit: $${currentProfit.toFixed(2)}`,
  });

  const eligible = checks.every(c => c.met);

  return {
    eligible,
    checks,
    availableForWithdrawal,
    minBalance,
    payoutSplit: payout.split ?? 1,
    firstTierAmount: payout.firstTierAmount ?? null,
    firstTierSplit: payout.firstTierSplit ?? null,
  };
}

// ============================================
// Simulador de Saque
// ============================================

/**
 * Simula o impacto de um saque no drawdown threshold.
 *
 * Regra geral das mesas: após saque, o drawdown threshold recalcula
 * como se o trader tivesse começado com (balance - saque).
 * Se o trail está locked/frozen, o threshold não muda.
 *
 * @param {Object} params
 * @param {number} params.withdrawalAmount - valor do saque
 * @param {number} params.currentBalance - saldo atual
 * @param {number} params.currentDrawdownThreshold - threshold atual
 * @param {number} params.accountSize - tamanho da conta
 * @param {number} params.drawdownMax - DD máximo do template
 * @param {boolean} params.isLocked - lock/freeze ativado
 * @param {number} params.payoutSplit - percentual que o trader recebe (ex: 0.90)
 * @param {number|null} params.firstTierAmount - até quanto é 100% (ex: 25000)
 * @param {number|null} params.firstTierSplit - split do primeiro tier (ex: 1.00)
 * @param {number} params.totalWithdrawn - total já sacado (para calcular tier)
 * @returns {Object} resultado da simulação
 */
export function simulateWithdrawal({
  withdrawalAmount,
  currentBalance,
  currentDrawdownThreshold,
  accountSize,
  drawdownMax,
  isLocked = false,
  payoutSplit = 1,
  firstTierAmount = null,
  firstTierSplit = null,
  totalWithdrawn = 0,
}) {
  if (withdrawalAmount <= 0) {
    return {
      valid: false,
      reason: 'Valor de saque deve ser positivo',
    };
  }

  const minBalance = accountSize - drawdownMax + 100;
  const maxWithdrawal = Math.max(0, currentBalance - minBalance);

  if (withdrawalAmount > maxWithdrawal) {
    return {
      valid: false,
      reason: `Saque máximo permitido: $${maxWithdrawal.toFixed(2)} (saldo - DD - $100)`,
      maxWithdrawal,
    };
  }

  // Calcular split efetivo (considerando tiers)
  let traderReceives;
  if (firstTierAmount !== null && firstTierSplit !== null) {
    const remainingInFirstTier = Math.max(0, firstTierAmount - totalWithdrawn);
    if (remainingInFirstTier >= withdrawalAmount) {
      // Tudo no primeiro tier
      traderReceives = withdrawalAmount * firstTierSplit;
    } else {
      // Parte no primeiro tier, parte no segundo
      traderReceives = remainingInFirstTier * firstTierSplit
        + (withdrawalAmount - remainingInFirstTier) * payoutSplit;
    }
  } else {
    traderReceives = withdrawalAmount * payoutSplit;
  }

  const newBalance = currentBalance - withdrawalAmount;

  // Threshold: se locked/frozen, não muda. Senão, recalcula.
  let newThreshold;
  if (isLocked) {
    newThreshold = currentDrawdownThreshold;
  } else {
    // Trailing: threshold acompanha o novo balance
    newThreshold = Math.max(
      accountSize - drawdownMax, // nunca abaixo do mínimo absoluto
      newBalance - drawdownMax
    );
  }

  const newDistanceToDD = drawdownMax > 0
    ? (newBalance - newThreshold) / drawdownMax
    : 1;

  return {
    valid: true,
    withdrawalAmount,
    traderReceives: round(traderReceives, 2),
    firmKeeps: round(withdrawalAmount - traderReceives, 2),
    effectiveSplit: round(traderReceives / withdrawalAmount, 4),
    newBalance: round(newBalance, 2),
    newThreshold: round(newThreshold, 2),
    newDistanceToDD: round(newDistanceToDD, 4),
    previousBalance: currentBalance,
    previousThreshold: currentDrawdownThreshold,
    maxWithdrawal: round(maxWithdrawal, 2),
  };
}

// ============================================
// Histórico de saques (derivado de movements)
// ============================================

/**
 * Filtra movements para obter histórico de saques (WITHDRAWAL) da conta.
 *
 * @param {Array} movements - array de movements da conta
 * @returns {Object} { withdrawals, totalWithdrawn, count }
 */
export function getWithdrawalHistory(movements) {
  const withdrawals = (movements ?? [])
    .filter(m => m.type === 'WITHDRAWAL')
    .map(m => ({
      id: m.id,
      amount: Math.abs(m.amount ?? 0),
      date: m.date,
      description: m.description,
      balanceBefore: m.balanceBefore,
      balanceAfter: m.balanceAfter,
    }));

  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  return {
    withdrawals,
    totalWithdrawn,
    count: withdrawals.length,
  };
}

// --- Helpers ---

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
