// ============================================
// CYCLE CONSISTENCY — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/cycleConsistency/computeCVNormalized.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui replica em src/, e vice-versa (#119/#191).
//
// CV normalizado per-ciclo: razão entre variabilidade observada do P&L
// diário e variabilidade teórica esperada pelo plano (RR + WR).
//
// Algoritmo (memória de cálculo, body do issue #235 §2):
//
//   ── CV observado (sobre P&L diário do ciclo) ──
//   mean_obs = Σ pl_dia / N
//   std_obs  = sqrt( Σ (pl_dia - mean_obs)² / (N - 1) )      [amostral, Bessel]
//   cv_obs   = std_obs / |mean_obs|                          (null se mean_obs ≈ 0)
//
//   ── CV esperado pelo plano (analítico) ──
//   p        = WR efetiva no ciclo (fallback breakeven 1/(1+RR) quando insuficiente)
//   RR       = plan.targetRR
//   mean_exp = p × RR − (1 − p)                              [unidades de R]
//   var_exp  = p × (RR − mean_exp)² + (1 − p) × (−1 − mean_exp)²
//   std_exp  = sqrt(var_exp)
//   cv_exp   = std_exp / |mean_exp|                          (null se mean_exp ≈ 0)
//
//   ── Normalizado ──
//   cv_normalized = cv_obs / cv_exp                          (ratio adimensional)
//
// Função pura: zero Firestore, zero I/O.

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const NEAR_ZERO = 1e-9;

function parseDateToIso(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (ISO_DATE_RE.test(value)) return value;
  const m = BR_DATE_RE.exec(value);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/**
 * Agrupa trades por dia (ISO `YYYY-MM-DD`), filtrando por janela
 * `[cycleStart, cycleEnd]` (inclusive) e `status === 'CLOSED'`.
 * Mesmo contrato do helper homônimo em computeCycleSharpe.js (DEC-AUTO-235-T06-A:
 * duplicação intencional para preservar mirror discipline F1.1).
 */
function groupTradesByDay(trades, cycleStart, cycleEnd) {
  const map = new Map();
  if (!Array.isArray(trades) || trades.length === 0) return map;

  for (const t of trades) {
    if (!t || t.status !== 'CLOSED') continue;
    const iso = parseDateToIso(t.date);
    if (iso === null) continue;
    if (iso < cycleStart || iso > cycleEnd) continue;
    const pl = typeof t.result === 'number' && Number.isFinite(t.result) ? t.result : null;
    if (pl === null) continue;
    map.set(iso, (map.get(iso) ?? 0) + pl);
  }
  return map;
}

function effectiveWinRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return null;
  let wins = 0;
  let total = 0;
  for (const t of trades) {
    if (!t || t.status !== 'CLOSED') continue;
    if (typeof t.result !== 'number' || !Number.isFinite(t.result)) continue;
    total += 1;
    if (t.result > 0) wins += 1;
  }
  if (total === 0) return null;
  return wins / total;
}

function computeCvObserved(dailyPLs) {
  if (!Array.isArray(dailyPLs) || dailyPLs.length === 0) {
    return { cv: null, mean: 0, std: 0 };
  }
  const N = dailyPLs.length;
  let sum = 0;
  for (const v of dailyPLs) sum += v;
  const mean = sum / N;

  if (N < 2) {
    if (Math.abs(mean) < NEAR_ZERO) return { cv: null, mean, std: 0 };
    return { cv: 0, mean, std: 0 };
  }

  let sumSq = 0;
  for (const v of dailyPLs) sumSq += (v - mean) ** 2;
  const std = Math.sqrt(sumSq / (N - 1));

  if (Math.abs(mean) < NEAR_ZERO) return { cv: null, mean, std };
  return { cv: std / Math.abs(mean), mean, std };
}

function computeCvExpected(p, RR) {
  const mean = p * RR - (1 - p);
  const variance = p * (RR - mean) ** 2 + (1 - p) * (-1 - mean) ** 2;
  const std = Math.sqrt(variance);
  if (Math.abs(mean) < NEAR_ZERO) return { cv: null, mean, std };
  return { cv: std / Math.abs(mean), mean, std };
}

function resolveWinRate(trades, rrTarget) {
  const fromTrades = effectiveWinRate(trades);
  if (fromTrades !== null) return fromTrades;
  if (typeof rrTarget === 'number' && Number.isFinite(rrTarget) && rrTarget > 0) {
    return 1 / (1 + rrTarget);
  }
  return null;
}

/**
 * CV normalizado per-ciclo. Pure function — zero Firestore.
 *
 * @param {Array<{date:string,result:number,status:string}>} trades
 * @param {{rrTarget:number}} plan — campo canônico é `rrTarget` (ver PlanManagementModal)
 * @param {string} cycleStart — ISO `YYYY-MM-DD` (inclusive)
 * @param {string} cycleEnd   — ISO `YYYY-MM-DD` (inclusive)
 * @param {Object} [opts]
 * @param {number} [opts.minDays=5]
 */
function computeCVNormalized(trades, plan, cycleStart, cycleEnd, opts = {}) {
  const minDays = typeof opts.minDays === 'number' ? opts.minDays : 5;

  const groups = groupTradesByDay(trades, cycleStart, cycleEnd);
  const daysWithTrade = groups.size;

  if (daysWithTrade < minDays) {
    return {
      value: null,
      cvObs: null,
      cvExp: null,
      daysWithTrade,
      insufficientReason: 'min_days',
      label: `Insuficiente · ≥${minDays} dias`,
    };
  }

  const rrTarget = plan && plan.rrTarget;
  if (typeof rrTarget !== 'number' || !Number.isFinite(rrTarget) || rrTarget <= 0) {
    return {
      value: null,
      cvObs: null,
      cvExp: null,
      daysWithTrade,
      insufficientReason: 'no_target_rr',
      label: 'Plano sem RR alvo definido — definir para ativar métrica',
    };
  }

  const inWindowTrades = [];
  for (const t of trades) {
    if (!t || t.status !== 'CLOSED') continue;
    const iso = parseDateToIso(t.date);
    if (iso === null) continue;
    if (iso < cycleStart || iso > cycleEnd) continue;
    if (typeof t.result !== 'number' || !Number.isFinite(t.result)) continue;
    inWindowTrades.push(t);
  }

  const p = resolveWinRate(inWindowTrades, rrTarget);
  if (p === null) {
    return {
      value: null,
      cvObs: null,
      cvExp: null,
      daysWithTrade,
      insufficientReason: 'no_target_rr',
      label: 'Plano sem RR alvo definido — definir para ativar métrica',
    };
  }

  const exp = computeCvExpected(p, rrTarget);
  if (exp.cv === null) {
    return {
      value: null,
      cvObs: null,
      cvExp: null,
      daysWithTrade,
      insufficientReason: 'breakeven_plan',
      label: 'Plano com expectância nula — métrica indefinida',
    };
  }

  const dailyPLs = Array.from(groups.values());
  const obs = computeCvObserved(dailyPLs);
  if (obs.cv === null) {
    return {
      value: null,
      cvObs: null,
      cvExp: exp.cv,
      daysWithTrade,
      insufficientReason: 'zero_obs_mean',
      label: 'P&L médio diário próximo de zero — CV indefinido',
    };
  }

  return {
    value: obs.cv / exp.cv,
    cvObs: obs.cv,
    cvExp: exp.cv,
    daysWithTrade,
  };
}

module.exports = computeCVNormalized;
module.exports.computeCVNormalized = computeCVNormalized;
module.exports.groupTradesByDay = groupTradesByDay;
module.exports.effectiveWinRate = effectiveWinRate;
module.exports.computeCvObserved = computeCvObserved;
module.exports.computeCvExpected = computeCvExpected;
module.exports.resolveWinRate = resolveWinRate;
