#!/usr/bin/env node
/**
 * issue-235-bootstrap-selic-history.mjs — backfill diário Selic SGS-11
 *
 * CONTEXTO (issue #235, F0.2):
 *   Task 01 (commit e8286e08) entregou a CF `fetchSelicDaily`, que mantém
 *   `systemConfig/selic` atualizado a partir de hoje. Para alimentar o helper
 *   `getSelicForDate` (F0.3) e `computeCycleSharpe` (F1.1) com Sharpe per-ciclo
 *   desde o início do tracking (jan/2024), precisamos popular retroativamente
 *   `systemConfig/selic/history/<YYYY-MM-DD>` com o histórico oficial BCB SGS-11.
 *
 * ESTRATÉGIA:
 *   - Fetch BCB SGS-11 em janelas de até 365 dias entre `--from` e `--to`.
 *   - Parse defensivo + filtragem por idempotência (history/<date> com
 *     source=BCB-SGS-11 → pula).
 *   - Enfileira escrita em batches de 500 (limite Firestore).
 *   - Schema gravado idêntico ao da CF F0.1: {date, rateDaily, source,
 *     fetchedAt} no history; metadata em `systemConfig/selic` só avança se
 *     houve gravação E a maior data nova for superior à `lastDate` corrente
 *     (não regride janela atual).
 *
 * MODO DRY-RUN (default — sem credenciais necessárias se fetchFn for mock):
 *   node scripts/issue-235-bootstrap-selic-history.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-235-bootstrap-selic-history.mjs --execute --confirm=SIM
 *
 * Args opcionais:
 *   --from=YYYY-MM-DD   default 2024-01-01
 *   --to=YYYY-MM-DD     default D-1 BRT
 *
 * PRÉ-REQUISITOS (modo execute):
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/issue-235-{dryrun|execute}-<ISO8601>.json
 *
 * INV-15: namespace systemConfig/selic + history aprovado em
 *         #issuecomment-4364111738.
 * INV-10: schema 1:1 com `functions/marketData/fetchSelicDaily.js`.
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

export const PROJECT_ID = 'acompanhamento-20';
export const BATCH_SIZE = 500;
export const SOURCE = 'BCB-SGS-11';
export const BCB_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados';
export const DEFAULT_FROM = '2024-01-01';
export const RANGE_CHUNK_DAYS = 365;

// ── Pure helpers (exportadas para teste) ────────────────────

export function brToIso(brDate) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isoToBr(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatBrDate(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return fmt.format(date).replace(/-/g, '/');
}

export function previousBrDate(now) {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return formatBrDate(d);
}

export function defaultToIso(now) {
  return brToIso(previousBrDate(now));
}

/**
 * Parse defensivo do payload BCB SGS-11. Aceita campo extra; valida apenas
 * `data` (DD/MM/YYYY) e `valor` numérico. Retorna null no schema inválido.
 * Schema mantido 1:1 com `functions/marketData/fetchSelicDaily.parsePayload`.
 */
export function parsePayload(json) {
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
 * Quebra array em chunks de tamanho `size`. Último chunk pode ser menor.
 */
export function chunkBatch(arr, size) {
  if (!Array.isArray(arr)) throw new TypeError('chunkBatch: arr deve ser Array');
  if (!Number.isInteger(size) || size <= 0) throw new RangeError('chunkBatch: size deve ser inteiro positivo');
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Lista YYYY-MM-DD inclusiva de fromIso até toIso (UTC). [] se from > to.
 */
export function iterateDateRange(fromIso, toIso) {
  const fm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromIso);
  const tm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toIso);
  if (!fm || !tm) throw new RangeError('iterateDateRange: ISO date inválido');
  const start = Date.UTC(+fm[1], +fm[2] - 1, +fm[3]);
  const end = Date.UTC(+tm[1], +tm[2] - 1, +tm[3]);
  if (start > end) return [];
  const out = [];
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}

/**
 * Quebra um range [from, to] em janelas inclusivas de até `chunkDays` dias.
 */
export function chunkDateRange(fromIso, toIso, chunkDays = RANGE_CHUNK_DAYS) {
  const all = iterateDateRange(fromIso, toIso);
  if (all.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < all.length; i += chunkDays) {
    const slice = all.slice(i, i + chunkDays);
    chunks.push({ from: slice[0], to: slice[slice.length - 1] });
  }
  return chunks;
}

// ── Orchestration (testável via injeção de dependências) ────

/**
 * @param {Object} deps
 * @param {Object}   deps.db          — admin.firestore() ou stub
 * @param {Function} deps.fetchFn     — fetch (global ou mock)
 * @param {string}   [deps.from]      — YYYY-MM-DD (default DEFAULT_FROM)
 * @param {string}   [deps.to]        — YYYY-MM-DD (default D-1 BRT)
 * @param {'dryrun'|'execute'} [deps.mode]
 * @param {number}   [deps.batchSize] — default BATCH_SIZE
 * @param {Object}   [deps.timestamp] — { now: () => any }
 * @param {Function} [deps.now]       — () => Date
 * @param {Function} [deps.log]       — (line: string) => void
 * @returns {Promise<Object>} summary { mode, from, to, fetched_count, would_write|wrote, skipped, errors, started_at, finished_at, duration_ms }
 */
export async function runBootstrap(deps) {
  if (!deps?.db) throw new Error('deps.db obrigatório');
  if (!deps?.fetchFn) throw new Error('deps.fetchFn obrigatório');

  const mode = deps.mode === 'execute' ? 'execute' : 'dryrun';
  const now = deps.now ? deps.now() : new Date();
  const from = deps.from ?? DEFAULT_FROM;
  const to = deps.to ?? defaultToIso(now);
  const batchSize = deps.batchSize ?? BATCH_SIZE;
  const ts = deps.timestamp ?? { now: () => new Date() };
  const log = deps.log ?? (() => {});

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  log(`[bootstrap] mode=${mode} from=${from} to=${to} batchSize=${batchSize}`);

  const ranges = chunkDateRange(from, to);
  const errors = [];
  const fetched = [];

  for (const r of ranges) {
    const url = `${BCB_URL}?formato=json&dataInicial=${encodeURIComponent(isoToBr(r.from))}&dataFinal=${encodeURIComponent(isoToBr(r.to))}`;
    try {
      const res = await deps.fetchFn(url);
      if (!res.ok) {
        errors.push({
          phase: 'fetch',
          range: r,
          code: `http_${res.status}`,
          message: `HTTP ${res.status}`,
        });
        continue;
      }
      const json = await res.json();
      const parsed = parsePayload(json);
      if (parsed == null) {
        errors.push({
          phase: 'parse',
          range: r,
          code: 'bad_schema',
          message: 'payload com schema inválido',
        });
        continue;
      }
      fetched.push(...parsed);
      log(`[bootstrap] ${r.from}..${r.to}: ${parsed.length} item(s)`);
    } catch (err) {
      errors.push({
        phase: 'fetch',
        range: r,
        code: err.code || 'fetch_error',
        message: err.message || String(err),
      });
    }
  }

  // Idempotência: filtrar dias já presentes em history com source=BCB-SGS-11.
  const selicRef = deps.db.collection('systemConfig').doc('selic');
  const historyCol = selicRef.collection('history');
  const toWrite = [];
  let skipped = 0;
  for (const item of fetched) {
    const existing = await historyCol.doc(item.date).get();
    if (existing.exists && existing.data()?.source === SOURCE) {
      skipped += 1;
      continue;
    }
    toWrite.push(item);
  }

  const wouldWrite = toWrite.length;
  let wrote = 0;
  const writtenDates = [];

  if (mode === 'execute' && toWrite.length > 0) {
    const batches = chunkBatch(toWrite, batchSize);
    for (let bi = 0; bi < batches.length; bi++) {
      const slice = batches[bi];
      const batch = deps.db.batch();
      for (const item of slice) {
        batch.set(historyCol.doc(item.date), {
          date: item.date,
          rateDaily: item.rateDaily,
          source: SOURCE,
          fetchedAt: ts.now(),
        });
      }
      try {
        await batch.commit();
        wrote += slice.length;
        for (const item of slice) writtenDates.push(item.date);
        log(`[bootstrap] batch ${bi + 1}/${batches.length}: ${slice.length} docs gravados (total ${wrote})`);
      } catch (err) {
        errors.push({
          phase: 'commit',
          batch: bi + 1,
          size: slice.length,
          code: err.code || 'batch_error',
          message: err.message || String(err),
        });
      }
    }

    if (writtenDates.length > 0) {
      const maxNewDate = writtenDates.slice().sort().slice(-1)[0];
      const winningItem = toWrite.find((i) => i.date === maxNewDate);
      const cur = await selicRef.get();
      const curData = cur.exists ? cur.data() : null;
      if (!curData || !curData.lastDate || maxNewDate > curData.lastDate) {
        await selicRef.set(
          {
            lastDate: maxNewDate,
            lastRate: winningItem.rateDaily,
            lastFetchedAt: ts.now(),
            source: SOURCE,
            lastError: null,
          },
          { merge: true }
        );
        log(`[bootstrap] systemConfig/selic atualizado: lastDate=${maxNewDate} lastRate=${winningItem.rateDaily}`);
      } else {
        log(`[bootstrap] systemConfig/selic preservado (lastDate=${curData.lastDate} >= ${maxNewDate})`);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    mode,
    from,
    to,
    fetched_count: fetched.length,
    skipped,
    errors,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: Date.now() - startedMs,
  };
  if (mode === 'execute') {
    summary.wrote = wrote;
  } else {
    summary.would_write = wouldWrite;
  }
  return summary;
}

// ── Runner (CLI) ────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-235-${mode}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { execute: false, confirmed: false, from: null, to: null };
  for (const a of args) {
    if (a === '--execute') out.execute = true;
    else if (a === '--confirm=SIM') out.confirmed = true;
    else if (a.startsWith('--from=')) out.from = a.slice('--from='.length);
    else if (a.startsWith('--to=')) out.to = a.slice('--to='.length);
  }
  return out;
}

function initAdmin() {
  const require = createRequire(import.meta.url);
  const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin;
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.execute && !opts.confirmed) {
    console.error('\n❌ --execute requer --confirm=SIM (dupla confirmação obrigatória).\n');
    process.exit(1);
  }

  const mode = opts.execute ? 'execute' : 'dryrun';
  const now = new Date();
  const from = opts.from ?? DEFAULT_FROM;
  const to = opts.to ?? defaultToIso(now);

  console.log(`\n🔧 issue-235 — bootstrap Selic history [${mode.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Janela: ${from} → ${to}`);
  console.log(`   Fonte:  ${BCB_URL}\n`);

  const admin = initAdmin();
  const db = admin.firestore();
  const timestamp = { now: () => admin.firestore.FieldValue.serverTimestamp() };

  const summary = await runBootstrap({
    db,
    fetchFn: globalThis.fetch,
    from,
    to,
    mode,
    batchSize: BATCH_SIZE,
    timestamp,
    now: () => now,
    log: (line) => console.log(`   ${line}`),
  });

  console.log('\n── Resumo ──────────────────────────────────────');
  console.log(`   modo:           ${summary.mode}`);
  console.log(`   janela:         ${summary.from} → ${summary.to}`);
  console.log(`   fetched_count:  ${summary.fetched_count}`);
  console.log(`   skipped:        ${summary.skipped}`);
  if (summary.mode === 'execute') {
    console.log(`   wrote:          ${summary.wrote}`);
  } else {
    console.log(`   would_write:    ${summary.would_write}`);
  }
  console.log(`   errors:         ${summary.errors.length}`);
  console.log(`   duration_ms:    ${summary.duration_ms}\n`);

  if (summary.errors.length > 0) {
    console.log('   Erros (primeiros 5):');
    for (const e of summary.errors.slice(0, 5)) {
      console.log(`     [${e.phase}] ${e.code}: ${e.message}`);
    }
    console.log();
  }

  const logPath = writeLog(mode, summary);
  console.log(`📝 Log: ${logPath}\n`);

  if (mode === 'dryrun') {
    console.log('🟡 DRY-RUN — nada gravado. Para executar:');
    console.log('     node scripts/issue-235-bootstrap-selic-history.mjs --execute --confirm=SIM\n');
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 erro:', err);
    process.exit(1);
  });
}
