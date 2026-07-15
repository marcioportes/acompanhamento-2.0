/**
 * tradeTimezone.js — issue #285
 *
 * Helpers puros para o seletor de fuso no `AddTradeModal`. Calcula o offset UTC
 * pra uma data + fuso, considerando DST automaticamente (US Eastern/Central têm
 * horário de verão; Brasília é UTC-3 fixo desde 2019).
 *
 * O fuso é gravado no `entryTime`/`exitTime` do trade como **ISO + offset**
 * (ex.: `"2026-05-27T16:23:00-04:00"`) — instante absoluto, sem ambiguidade.
 * O enrichment (que já reconhece `HAS_TZ`) passa direto sem aplicar Brasília.
 *
 * @see functions/marketData/enrichTradeWithExcursions.js — toBrasiliaISO/HAS_TZ
 */

export const TIMEZONES = {
  ET:  { id: 'America/New_York',  label: 'Nova York (ET)', short: 'ET'  },
  CT:  { id: 'America/Chicago',   label: 'Chicago (CT)',   short: 'CT'  },
  BRT: { id: 'America/Sao_Paulo', label: 'Brasília (BRT)', short: 'BRT' },
};

export const TIMEZONE_LIST = [TIMEZONES.ET, TIMEZONES.CT, TIMEZONES.BRT];

// Detecta ISO já com offset/Z — não reconverter.
const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;

// Prefixos de futuros CME (US) — MANTER SINCRONIZADO com
// functions/marketData/symbolMapper.js MAPPINGS. Ordem-sensível: micros antes
// dos cheios pra não bater MNQ em NQ.
const CME_PREFIXES = ['MNQ', 'MES', 'MGC', 'MCL', 'MYM', 'M2K', 'NQ', 'ES', 'GC', 'CL', 'YM', 'RTY'];

/** Dia do mês do N-ésimo domingo (year, monthOneBased, n). */
function nthSundayOfMonth(year, monthOneBased, n) {
  const first = new Date(Date.UTC(year, monthOneBased - 1, 1));
  const dow = first.getUTCDay(); // 0=Sun
  const firstSunday = dow === 0 ? 1 : 1 + (7 - dow);
  return firstSunday + 7 * (n - 1);
}

/**
 * True se a data está em DST nos EUA (regra atual: 2º domingo de março a
 * 1º domingo de novembro). Granularidade de data — ignora o switch às 2h
 * local (irrelevante pra entrada de trade).
 *
 * @param {string} dateISO — 'YYYY-MM-DD' (sufixo extra ignorado)
 * @returns {boolean}
 */
export function isUSDST(dateISO) {
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return false;
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (m < 3 || m > 11) return false;
  if (m > 3 && m < 11) return true;
  if (m === 3) return d >= nthSundayOfMonth(y, 3, 2);
  if (m === 11) return d < nthSundayOfMonth(y, 11, 1);
  return false;
}

/**
 * Offset UTC (`'-HH:MM'`) pra uma data + fuso. DST automático em ET/CT;
 * BRT é fixo `-03:00`.
 *
 * @param {string} dateISO — 'YYYY-MM-DD'
 * @param {string} tz — id IANA
 * @returns {string}
 */
export function getOffset(dateISO, tz) {
  if (tz === TIMEZONES.BRT.id) return '-03:00';
  const dst = isUSDST(dateISO);
  if (tz === TIMEZONES.ET.id) return dst ? '-04:00' : '-05:00';
  if (tz === TIMEZONES.CT.id) return dst ? '-05:00' : '-06:00';
  return '-03:00'; // fallback defensivo
}

/**
 * True se o ticker é um futuro CME (mapeável no Yahoo). Espelha o predicado
 * de `symbolMapper.mapToYahoo` sem depender do CJS server-side.
 */
export function isCMEFutureTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return false;
  const upper = ticker.toUpperCase().trim();
  return CME_PREFIXES.some((p) => upper.startsWith(p));
}

/**
 * Default inicial de fuso pra um ticker — ET pra futuros CME, BRT pro resto.
 * Sticky (último escolhido pelo aluno) sobrescreve via localStorage no caller.
 */
export function defaultTzForTicker(ticker) {
  return isCMEFutureTicker(ticker) ? TIMEZONES.ET.id : TIMEZONES.BRT.id;
}

// Exchanges US (horário de mercado em ET) — bolsas brasileiras usam BRT (#292).
const US_EXCHANGES = ['CME', 'CBOT', 'NYMEX', 'COMEX', 'GLOBEX', 'NYSE', 'NASDAQ', 'CBOE'];

/**
 * Default de fuso por exchange no import CSV (#292) — ET pras bolsas US, BRT
 * pro resto (B3 etc.). Case-insensitive. Sticky/manual sobrescreve no caller.
 */
export function defaultTzForExchange(exchange) {
  if (!exchange || typeof exchange !== 'string') return TIMEZONES.BRT.id;
  return US_EXCHANGES.includes(exchange.toUpperCase().trim())
    ? TIMEZONES.ET.id
    : TIMEZONES.BRT.id;
}

/**
 * Combina data (YYYY-MM-DD) + hora (HH:MM ou HH:MM:SS) + fuso → ISO + offset.
 * Offset é calculado pra DATA do trade (não "hoje") — DST correto pro instante.
 *
 * @returns {string|null} ex.: `'2026-05-27T16:23:00-04:00'`
 */
export function combineDateTimeWithTz(dateISO, time, tz) {
  if (!dateISO || !time || !tz) return null;
  const timePart = time.length >= 8 ? time : `${time}:00`;
  return `${dateISO}T${timePart}${getOffset(dateISO, tz)}`;
}

/**
 * Converte um ISO naive (`YYYY-MM-DDTHH:MM[:SS]`) para instante absoluto
 * (ISO+offset) no fuso informado (#292, import por lote). Já com offset/Z, ou
 * sem tz, ou malformado → retorna o valor original (legado segue Brasília no
 * enrich). Usado por csvMapper e orderReconstruction.
 *
 * @param {string|null} naiveIso
 * @param {string|null} tz — IANA id; null/'' não converte
 * @returns {string|null}
 */
export function naiveIsoToOffset(naiveIso, tz) {
  if (!naiveIso || !tz || HAS_TZ.test(naiveIso)) return naiveIso;
  const [date, time] = naiveIso.split('T');
  if (!date || !time) return naiveIso;
  return combineDateTimeWithTz(date, time, tz) || naiveIso;
}

/**
 * Deriva o id IANA do fuso a partir de um ISO já gravado (consulta/edição #292):
 * casa o offset do ISO contra cada fuso conhecido NA DATA do trade (DST correto).
 * Naive (legado, sem offset) ou sem match → null (caller decide o fallback).
 * Empate (ex.: -05:00 = ET-inverno ou CT-verão) → prioriza a ordem de TIMEZONE_LIST.
 *
 * @param {string|null} iso — ex.: '2026-06-03T10:21:57-03:00'
 * @returns {string|null} id IANA (ex.: 'America/Sao_Paulo') ou null
 */
export function tzFromStoredIso(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/T\d{2}:\d{2}(?::\d{2})?([+-]\d{2}:?\d{2}|[zZ])$/);
  if (!m) return null; // naive (legado) — sem offset gravado
  let off = m[1];
  if (off === 'Z' || off === 'z') off = '+00:00';
  if (!off.includes(':')) off = `${off.slice(0, 3)}:${off.slice(3)}`;
  const date = iso.slice(0, 10);
  const match = TIMEZONE_LIST.find((tz) => getOffset(date, tz.id) === off);
  return match ? match.id : null;
}

/**
 * Equivalente em Brasília (`'HH:MM'`) de um ISO com offset — usado no helper
 * embaixo do campo pro aluno conferir mentalmente.
 *
 * Funciona pra ISO+offset (instante absoluto) e pra naive (assume Brasília,
 * legado) — nos dois casos retorna a hora local de Brasília.
 */
export function toBrasiliaDisplay(isoWithOffset) {
  if (!isoWithOffset || typeof isoWithOffset !== 'string') return '';
  const d = new Date(isoWithOffset);
  if (isNaN(d.getTime())) return '';
  // Pega componentes da hora local de Brasília (UTC-3) sem depender da TZ do JS env.
  const brtMs = d.getTime() - 3 * 3600 * 1000;
  const brt = new Date(brtMs);
  const hh = String(brt.getUTCHours()).padStart(2, '0');
  const mm = String(brt.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// IANA id → label curto (ET/CT/BRT). Deriva de TIMEZONE_LIST (SSoT do `short`).
const SHORT_BY_IANA = Object.fromEntries(TIMEZONE_LIST.map((tz) => [tz.id, tz.short]));

/**
 * Label curto do fuso (`'ET'|'CT'|'BRT'`) a partir de um ISO gravado (#339).
 * Reidrata o IANA via `tzFromStoredIso` (offset cru é ambíguo: -05:00 = ET-inverno
 * ou CT-verão) e mapeia p/ o código curto. Naive/legado/desconhecido → `''`.
 *
 * @param {string|null} iso — ex.: '2026-05-27T16:23:00-04:00'
 * @returns {string} 'ET' | 'CT' | 'BRT' | ''
 */
export function shortTzLabelFromIso(iso) {
  const iana = tzFromStoredIso(iso);
  return (iana && SHORT_BY_IANA[iana]) || '';
}

/** Extrai o relógio de parede (`'HH:MM'` ou `'HH:MM:SS'`) do ISO, sem reconverter fuso. */
function wallClock(iso, withSeconds) {
  if (!iso || typeof iso !== 'string') return '';
  const timePart = iso.split('T')[1];
  if (!timePart) return '';
  const hm = timePart.slice(0, withSeconds ? 8 : 5);
  return /^\d{2}:\d{2}/.test(hm) ? hm : '';
}

/**
 * Horário do trade com fuso (#339): `'16:23 ET'`. Usa o relógio de parede do
 * trade (o instante que o trader operou), NÃO o fuso do navegador. ISO legado
 * sem offset → só a hora, sem label. SSoT de exibição de horário de trade.
 *
 * @param {string|null} iso — `entryTime`/`exitTime`/`p.dateTime`
 * @param {{ withSeconds?: boolean }} [opts]
 * @returns {string}
 */
export function fmtTradeTime(iso, { withSeconds = false } = {}) {
  const time = wallClock(iso, withSeconds);
  if (!time) return '';
  const label = shortTzLabelFromIso(iso);
  return label ? `${time} ${label}` : time;
}

/**
 * Data + horário do trade com fuso (#339): `'27/05/2026 16:23 ET'`.
 * ISO inválido → `'-'`. ISO legado sem offset → data + hora sem label.
 *
 * @param {string|null} iso
 * @param {{ withSeconds?: boolean }} [opts]
 * @returns {string}
 */
export function fmtTradeDateTime(iso, { withSeconds = false } = {}) {
  if (!iso || typeof iso !== 'string') return '-';
  const datePart = iso.split('T')[0];
  const m = datePart && datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '-';
  const time = fmtTradeTime(iso, { withSeconds });
  const dateBr = `${m[3]}/${m[2]}/${m[1]}`;
  return time ? `${dateBr} ${time}` : dateBr;
}
