// ============================================
// PROP FIRM DRAWDOWN ENGINE — Função pura
// ============================================
// Camada 3 do modelo semântico: a cada trade fechado, recalcula o estado
// runtime da instância prop firm na conta — peakBalance, currentDrawdownThreshold,
// lockLevel, isDayPaused, tradingDays, dailyPnL — e gera flags.
//
// Função 100% pura. CF a chama dentro de runTransaction para garantir
// atomicidade do peakBalance em escrita concorrente (batch import).
//
// Suporta 4 tipos nominais (DRAWDOWN_TYPES):
//   STATIC              — peak nunca move, threshold = accountSize - DD fixo
//   TRAILING_INTRADAY   — peak move a cada trade ganhador
//   TRAILING_EOD        — peak move apenas no fechamento do dia (snapshot no 1º trade do dia seguinte)
//   TRAILING_WITH_LOCK  — tratado como INTRADAY com lock obrigatório (legacy)
//
// Lock é independente do tipo: qualquer trailing pode ter ou não lockAt/lockFormula.
// Quando peakBalance atinge lockAt, threshold congela em lockLevel = accountSize
// (a partir daí, comporta-se como STATIC).
//
// LIMITAÇÃO INTENCIONAL DA v1:
//   A engine NÃO recalcula o histórico se um trade antigo for editado. Processa
//   somente o trade atual com o estado atual. Para reconstrução completa, futura
//   versão pode adicionar cron noturno que recomputa do zero.
//
// Ref: issue #52 Fase 2, sessão 09/04/2026

import { DRAWDOWN_TYPES } from '../constants/propFirmDefaults';

// ============================================
// Constantes
// ============================================

// Quando distanceToDD < DD_NEAR_THRESHOLD → flag DD_NEAR
export const DD_NEAR_THRESHOLD = 0.20;

// Flags possíveis no resultado
export const DRAWDOWN_FLAGS = {
  DAILY_LOSS_HIT: 'DAILY_LOSS_HIT',         // dailyPnL atingiu daily loss limit
  ACCOUNT_BUST: 'ACCOUNT_BUST',             // newBalance ≤ currentDrawdownThreshold
  DD_NEAR: 'DD_NEAR',                       // distanceToDD < 20%
  LOCK_ACTIVATED: 'LOCK_ACTIVATED',         // lockLevel ativado neste trade (Apex)
  TRAIL_FROZEN: 'TRAIL_FROZEN',             // trail congelado neste trade (Ylos TRAILING_TO_STATIC)
  EVAL_DEADLINE_NEAR: 'EVAL_DEADLINE_NEAR'  // (helper separado)
};

// ============================================
// resolveLockAt — traduz lockAt numérico ou lockFormula textual
// ============================================

/**
 * Resolve o valor de peakBalance que dispara o lock do trailing.
 *
 * @param {Object} template - propFirmTemplates doc
 * @param {number} accountSize - tamanho da conta (do template)
 * @returns {number|null} valor de peakBalance que dispara o lock, ou null se sem lock
 */
export function resolveLockAt(template, accountSize) {
  const dd = template?.drawdown;
  if (!dd) return null;

  // 1ª prioridade: valor numérico explícito
  if (typeof dd.lockAt === 'number') return dd.lockAt;

  // 2ª prioridade: fórmula textual conhecida
  if (dd.lockFormula === 'BALANCE + DD + 100') {
    return accountSize + (dd.maxAmount ?? 0) + 100;
  }

  return null;
}

// ============================================
// getPeakUpdateMode — quando o peak deve atualizar
// ============================================

/**
 * Retorna o modo de atualização do peakBalance baseado no tipo de drawdown.
 *
 * @param {string} type - DRAWDOWN_TYPES
 * @returns {'never'|'intraday'|'eod'}
 */
export function getPeakUpdateMode(type) {
  if (type === DRAWDOWN_TYPES.STATIC) return 'never';
  if (type === DRAWDOWN_TYPES.TRAILING_EOD) return 'eod';
  // TRAILING_INTRADAY ou TRAILING_WITH_LOCK (legacy)
  return 'intraday';
}

// ============================================
// initializePropFirmState — estado inicial ao vincular conta a template
// ============================================

/**
 * Cria o estado inicial do propFirm para uma nova conta vinculada a uma mesa.
 *
 * @param {Object} template - propFirmTemplates doc
 * @param {number} accountSize - tamanho da conta (geralmente template.accountSize)
 * @returns {Object} estado inicial (campos runtime, sem template/phase metadata)
 */
export function initializePropFirmState(template, accountSize) {
  if (!template || !template.drawdown) {
    throw new Error('template.drawdown é obrigatório');
  }
  const drawdownMax = template.drawdown.maxAmount ?? 0;
  return {
    peakBalance: accountSize,
    currentDrawdownThreshold: accountSize - drawdownMax,
    lockLevel: null,
    trailFrozen: false,
    isDayPaused: false,
    tradingDays: 0,
    dailyPnL: 0,
    lastTradeDate: null
  };
}

// ============================================
// calculateDrawdownState — recalcula o estado após um trade
// ============================================

/**
 * Função pura. Recebe o estado atual e dados do trade, retorna novo estado + flags.
 *
 * Esta função NÃO escreve em Firestore. A CF chama dentro de runTransaction
 * para atomicidade do peakBalance.
 *
 * @param {Object} args
 * @param {Object} args.propFirm - estado atual (account.propFirm); pode ser estado inicial
 * @param {Object} args.template - template da mesa (propFirmTemplates doc)
 * @param {number} args.accountSize - tamanho da conta (template.accountSize ou account.initialBalance)
 * @param {number} args.balanceBefore - saldo da conta ANTES deste trade
 * @param {number} args.tradeNet - P&L net do trade (positivo win, negativo loss)
 * @param {string} args.tradeDate - data do trade no formato YYYY-MM-DD
 * @returns {Object} novo estado + newBalance + distanceToDD + flags + transitions
 */
export function calculateDrawdownState({
  propFirm,
  template,
  accountSize,
  balanceBefore,
  tradeNet,
  tradeDate
}) {
  if (!template || !template.drawdown) {
    throw new Error('template.drawdown é obrigatório');
  }
  if (typeof accountSize !== 'number' || accountSize <= 0) {
    throw new Error('accountSize deve ser número positivo');
  }
  if (typeof balanceBefore !== 'number') {
    throw new Error('balanceBefore deve ser número');
  }
  if (typeof tradeNet !== 'number') {
    throw new Error('tradeNet deve ser número');
  }
  if (!tradeDate || typeof tradeDate !== 'string') {
    throw new Error('tradeDate (YYYY-MM-DD) é obrigatório');
  }

  const drawdownType = template.drawdown.type;
  const drawdownMax = template.drawdown.maxAmount ?? 0;
  const dailyLossLimit = template.dailyLossLimit ?? 0;
  const peakMode = getPeakUpdateMode(drawdownType);

  // Estado atual (com defaults para conta nova)
  let peakBalance = propFirm?.peakBalance ?? accountSize;
  let dailyPnL = propFirm?.dailyPnL ?? 0;
  let isDayPaused = propFirm?.isDayPaused ?? false;
  let tradingDays = propFirm?.tradingDays ?? 0;
  let lockLevel = propFirm?.lockLevel ?? null;
  const previousLockLevel = lockLevel;
  let trailFrozen = propFirm?.trailFrozen ?? false;
  const previousTrailFrozen = trailFrozen;
  const lastTradeDate = propFirm?.lastTradeDate ?? null;
  const isTrailToStatic = drawdownType === DRAWDOWN_TYPES.TRAILING_TO_STATIC;

  // ============================================
  // 1. Detectar novo dia
  // ============================================
  const isNewDay = lastTradeDate !== tradeDate;

  if (isNewDay) {
    // EOD trailing: snapshot do peak no fechamento do dia anterior
    // (só atualiza se o saldo de fechamento foi maior que o peak corrente
    //  e o lock ainda não foi disparado)
    if (peakMode === 'eod' && lockLevel === null && lastTradeDate !== null) {
      peakBalance = Math.max(peakBalance, balanceBefore);
    }

    // Reset diário
    dailyPnL = 0;
    isDayPaused = false;
    tradingDays += 1;
  }

  // ============================================
  // 2. Aplicar trade
  // ============================================
  const newBalance = round(balanceBefore + tradeNet, 2);
  dailyPnL = round(dailyPnL + tradeNet, 2);

  // ============================================
  // 3. Atualizar peak (intraday) — não atualiza após lock ou freeze
  // ============================================
  if (peakMode === 'intraday' && lockLevel === null && !trailFrozen) {
    peakBalance = Math.max(peakBalance, newBalance);
  }

  // ============================================
  // 4a. Verificar lock Apex (fórmula fixa → lockLevel = accountSize)
  // ============================================
  const lockAt = resolveLockAt(template, accountSize);
  if (lockAt !== null && lockLevel === null && peakBalance >= lockAt) {
    // Lock ativado: threshold congela em accountSize (sai do drawdown trailing)
    lockLevel = accountSize;
  }

  // ============================================
  // 4b. Verificar freeze Ylos (TRAILING_TO_STATIC) — captura threshold do momento
  // ============================================
  if (isTrailToStatic && !trailFrozen) {
    const staticTrigger = template.drawdown.staticTrigger ?? 100;
    const triggerBalance = accountSize + drawdownMax + staticTrigger;
    if (newBalance >= triggerBalance) {
      trailFrozen = true;
    }
  }

  // ============================================
  // 5. Calcular currentDrawdownThreshold
  // ============================================
  let currentDrawdownThreshold;
  if (drawdownType === DRAWDOWN_TYPES.STATIC) {
    currentDrawdownThreshold = accountSize - drawdownMax;
  } else if (isTrailToStatic && trailFrozen) {
    // Primeiro trade em estado frozen: captura threshold com base no peak atual.
    // Trades subsequentes: mantém valor já persistido em propFirm.
    currentDrawdownThreshold = previousTrailFrozen
      ? (propFirm?.currentDrawdownThreshold ?? (peakBalance - drawdownMax))
      : (peakBalance - drawdownMax);
  } else if (lockLevel !== null) {
    currentDrawdownThreshold = lockLevel;
  } else {
    currentDrawdownThreshold = peakBalance - drawdownMax;
  }

  // ============================================
  // 6. Daily loss check (soft — não bloqueia, apenas marca flag)
  // ============================================
  if (dailyLossLimit > 0 && dailyPnL <= -dailyLossLimit) {
    isDayPaused = true;
  }

  // ============================================
  // 7. Distance to DD (margem proporcional ainda disponível)
  // ============================================
  const distanceToDD = drawdownMax > 0
    ? round((newBalance - currentDrawdownThreshold) / drawdownMax, 4)
    : 1;

  // ============================================
  // 8. Flags
  // ============================================
  const flags = [];
  if (isDayPaused) flags.push(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  if (newBalance <= currentDrawdownThreshold) flags.push(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  if (distanceToDD < DD_NEAR_THRESHOLD && distanceToDD > 0) flags.push(DRAWDOWN_FLAGS.DD_NEAR);
  if (lockLevel !== null && previousLockLevel === null) flags.push(DRAWDOWN_FLAGS.LOCK_ACTIVATED);
  if (trailFrozen && !previousTrailFrozen) flags.push(DRAWDOWN_FLAGS.TRAIL_FROZEN);

  return {
    // Estado novo (escrito pela CF em account.propFirm.*)
    peakBalance: round(peakBalance, 2),
    currentDrawdownThreshold: round(currentDrawdownThreshold, 2),
    lockLevel: lockLevel !== null ? round(lockLevel, 2) : null,
    trailFrozen,
    isDayPaused,
    tradingDays,
    dailyPnL,
    lastTradeDate: tradeDate,

    // Derivados / observabilidade
    newBalance,
    distanceToDD,
    flags,
    isNewDay
  };
}

// ============================================
// calculateEvalDaysRemaining — countdown de dias corridos
// ============================================

/**
 * Calcula dias corridos restantes até o eval deadline.
 * Apex e similares contam dias corridos, NÃO dias de trading.
 *
 * @param {string|Date} phaseStartDate - data de início da fase EVALUATION
 * @param {number} evalTimeLimit - dias corridos (do template)
 * @param {Date} [now] - data de referência (para testes); default new Date()
 * @returns {number|null} dias restantes (0 se já expirou) ou null se inputs inválidos
 */
export function calculateEvalDaysRemaining(phaseStartDate, evalTimeLimit, now = new Date()) {
  if (!phaseStartDate || typeof evalTimeLimit !== 'number' || evalTimeLimit <= 0) {
    return null;
  }
  const start = phaseStartDate instanceof Date
    ? phaseStartDate
    : new Date(phaseStartDate);
  if (isNaN(start.getTime())) return null;

  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + evalTimeLimit);

  const msPerDay = 1000 * 60 * 60 * 24;
  const remaining = Math.ceil((deadline.getTime() - now.getTime()) / msPerDay);
  return Math.max(0, remaining);
}

/**
 * Helper para flag EVAL_DEADLINE_NEAR.
 * Threshold padrão: 7 dias.
 */
export function isEvalDeadlineNear(daysRemaining, threshold = 7) {
  if (daysRemaining === null || daysRemaining === undefined) return false;
  return daysRemaining > 0 && daysRemaining <= threshold;
}

// --- Helpers ---

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
