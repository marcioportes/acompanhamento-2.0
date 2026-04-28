/**
 * fetchYahooBars.js — issue #187 Fase 4
 *
 * Busca 1m OHLC do Yahoo Finance entre dois timestamps. Free tier — limitações
 * conhecidas e aceitas (DEC-AUTO-187-02):
 *   - apenas últimos 7 dias para granularidade 1m
 *   - tickers `=F` retornam sempre front-month vigente (contract roll)
 *   - oscilações de disponibilidade (rate limit / mudanças não documentadas)
 *
 * Política de falha: retornar `{ ok: false, reason }` em vez de throw, para o
 * orchestrator marcar o trade como `excursionSource: 'unavailable'` sem propagar
 * erro pro caller (CF não falha um import por causa disso).
 *
 * Endpoint usado (público, sem auth):
 *   https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m
 *     &period1={unixSeconds}&period2={unixSeconds}
 */

const YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {Object} input
 * @param {string} input.yahooSymbol — ex: 'MNQ=F'
 * @param {Date|string|number} input.from — ISO/Date/ms
 * @param {Date|string|number} input.to — ISO/Date/ms
 * @param {Object} [deps]
 * @param {Function} [deps.fetchFn] — fetch para injeção em teste (default: global fetch)
 * @param {Function} [deps.now] — () => Date para teste
 * @param {number} [deps.timeoutMs]
 * @param {number} [deps.retries]
 * @returns {Promise<{ok: true, bars: Array<{t:number,h:number,l:number}>} |
 *                  {ok: false, reason: string}>}
 */
async function fetchYahooBars({ yahooSymbol, from, to }, deps = {}) {
  const fetchFn = deps.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : null);
  const now = deps.now ? deps.now() : new Date();
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = deps.retries ?? DEFAULT_RETRIES;

  if (!fetchFn) return { ok: false, reason: 'fetch unavailable in runtime' };
  if (!yahooSymbol) return { ok: false, reason: 'yahooSymbol obrigatório' };

  const t1 = toUnixSeconds(from);
  const t2 = toUnixSeconds(to);
  if (t1 == null || t2 == null) return { ok: false, reason: 'timestamps inválidos' };
  if (t2 <= t1) return { ok: false, reason: 'janela vazia (to <= from)' };

  // Janela 7d: se o final do trade já passou de 7d atrás, Yahoo não tem 1m.
  const oldestAllowed = now.getTime() - SEVEN_DAYS_MS;
  if (t2 * 1000 < oldestAllowed) {
    return { ok: false, reason: 'trade fora da janela 7d do Yahoo free tier' };
  }

  // Yahoo aceita o `=` literal no path; encode só caracteres que poderiam
  // confundir o parser (espaços/etc). Para tickers `MNQ=F`, evita %3D.
  const url = `${YAHOO_URL}/${yahooSymbol.replace(/\s+/g, '')}?interval=1m&period1=${t1}&period2=${t2}`;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), timeoutMs);
      const res = await fetchFn(url, { signal: ac.signal });
      clearTimeout(tid);

      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        // 4xx não vai melhorar com retry. Aborta cedo.
        if (res.status >= 400 && res.status < 500) break;
        continue;
      }

      const json = await res.json();
      const bars = parseYahooResponse(json);
      if (bars == null) {
        lastErr = 'shape inesperado';
        break;
      }
      // Filtra bars dentro do range exato (Yahoo às vezes retorna além)
      const filtered = bars.filter((b) => b.t >= t1 && b.t <= t2);
      return { ok: true, bars: filtered };
    } catch (err) {
      lastErr = err.message || String(err);
    }
  }
  return { ok: false, reason: `fetch falhou após ${retries + 1} tentativas: ${lastErr}` };
}

function parseYahooResponse(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const ts = result.timestamp;
  const quote = result.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !quote) return null;
  const high = quote.high;
  const low = quote.low;
  if (!Array.isArray(high) || !Array.isArray(low)) return null;

  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const h = high[i];
    const l = low[i];
    if (h == null || l == null) continue; // null bars (sem volume) ignorados
    bars.push({ t: ts[i], h, l });
  }
  return bars;
}

function toUnixSeconds(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof v === 'number') return Math.floor(v / 1000);
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  return null;
}

module.exports = {
  fetchYahooBars,
  parseYahooResponse,
  toUnixSeconds,
  SEVEN_DAYS_MS,
};
