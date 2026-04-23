/**
 * src/utils/maturityEngine/helpers.js
 *
 * Helpers numéricos puros do motor de maturidade 4D × 5 stages (issue #119).
 *
 * Todas as funções são puras: zero I/O, zero Firestore, zero Date.now() direto.
 * Datas seguem INV-06 (BR DD/MM/YYYY e ISO YYYY-MM-DD aceitas, normalizadas para ISO).
 * Semana começa na segunda-feira (INV-06).
 */

// ---------------------------------------------------------------------------
// Parsers e utilitários internos
// ---------------------------------------------------------------------------

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
  // isoDate: 'YYYY-MM-DD'. Retorna a segunda-feira da mesma semana em ISO.
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1.1 computeDailyReturns
// ---------------------------------------------------------------------------

/**
 * Agrupa trades por dia (ISO YYYY-MM-DD) e calcula retorno diário:
 *   r_dia = sum(PL do dia) / balance_inicio_dia
 *   balance_inicio_hoje = balance_inicio_ontem + sum(PL ontem)
 *   balance_inicio_primeiro_dia = initialBalance
 *
 * Trades sem date ou sem pl numérico são ignorados silenciosamente.
 * Datas aceitas em BR (DD/MM/YYYY) ou ISO (YYYY-MM-DD); normalizadas para ISO.
 *
 * @param {Array<{date: string, pl: number}>} trades
 * @param {number} initialBalance
 * @returns {Array<{date: string, r: number}>} ordenado cronologicamente asc.
 */
export function computeDailyReturns(trades, initialBalance) {
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

// ---------------------------------------------------------------------------
// 1.2 computeSharpe
// ---------------------------------------------------------------------------

/**
 * Sharpe ratio a partir de retornos diários.
 *   mean = Σ r / N
 *   std  = sqrt(Σ (r - mean)² / (N - 1))    (amostral, Bessel)
 *   sharpe = (mean / std) * sqrt(252)       [annual]
 *   sharpe = (mean / std) * sqrt(21)        [monthly]
 *
 * @param {Array<{r: number}>} dailyReturns
 * @param {{periodicity?: 'annual'|'monthly', minDays?: number}} options
 * @returns {number|null} null se amostra < minDays ou std = 0.
 */
export function computeSharpe(dailyReturns, options = {}) {
  const { periodicity = 'annual', minDays = 60 } = options;
  if (!Array.isArray(dailyReturns) || dailyReturns.length < minDays) return null;

  let multiplier;
  if (periodicity === 'annual') multiplier = Math.sqrt(252);
  else if (periodicity === 'monthly') multiplier = Math.sqrt(21);
  else throw new Error(`Unsupported periodicity: ${periodicity}`);

  const N = dailyReturns.length;
  // Short-circuit: retornos exatamente constantes não têm dispersão — evita erro FP
  // que produz std ~1e-18 em vez de 0 e Sharpe astronômico.
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

// ---------------------------------------------------------------------------
// 1.3 computeAnnualizedReturn
// ---------------------------------------------------------------------------

/**
 * Retorno anualizado (CAGR em base diária) a partir de retornos diários.
 *   cumulative = Π(1 + r_i) - 1
 *   annualized = (1 + cumulative)^(252/N) - 1
 *
 * @param {Array<{r: number}>} dailyReturns
 * @param {{minDays?: number}} options
 * @returns {number|null} fração (0.15 = 15%); null se amostra < minDays.
 */
export function computeAnnualizedReturn(dailyReturns, options = {}) {
  const { minDays = 60 } = options;
  if (!Array.isArray(dailyReturns) || dailyReturns.length < minDays) return null;

  const N = dailyReturns.length;
  let cum = 1;
  for (const { r } of dailyReturns) cum *= 1 + r;
  const cumulative = cum - 1;
  return Math.pow(1 + cumulative, 252 / N) - 1;
}

// ---------------------------------------------------------------------------
// 1.4 computeStrategyConsistencyWeeks
// ---------------------------------------------------------------------------

/**
 * Run máximo consecutivo de semanas (segunda-a-domingo) em que o mesmo setup
 * é dominante (> 60% dos trades da semana).
 *
 * @param {Array<{date:string, setup?:string}>} trades
 * @param {Array<any>} plans   recebido para futura extensão (não usado).
 * @returns {number} inteiro ≥ 0.
 */
export function computeStrategyConsistencyWeeks(trades, plans) {
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
  for (const dom of dominants) {
    if (dom !== null && dom === currentSetup) {
      currentRun += 1;
    } else if (dom !== null) {
      currentSetup = dom;
      currentRun = 1;
    } else {
      currentSetup = null;
      currentRun = 0;
    }
    if (currentRun > maxRun) maxRun = currentRun;
  }

  return maxRun;
}

// ---------------------------------------------------------------------------
// 1.5 mapMetricsToStage
// ---------------------------------------------------------------------------

// Tabela framework §5.3 (linhas 452-461) — fronteiras preferem o stage superior.

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
  // Invertido: DD menor = stage maior. Fronteira prefere stage superior.
  if (dd <= 3) return 5;
  if (dd <= 5) return 4;
  if (dd <= 15) return 3;
  if (dd <= 25) return 2;
  return 1;
}

/**
 * Mapeia métricas agregadas para o pior stage entre win rate, payoff e maxDD.
 * Fronteiras: preferem stage superior (≥ thresholds do stage de cima vencem).
 *
 * @param {{winRate?: number, payoff?: number, maxDD?: number}} metrics
 * @returns {1|2|3|4|5}
 */
export function mapMetricsToStage(metrics = {}) {
  const { winRate, payoff, maxDD } = metrics;
  const stages = [];
  if (typeof winRate === 'number' && Number.isFinite(winRate)) stages.push(stageFromWinRate(winRate));
  if (typeof payoff === 'number' && Number.isFinite(payoff)) stages.push(stageFromPayoff(payoff));
  if (typeof maxDD === 'number' && Number.isFinite(maxDD)) stages.push(stageFromMaxDD(maxDD));
  if (stages.length === 0) return 1;
  return Math.min(...stages);
}

// ---------------------------------------------------------------------------
// 1.6 computeSelfAwareness
// ---------------------------------------------------------------------------

/**
 * Self-awareness: 100 - mean(|baseline_i - current_i|) em {emotional, financial, operational}.
 * Dimensões ausentes no baseline são ignoradas no mean.
 * Sem nenhuma dimensão disponível → 50 (neutro, aluno novo).
 * Clipado em [0, 100].
 *
 * @param {{emotional?:number, financial?:number, operational?:number}} baseline
 * @param {{emotional?:number, financial?:number, operational?:number}} currentDims
 * @returns {number}
 */
export function computeSelfAwareness(baseline, currentDims) {
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
