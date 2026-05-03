#!/usr/bin/env node
/**
 * issue-237-backfill-subscriptions.mjs — backfill one-time
 *
 * Para cada contact NÃO-VIP com `subscription.endsAt` setado:
 *  1. Cria `students/{contactId}` se ainda não existe (status='active',
 *     accessTier='self_service'); atualiza `contacts/{id}.studentUid`.
 *  2. Cria `students/{contactId}/subscriptions/{auto}` paid/self_service:
 *       startDate = endsAt − 3 meses
 *       endDate = renewalDate = endsAt (literal, preserva planilha)
 *       lastPaymentDate = startDate
 *       amount = 1200, billingPeriodMonths = 3
 *  3. Cria initial payment em `subscriptions/{subId}/payments/{auto}`.
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-237-backfill-subscriptions.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-237-backfill-subscriptions.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS (modo execute):
 *   gcloud auth application-default login
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

export const PROJECT_ID = 'acompanhamento-20';
export const AMOUNT = 1200;
export const CURRENCY = 'BRL';
export const PLAN = 'self_service';
export const BILLING_MONTHS = 3;
export const GRACE_DAYS = 5;
export const NOTES = 'Backfill onetime #237';

// Subtrai N meses respeitando UTC (evita shift de fuso BRT).
export function minusMonthsUTC(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export function classifyContact(contact) {
  if (contact?.subscription?.isVIP === true) return { skip: true, reason: 'vip' };
  const endsAt = contact?.subscription?.endsAt;
  if (!endsAt) return { skip: true, reason: 'no_endsAt' };
  const date = endsAt instanceof Date ? endsAt : endsAt?.toDate?.();
  if (!(date instanceof Date) || isNaN(date.getTime())) return { skip: true, reason: 'bad_endsAt' };
  return { skip: false, endsAt: date };
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-237-backfill-${mode}-${ts()}.json`);
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

async function processContact({ db, admin, contact, mode, log }) {
  const cl = classifyContact(contact);
  if (cl.skip) {
    return { id: contact.id, nome: contact.nome, action: 'skip', reason: cl.reason };
  }
  const endsAt = cl.endsAt;
  const startDate = minusMonthsUTC(endsAt, BILLING_MONTHS);

  // Idempotência: já tem student + alguma subscription?
  let studentUid = contact.studentUid ?? null;
  let createdStudent = false;
  if (!studentUid) {
    studentUid = contact.id;
  }
  const studentRef = db.collection('students').doc(studentUid);
  const studentSnap = await studentRef.get();

  if (studentSnap.exists) {
    const subsSnap = await studentRef.collection('subscriptions').limit(1).get();
    if (!subsSnap.empty) {
      return { id: contact.id, nome: contact.nome, action: 'skip', reason: 'already_has_subscription', studentUid };
    }
  } else {
    createdStudent = true;
  }

  if (mode === 'execute') {
    if (!studentSnap.exists) {
      await studentRef.set({
        uid: studentUid,
        contactId: contact.id,
        name: contact.nome,
        email: contact.email ?? null,
        whatsappNumber: contact.celular ?? null,
        status: 'active',
        accessTier: PLAN,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        firstLoginAt: null,
      });
    } else {
      await studentRef.update({
        accessTier: PLAN,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (!contact.studentUid) {
      await db.collection('contacts').doc(contact.id).update({
        studentUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const subRef = await studentRef.collection('subscriptions').add({
      type: 'paid',
      plan: PLAN,
      status: 'active',
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endsAt),
      renewalDate: admin.firestore.Timestamp.fromDate(endsAt),
      lastPaymentDate: admin.firestore.Timestamp.fromDate(startDate),
      amount: AMOUNT,
      currency: CURRENCY,
      gracePeriodDays: GRACE_DAYS,
      billingPeriodMonths: BILLING_MONTHS,
      notes: NOTES,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await subRef.collection('payments').add({
      date: admin.firestore.Timestamp.fromDate(startDate),
      amount: AMOUNT,
      currency: CURRENCY,
      method: 'other',
      reference: NOTES,
      receiptUrl: '',
      plan: PLAN,
      periodStart: admin.firestore.Timestamp.fromDate(startDate),
      periodEnd: admin.firestore.Timestamp.fromDate(endsAt),
      registeredBy: 'backfill',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  log(`  [${mode === 'execute' ? 'wrote' : 'plan'}] ${contact.nome} · start=${startDate.toISOString().slice(0, 10)} · venc=${endsAt.toISOString().slice(0, 10)}`);
  return {
    id: contact.id,
    nome: contact.nome,
    action: mode === 'execute' ? 'wrote' : 'plan',
    studentUid,
    studentCreated: createdStudent,
    startDate: startDate.toISOString().slice(0, 10),
    endsAt: endsAt.toISOString().slice(0, 10),
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.execute && !opts.confirmed) {
    console.error('\n❌ --execute requer --confirm=SIM\n');
    process.exit(1);
  }
  const mode = opts.execute ? 'execute' : 'dryrun';
  console.log(`\n🔧 issue-237 — backfill subscriptions [${mode.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Plano default: ${PLAN}, Amount: ${AMOUNT} ${CURRENCY}, Periodicidade: ${BILLING_MONTHS}m\n`);

  const admin = initAdmin();
  const db = admin.firestore();

  const snap = await db.collection('contacts').get();
  console.log(`   contacts lidos: ${snap.size}\n`);

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const results = [];
  for (const doc of snap.docs) {
    const contact = { id: doc.id, ...doc.data() };
    if (contact.subscription?.endsAt?.toDate) {
      contact.subscription.endsAt = contact.subscription.endsAt.toDate();
    }
    try {
      const r = await processContact({ db, admin, contact, mode, log: (l) => console.log(l) });
      results.push(r);
    } catch (err) {
      console.error(`   [error] ${contact.nome}:`, err.message);
      results.push({ id: contact.id, nome: contact.nome, action: 'error', message: err.message });
    }
  }

  const summary = {
    mode,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    total_contacts: snap.size,
    by_action: results.reduce((acc, r) => ((acc[r.action] = (acc[r.action] || 0) + 1), acc), {}),
    by_skip_reason: results
      .filter((r) => r.action === 'skip')
      .reduce((acc, r) => ((acc[r.reason] = (acc[r.reason] || 0) + 1), acc), {}),
    results,
  };

  console.log('\n── Resumo ──────────────────────────────────────');
  for (const [k, v] of Object.entries(summary.by_action)) {
    console.log(`   ${k.padEnd(8)}: ${v}`);
  }
  if (Object.keys(summary.by_skip_reason).length) {
    console.log('\n   Motivos de skip:');
    for (const [k, v] of Object.entries(summary.by_skip_reason)) {
      console.log(`     ${k}: ${v}`);
    }
  }
  console.log(`   duration_ms: ${summary.duration_ms}\n`);

  const logPath = writeLog(mode, summary);
  console.log(`📝 Log: ${logPath}\n`);

  if (mode === 'dryrun') {
    console.log('🟡 DRY-RUN — nada gravado. Para executar:');
    console.log('     node scripts/issue-237-backfill-subscriptions.mjs --execute --confirm=SIM\n');
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 erro:', err);
    process.exit(1);
  });
}
