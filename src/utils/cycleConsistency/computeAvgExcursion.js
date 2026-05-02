/**
 * src/utils/cycleConsistency/computeAvgExcursion.js — issue #235 F1.3
 *
 * MEP médio (Máxima Excursão Positiva) e MEN médio (Máxima Excursão Negativa)
 * em % por entry, agregados sobre os trades CLOSED dentro do ciclo.
 *
 * Algoritmo (memória de cálculo, body do issue #235 §3):
 *
 *   Para cada trade t com mepPrice/menPrice != null && entry > 0:
 *     Se LONG:
 *       mepPct_t = ((t.mepPrice - t.entry) / t.entry) × 100
 *       menPct_t = ((t.menPrice - t.entry) / t.entry) × 100
 *     Se SHORT:
 *       mepPct_t = ((t.entry - t.mepPrice) / t.entry) × 100
 *       menPct_t = ((t.entry - t.menPrice) / t.entry) × 100
 *
 *   avgMEP   = mean(mepPct_t) sobre trades com dado disponível
 *   avgMEN   = mean(menPct_t) sobre trades com dado disponível
 *   coverage = N_with_mep_men / N_total_trades_in_cycle
 *
 * Coverage display: se `coverage < coverageThreshold` (default 0.7), exibir
 * `⚠ MEP/MEN em N de M trades` (transparência de amostra).
 *
 * Função pura: zero Firestore, zero I/O. Toda entrada vem dos argumentos.
 * Os campos `mepPrice`/`menPrice` são populados por #187 — esta task só agrega.
 *
 * ⚠️ ESPELHO de functions/cycleConsistency/computeAvgExcursion.js — MANTER SINCRONIZADO ⚠️
 * Qualquer alteração aqui replica no CJS, e vice-versa (padrão #119/#191).
 */

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
 * MEP/MEN em % sobre entry para um único trade. Retorna null se:
 *  - dado faltando (`mepPrice` ou `menPrice` null/undefined ou não-finito);
 *  - `entry` ausente, não-finito ou ≤ 0 (evita divisão por zero);
 *  - `side` inválido (qualquer valor diferente de `'LONG'` / `'SHORT'`).
 *
 * @param {{side?:string, entry?:number, mepPrice?:number, menPrice?:number}} trade
 * @returns {{mepPct:number, menPct:number}|null}
 */
export function excursionPctForTrade(trade) {
  if (!trade) return null;

  const entry = typeof trade.entry === 'number' ? trade.entry : Number(trade.entry);
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const mep = typeof trade.mepPrice === 'number' ? trade.mepPrice : Number(trade.mepPrice);
  const men = typeof trade.menPrice === 'number' ? trade.menPrice : Number(trade.menPrice);
  if (trade.mepPrice == null || trade.menPrice == null) return null;
  if (!Number.isFinite(mep) || !Number.isFinite(men)) return null;

  if (trade.side === 'LONG') {
    return {
      mepPct: ((mep - entry) / entry) * 100,
      menPct: ((men - entry) / entry) * 100,
    };
  }
  if (trade.side === 'SHORT') {
    return {
      mepPct: ((entry - mep) / entry) * 100,
      menPct: ((entry - men) / entry) * 100,
    };
  }
  return null;
}

/**
 * MEP/MEN médio per-ciclo. Pure function — zero Firestore.
 *
 * @param {Array<{date:string,status:string,side:string,entry:number,mepPrice:number|null,menPrice:number|null}>} trades
 * @param {string} cycleStart — ISO `YYYY-MM-DD` (inclusive)
 * @param {string} cycleEnd   — ISO `YYYY-MM-DD` (inclusive)
 * @param {Object} [opts]
 * @param {number} [opts.coverageThreshold=0.7]
 * @returns {{
 *   avgMEP:(number|null),
 *   avgMEN:(number|null),
 *   coverage:number,
 *   coverageBelowThreshold:boolean,
 *   coverageLabel?:string,
 *   totalTrades:number,
 *   tradesWithData:number,
 *   insufficientReason?:('no_trades'|'no_excursion_data')
 * }}
 */
export function computeAvgExcursion(trades, cycleStart, cycleEnd, opts = {}) {
  const coverageThreshold =
    typeof opts.coverageThreshold === 'number' ? opts.coverageThreshold : 0.7;

  const inWindow = [];
  if (Array.isArray(trades)) {
    for (const t of trades) {
      if (!t || t.status !== 'CLOSED') continue;
      const iso = parseDateToIso(t.date);
      if (iso === null) continue;
      if (iso < cycleStart || iso > cycleEnd) continue;
      inWindow.push(t);
    }
  }

  const totalTrades = inWindow.length;
  if (totalTrades === 0) {
    return {
      avgMEP: null,
      avgMEN: null,
      coverage: 0,
      coverageBelowThreshold: false,
      totalTrades: 0,
      tradesWithData: 0,
      insufficientReason: 'no_trades',
    };
  }

  let sumMep = 0;
  let sumMen = 0;
  let tradesWithData = 0;
  for (const t of inWindow) {
    const pct = excursionPctForTrade(t);
    if (pct === null) continue;
    sumMep += pct.mepPct;
    sumMen += pct.menPct;
    tradesWithData += 1;
  }

  if (tradesWithData === 0) {
    return {
      avgMEP: null,
      avgMEN: null,
      coverage: 0,
      coverageBelowThreshold: true,
      coverageLabel: `⚠ MEP/MEN em 0 de ${totalTrades} trades`,
      totalTrades,
      tradesWithData: 0,
      insufficientReason: 'no_excursion_data',
    };
  }

  const coverage = tradesWithData / totalTrades;
  const coverageBelowThreshold = coverage < coverageThreshold;
  const result = {
    avgMEP: sumMep / tradesWithData,
    avgMEN: sumMen / tradesWithData,
    coverage,
    coverageBelowThreshold,
    totalTrades,
    tradesWithData,
  };
  if (coverageBelowThreshold) {
    result.coverageLabel = `⚠ MEP/MEN em ${tradesWithData} de ${totalTrades} trades`;
  }
  return result;
}
