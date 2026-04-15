/**
 * cycleResolver.js
 * @description Utils puros para resolver contexto de navegação do Dashboard-Aluno.
 *              Detecta ciclo ativo, resolve default de contexto, calcula ranges de período.
 *
 * @see Issue #118 — Barra de Contexto Unificado (DEC-047)
 * @see src/utils/planStateMachine.js — base para cycle start/end
 */

import { getCycleStartDate, getCycleEndDate } from './planStateMachine.js';

// ============================================
// CONSTANTES
// ============================================

export const PERIOD_KIND = {
  CYCLE: 'CYCLE',
  WEEK: 'WEEK',
  MONTH: 'MONTH'
};

export const CYCLE_STATUS = {
  ACTIVE: 'ACTIVE',       // now está dentro do range do ciclo
  FINALIZED: 'FINALIZED'  // now > cycleEnd → read-only
};

// ============================================
// HELPERS DE DATA
// ============================================

const toISODate = (d) => {
  if (!d || isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const getISOWeekMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return startOfDay(d);
};

const getISOWeekSunday = (date) => {
  const monday = getISOWeekMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return endOfDay(sunday);
};

// ============================================
// CYCLE KEYS
// ============================================

/**
 * Gera a chave canônica do ciclo que contém a data.
 * - Mensal: "YYYY-MM"
 * - Trimestral: "YYYY-Qn"
 *
 * @param {string} adjustmentCycle - 'Mensal' | 'Trimestral'
 * @param {Date} date
 * @returns {string}
 */
export const getCycleKey = (adjustmentCycle, date) => {
  if (!date || isNaN(date)) return null;
  const y = date.getFullYear();
  const m = date.getMonth();
  if (adjustmentCycle === 'Trimestral') {
    const q = Math.floor(m / 3) + 1;
    return `${y}-Q${q}`;
  }
  const mm = String(m + 1).padStart(2, '0');
  return `${y}-${mm}`;
};

/**
 * Parseia cycleKey de volta para Date (início do ciclo).
 * Aceita "YYYY-MM" ou "YYYY-Qn".
 *
 * @param {string} cycleKey
 * @returns {Date | null}
 */
export const parseCycleKey = (cycleKey) => {
  if (!cycleKey || typeof cycleKey !== 'string') return null;
  const quarterMatch = cycleKey.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) {
    const y = parseInt(quarterMatch[1], 10);
    const q = parseInt(quarterMatch[2], 10);
    return new Date(y, (q - 1) * 3, 1);
  }
  const monthMatch = cycleKey.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const y = parseInt(monthMatch[1], 10);
    const m = parseInt(monthMatch[2], 10);
    return new Date(y, m - 1, 1);
  }
  return null;
};

// ============================================
// DETECTORES
// ============================================

/**
 * Detecta o ciclo ativo do plano baseado em `now`.
 * (E3: detecção por datas, `now between startDate and endDate`)
 *
 * @param {Object} plan - plan doc com `adjustmentCycle`
 * @param {Date} [now]
 * @returns {{ cycleKey, start, end, status } | null}
 */
export const detectActiveCycle = (plan, now = new Date()) => {
  if (!plan) return null;
  const adjustmentCycle = plan.adjustmentCycle || 'Mensal';
  const ref = now instanceof Date ? now : new Date(now);
  if (isNaN(ref)) return null;

  const start = getCycleStartDate(adjustmentCycle, ref);
  const end = getCycleEndDate(adjustmentCycle, ref);
  const cycleKey = getCycleKey(adjustmentCycle, ref);

  return {
    cycleKey,
    start: startOfDay(start),
    end: endOfDay(end),
    status: CYCLE_STATUS.ACTIVE
  };
};

/**
 * Resolve ciclo a partir de cycleKey + plano.
 * Usado quando contexto tem cycleKey persistido mas precisa reconstruir range.
 *
 * @param {string} cycleKey
 * @param {Object} plan
 * @param {Date} [now]
 * @returns {{ cycleKey, start, end, status } | null}
 */
export const resolveCycle = (cycleKey, plan, now = new Date()) => {
  if (!cycleKey || !plan) return null;
  const adjustmentCycle = plan.adjustmentCycle || 'Mensal';
  const refDate = parseCycleKey(cycleKey);
  if (!refDate) return null;

  const start = getCycleStartDate(adjustmentCycle, refDate);
  const end = getCycleEndDate(adjustmentCycle, refDate);
  const ref = now instanceof Date ? now : new Date(now);
  const status = ref > end ? CYCLE_STATUS.FINALIZED : CYCLE_STATUS.ACTIVE;

  return {
    cycleKey,
    start: startOfDay(start),
    end: endOfDay(end),
    status
  };
};

// ============================================
// PERIOD RANGES
// ============================================

/**
 * Calcula o range temporal para um `kind` de período dentro de um ciclo.
 * - CYCLE: range inteiro do ciclo
 * - WEEK: semana ISO atual (intersectada com o ciclo)
 * - MONTH: mês atual (intersectada com o ciclo)
 *
 * @param {{ start: Date, end: Date }} cycle
 * @param {string} kind - PERIOD_KIND
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, kind }}
 */
export const getPeriodRange = (cycle, kind, now = new Date()) => {
  if (!cycle || !cycle.start || !cycle.end) return null;
  const ref = now instanceof Date ? now : new Date(now);
  const cycleStart = cycle.start instanceof Date ? cycle.start : new Date(cycle.start);
  const cycleEnd = cycle.end instanceof Date ? cycle.end : new Date(cycle.end);

  const clamp = (start, end) => ({
    start: start < cycleStart ? cycleStart : start,
    end: end > cycleEnd ? cycleEnd : end,
    kind
  });

  switch (kind) {
    case PERIOD_KIND.WEEK: {
      const weekStart = getISOWeekMonday(ref);
      const weekEnd = getISOWeekSunday(ref);
      return clamp(weekStart, weekEnd);
    }
    case PERIOD_KIND.MONTH: {
      const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return clamp(startOfDay(monthStart), endOfDay(monthEnd));
    }
    case PERIOD_KIND.CYCLE:
    default:
      return { start: cycleStart, end: cycleEnd, kind: PERIOD_KIND.CYCLE };
  }
};

// ============================================
// DEFAULT CONTEXT
// ============================================

/**
 * Resolve o contexto inicial default (E2): conta com plano ativo mais recente,
 * ciclo ativo, período = ciclo completo.
 *
 * Ordem de prioridade:
 * - accounts[]: filtra `active !== false`, ordena por plano mais recente
 * - plans[]: filtra `accountId === selectedAccount.id`, ordena por createdAt DESC, id DESC
 *
 * @param {Array} accounts
 * @param {Array} plans
 * @param {Date} [now]
 * @returns {{ accountId, planId, cycleKey, period, updatedAt } | null}
 */
export const getDefaultContext = (accounts = [], plans = [], now = new Date()) => {
  const activeAccounts = (accounts || []).filter(a => a && a.active !== false);
  if (activeAccounts.length === 0) {
    return {
      accountId: null,
      planId: null,
      cycleKey: null,
      period: null,
      updatedAt: now.toISOString()
    };
  }

  // Indexa planos por accountId
  const plansByAccount = new Map();
  for (const p of (plans || [])) {
    if (!p || !p.accountId) continue;
    const list = plansByAccount.get(p.accountId) || [];
    list.push(p);
    plansByAccount.set(p.accountId, list);
  }

  // Ordena planos da conta por createdAt DESC, id DESC (determinismo)
  const sortPlans = (list) => [...list].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? new Date(a.createdAt ?? 0).getTime();
    const tb = b.createdAt?.toMillis?.() ?? new Date(b.createdAt ?? 0).getTime();
    if (tb !== ta) return tb - ta;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  // Encontra primeira conta com plano
  let selectedAccount = null;
  let selectedPlan = null;
  for (const acc of activeAccounts) {
    const accPlans = sortPlans(plansByAccount.get(acc.id) || []);
    if (accPlans.length > 0) {
      selectedAccount = acc;
      selectedPlan = accPlans[0];
      break;
    }
  }

  if (!selectedAccount) {
    selectedAccount = activeAccounts[0];
  }

  if (!selectedPlan) {
    return {
      accountId: selectedAccount.id,
      planId: null,
      cycleKey: null,
      period: null,
      updatedAt: now.toISOString()
    };
  }

  const activeCycle = detectActiveCycle(selectedPlan, now);
  const periodRange = activeCycle
    ? getPeriodRange(activeCycle, PERIOD_KIND.CYCLE, now)
    : null;

  return {
    accountId: selectedAccount.id,
    planId: selectedPlan.id,
    cycleKey: activeCycle?.cycleKey ?? null,
    period: periodRange
      ? {
          kind: periodRange.kind,
          start: toISODate(periodRange.start),
          end: toISODate(periodRange.end)
        }
      : null,
    updatedAt: now.toISOString()
  };
};

/**
 * Resolve plano default para uma conta (mais recente pelo createdAt).
 *
 * @param {Array} plans
 * @param {string} accountId
 * @returns {Object | null}
 */
export const getDefaultPlanForAccount = (plans = [], accountId) => {
  if (!accountId) return null;
  const candidates = (plans || []).filter(p => p && p.accountId === accountId);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? new Date(a.createdAt ?? 0).getTime();
    const tb = b.createdAt?.toMillis?.() ?? new Date(b.createdAt ?? 0).getTime();
    if (tb !== ta) return tb - ta;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  return sorted[0] || null;
};

// Exports adicionais para testes
export const __helpers = { toISODate, startOfDay, endOfDay, getISOWeekMonday, getISOWeekSunday };
