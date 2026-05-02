// ============================================
// CYCLE CONSISTENCY — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/cycleConsistency/computeCycleSharpe.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui replica em src/, e vice-versa (#119/#191).
//
// Sharpe ratio per-ciclo com Selic histórica descontada apenas em dias com
// trade. Anualiza pelo factor √252 (DEC-AUTO-235-03).
//
// Algoritmo (memória de cálculo, body do issue #235):
//   returns_d   = Σ result_dia(d) / plStart                    [d ∈ dias com trade]
//   rfr_d       = getSelicForDate(d).rateDaily                 [um lookup por dia distinto]
//   excess_d    = returns_d - rfr_d
//   mean        = Σ excess_d / N
//   std         = sqrt( Σ (excess_d - mean)² / (N - 1) )       [amostral, Bessel]
//   sharpe      = (mean / std) * √252                          [annual]
//
// Consistência declarada: Selic é descontada APENAS para dias com trade —
// nem dias sem trade entram em returns_d nem em rfr_d.

const SQRT_252 = Math.sqrt(252);
const SQRT_21 = Math.sqrt(21);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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

function dailyReturnsFromGroups(groups, plStart) {
  if (!(groups instanceof Map) || groups.size === 0) return [];
  if (typeof plStart !== 'number' || !Number.isFinite(plStart) || plStart === 0) return [];

  const dates = Array.from(groups.keys()).sort();
  return dates.map((dateIso) => ({
    dateIso,
    dailyReturn: groups.get(dateIso) / plStart,
  }));
}

function meanStdSample(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return { mean: 0, std: 0 };
  const N = arr.length;
  let sum = 0;
  for (const v of arr) sum += v;
  const mean = sum / N;
  if (N < 2) return { mean, std: 0 };

  let sumSq = 0;
  for (const v of arr) sumSq += (v - mean) ** 2;
  const std = Math.sqrt(sumSq / (N - 1));
  return { mean, std };
}

function aggregateSource(daySources) {
  let bcbCount = 0;
  let fallbackCount = 0;
  for (const s of daySources) {
    if (s.isFallback) fallbackCount += 1;
    else bcbCount += 1;
  }
  const fallbackUsed = fallbackCount > 0;
  let source;
  if (fallbackCount === 0) source = 'BCB';
  else if (bcbCount === 0) source = 'FALLBACK';
  else source = 'MIXED';
  return { source, fallbackUsed };
}

function resolveGetSelicFn(opts) {
  if (typeof opts.getSelicForDateFn === 'function') return opts.getSelicForDateFn;
  return require('../marketData/getSelicForDate').getSelicForDate;
}

/**
 * Sharpe per-ciclo anualizado, com Selic histórica descontada por dia operado.
 *
 * @param {Array<{date:string,result:number,status:string}>} trades
 * @param {string} cycleStart — ISO `YYYY-MM-DD` (inclusive)
 * @param {string} cycleEnd   — ISO `YYYY-MM-DD` (inclusive)
 * @param {number} plStart    — balance no início do ciclo (R$)
 * @param {Object} [opts]
 * @param {number} [opts.minDays=5]
 * @param {('annual'|'monthly')} [opts.periodicity='annual']
 * @param {Function} [opts.getSelicForDateFn]
 * @returns {Promise<{value:(number|null), daysWithTrade:number, source:('BCB'|'FALLBACK'|'MIXED'), insufficientReason?:string, fallbackUsed:boolean}>}
 */
async function computeCycleSharpe(trades, cycleStart, cycleEnd, plStart, opts = {}) {
  const minDays = typeof opts.minDays === 'number' ? opts.minDays : 5;
  const periodicity = opts.periodicity ?? 'annual';
  const multiplier = periodicity === 'monthly' ? SQRT_21 : SQRT_252;

  const groups = groupTradesByDay(trades, cycleStart, cycleEnd);
  const daysWithTrade = groups.size;

  if (daysWithTrade < minDays) {
    return {
      value: null,
      daysWithTrade,
      source: 'BCB',
      insufficientReason: 'min_days',
      fallbackUsed: false,
    };
  }

  const dailyReturns = dailyReturnsFromGroups(groups, plStart);
  const getSelicFn = resolveGetSelicFn(opts);

  const lookups = await Promise.all(
    dailyReturns.map((d) => Promise.resolve(getSelicFn(d.dateIso)))
  );

  const excess = [];
  const daySources = [];
  for (let i = 0; i < dailyReturns.length; i += 1) {
    const r = lookups[i] ?? {};
    const rateDaily = typeof r.rateDaily === 'number' && Number.isFinite(r.rateDaily) ? r.rateDaily : 0;
    const isFallback = r.isFallback === true || r.source === 'FALLBACK';
    daySources.push({ isFallback });
    excess.push(dailyReturns[i].dailyReturn - rateDaily);
  }

  const { source, fallbackUsed } = aggregateSource(daySources);
  const { mean, std } = meanStdSample(excess);

  if (std === 0) {
    return {
      value: null,
      daysWithTrade,
      source,
      insufficientReason: 'zero_variance',
      fallbackUsed,
    };
  }

  const value = (mean / std) * multiplier;
  return {
    value,
    daysWithTrade,
    source,
    fallbackUsed,
  };
}

module.exports = computeCycleSharpe;
module.exports.computeCycleSharpe = computeCycleSharpe;
module.exports.groupTradesByDay = groupTradesByDay;
module.exports.dailyReturnsFromGroups = dailyReturnsFromGroups;
module.exports.meanStdSample = meanStdSample;
