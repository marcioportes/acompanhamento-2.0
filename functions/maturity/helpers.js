// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/helpers.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { STAGE_WINDOWS } = require('./constants');

function clip01(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function norm(x, min, max) {
  if (max === min) return 0;
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  return clip01((x - min) / (max - min)) * 100;
}

function normInverted(x, min, max) {
  if (max === min) return 0;
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  return clip01(1 - (x - min) / (max - min)) * 100;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseDateToISO(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (ISO_DATE_RE.test(value)) return value;
  const m = BR_DATE_RE.exec(value);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function getMondayOfWeekISO(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function computeDailyReturns(trades, initialBalance) {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  const byDay = new Map();
  for (const t of trades) {
    const iso = parseDateToISO(t?.date);
    const pl = t?.pl;
    if (iso === null) continue;
    if (typeof pl !== 'number' || !Number.isFinite(pl)) continue;
    byDay.set(iso, (byDay.get(iso) ?? 0) + pl);
  }

  if (byDay.size === 0) return [];

  const sortedDates = Array.from(byDay.keys()).sort();
  const result = [];
  let balanceStart = initialBalance;
  for (const date of sortedDates) {
    const dayPL = byDay.get(date);
    const r = balanceStart === 0 ? 0 : dayPL / balanceStart;
    result.push({ date, r });
    balanceStart = balanceStart + dayPL;
  }
  return result;
}

function computeSharpe(dailyReturns, options = {}) {
  const { periodicity = 'annual', minDays = 60 } = options;
  if (!Array.isArray(dailyReturns) || dailyReturns.length < minDays) return null;

  let multiplier;
  if (periodicity === 'annual') multiplier = Math.sqrt(252);
  else if (periodicity === 'monthly') multiplier = Math.sqrt(21);
  else throw new Error(`Unsupported periodicity: ${periodicity}`);

  const N = dailyReturns.length;
  const first = dailyReturns[0].r;
  let isConstant = true;
  for (const { r } of dailyReturns) {
    if (r !== first) {
      isConstant = false;
      break;
    }
  }
  if (isConstant) return null;

  let sum = 0;
  for (const { r } of dailyReturns) sum += r;
  const mean = sum / N;

  let sumSqDev = 0;
  for (const { r } of dailyReturns) sumSqDev += (r - mean) ** 2;
  const std = Math.sqrt(sumSqDev / (N - 1));

  if (std === 0) return null;
  return (mean / std) * multiplier;
}

function computeAnnualizedReturn(dailyReturns, options = {}) {
  const { minDays = 60 } = options;
  if (!Array.isArray(dailyReturns) || dailyReturns.length < minDays) return null;

  const N = dailyReturns.length;
  let cum = 1;
  for (const { r } of dailyReturns) cum *= 1 + r;
  const cumulative = cum - 1;
  return Math.pow(1 + cumulative, 252 / N) - 1;
}

/**
 * #376 — a sequência exige vizinhança no calendário. Espelho de
 * `src/utils/maturityEngine/helpers.js`; ver a nota longa lá.
 *
 * A lista tem só os períodos COM trade: contar run por adjacência nela fazia
 * 4 semanas de janeiro + 4 de julho valerem 8 "consecutivas". Tolerância de 1
 * período — uma semana sem operar não apaga a constância; meses sumido, sim.
 */
const MAX_BURACO = 1;

function semanasEntre(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 604800000);
}

function mesesEntre(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return (pb[0] - pa[0]) * 12 + (pb[1] - pa[1]);
}

function computeStrategyConsistencyWeeks(trades, plans) {
  void plans;
  if (!Array.isArray(trades) || trades.length === 0) return 0;

  const byWeek = new Map();
  for (const t of trades) {
    const iso = parseDateToISO(t?.date);
    const setup = t?.setup;
    if (iso === null || typeof setup !== 'string' || setup.length === 0) continue;
    const weekKey = getMondayOfWeekISO(iso);
    let setupMap = byWeek.get(weekKey);
    if (!setupMap) {
      setupMap = new Map();
      byWeek.set(weekKey, setupMap);
    }
    setupMap.set(setup, (setupMap.get(setup) ?? 0) + 1);
  }

  if (byWeek.size === 0) return 0;

  const sortedWeeks = Array.from(byWeek.keys()).sort();
  const dominants = sortedWeeks.map((w) => {
    const setupMap = byWeek.get(w);
    let total = 0;
    for (const c of setupMap.values()) total += c;
    for (const [setup, count] of setupMap) {
      if (count / total > 0.6) return setup;
    }
    return null;
  });

  let maxRun = 0;
  let currentRun = 0;
  let currentSetup = null;
  let semanaAnterior = null;
  for (let i = 0; i < dominants.length; i += 1) {
    const dom = dominants[i];
    const atual = sortedWeeks[i];
    const vizinho = semanaAnterior !== null && semanasEntre(semanaAnterior, atual) <= MAX_BURACO + 1;
    if (dom !== null && dom === currentSetup && vizinho) {
      currentRun += 1;
    } else if (dom !== null) {
      currentSetup = dom;
      currentRun = 1;
    } else {
      currentSetup = null;
      currentRun = 0;
    }
    semanaAnterior = atual;
    if (currentRun > maxRun) maxRun = currentRun;
  }

  return maxRun;
}

function stageFromWinRate(wr) {
  if (wr >= 65) return 5;
  if (wr >= 55) return 4;
  if (wr >= 45) return 3;
  if (wr >= 30) return 2;
  return 1;
}

function stageFromPayoff(p) {
  if (p >= 2.5) return 5;
  if (p >= 2.0) return 4;
  if (p >= 1.2) return 3;
  if (p >= 1.0) return 2;
  return 1;
}

function stageFromMaxDD(dd) {
  if (dd <= 3) return 5;
  if (dd <= 5) return 4;
  if (dd <= 15) return 3;
  if (dd <= 25) return 2;
  return 1;
}

function mapMetricsToStage(metrics = {}) {
  const { winRate, payoff, maxDD } = metrics;
  const stages = [];
  if (typeof winRate === 'number' && Number.isFinite(winRate)) stages.push(stageFromWinRate(winRate));
  if (typeof payoff === 'number' && Number.isFinite(payoff)) stages.push(stageFromPayoff(payoff));
  if (typeof maxDD === 'number' && Number.isFinite(maxDD)) stages.push(stageFromMaxDD(maxDD));
  if (stages.length === 0) return 1;
  return Math.min(...stages);
}

function computeSelfAwareness(baseline, currentDims) {
  const DIMS = ['emotional', 'financial', 'operational'];
  const deltas = [];
  const b = baseline ?? {};
  const c = currentDims ?? {};
  for (const dim of DIMS) {
    const bv = b[dim];
    const cv = c[dim];
    if (typeof bv !== 'number' || !Number.isFinite(bv)) continue;
    if (typeof cv !== 'number' || !Number.isFinite(cv)) continue;
    deltas.push(Math.abs(bv - cv));
  }
  if (deltas.length === 0) return 50;
  const meanDelta = deltas.reduce((a, x) => a + x, 0) / deltas.length;
  const score = 100 - meanDelta;
  return Math.max(0, Math.min(100, score));
}

function toEpochMs(value) {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value !== 'string') return null;
  const iso = ISO_DATE_RE.test(value) ? value : parseDateToISO(value);
  if (iso === null) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveWindow(trades, stageCurrent, now) {
  const cfg = STAGE_WINDOWS[stageCurrent] ?? STAGE_WINDOWS[1];
  const floor = cfg.floorTrades;

  if (!Array.isArray(trades) || trades.length === 0) {
    return { window: [], windowSize: 0, sparseSample: true };
  }

  const nowMs = toEpochMs(now);
  if (nowMs === null) {
    return { window: [], windowSize: 0, sparseSample: true };
  }

  const annotated = [];
  for (const t of trades) {
    const ms = toEpochMs(t?.date);
    if (ms === null) continue;
    annotated.push({ trade: t, ms });
  }
  if (annotated.length === 0) {
    return { window: [], windowSize: 0, sparseSample: true };
  }

  annotated.sort((a, b) => a.ms - b.ms);

  const byCount = annotated.slice(Math.max(0, annotated.length - cfg.minTrades));

  const cutoffMs = nowMs - cfg.minDays * MS_PER_DAY;
  const byDays = annotated.filter((x) => x.ms >= cutoffMs);

  const chosen = byDays.length > byCount.length ? byDays : byCount;
  const window = chosen.map((x) => x.trade);

  return {
    window,
    windowSize: window.length,
    sparseSample: window.length < floor,
  };
}

// #416 C2 / D-11 — espelho de src/utils/planRiskFields.js. CJS não importa de src/
// (functions/ é deployado sozinho); a divergência é travada pelo teste de paridade
// em src/__tests__/functions/maturity/helpers.strategyConsistencyMonths.parity.test.js.
const RISK_FIELDS = Object.freeze([
  'riskPerOperation',
  'rrTarget',
  'periodStop',
  'cycleStop',
]);

// #416 C2 — a métrica media setup dominante > 60% do mês e descartava `plans`. Passa a
// medir meses desde a última mudança nos parâmetros de risco do plano. Ver a nota longa
// no espelho ESM. Assinatura (plans, options) — DEC-AUTO-416-18/20.
function planInstantToMs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const iso = parseDateToISO(value);
    const ms = iso !== null ? Date.parse(`${iso}T00:00:00Z`) : Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    try {
      if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
      }
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        const ms = Object.prototype.toString.call(d) === '[object Date]' ? d.getTime() : NaN;
        return Number.isFinite(ms) ? ms : null;
      }
      const secs = typeof value.seconds === 'number' ? value.seconds : value._seconds;
      if (typeof secs === 'number' && Number.isFinite(secs)) return secs * 1000;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function chaveMes(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mesesDecorridos(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;
  let meses = mesesEntre(chaveMes(fromMs), chaveMes(toMs));
  if (new Date(toMs).getUTCDate() < new Date(fromMs).getUTCDate()) meses -= 1;
  return meses > 0 ? meses : 0;
}

function ultimaMudancaDeRisco(plan) {
  const historico = Array.isArray(plan && plan.editHistory) ? plan.editHistory : [];
  let maisRecente = null;
  for (const entrada of historico) {
    const fields = Array.isArray(entrada && entrada.fields) ? entrada.fields : [];
    if (!fields.some((f) => RISK_FIELDS.includes(f))) continue;
    const ms = planInstantToMs(entrada && entrada.timestamp);
    if (ms === null) continue;
    if (maisRecente === null || ms > maisRecente) maisRecente = ms;
  }
  return maisRecente !== null ? maisRecente : planInstantToMs(plan && plan.createdAt);
}

function computeStrategyConsistencyMonths(plans, options = {}) {
  const ativos = Array.isArray(plans)
    ? plans.filter((p) => p != null && typeof p === 'object' && p.active !== false)
    : [];
  if (ativos.length === 0) return 0;

  const nowMs = planInstantToMs(options && options.now) ?? Date.now();

  let menor = null;
  for (const plan of ativos) {
    const refMs = ultimaMudancaDeRisco(plan);
    const meses = refMs === null ? 0 : mesesDecorridos(refMs, nowMs);
    if (menor === null || meses < menor) menor = meses;
    if (menor === 0) return 0;
  }
  return menor ?? 0;
}

function computeStopUsageRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  const withStop = trades.filter((t) => t?.stopLoss != null).length;
  return withStop / trades.length;
}

const CONF_RANK = { LOW: 0, MED: 1, HIGH: 2 };
const CONF_BY_RANK = ['LOW', 'MED', 'HIGH'];

function computeConfidence(dimConfidences) {
  if (dimConfidences == null || typeof dimConfidences !== 'object') return 'MED';
  const ranks = [];
  for (const key of ['E', 'F', 'O', 'M']) {
    const v = dimConfidences[key];
    if (v in CONF_RANK) ranks.push(CONF_RANK[v]);
  }
  if (ranks.length === 0) return 'MED';
  return CONF_BY_RANK[Math.min(...ranks)];
}

module.exports = {
  RISK_FIELDS,
  clip01,
  norm,
  normInverted,
  computeDailyReturns,
  computeSharpe,
  computeAnnualizedReturn,
  computeStrategyConsistencyWeeks,
  mapMetricsToStage,
  computeSelfAwareness,
  resolveWindow,
  computeStrategyConsistencyMonths,
  computeStopUsageRate,
  computeConfidence,
};
