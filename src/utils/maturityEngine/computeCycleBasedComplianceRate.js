/**
 * src/utils/maturityEngine/computeCycleBasedComplianceRate.js
 *
 * Mirror ESM de functions/maturity/computeCycleBasedComplianceRate.js (issue #191).
 * Comportamento idêntico — manter sincronizado.
 *
 * Aderência avaliada sobre a janela de ciclos ativos do trader, união de todos
 * os planos. Mínimo 20 trades CLOSED; fallback retroativo simultâneo até atingir
 * o mínimo ou esgotar histórico. Estado insuficiente → null (METRIC_UNAVAILABLE
 * no evaluateGates: gate pendente, não promove e não rebaixa).
 *
 * Issue #221: respeita `mentorClearedViolations` — trade com TODAS as red flags
 * limpas pelo mentor é tratado como compliant.
 */

import { hasEffectiveRedFlags } from '../violationFilter';

const MAX_LOOKBACK_CYCLES = 36;
const DEFAULT_MIN_TRADES = 20;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseTradeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) return null;
  const iso = ISO_DATE_RE.exec(value);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const br = BR_DATE_RE.exec(value);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getCycleStart(adjustmentCycle, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (adjustmentCycle) {
    case 'Trimestral':
      return new Date(y, Math.floor(m / 3) * 3, 1, 0, 0, 0, 0);
    case 'Semestral':
    case 'Semanal':
      return new Date(y, m < 6 ? 0 : 6, 1, 0, 0, 0, 0);
    case 'Anual':
      return new Date(y, 0, 1, 0, 0, 0, 0);
    case 'Mensal':
    default:
      return new Date(y, m, 1, 0, 0, 0, 0);
  }
}

function getCycleEnd(adjustmentCycle, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (adjustmentCycle) {
    case 'Trimestral': {
      const qEndMonth = Math.floor(m / 3) * 3 + 2;
      return new Date(y, qEndMonth + 1, 0, 23, 59, 59, 999);
    }
    case 'Semestral':
    case 'Semanal':
      return new Date(y, m < 6 ? 5 : 11, m < 6 ? 30 : 31, 23, 59, 59, 999);
    case 'Anual':
      return new Date(y, 11, 31, 23, 59, 59, 999);
    case 'Mensal':
    default:
      return new Date(y, m + 1, 0, 23, 59, 59, 999);
  }
}

function previousCycleRefDate(cycleStart) {
  return new Date(cycleStart.getTime() - 1);
}

function isInRange(date, start, end) {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function rangesContain(ranges, date) {
  for (const r of ranges) {
    if (isInRange(date, r.start, r.end)) return true;
  }
  return false;
}

function complianceFromTrades(trades) {
  if (trades.length === 0) return null;
  const withFlags = trades.filter((t) => hasEffectiveRedFlags(t)).length;
  const compliant = trades.length - withFlags;
  return (compliant / trades.length) * 100;
}

/**
 * @param {{
 *   trades: Array<{ id?: string, date: string|Date, hasRedFlags?: boolean, redFlags?: Array<unknown> }>,
 *   plans: Array<{ id?: string, adjustmentCycle?: 'Mensal'|'Trimestral'|'Semestral'|'Anual' }>,
 *   now: Date|string|number,
 *   minTrades?: number,
 * }} input
 * @returns {number|null}
 */
export function computeCycleBasedComplianceRate({ trades, plans, now, minTrades = DEFAULT_MIN_TRADES } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safePlans = Array.isArray(plans) ? plans : [];
  if (safeTrades.length === 0 || safePlans.length === 0) return null;

  const ref = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(ref.getTime())) return null;

  const parsedTrades = safeTrades
    .map((t) => ({ trade: t, date: parseTradeDate(t.date) }))
    .filter((p) => p.date !== null);
  if (parsedTrades.length === 0) return null;

  const planStates = safePlans.map((p) => ({
    adjustmentCycle: p.adjustmentCycle || 'Mensal',
    refDate: ref,
  }));

  const ranges = [];
  const seenIds = new Set();
  const collected = [];
  let prevSize = 0;

  for (let iter = 0; iter <= MAX_LOOKBACK_CYCLES; iter += 1) {
    for (const state of planStates) {
      const start = getCycleStart(state.adjustmentCycle, state.refDate);
      const end = getCycleEnd(state.adjustmentCycle, state.refDate);
      ranges.push({ start, end });
    }

    collected.length = 0;
    seenIds.clear();
    for (const p of parsedTrades) {
      if (!rangesContain(ranges, p.date)) continue;
      const key = p.trade.id != null ? String(p.trade.id) : `__idx_${collected.length}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      collected.push(p.trade);
    }

    if (collected.length >= minTrades) {
      return complianceFromTrades(collected);
    }

    if (iter > 0 && collected.length === prevSize) {
      return null;
    }
    prevSize = collected.length;

    for (const state of planStates) {
      const currentStart = getCycleStart(state.adjustmentCycle, state.refDate);
      state.refDate = previousCycleRefDate(currentStart);
    }
  }

  return collected.length >= minTrades ? complianceFromTrades(collected) : null;
}

export const __internals = {
  parseTradeDate,
  getCycleStart,
  getCycleEnd,
  previousCycleRefDate,
  MAX_LOOKBACK_CYCLES,
  DEFAULT_MIN_TRADES,
};
