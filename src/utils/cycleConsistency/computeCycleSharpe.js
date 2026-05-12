/**
 * src/utils/cycleConsistency/computeCycleSharpe.js — issue #235 F1.1
 *
 * Sharpe ratio per-ciclo com Selic histórica descontada apenas em dias com
 * trade. Anualiza pelo factor √252 (DEC-AUTO-235-03).
 *
 * Algoritmo (memória de cálculo, body do issue #235):
 *   returns_d   = Σ result_dia(d) / plStart                    [d ∈ dias com trade]
 *   rfr_d       = getSelicForDate(d).rateDaily                 [um lookup por dia distinto]
 *   excess_d    = returns_d - rfr_d
 *   mean        = Σ excess_d / N
 *   std         = sqrt( Σ (excess_d - mean)² / (N - 1) )       [amostral, Bessel]
 *   sharpe      = (mean / std) * √252                          [annual]
 *
 * Consistência declarada: Selic é descontada APENAS para dias com trade —
 * nem dias sem trade entram em returns_d nem em rfr_d (alinhamento numerador
 * vs custo de oportunidade).
 *
 * ⚠️ ESPELHO de functions/cycleConsistency/computeCycleSharpe.js — MANTER SINCRONIZADO ⚠️
 * Qualquer alteração aqui replica no CJS, e vice-versa (padrão #119/#191).
 */

const SQRT_252 = Math.sqrt(252);
const SQRT_21 = Math.sqrt(21);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Converte string `DD/MM/YYYY` ou `YYYY-MM-DD` para ISO `YYYY-MM-DD`.
 * Retorna null para qualquer outro formato.
 */
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
 * Trades sem `date` parseável, sem `result` numérico ou fora da janela
 * são ignorados silenciosamente.
 *
 * @param {Array<{date:string,result:number,status:string}>} trades
 * @param {string} cycleStart — ISO `YYYY-MM-DD`
 * @param {string} cycleEnd   — ISO `YYYY-MM-DD`
 * @returns {Map<string,number>} Map<dateIso, sumPL>
 */
export function groupTradesByDay(trades, cycleStart, cycleEnd) {
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

/**
 * Converte Map<dateIso, sumPL> em lista ordenada de `{dateIso, dailyReturn}`.
 * `dailyReturn = sumPL / plStart` (denominador constante = balance do início
 * do ciclo, conforme contrato do helper). Datas ordenadas asc.
 *
 * @param {Map<string,number>} groups
 * @param {number} plStart
 * @returns {Array<{dateIso:string, dailyReturn:number}>}
 */
export function dailyReturnsFromGroups(groups, plStart) {
  if (!(groups instanceof Map) || groups.size === 0) return [];
  if (typeof plStart !== 'number' || !Number.isFinite(plStart) || plStart === 0) return [];

  const dates = Array.from(groups.keys()).sort();
  return dates.map((dateIso) => ({
    dateIso,
    dailyReturn: groups.get(dateIso) / plStart,
  }));
}

/**
 * Média e desvio-padrão amostral (denominador N-1) de um array numérico.
 * N=0 → {mean:0, std:0}. N=1 → {mean:arr[0], std:0} (sem variância amostral).
 *
 * @param {number[]} arr
 * @returns {{mean:number, std:number}}
 */
export function meanStdSample(arr) {
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
  // daySources: Array<{isFallback:boolean, source?:string}>
  let bcbCount = 0;
  let fallbackCount = 0;
  let placeholderCount = 0;
  for (const s of daySources) {
    if (s.source === 'PLACEHOLDER') placeholderCount += 1;
    else if (s.isFallback) fallbackCount += 1;
    else bcbCount += 1;
  }
  const fallbackUsed = fallbackCount > 0;
  // PLACEHOLDER puro (todos os dias) — trades USD com SOFR não-integrado (DT-Zero7-03).
  if (placeholderCount === daySources.length && daySources.length > 0) {
    return { source: 'PLACEHOLDER', fallbackUsed: false };
  }
  let source;
  if (fallbackCount === 0) source = 'BCB';
  else if (bcbCount === 0) source = 'FALLBACK';
  else source = 'MIXED';
  return { source, fallbackUsed };
}

/**
 * Resolve a função de lookup de Selic. Aceita override via `opts.getSelicForDateFn`
 * (sempre usado em testes, evita carregar firebase). Sem override, importa
 * dinamicamente o helper real — nunca side-effect na carga do módulo.
 */
async function resolveGetSelicFn(opts) {
  if (typeof opts.getSelicForDateFn === 'function') return opts.getSelicForDateFn;
  const mod = await import('../marketData/getSelicForDate.js');
  return mod.getSelicForDate;
}

/**
 * Resolve a função de risk-free rate por moeda. Issue #273 — fecha bug latente
 * onde Selic (BRL) era aplicada a trades USD.
 *
 * - BRL → Selic (helper existente). Comportamento histórico preservado.
 * - USD → placeholder zero (DT-Zero7-03: integrar SOFR real depois).
 * - outros → placeholder zero.
 *
 * Caller pode passar `opts.getRiskFreeRateFn` para override total.
 *
 * @param {('BRL'|'USD'|string)} currency
 * @param {Object} opts
 * @returns {Function} (dateIso) => Promise<{rateDaily, isFallback, source}>
 */
async function resolveRiskFreeRateFn(currency, opts) {
  if (typeof opts.getRiskFreeRateFn === 'function') return opts.getRiskFreeRateFn;

  if (currency === 'BRL' || currency === undefined || currency === null) {
    return resolveGetSelicFn(opts);
  }

  // DT-Zero7-03: SOFR placeholder. Sem fetch real até integração com
  // Fed/Treasury API; rateDaily=0 = "sem desconto" — Sharpe fica
  // comparável ao retorno bruto.
  return () => ({ rateDaily: 0, source: 'PLACEHOLDER', isFallback: false });
}

/**
 * Sharpe per-ciclo anualizado, com Selic histórica descontada por dia operado.
 *
 * @param {Array<{date:string,result:number,status:string}>} trades
 * @param {string} cycleStart — ISO `YYYY-MM-DD` (inclusive)
 * @param {string} cycleEnd   — ISO `YYYY-MM-DD` (inclusive)
 * @param {number} plStart    — balance no início do ciclo (R$); denominador R$→%
 * @param {Object} [opts]
 * @param {number} [opts.minDays=5]               — mínimo de dias distintos com trade
 * @param {('annual'|'monthly')} [opts.periodicity='annual']
 * @param {('BRL'|'USD'|string)} [opts.currency='BRL'] — moeda dos trades para escolher rfr (#273)
 * @param {Function} [opts.getSelicForDateFn]     — override Selic (testabilidade)
 * @param {Function} [opts.getRiskFreeRateFn]     — override rfr genérico por moeda (#273)
 * @returns {Promise<{value:(number|null), daysWithTrade:number, source:('BCB'|'FALLBACK'|'MIXED'|'PLACEHOLDER'), insufficientReason?:string, fallbackUsed:boolean}>}
 */
export async function computeCycleSharpe(trades, cycleStart, cycleEnd, plStart, opts = {}) {
  const minDays = typeof opts.minDays === 'number' ? opts.minDays : 5;
  const periodicity = opts.periodicity ?? 'annual';
  const multiplier = periodicity === 'monthly' ? SQRT_21 : SQRT_252;
  const currency = opts.currency ?? 'BRL';

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
  const getRfrFn = await resolveRiskFreeRateFn(currency, opts);

  const lookups = await Promise.all(
    dailyReturns.map((d) => Promise.resolve(getRfrFn(d.dateIso)))
  );

  const excess = [];
  const daySources = [];
  for (let i = 0; i < dailyReturns.length; i += 1) {
    const r = lookups[i] ?? {};
    const rateDaily = typeof r.rateDaily === 'number' && Number.isFinite(r.rateDaily) ? r.rateDaily : 0;
    const isFallback = r.isFallback === true || r.source === 'FALLBACK';
    daySources.push({ isFallback, source: r.source });
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
