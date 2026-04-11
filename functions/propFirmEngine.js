// ============================================
// PROP FIRM DRAWDOWN ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/propFirmDrawdownEngine.js — MANTER SINCRONIZADO ⚠️
//
// Esta é uma cópia CommonJS do engine puro testado em src/utils/.
// Cloud Functions não conseguem importar de ../src/ (separação de pacotes).
//
// Toda mudança na lógica DEVE ser propagada manualmente para os DOIS arquivos:
//   1. src/utils/propFirmDrawdownEngine.js (testado por 58 testes Vitest)
//   2. functions/propFirmEngine.js (este arquivo)
//
// Refactoring futuro: DT-034 — unificar via build step (rollup/esbuild) ou
// monorepo workspace que permita import compartilhado.
//
// Ref: issue #52 Fase 2.b, decisão Opção A duplicação (sessão 09/04/2026)
// ============================================

// DRAWDOWN_TYPES inlined (evita import cross-package)
const DRAWDOWN_TYPES = {
  TRAILING_INTRADAY: 'TRAILING_INTRADAY',
  TRAILING_EOD: 'TRAILING_EOD',
  STATIC: 'STATIC',
  TRAILING_WITH_LOCK: 'TRAILING_WITH_LOCK',
  TRAILING_TO_STATIC: 'TRAILING_TO_STATIC'
};

const DD_NEAR_THRESHOLD = 0.20;

const DRAWDOWN_FLAGS = {
  DAILY_LOSS_HIT: 'DAILY_LOSS_HIT',
  ACCOUNT_BUST: 'ACCOUNT_BUST',
  DD_NEAR: 'DD_NEAR',
  LOCK_ACTIVATED: 'LOCK_ACTIVATED',
  TRAIL_FROZEN: 'TRAIL_FROZEN',
  EVAL_DEADLINE_NEAR: 'EVAL_DEADLINE_NEAR'
};

function resolveLockAt(template, accountSize) {
  const dd = template && template.drawdown;
  if (!dd) return null;
  if (typeof dd.lockAt === 'number') return dd.lockAt;
  if (dd.lockFormula === 'BALANCE + DD + 100') {
    return accountSize + (dd.maxAmount || 0) + 100;
  }
  return null;
}

function getActiveDrawdown(template, phase) {
  const activePhase = phase || 'EVALUATION';
  const isFunded = activePhase === 'SIM_FUNDED' || activePhase === 'LIVE';
  if (isFunded && template && template.fundedDrawdown) {
    return template.fundedDrawdown;
  }
  return template && template.drawdown;
}

function getPeakUpdateMode(type) {
  if (type === DRAWDOWN_TYPES.STATIC) return 'never';
  if (type === DRAWDOWN_TYPES.TRAILING_EOD) return 'eod';
  return 'intraday';
}

function initializePropFirmState(template, accountSize) {
  if (!template || !template.drawdown) {
    throw new Error('template.drawdown é obrigatório');
  }
  const drawdownMax = template.drawdown.maxAmount || 0;
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

function calculateDrawdownState(args) {
  const {
    propFirm,
    template,
    accountSize,
    balanceBefore,
    tradeNet,
    tradeDate,
    phase
  } = args;

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

  const activePhase = phase || (propFirm && propFirm.phase) || 'EVALUATION';
  const activeDrawdown = getActiveDrawdown(template, activePhase);
  if (!activeDrawdown) {
    throw new Error('activeDrawdown não resolvido — template sem drawdown ou fundedDrawdown');
  }

  const drawdownType = activeDrawdown.type;
  const drawdownMax = activeDrawdown.maxAmount || 0;
  const dailyLossLimit = template.dailyLossLimit || 0;
  const peakMode = getPeakUpdateMode(drawdownType);

  let peakBalance = (propFirm && propFirm.peakBalance != null) ? propFirm.peakBalance : accountSize;
  let dailyPnL = (propFirm && propFirm.dailyPnL != null) ? propFirm.dailyPnL : 0;
  let isDayPaused = (propFirm && propFirm.isDayPaused != null) ? propFirm.isDayPaused : false;
  let tradingDays = (propFirm && propFirm.tradingDays != null) ? propFirm.tradingDays : 0;
  let lockLevel = (propFirm && propFirm.lockLevel != null) ? propFirm.lockLevel : null;
  const previousLockLevel = lockLevel;
  let trailFrozen = (propFirm && propFirm.trailFrozen != null) ? propFirm.trailFrozen : false;
  const previousTrailFrozen = trailFrozen;
  const lastTradeDate = (propFirm && propFirm.lastTradeDate) ? propFirm.lastTradeDate : null;
  const isTrailToStatic = drawdownType === DRAWDOWN_TYPES.TRAILING_TO_STATIC;

  const isNewDay = lastTradeDate !== tradeDate;

  if (isNewDay) {
    if (peakMode === 'eod' && lockLevel === null && lastTradeDate !== null) {
      peakBalance = Math.max(peakBalance, balanceBefore);
    }
    dailyPnL = 0;
    isDayPaused = false;
    tradingDays += 1;
  }

  const newBalance = round(balanceBefore + tradeNet, 2);
  dailyPnL = round(dailyPnL + tradeNet, 2);

  if (peakMode === 'intraday' && lockLevel === null && !trailFrozen) {
    peakBalance = Math.max(peakBalance, newBalance);
  }

  let lockAt = null;
  if (typeof activeDrawdown.lockAt === 'number') {
    lockAt = activeDrawdown.lockAt;
  } else if (activeDrawdown.lockFormula === 'BALANCE + DD + 100') {
    lockAt = accountSize + drawdownMax + 100;
  }
  if (lockAt !== null && lockLevel === null && peakBalance >= lockAt) {
    lockLevel = accountSize;
  }

  if (isTrailToStatic && !trailFrozen) {
    const staticTrigger = (activeDrawdown.staticTrigger != null) ? activeDrawdown.staticTrigger : 100;
    const triggerBalance = accountSize + drawdownMax + staticTrigger;
    if (newBalance >= triggerBalance) {
      trailFrozen = true;
    }
  }

  let currentDrawdownThreshold;
  if (drawdownType === DRAWDOWN_TYPES.STATIC) {
    currentDrawdownThreshold = accountSize - drawdownMax;
  } else if (isTrailToStatic && trailFrozen) {
    currentDrawdownThreshold = previousTrailFrozen
      ? ((propFirm && propFirm.currentDrawdownThreshold != null) ? propFirm.currentDrawdownThreshold : (peakBalance - drawdownMax))
      : (peakBalance - drawdownMax);
  } else if (lockLevel !== null) {
    currentDrawdownThreshold = lockLevel;
  } else {
    currentDrawdownThreshold = peakBalance - drawdownMax;
  }

  if (dailyLossLimit > 0 && dailyPnL <= -dailyLossLimit) {
    isDayPaused = true;
  }

  const distanceToDD = drawdownMax > 0
    ? round((newBalance - currentDrawdownThreshold) / drawdownMax, 4)
    : 1;

  const flags = [];
  if (isDayPaused) flags.push(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  if (newBalance <= currentDrawdownThreshold) flags.push(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  if (distanceToDD < DD_NEAR_THRESHOLD && distanceToDD > 0) flags.push(DRAWDOWN_FLAGS.DD_NEAR);
  if (lockLevel !== null && previousLockLevel === null) flags.push(DRAWDOWN_FLAGS.LOCK_ACTIVATED);
  if (trailFrozen && !previousTrailFrozen) flags.push(DRAWDOWN_FLAGS.TRAIL_FROZEN);

  return {
    peakBalance: round(peakBalance, 2),
    currentDrawdownThreshold: round(currentDrawdownThreshold, 2),
    lockLevel: lockLevel !== null ? round(lockLevel, 2) : null,
    trailFrozen,
    isDayPaused,
    tradingDays,
    dailyPnL,
    lastTradeDate: tradeDate,
    newBalance,
    distanceToDD,
    flags,
    isNewDay
  };
}

function calculateEvalDaysRemaining(phaseStartDate, evalTimeLimit, now) {
  if (!phaseStartDate || typeof evalTimeLimit !== 'number' || evalTimeLimit <= 0) {
    return null;
  }
  const start = phaseStartDate instanceof Date
    ? phaseStartDate
    : new Date(phaseStartDate);
  if (isNaN(start.getTime())) return null;

  const reference = now || new Date();
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + evalTimeLimit);

  const msPerDay = 1000 * 60 * 60 * 24;
  const remaining = Math.ceil((deadline.getTime() - reference.getTime()) / msPerDay);
  return Math.max(0, remaining);
}

function isEvalDeadlineNear(daysRemaining, threshold) {
  const t = threshold || 7;
  if (daysRemaining === null || daysRemaining === undefined) return false;
  return daysRemaining > 0 && daysRemaining <= t;
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

module.exports = {
  DRAWDOWN_TYPES,
  DRAWDOWN_FLAGS,
  DD_NEAR_THRESHOLD,
  resolveLockAt,
  getActiveDrawdown,
  getPeakUpdateMode,
  initializePropFirmState,
  calculateDrawdownState,
  calculateEvalDaysRemaining,
  isEvalDeadlineNear
};
