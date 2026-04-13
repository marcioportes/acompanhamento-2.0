/**
 * propFirmAlerts — Lógica pura de derivação de alertas para contas PROP
 * @description Extrai a lógica de alertas do PropAccountCard para função testável.
 *   3 níveis: danger (mesa), warning (plano), info (nudge operacional).
 *   Alertas amarelos usam cálculos locais além das flags da CF.
 *
 * Ref: issue #134 Fase B, epic #52
 */

import { DD_NEAR_THRESHOLD } from './propFirmDrawdownEngine';

/**
 * Deriva alertas para uma conta PROP.
 *
 * @param {Object} params
 * @param {string[]} params.flags - flags da CF (ACCOUNT_BUST, DD_NEAR, DAILY_LOSS_HIT, etc.)
 * @param {number} params.distanceToDD - margem proporcional (0..1)
 * @param {boolean} params.isDayPaused - dia pausado por daily loss
 * @param {number} params.dailyPnL - P&L do dia corrente
 * @param {number} params.currentBalance - saldo atual
 * @param {number} params.currentDrawdownThreshold - limite de liquidação
 * @param {number} params.currentProfit - profit acumulado (balance - accountSize)
 * @param {number} params.profitTarget - meta de profit da mesa
 * @param {number} params.profitRatio - currentProfit / profitTarget (0..1+)
 * @param {number|null} params.evalDaysRemaining - dias restantes da eval (null se não aplica)
 * @param {number|null} params.bestDayProfit - maior profit num único dia
 * @param {number|null} params.consistencyRule - regra de consistency (ex: 0.50)
 * @param {number|null} params.consistencyThreshold - profitTarget * consistencyRule
 * @param {number|null} params.lockLevel - nível do lock (null se inativo)
 * @param {boolean} params.trailFrozen - trail congelado (TRAILING_TO_STATIC)
 * @param {string} params.currency - moeda da conta
 * @param {Function} params.fmt - formatador de moeda (value, currency) => string
 * @returns {Array<{level: 'danger'|'warning'|'info', text: string}>}
 */
export function derivePropAlerts({
  flags = [],
  distanceToDD = 1,
  isDayPaused = false,
  dailyPnL = 0,
  currentBalance = 0,
  currentDrawdownThreshold = 0,
  currentProfit = 0,
  profitTarget = 0,
  profitRatio = 0,
  evalDaysRemaining = null,
  bestDayProfit = 0,
  consistencyRule = null,
  consistencyThreshold = null,
  lockLevel = null,
  trailFrozen = false,
  currency = 'USD',
  fmt = (v) => `$${v}`,
}) {
  const alerts = [];

  // ============================================
  // DANGER (vermelho) — risco de perder a conta
  // ============================================
  if (flags.includes('ACCOUNT_BUST')) {
    alerts.push({ level: 'danger', text: 'Conta eliminada — drawdown atingido' });
  } else if (flags.includes('DD_NEAR') || distanceToDD < DD_NEAR_THRESHOLD) {
    const pct = ((1 - distanceToDD) * 100).toFixed(0);
    const remaining = Math.max(0, currentBalance - currentDrawdownThreshold);
    alerts.push({ level: 'danger', text: `Drawdown ${pct}% utilizado — ${fmt(remaining, currency)} restantes` });
  }
  if (isDayPaused) {
    alerts.push({ level: 'danger', text: `Daily loss atingido (${fmt(dailyPnL, currency)}) — dia pausado` });
  }

  // ============================================
  // WARNING (amarelo) — risco de descumprir plano/regras
  // Usa cálculos locais, não só flags da CF
  // ============================================

  // W1: Consistency prestes a violar (melhor dia > 40% do target = zona de perigo,
  //     independente da regra da mesa ser 50%)
  const consistencyWarnThreshold = profitTarget > 0 ? profitTarget * 0.40 : null;
  if (consistencyWarnThreshold && bestDayProfit > consistencyWarnThreshold) {
    const rulePct = consistencyRule ? (consistencyRule * 100).toFixed(0) : '50';
    const bestPct = profitTarget > 0 ? ((bestDayProfit / profitTarget) * 100).toFixed(0) : '0';
    alerts.push({
      level: 'warning',
      text: `Consistency em risco — melhor dia ${bestPct}% do target (limite ${rulePct}%)`,
    });
  }

  // W2: Eval deadline < 7 dias com profit < 50% do target
  if (evalDaysRemaining !== null && evalDaysRemaining > 0 && evalDaysRemaining <= 7) {
    const profitNeeded = profitTarget - currentProfit;
    if (profitNeeded > 0 && profitRatio < 0.50) {
      alerts.push({
        level: 'warning',
        text: `${evalDaysRemaining} dias restantes, apenas ${(profitRatio * 100).toFixed(0)}% do target — faltam ${fmt(profitNeeded, currency)}`,
      });
    } else if (profitNeeded > 0) {
      alerts.push({
        level: 'warning',
        text: `${evalDaysRemaining} dias restantes, faltam ${fmt(profitNeeded, currency)} para o target`,
      });
    }
  }

  // ============================================
  // INFO (informativo) — nudge operacional
  // ============================================

  // I1: Perto do target (80-99%)
  if (profitRatio >= 0.80 && profitRatio < 1.0 && !flags.includes('ACCOUNT_BUST')) {
    const remaining = profitTarget - currentProfit;
    alerts.push({
      level: 'info',
      text: `${(profitRatio * 100).toFixed(0)}% do target — faltam ${fmt(remaining, currency)}`,
    });
  }

  // I2: Eval countdown contextual (> 7 dias, com progress report)
  if (evalDaysRemaining !== null && evalDaysRemaining > 7 && profitTarget > 0) {
    const profitNeeded = profitTarget - currentProfit;
    if (profitNeeded > 0) {
      alerts.push({
        level: 'info',
        text: `Faltam ${evalDaysRemaining} dias e ${fmt(profitNeeded, currency)} para o target`,
      });
    }
  }

  // I3: Lock ativado — drawdown congelado
  if (lockLevel !== null) {
    alerts.push({
      level: 'info',
      text: `Lock ativado — drawdown congelado em ${fmt(lockLevel, currency)}`,
    });
  }

  // I4: Trail congelado (TRAILING_TO_STATIC)
  if (trailFrozen) {
    alerts.push({
      level: 'info',
      text: 'Trail congelado (TRAILING_TO_STATIC) — threshold não sobe mais',
    });
  }

  return alerts;
}

/**
 * Filtra apenas alertas de nível danger (para o banner persistente).
 */
export function getDangerAlerts(alerts) {
  return alerts.filter(a => a.level === 'danger');
}
