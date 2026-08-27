/**
 * functions/shared/tradeInstant.js
 * @version 1.0.0 (v1.83.32 — issue #402)
 * @description Espelho CJS de `src/utils/tradeInstant.js` — SSoT do instante de
 *   um trade e da ordem cronológica entre trades.
 *
 * Por que o espelho carrega a tabela de fusos em vez de importar: `functions/`
 * não tem módulo de fuso, e o contrato do #292 (`tradeTimezone.js`) é ESM do
 * lado web. As ~30 linhas de DST abaixo são cópia deliberada, cobertas por
 * teste de paridade em `src/__tests__/functions/shared/tradeInstantMirror.test.js`.
 *
 * MANTER EM SINCRONIA com `src/utils/tradeInstant.js` e com a tabela de
 * `src/utils/tradeTimezone.js` (getOffset / defaultTzForExchange / defaultTzForTicker).
 */

const TZ_ET = 'America/New_York';
const TZ_CT = 'America/Chicago';
const TZ_BRT = 'America/Sao_Paulo';
const TZ_LIST = [TZ_ET, TZ_CT, TZ_BRT];

const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;
const MEIO_DIA = '12:00:00';

// Ordem-sensível: micros antes dos cheios pra não bater MNQ em NQ.
const CME_PREFIXES = ['MNQ', 'MES', 'MGC', 'MCL', 'MYM', 'M2K', 'NQ', 'ES', 'GC', 'CL', 'YM', 'RTY'];
const US_EXCHANGES = ['CME', 'CBOT', 'NYMEX', 'COMEX', 'GLOBEX', 'NYSE', 'NASDAQ', 'CBOE'];

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

function nthSundayOfMonth(year, monthOneBased, n) {
  const first = new Date(Date.UTC(year, monthOneBased - 1, 1));
  const dow = first.getUTCDay();
  const firstSunday = dow === 0 ? 1 : 1 + (7 - dow);
  return firstSunday + 7 * (n - 1);
}

function isUSDST(dateISO) {
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return false;
  const parts = dateISO.slice(0, 10).split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (m < 3 || m > 11) return false;
  if (m > 3 && m < 11) return true;
  if (m === 3) return d >= nthSundayOfMonth(y, 3, 2);
  if (m === 11) return d < nthSundayOfMonth(y, 11, 1);
  return false;
}

function getOffset(dateISO, tz) {
  if (tz === TZ_BRT) return '-03:00';
  const dst = isUSDST(dateISO);
  if (tz === TZ_ET) return dst ? '-04:00' : '-05:00';
  if (tz === TZ_CT) return dst ? '-05:00' : '-06:00';
  return '-03:00';
}

function defaultTzForTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return TZ_BRT;
  const upper = ticker.toUpperCase().trim();
  return CME_PREFIXES.some((p) => upper.startsWith(p)) ? TZ_ET : TZ_BRT;
}

function defaultTzForExchange(exchange) {
  if (!exchange || typeof exchange !== 'string') return TZ_BRT;
  return US_EXCHANGES.indexOf(exchange.toUpperCase().trim()) !== -1 ? TZ_ET : TZ_BRT;
}

function tzFromStoredIso(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/T\d{2}:\d{2}(?::\d{2})?([+-]\d{2}:?\d{2}|[zZ])$/);
  if (!m) return null;
  let off = m[1];
  if (off === 'Z' || off === 'z') off = '+00:00';
  if (off.indexOf(':') === -1) off = `${off.slice(0, 3)}:${off.slice(3)}`;
  const date = iso.slice(0, 10);
  for (let i = 0; i < TZ_LIST.length; i++) {
    if (getOffset(date, TZ_LIST[i]) === off) return TZ_LIST[i];
  }
  return null;
}

function naiveIsoToOffset(naiveIso, tz) {
  if (!naiveIso || !tz || HAS_TZ.test(naiveIso)) return naiveIso;
  const parts = naiveIso.split('T');
  const date = parts[0];
  const time = parts[1];
  if (!date || !time) return naiveIso;
  const timePart = time.length >= 8 ? time : `${time}:00`;
  return `${date}T${timePart}${getOffset(date, tz)}`;
}

/** Fuso a assumir para um horário naive deste trade — inferido POR TRADE. */
function inferirTz(trade) {
  const doExit = tzFromStoredIso(trade && trade.exitTime);
  if (doExit) return doExit;
  if (trade && trade.exchange) return defaultTzForExchange(trade.exchange);
  if (trade && trade.ticker) return defaultTzForTicker(trade.ticker);
  return TZ_BRT;
}

/**
 * @returns {{ ms: number|null, source: 'offset'|'inferred'|'date'|'none', tz: string|null, iso: string|null }}
 */
function tradeInstantInfo(trade, field) {
  const campo = field || 'entryTime';
  const vazio = { ms: null, source: 'none', tz: null, iso: null };
  if (!trade || typeof trade !== 'object') return vazio;

  const raw = trade[campo];

  if (typeof raw === 'string' && raw.indexOf('T') !== -1) {
    if (HAS_TZ.test(raw)) {
      const ms = Date.parse(raw);
      if (finito(ms)) return { ms, source: 'offset', tz: tzFromStoredIso(raw), iso: raw };
    } else {
      const tz = inferirTz(trade);
      const iso = naiveIsoToOffset(raw, tz);
      const ms = Date.parse(iso);
      if (finito(ms)) return { ms, source: 'inferred', tz, iso };
    }
  }

  const date = typeof trade.date === 'string' ? trade.date.slice(0, 10) : null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const tz = inferirTz(trade);
    const iso = `${date}T${MEIO_DIA}${getOffset(date, tz)}`;
    const ms = Date.parse(iso);
    if (finito(ms)) return { ms, source: 'date', tz, iso };
  }

  return vazio;
}

function tradeInstantMs(trade, field) {
  return tradeInstantInfo(trade, field).ms;
}

function createdAtMs(trade) {
  const c = trade && trade.createdAt;
  if (!c) return null;
  if (finito(c.seconds)) return c.seconds * 1000 + Math.round((c.nanoseconds || 0) / 1e6);
  if (typeof c.toDate === 'function') {
    const ms = c.toDate().getTime();
    return finito(ms) ? ms : null;
  }
  if (c instanceof Date) return finito(c.getTime()) ? c.getTime() : null;
  if (finito(c)) return c;
  if (typeof c === 'string') {
    const ms = Date.parse(c);
    return finito(ms) ? ms : null;
  }
  return null;
}

function cmpNullLast(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ordem canônica: data → instante → createdAt → id. Total e determinística. */
function compareTradesChrono(a, b) {
  const porData = cmpNullLast(
    a && typeof a.date === 'string' ? a.date : null,
    b && typeof b.date === 'string' ? b.date : null,
  );
  if (porData !== 0) return porData;

  const porInstante = cmpNullLast(tradeInstantMs(a), tradeInstantMs(b));
  if (porInstante !== 0) return porInstante;

  const porCriacao = cmpNullLast(createdAtMs(a), createdAtMs(b));
  if (porCriacao !== 0) return porCriacao;

  return cmpNullLast((a && a.id) || null, (b && b.id) || null);
}

function sortTradesChrono(trades) {
  if (!Array.isArray(trades)) return [];
  return trades.slice().sort(compareTradesChrono);
}

/** @returns {{ reliable: boolean, reason: 'ok'|'single'|'missing_entry_time'|'mixed_offsets' }} */
function orderingConfidence(trades) {
  const lista = Array.isArray(trades) ? trades : [];
  if (lista.length <= 1) return { reliable: true, reason: 'single' };

  const infos = [];
  for (let i = 0; i < lista.length; i++) infos.push(tradeInstantInfo(lista[i]));
  for (let i = 0; i < infos.length; i++) {
    if (infos[i].source === 'date' || infos[i].source === 'none') {
      return { reliable: false, reason: 'missing_entry_time' };
    }
  }
  // Ver nota no espelho ESM: mistura só é risco quando os fusos RESOLVIDOS divergem.
  const fusos = {};
  for (let i = 0; i < infos.length; i++) fusos[String(infos[i].tz)] = true;
  if (Object.keys(fusos).length > 1) return { reliable: false, reason: 'mixed_offsets' };
  return { reliable: true, reason: 'ok' };
}

module.exports = {
  tradeInstantInfo,
  tradeInstantMs,
  compareTradesChrono,
  sortTradesChrono,
  orderingConfidence,
};
