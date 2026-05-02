/**
 * fetchSelicDaily.js — issue #235 Fase F0.1
 *
 * Cloud Function (onSchedule v2) que busca a taxa Selic diária no BCB SGS-11
 * todo dia útil às 09h BRT e grava em `systemConfig/selic` (doc + subcollection
 * `history`). Insumo do helper `getSelicForDate` (F0.3) usado por
 * `computeCycleSharpe` (F1.1).
 *
 * Endpoint BCB SGS-11 (público, sem auth):
 *   https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados
 *     ?formato=json&dataInicial=DD/MM/YYYY&dataFinal=DD/MM/YYYY
 *
 * Payload sucesso (1 dia):
 *   [{ "data": "DD/MM/YYYY", "valor": "0.04953" }]   // valor = taxa diária em %
 *
 * Payload em fim de semana / feriado: `[]` (BCB não publica). Não é erro.
 *
 * Política de erro: NUNCA throw. Falha após N retries grava
 * `systemConfig/selic.lastError` e retorna — evita o scheduler do Cloud
 * Functions empilhar retry em cima do nosso retry.
 *
 * Schema gravado:
 *   systemConfig/selic                       { lastDate, lastRate, lastFetchedAt, source, lastError }
 *   systemConfig/selic/history/<YYYY-MM-DD>  { date, rateDaily, source, fetchedAt }
 *
 * INV-15: namespace aprovado em #issuecomment-4364111738.
 */

const BCB_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados';
const SOURCE = 'BCB-SGS-11';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_BASE_MS = 1000;
const DEFAULT_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Converte Date para `DD/MM/YYYY` no fuso America/Sao_Paulo.
 */
function formatBrDate(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return fmt.format(date).replace(/-/g, '/');
}

/**
 * Converte `DD/MM/YYYY` → `YYYY-MM-DD` (ISO). Não valida calendário.
 */
function brToIso(brDate) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Calcula D-1 do horário atual em America/Sao_Paulo. BCB publica a taxa
 * referente ao dia útil anterior; D-0 às 09h BRT geralmente ainda não saiu.
 */
function previousBrDate(now) {
  const brNow = new Date(now.getTime());
  brNow.setUTCDate(brNow.getUTCDate() - 1);
  return formatBrDate(brNow);
}

async function fetchOnce(url, fetchFn, timeoutMs) {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ac.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.code = `http_${res.status}`;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Tenta buscar até `attempts` vezes com backoff exponencial
 * (base, base*2, base*4, ...). Lança o último erro se todas falharem.
 */
async function fetchWithRetry(url, { fetchFn, attempts, backoffBase, timeoutMs, sleepFn }) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchOnce(url, fetchFn, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await sleepFn(backoffBase * Math.pow(2, i));
      }
    }
  }
  throw lastErr;
}

/**
 * Parse defensivo do payload BCB. Aceita campos extras, valida apenas
 * `data` (string DD/MM/YYYY) e `valor` (string numérica).
 */
function parsePayload(json) {
  if (!Array.isArray(json)) return null;
  const out = [];
  for (const item of json) {
    if (!item || typeof item.data !== 'string' || typeof item.valor !== 'string') return null;
    const iso = brToIso(item.data);
    if (!iso) return null;
    const num = Number(item.valor);
    if (!Number.isFinite(num)) return null;
    out.push({ date: iso, rateDaily: num / 100 });
  }
  return out;
}

/**
 * Helper puro: orquestra fetch + parse + escrita Firestore.
 *
 * @param {Object} deps
 * @param {Object} deps.db                 — admin.firestore() instance (ou stub)
 * @param {Function} deps.fetchFn          — fetch (default: global fetch)
 * @param {Function} [deps.now]            — () => Date (default: () => new Date())
 * @param {number} [deps.attempts]         — default 3
 * @param {number} [deps.backoffBase]      — ms, default 1000
 * @param {number} [deps.timeoutMs]        — default 8000
 * @param {Function} [deps.sleepFn]        — injetável para testes
 * @param {Object} [deps.timestamp]        — { now: () => any } para FieldValue.serverTimestamp simulado
 * @returns {Promise<{ok: boolean, status: 'written'|'skipped_idempotent'|'no_data'|'error', date?: string, rateDaily?: number, reason?: string}>}
 */
async function runFetchSelicDaily(deps = {}) {
  const fetchFn = deps.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!deps.db) throw new Error('deps.db obrigatório');
  if (!fetchFn) throw new Error('fetch indisponível');

  const now = deps.now ? deps.now() : new Date();
  const attempts = deps.attempts ?? DEFAULT_ATTEMPTS;
  const backoffBase = deps.backoffBase ?? DEFAULT_BACKOFF_BASE_MS;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleepFn = deps.sleepFn ?? sleep;
  const ts = deps.timestamp ?? { now: () => new Date() };

  const targetBr = previousBrDate(now);
  const url = `${BCB_URL}?formato=json&dataInicial=${encodeURIComponent(targetBr)}&dataFinal=${encodeURIComponent(targetBr)}`;

  const selicRef = deps.db.collection('systemConfig').doc('selic');

  let payload;
  try {
    payload = await fetchWithRetry(url, { fetchFn, attempts, backoffBase, timeoutMs, sleepFn });
  } catch (err) {
    const code = err.code || 'fetch_failed';
    const message = err.message || String(err);
    console.error(`[fetchSelicDaily] falha após ${attempts} tentativas: ${code} ${message}`);
    await selicRef.set(
      {
        lastError: { code, message, attemptedAt: ts.now() },
      },
      { merge: true }
    );
    return { ok: false, status: 'error', reason: `${code}: ${message}` };
  }

  const parsed = parsePayload(payload);
  if (parsed == null) {
    const message = 'payload com schema inválido';
    console.error(`[fetchSelicDaily] ${message}`);
    await selicRef.set(
      {
        lastError: { code: 'bad_schema', message, attemptedAt: ts.now() },
      },
      { merge: true }
    );
    return { ok: false, status: 'error', reason: message };
  }

  // Atualiza metadata mesmo em payload vazio (saber que rodamos hoje).
  if (parsed.length === 0) {
    console.info(`[fetchSelicDaily] no data for ${targetBr} (fim de semana / feriado)`);
    await selicRef.set(
      {
        lastFetchedAt: ts.now(),
        source: SOURCE,
        lastError: null,
      },
      { merge: true }
    );
    return { ok: true, status: 'no_data' };
  }

  // BCB devolve a janela inteira; pegamos a entrada cuja data bate com o alvo,
  // ou a última disponível como fallback (defensivo).
  const targetIso = brToIso(targetBr);
  const entry = parsed.find((p) => p.date === targetIso) ?? parsed[parsed.length - 1];

  // Idempotência: se history/<date> já existe com source BCB-SGS-11, pula.
  const historyRef = selicRef.collection('history').doc(entry.date);
  const existing = await historyRef.get();
  if (existing.exists && existing.data()?.source === SOURCE) {
    console.info(`[fetchSelicDaily] already fetched for ${entry.date}`);
    await selicRef.set(
      {
        lastFetchedAt: ts.now(),
        lastError: null,
      },
      { merge: true }
    );
    return { ok: true, status: 'skipped_idempotent', date: entry.date, rateDaily: entry.rateDaily };
  }

  const batch = deps.db.batch();
  batch.set(historyRef, {
    date: entry.date,
    rateDaily: entry.rateDaily,
    source: SOURCE,
    fetchedAt: ts.now(),
  });
  batch.set(
    selicRef,
    {
      lastDate: entry.date,
      lastRate: entry.rateDaily,
      lastFetchedAt: ts.now(),
      source: SOURCE,
      lastError: null,
    },
    { merge: true }
  );
  await batch.commit();

  console.info(`[fetchSelicDaily] ok ${entry.date} rateDaily=${entry.rateDaily}`);
  return { ok: true, status: 'written', date: entry.date, rateDaily: entry.rateDaily };
}

const { onSchedule } = (() => {
  try {
    return require('firebase-functions/v2/scheduler');
  } catch (_e) {
    return { onSchedule: (_opts, fn) => fn };
  }
})();

const fetchSelicDaily = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    retryCount: 0,
  },
  async () => {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const ts = { now: () => admin.firestore.FieldValue.serverTimestamp() };
    return runFetchSelicDaily({ db, timestamp: ts });
  }
);

module.exports = fetchSelicDaily;
module.exports.runFetchSelicDaily = runFetchSelicDaily;
module.exports.parsePayload = parsePayload;
module.exports.formatBrDate = formatBrDate;
module.exports.brToIso = brToIso;
module.exports.previousBrDate = previousBrDate;
