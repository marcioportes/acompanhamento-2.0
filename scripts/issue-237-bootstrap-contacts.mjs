#!/usr/bin/env node
/**
 * issue-237-bootstrap-contacts.mjs — bootstrap one-time da collection `contacts/`
 *
 * CONTEXTO (issue #237 F2):
 *   Carrega a planilha Excel `Mentoria_Ativa_2404.xlsx` (3 colunas:
 *   numeros, nomes, Vencimento) na collection canônica `contacts/`.
 *   Padrão dry-run + execute; idempotente via triplo match
 *   (nome OR celular OR email).
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-237-bootstrap-contacts.mjs --file=/mnt/c/000-Marcio/CSV/Mentoria_Ativa_2404.xlsx
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-237-bootstrap-contacts.mjs --file=... --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS (modo execute):
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/issue-237-{dryrun|execute}-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeContactInput,
  normalizeName,
  normalizeEmail,
} from '../src/utils/contactsNormalizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

export const PROJECT_ID = 'acompanhamento-20';
export const BATCH_SIZE = 500;
export const SOURCE = 'planilha-bootstrap';

// ── Pure helpers ─────────────────────────────────────────────

const US_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
const VIP_RE = /^vip$/i;
const CANCELADO_RE = /^cancelado$/i;

/**
 * Parse `MM/DD/YY` (US format, ano 20YY). Retorna `Date` ou `null` se inválido.
 */
export function parseUSDate(raw) {
  if (typeof raw !== 'string') return null;
  const m = US_DATE_RE.exec(raw.trim());
  if (!m) return null;
  const month = +m[1];
  const day = +m[2];
  const year = 2000 + +m[3];
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

/**
 * Parse coluna `Vencimento`. Retorna decisão de import.
 *
 * @param {unknown} raw
 * @returns {{
 *   action: 'import' | 'skip',
 *   reason?: string,
 *   status?: 'alpha',
 *   subscription?: { type:'alpha', endsAt:Date|null, isVIP:boolean }
 * }}
 */
export function parseVencimento(raw) {
  if (raw == null || raw === '') {
    return {
      action: 'import',
      status: 'alpha',
      subscription: { type: 'alpha', endsAt: null, isVIP: false },
    };
  }
  const s = String(raw).trim();
  if (s === '') {
    return {
      action: 'import',
      status: 'alpha',
      subscription: { type: 'alpha', endsAt: null, isVIP: false },
    };
  }
  if (CANCELADO_RE.test(s)) {
    return { action: 'skip', reason: 'cancelado' };
  }
  if (VIP_RE.test(s)) {
    return {
      action: 'import',
      status: 'alpha',
      subscription: { type: 'alpha', endsAt: null, isVIP: true },
    };
  }
  const date = parseUSDate(s);
  if (date) {
    return {
      action: 'import',
      status: 'alpha',
      subscription: { type: 'alpha', endsAt: date, isVIP: false },
    };
  }
  return { action: 'skip', reason: 'parse_fail', raw: s };
}

/**
 * Aplica normalizers + parseVencimento numa linha bruta da planilha.
 * Sem I/O. Retorna decisão completa pronta pra `processRows`.
 *
 * @param {{numeros:unknown, nomes:unknown, Vencimento:unknown}} row
 * @returns {{
 *   action: 'import' | 'skip',
 *   reason?: string,
 *   payload?: object,
 *   sourceMeta?: object,
 *   raw: object
 * }}
 */
export function parsePlanilhaRow(row) {
  const raw = {
    numeros: row?.numeros ?? null,
    nomes: row?.nomes ?? null,
    Vencimento: row?.Vencimento ?? null,
  };

  const normalized = normalizeContactInput({ nome: raw.nomes, celular: raw.numeros });

  if (!normalized.nome) {
    return { action: 'skip', reason: 'nome_vazio', raw };
  }
  if (!normalized.celular) {
    return { action: 'skip', reason: 'celular_vazio', raw };
  }

  const venc = parseVencimento(raw.Vencimento);
  if (venc.action === 'skip') {
    return { action: 'skip', reason: venc.reason, raw };
  }

  const payload = {
    nome: normalized.nome,
    nameNormalized: normalized.nameNormalized,
    celular: normalized.celular,
    countryCode: normalized.countryCode,
    email: null,
    cpf: null,
    status: venc.status,
    subscription: {
      type: venc.subscription.type,
      since: null,
      endsAt: venc.subscription.endsAt,
      isVIP: venc.subscription.isVIP,
      notes: null,
    },
    studentUid: null,
    source: SOURCE,
  };

  return {
    action: 'import',
    payload,
    sourceMeta: {
      rawNumeros: String(raw.numeros ?? ''),
      rawVencimento: raw.Vencimento == null ? null : String(raw.Vencimento),
    },
    raw,
  };
}

/**
 * Processa um batch de linhas brutas. Retorna decisões agregadas.
 * Pure: zero I/O.
 *
 * @param {Array} rows
 * @returns {{
 *   toImport: Array<{payload, sourceMeta, raw}>,
 *   skipped: Array<{reason, raw}>,
 * }}
 */
export function processRows(rows) {
  const toImport = [];
  const skipped = [];
  for (const row of rows ?? []) {
    const r = parsePlanilhaRow(row);
    if (r.action === 'import') {
      toImport.push({ payload: r.payload, sourceMeta: r.sourceMeta, raw: r.raw });
    } else {
      skipped.push({ reason: r.reason, raw: r.raw });
    }
  }
  return { toImport, skipped };
}

/**
 * Quebra array em chunks de tamanho `size`.
 */
export function chunkBatch(arr, size) {
  if (!Array.isArray(arr)) throw new TypeError('chunkBatch: arr deve ser Array');
  if (!Number.isInteger(size) || size <= 0) throw new RangeError('chunkBatch: size > 0');
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ── Idempotência (triplo match) ──────────────────────────────

/**
 * Procura colisão (nome/celular/email) na collection `contacts/`.
 * Retorna o primeiro doc match ou null.
 *
 * @param {Object} db — admin.firestore() ou stub
 * @param {{nameNormalized, celular, email}} normalized
 * @returns {Promise<{id, data}|null>}
 */
export async function findDuplicate(db, normalized) {
  const col = db.collection('contacts');
  const queries = [];
  if (normalized.nameNormalized) {
    queries.push(col.where('nameNormalized', '==', normalized.nameNormalized).limit(1).get());
  }
  if (normalized.celular) {
    queries.push(col.where('celular', '==', normalized.celular).limit(1).get());
  }
  if (normalized.email) {
    queries.push(col.where('email', '==', normalized.email).limit(1).get());
  }
  if (queries.length === 0) return null;
  const snaps = await Promise.all(queries);
  for (const snap of snaps) {
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, data: doc.data() };
    }
  }
  return null;
}

// ── Orchestration ────────────────────────────────────────────

/**
 * @param {Object} deps
 * @param {Object}   deps.db           — admin.firestore() ou stub
 * @param {Function} deps.readSheet    — (filePath) => Array<row>
 * @param {string}   deps.filePath
 * @param {'dryrun'|'execute'} [deps.mode]
 * @param {Object}   [deps.timestamp]  — { now: () => any }
 * @param {Function} [deps.now]        — () => Date
 * @param {Function} [deps.log]
 * @returns {Promise<Object>} summary
 */
export async function runBootstrap(deps) {
  if (!deps?.db) throw new Error('deps.db obrigatório');
  if (!deps?.readSheet) throw new Error('deps.readSheet obrigatório');
  if (!deps?.filePath) throw new Error('deps.filePath obrigatório');

  const mode = deps.mode === 'execute' ? 'execute' : 'dryrun';
  const ts = deps.timestamp ?? { now: () => new Date() };
  const log = deps.log ?? (() => {});
  const now = deps.now ? deps.now() : new Date();

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  log(`[bootstrap] mode=${mode} file=${deps.filePath}`);

  const rows = deps.readSheet(deps.filePath);
  log(`[bootstrap] rows lidas: ${rows.length}`);

  const { toImport, skipped } = processRows(rows);
  log(`[bootstrap] parsed: ${toImport.length} import / ${skipped.length} skip`);

  // Triplo match — separar duplicates de novos
  const toWrite = [];
  const duplicates = [];
  for (const item of toImport) {
    const existing = await findDuplicate(db_(deps.db), {
      nameNormalized: item.payload.nameNormalized,
      celular: item.payload.celular,
      email: item.payload.email,
    });
    if (existing) {
      duplicates.push({ raw: item.raw, existingId: existing.id, reason: 'triple_match' });
    } else {
      toWrite.push(item);
    }
  }
  log(`[bootstrap] duplicates: ${duplicates.length}; new: ${toWrite.length}`);

  let wrote = 0;
  if (mode === 'execute' && toWrite.length > 0) {
    const sheetFile = deps.filePath.split('/').pop() ?? deps.filePath;
    const batches = chunkBatch(toWrite, BATCH_SIZE);
    for (let bi = 0; bi < batches.length; bi++) {
      const slice = batches[bi];
      const batch = deps.db.batch();
      for (const item of slice) {
        const doc = deps.db.collection('contacts').doc();
        batch.set(doc, {
          ...item.payload,
          subscription: {
            ...item.payload.subscription,
            endsAt: item.payload.subscription.endsAt
              ? deps.timestampFromDate
                ? deps.timestampFromDate(item.payload.subscription.endsAt)
                : item.payload.subscription.endsAt
              : null,
          },
          sourceMeta: {
            sheetFile,
            rawNumeros: item.sourceMeta.rawNumeros,
            rawVencimento: item.sourceMeta.rawVencimento,
            importedAt: ts.now(),
          },
          createdAt: ts.now(),
          createdBy: { uid: 'bootstrap', email: 'bootstrap@espelho' },
          updatedAt: ts.now(),
          updatedBy: { uid: 'bootstrap', email: 'bootstrap@espelho' },
        });
      }
      await batch.commit();
      wrote += slice.length;
      log(`[bootstrap] batch ${bi + 1}/${batches.length}: ${slice.length} docs (total ${wrote})`);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    mode,
    filePath: deps.filePath,
    rows_count: rows.length,
    parsed_import: toImport.length,
    parsed_skip: skipped.length,
    duplicates_count: duplicates.length,
    new_count: toWrite.length,
    wrote: mode === 'execute' ? wrote : 0,
    skipped_detail: skipped.map((s) => ({
      reason: s.reason,
      nome: s.raw?.nomes ?? null,
      numeros: s.raw?.numeros ?? null,
      vencimento: s.raw?.Vencimento ?? null,
    })),
    duplicates_detail: duplicates.map((d) => ({
      reason: d.reason,
      existingId: d.existingId,
      nome: d.raw?.nomes ?? null,
      numeros: d.raw?.numeros ?? null,
    })),
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: Date.now() - startedMs,
  };
  return summary;
}

// helper de identidade — torna `findDuplicate` testável sem mocks de prototype
function db_(x) {
  return x;
}

// ── Runner (CLI) ────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-237-${mode}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { execute: false, confirmed: false, file: null };
  for (const a of args) {
    if (a === '--execute') out.execute = true;
    else if (a === '--confirm=SIM') out.confirmed = true;
    else if (a.startsWith('--file=')) out.file = a.slice('--file='.length);
  }
  return out;
}

function readSheetXlsx(filePath) {
  const require = createRequire(import.meta.url);
  const xlsx = require(join(PROJECT_ROOT, 'node_modules', 'xlsx'));
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { defval: null, raw: false });
}

function initAdmin() {
  const require = createRequire(import.meta.url);
  const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  return admin;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.file) {
    console.error('\n❌ --file=/path/to/.xlsx é obrigatório.\n');
    process.exit(1);
  }
  if (opts.execute && !opts.confirmed) {
    console.error('\n❌ --execute requer --confirm=SIM (dupla confirmação).\n');
    process.exit(1);
  }

  const mode = opts.execute ? 'execute' : 'dryrun';
  console.log(`\n🔧 issue-237 — bootstrap contacts [${mode.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Arquivo: ${opts.file}\n`);

  const admin = initAdmin();
  const db = admin.firestore();
  const timestamp = { now: () => admin.firestore.FieldValue.serverTimestamp() };

  const summary = await runBootstrap({
    db,
    readSheet: readSheetXlsx,
    filePath: opts.file,
    mode,
    timestamp,
    timestampFromDate: (d) => admin.firestore.Timestamp.fromDate(d),
    log: (line) => console.log(`   ${line}`),
  });

  console.log('\n── Resumo ──────────────────────────────────────');
  console.log(`   modo:              ${summary.mode}`);
  console.log(`   linhas lidas:      ${summary.rows_count}`);
  console.log(`   parse import:      ${summary.parsed_import}`);
  console.log(`   parse skip:        ${summary.parsed_skip}`);
  console.log(`   duplicates:        ${summary.duplicates_count}`);
  console.log(`   new:               ${summary.new_count}`);
  console.log(`   wrote:             ${summary.wrote}`);
  console.log(`   duration_ms:       ${summary.duration_ms}\n`);

  if (summary.skipped_detail.length) {
    console.log('   Skips:');
    for (const s of summary.skipped_detail.slice(0, 10)) {
      console.log(`     [${s.reason}] ${s.nome ?? '?'} (${s.numeros ?? '?'}) venc=${s.vencimento ?? 'null'}`);
    }
    if (summary.skipped_detail.length > 10) {
      console.log(`     … +${summary.skipped_detail.length - 10}`);
    }
    console.log();
  }

  const logPath = writeLog(mode, summary);
  console.log(`📝 Log: ${logPath}\n`);

  if (mode === 'dryrun') {
    console.log('🟡 DRY-RUN — nada gravado. Para executar:');
    console.log(`     node scripts/issue-237-bootstrap-contacts.mjs --file=${opts.file} --execute --confirm=SIM\n`);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 erro:', err);
    process.exit(1);
  });
}
