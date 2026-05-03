#!/usr/bin/env node
/**
 * issue-237-backfill-vip.mjs — backfill one-time VIP/órfãos
 *
 * Para cada contact com `subscription.isVIP=true` OU `subscription.endsAt` null:
 *  1. Procura student existente por celular (whatsappNumber) ou name match.
 *  2. Se não encontrar, cria `students/{contactId}` (status='active', accessTier='none').
 *  3. Atualiza `contacts/{id}.studentUid` apontando pro student.
 *  4. Cria subscription VIP (type='vip', plan='self_service', status='active',
 *     startDate=now). Sem amount, sem vencimento, sem payment.
 *  5. Atualiza `student.accessTier = 'none'`.
 *
 * Idempotência: se student já tem alguma subscription, skip.
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-237-backfill-vip.mjs
 *
 * MODO EXECUTE:
 *   node scripts/issue-237-backfill-vip.mjs --execute --confirm=SIM
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

export const PROJECT_ID = 'acompanhamento-20';
export const PLAN = 'self_service';
export const NOTES = 'Backfill VIP onetime #237';

function normalizeNameKey(s) {
  if (!s) return '';
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function isOrphan(contact) {
  const sub = contact?.subscription;
  if (!sub) return false;
  if (sub.isVIP === true) return { orphan: true, reason: 'vip' };
  const endsAt = sub.endsAt?.toDate ? sub.endsAt.toDate() : sub.endsAt;
  if (!endsAt || (endsAt instanceof Date && isNaN(endsAt.getTime()))) {
    return { orphan: true, reason: 'no_endsAt' };
  }
  return { orphan: false };
}

function findExistingStudent(students, contact) {
  // 1) Match por celular (whatsappNumber)
  if (contact.celular) {
    const byPhone = students.find((s) => s.whatsappNumber === contact.celular);
    if (byPhone) return byPhone;
  }
  // 2) Match por nome normalizado
  const key = normalizeNameKey(contact.nome);
  if (key) {
    const byName = students.find((s) => normalizeNameKey(s.name) === key);
    if (byName) return byName;
  }
  return null;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-237-backfill-vip-${mode}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function parseArgs(argv) {
  const out = { execute: false, confirmed: false };
  for (const a of argv.slice(2)) {
    if (a === '--execute') out.execute = true;
    else if (a === '--confirm=SIM') out.confirmed = true;
  }
  return out;
}

function initAdmin() {
  const require = createRequire(import.meta.url);
  const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  return admin;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.execute && !opts.confirmed) {
    console.error('\n❌ --execute requer --confirm=SIM\n');
    process.exit(1);
  }
  const mode = opts.execute ? 'execute' : 'dryrun';
  console.log(`\n🔧 issue-237 — backfill VIP/órfãos [${mode.toUpperCase()}]\n`);

  const admin = initAdmin();
  const db = admin.firestore();

  // Carrega all contacts + all students upfront (matching client-side)
  const [contactsSnap, studentsSnap] = await Promise.all([
    db.collection('contacts').get(),
    db.collection('students').get(),
  ]);
  const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`   contacts: ${contacts.length} · students: ${students.length}\n`);

  const startedMs = Date.now();
  const results = [];

  for (const contact of contacts) {
    const cl = isOrphan(contact);
    if (!cl.orphan) {
      results.push({ id: contact.id, nome: contact.nome, action: 'skip', reason: 'not_orphan' });
      continue;
    }

    const existing = findExistingStudent(students, contact);
    let studentUid = existing?.id ?? contact.studentUid ?? contact.id;
    const studentRef = db.collection('students').doc(studentUid);
    const studentSnap = await studentRef.get();

    // Idempotência: tem subscription?
    const subSnap = await studentRef.collection('subscriptions').limit(1).get();
    if (!subSnap.empty) {
      results.push({
        id: contact.id, nome: contact.nome, action: 'skip',
        reason: 'already_has_subscription',
        studentUid, matchedBy: existing ? (existing.whatsappNumber === contact.celular ? 'phone' : 'name') : 'contactId',
      });
      continue;
    }

    if (mode === 'execute') {
      const now = admin.firestore.FieldValue.serverTimestamp();
      if (!studentSnap.exists) {
        await studentRef.set({
          uid: studentUid,
          contactId: contact.id,
          name: contact.nome,
          email: contact.email ?? null,
          whatsappNumber: contact.celular ?? null,
          status: 'active',
          accessTier: 'none',
          createdAt: now,
          firstLoginAt: null,
        });
      } else {
        await studentRef.update({ accessTier: 'none', updatedAt: now });
      }

      if (!contact.studentUid || contact.studentUid !== studentUid) {
        await db.collection('contacts').doc(contact.id).update({
          studentUid,
          updatedAt: now,
        });
      }

      await studentRef.collection('subscriptions').add({
        type: 'vip',
        plan: PLAN,
        status: 'active',
        startDate: now,
        notes: NOTES,
        createdAt: now,
        updatedAt: now,
      });
    }

    results.push({
      id: contact.id, nome: contact.nome,
      action: mode === 'execute' ? 'wrote' : 'plan',
      reason: cl.reason,
      studentUid,
      studentMatched: !!existing,
      matchedBy: existing ? (existing.whatsappNumber === contact.celular ? 'phone' : 'name') : null,
      studentCreated: !studentSnap.exists,
    });
    console.log(`  [${mode === 'execute' ? 'wrote' : 'plan'}] ${contact.nome} (${cl.reason}) · student=${studentUid} ${existing ? `← match ${existing.whatsappNumber === contact.celular ? 'phone' : 'name'}` : '(novo)'}`);
  }

  const summary = {
    mode,
    started_at: new Date(startedMs).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    by_action: results.reduce((acc, r) => ((acc[r.action] = (acc[r.action] || 0) + 1), acc), {}),
    by_reason: results.reduce((acc, r) => ((acc[r.reason] = (acc[r.reason] || 0) + 1), acc), {}),
    results,
  };

  console.log('\n── Resumo ──────────────────────────────────────');
  for (const [k, v] of Object.entries(summary.by_action)) {
    console.log(`   ${k.padEnd(8)}: ${v}`);
  }
  console.log(`   duration_ms: ${summary.duration_ms}\n`);

  const logPath = writeLog(mode, summary);
  console.log(`📝 Log: ${logPath}\n`);

  if (mode === 'dryrun') {
    console.log('🟡 DRY-RUN — nada gravado. Para executar:');
    console.log('     node scripts/issue-237-backfill-vip.mjs --execute --confirm=SIM\n');
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 erro:', err);
    process.exit(1);
  });
}
