/**
 * weeklyReviewSnapshot
 * @description Helpers puros para a Revisão Semanal (issue #102).
 *
 * A1: kpis com shape explícito (compliance sub-flags, emotional composite + contadores).
 * A2: topTrades/bottomTrades inline com fields fixos — sem _partials (bloat) e sem depender
 *     de re-read do trade doc (snapshot não rot quando trade é editado/deletado pós-close).
 * A3: reviewId = `${periodKey}-${epochMs}` para permitir múltiplas revisões por período.
 */

const TOP_BOTTOM_FIELDS = [
  'symbol', 'side', 'pnl', 'qty', 'entryTime', 'closeTime',
  'setup', 'emotionEntry', 'emotionExit', 'stopLoss',
];

const toDate = (input) => {
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  throw new Error('Invalid date input');
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Chave ISO 8601 de semana no formato `YYYY-Www`.
 * Ex: 2026-04-13 (segunda) → '2026-W16'.
 */
export const getISOWeekKey = (dateInput) => {
  const d = toDate(dateInput);
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Ajusta para quinta-feira da mesma ISO week (ISO: week contém a quinta)
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${pad2(weekNum)}`;
};

/**
 * Intervalo segunda→domingo da semana ISO contendo a data.
 * Retorna strings YYYY-MM-DD.
 */
export const getISOWeekRange = (dateInput) => {
  const d = toDate(dateInput);
  const dayOfWeek = d.getUTCDay() || 7; // domingo=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (dt) => `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
};

/**
 * ID da review — permite múltiplas revisões por período sem colisão (A3).
 */
export const buildReviewId = (periodKey, timestampMs = Date.now()) =>
  `${periodKey}-${timestampMs}`;

const projectTrade = (trade) => {
  const out = { tradeId: trade.id };
  for (const k of TOP_BOTTOM_FIELDS) {
    if (k === 'pnl') out.pnl = Number(trade.result) || 0;
    else if (k === 'qty') out.qty = Number(trade.qty) || 0;
    else if (k === 'closeTime') out.closeTime = trade.exitTime || null;
    // Trades legados usam `ticker`; novos usam `symbol`. Prioriza symbol, cai em ticker.
    else if (k === 'symbol') out.symbol = trade.symbol ?? trade.ticker ?? null;
    // Emotion legada é `emotion` (single); novo shape separa entry/exit. Fallback.
    else if (k === 'emotionEntry') out.emotionEntry = trade.emotionEntry ?? trade.emotion ?? null;
    else out[k] = trade[k] ?? null;
  }
  return out;
};

/**
 * Projeção inline de TODOS os trades do período para frozenSnapshot.periodTrades.
 * Usado na nova tela de Revisão Semanal (Subitem 1 — lista vertical).
 */
export const pickPeriodTrades = (trades) => {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  return [...trades]
    .sort((a, b) => {
      const ta = new Date(a.entryTime || a.date).getTime();
      const tb = new Date(b.entryTime || b.date).getTime();
      return ta - tb;
    })
    .map(projectTrade);
};

/**
 * Top N winners (result > 0), ordenados desc. Campos inline (A2), sem _partials.
 */
export const pickTopTrades = (trades, count = 3) => {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  return trades
    .filter(t => (Number(t.result) || 0) > 0)
    .sort((a, b) => (Number(b.result) || 0) - (Number(a.result) || 0))
    .slice(0, count)
    .map(projectTrade);
};

/**
 * Bottom N losers (result < 0), ordenados asc. Campos inline (A2), sem _partials.
 */
export const pickBottomTrades = (trades, count = 3) => {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  return trades
    .filter(t => (Number(t.result) || 0) < 0)
    .sort((a, b) => (Number(a.result) || 0) - (Number(b.result) || 0))
    .slice(0, count)
    .map(projectTrade);
};

/**
 * Monta o frozenSnapshot completo da revisão.
 *
 * @param {Object} params
 * @param {Object} params.plan - {id, adjustmentCycle}
 * @param {Array}  params.trades - trades do período filtrado
 * @param {Object} params.kpis - shape A1 já computado pelo caller
 * @param {string} params.cycleKey - chave do ciclo ativo (ex: '2026-04')
 * @returns {Object} frozenSnapshot
 */
export const buildWeeklyReviewSnapshot = ({ plan, trades, kpis, cycleKey }) => {
  if (!plan || !plan.id) throw new Error('buildWeeklyReviewSnapshot: plan is required');
  if (!kpis) throw new Error('buildWeeklyReviewSnapshot: kpis is required');
  return {
    planContext: {
      planId: plan.id,
      cycleKey: cycleKey || null,
      adjustmentCycle: plan.adjustmentCycle || null,
    },
    kpis,
    topTrades: pickTopTrades(trades, 3),
    bottomTrades: pickBottomTrades(trades, 3),
  };
};
