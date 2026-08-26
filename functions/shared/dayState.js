/**
 * functions/shared/dayState.js
 * @version 1.0.0 (v1.83.32 — issue #402)
 * @description Espelho CJS de `src/utils/dayState.js` — motor do período.
 *
 * Separa o fato ATÔMICO (o que a operação decidiu) do fato do PERÍODO (o que o
 * dia/semana fez). Duas regras governam o módulo:
 *   1. Resultado do período é LÍQUIDO — ganhos compensam perdas.
 *   2. O stop do período governa AUTORIZAÇÃO PARA ABRIR (DEC-069), não é um
 *      carimbo retroativo em toda operação do dia.
 *
 * MANTER EM SINCRONIA com `src/utils/dayState.js`
 * (paridade em `src/__tests__/functions/shared/dayStateMirror.test.js`).
 */

const { sortTradesChrono, orderingConfidence, tradeInstantInfo } = require('./tradeInstant');
const { exceedsLimit, fallsShortOf, authorizedCount } = require('./planTolerance');

const AUTHORIZATION = {
  AUTHORIZED: 'AUTORIZADA',
  NO_ROOM: 'SEM_FOLGA',
  AFTER_STOP: 'APOS_STOP',
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cents = (v) => Math.round(v * 100) / 100;

// --- bucketização por período (espelha planStateMachine.getPeriodKey) ---

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getISOWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodKey(tradeDate, operationPeriod, cycleStart) {
  if (operationPeriod !== 'Semanal') return tradeDate;
  const monday = getISOWeekMonday(new Date(`${tradeDate}T12:00:00`));
  if (cycleStart && monday < cycleStart) return formatDateKey(cycleStart);
  return formatDateKey(monday);
}

// --- limiares do plano ---

function thresholdsOf(plan) {
  const pl = num(plan && plan.pl) !== null ? num(plan.pl) : num(plan && plan.currentPl);
  if (pl == null || pl <= 0) {
    return { pl: null, stopValue: null, goalValue: null, roValue: null, maxAuthorizedTrades: null };
  }
  const pct = (v) => {
    const p = num(v);
    return p != null && p > 0 ? cents(pl * (p / 100)) : null;
  };
  const stopValue = pct(plan.periodStop);
  const roValue = pct(plan.riskPerOperation);
  return {
    pl,
    stopValue,
    goalValue: pct(plan.periodGoal),
    roValue,
    // #402 — com margem: 1,99 operações é 2.
    maxAuthorizedTrades: authorizedCount(stopValue, roValue),
  };
}

/**
 * @param {Object[]} trades — trades do período, em qualquer ordem
 * @param {Object|null} plan
 * @param {Object} [opts] — { cushionPolicy: 'net'|'floor', periodKey }
 * @returns {Object} PeriodState
 */
function buildPeriodState(trades, plan, opts) {
  const o = opts || {};
  const cushionPolicy = o.cushionPolicy === 'floor' ? 'floor' : 'net';
  const lista = Array.isArray(trades) ? trades : [];
  const ordenados = sortTradesChrono(lista);
  const th = thresholdsOf(plan);
  const stopValue = th.stopValue;
  const roValue = th.roValue;
  const goalValue = th.goalValue;

  const avaliaAutorizacao = stopValue != null;

  let cum = 0;
  let gains = 0;
  let losses = 0;
  let qty = 0;
  let stopHitIndex = null;
  let goalHitIndex = null;
  let tradesAfterStop = 0;

  const rows = ordenados.map((t, index) => {
    const result = num(t && t.result) !== null ? num(t.result) : 0;
    const cumBefore = cents(cum);

    const colchao = cushionPolicy === 'floor' ? Math.min(cumBefore, 0) : cumBefore;
    const budgetBefore = stopValue != null ? cents(stopValue + colchao) : null;

    let authorization = null;
    if (avaliaAutorizacao) {
      // #402 — margem de manejo (ver planTolerance).
      if (exceedsLimit(-cumBefore, stopValue)) {
        authorization = AUTHORIZATION.AFTER_STOP;
        tradesAfterStop += 1;
      } else if (roValue != null && fallsShortOf(budgetBefore, roValue)) {
        authorization = AUTHORIZATION.NO_ROOM;
      } else {
        authorization = AUTHORIZATION.AUTHORIZED;
      }
    }

    cum = cents(cum + result);
    if (result > 0) gains = cents(gains + result);
    if (result < 0) losses = cents(losses + Math.abs(result));
    qty += num(t && t.qty) !== null ? num(t.qty) : 0;

    if (stopValue != null && stopHitIndex === null && exceedsLimit(-cum, stopValue)) stopHitIndex = index;
    if (goalValue != null && goalHitIndex === null && cum >= goalValue) goalHitIndex = index;

    const info = tradeInstantInfo(t);
    return {
      index,
      tradeId: (t && t.id) || null,
      instantMs: info.ms,
      instantSource: info.source,
      result,
      cumBefore,
      cumAfter: cents(cum),
      budgetBefore,
      budgetAfter: stopValue != null
        ? cents(stopValue + (cushionPolicy === 'floor' ? Math.min(cum, 0) : cum))
        : null,
      authorization,
    };
  });

  const net = cents(cum);
  // Barreira só além da margem; `beyondStopBy` segue medido contra o limite REAL.
  const closedBeyondStop = stopValue != null ? exceedsLimit(-net, stopValue) : null;

  return {
    periodKey: o.periodKey != null ? o.periodKey : null,
    operationPeriod: (plan && plan.operationPeriod) || 'Diário',
    cushionPolicy,

    pl: th.pl,
    stopValue,
    goalValue,
    roValue,
    maxAuthorizedTrades: th.maxAuthorizedTrades,

    net,
    gains,
    losses,
    qty,
    count: rows.length,

    rows,
    stopHitIndex,
    goalHitIndex,
    reachedGoal: goalHitIndex !== null,
    closedBeyondStop,
    beyondStopBy: closedBeyondStop ? cents(Math.abs(net) - stopValue) : null,
    tradesAfterStop,

    ordering: orderingConfidence(ordenados),
  };
}

/** @returns {Map<string, Object>} */
function buildPeriodIndex(trades, plan, opts) {
  const o = opts || {};
  const lista = Array.isArray(trades) ? trades : [];
  const operationPeriod = (plan && plan.operationPeriod) || 'Diário';
  const buckets = new Map();

  for (let i = 0; i < lista.length; i++) {
    const t = lista[i];
    if (!t || !t.date) continue;
    const key = getPeriodKey(t.date, operationPeriod, o.cycleStart);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  const index = new Map();
  buckets.forEach((doPeriodo, key) => {
    index.set(key, buildPeriodState(doPeriodo, plan, Object.assign({}, o, { periodKey: key })));
  });
  return index;
}

/** @returns {Object|null} */
function authorizationFor(trade, periodState) {
  if (!trade || !trade.id || !periodState || !periodState.rows) return null;
  const achou = periodState.rows.find((r) => r.tradeId === trade.id);
  return achou || null;
}

module.exports = { AUTHORIZATION, buildPeriodState, buildPeriodIndex, authorizationFor };
