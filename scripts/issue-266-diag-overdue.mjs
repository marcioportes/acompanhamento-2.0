#!/usr/bin/env node
/**
 * issue-266-diag-overdue.mjs — diagnóstico READONLY
 *
 * Objetivo: medir escopo do bug do email diário de Assinaturas antes do fix.
 *
 * Lista todas as subs com `status === 'overdue'` agrupadas por:
 *   1. RECOVERABLE — renewalDate >= today − graceDays (vão ser recuperadas
 *      automaticamente pelo CF após deploy do fix #266)
 *   2. LEGÍTIMAS — renewalDate ainda além do grace (continuam overdue)
 *   3. SEM_RENEWAL — renewalDate ausente (excepção)
 *
 * Também sinaliza:
 *   - student.loginBlocked === true + loginBlockedReason === 'auto' (auto-unlock
 *     será aplicado no recovery)
 *   - amount === 0 ou ausente (caso Gizele)
 *   - type === 'vip' marcado como overdue (anormal — VIPs não vencem)
 *
 * EXECUÇÃO (somente readonly, idempotente):
 *   gcloud auth application-default login   # uma vez
 *   node scripts/issue-266-diag-overdue.mjs
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');
const PROJECT_ID = 'acompanhamento-20';

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// Helpers (mirror de functions/subscriptions/helpers.js, BRT-aware).
const getBrazilToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return new Date(Date.UTC(+get('year'), +get('month') - 1, +get('day'), 3, 0, 0, 0));
};

const daysBetween = (from, to) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const brOffsetMs = 3 * 60 * 60 * 1000;
  const calendarDayMs = (d) => {
    const shifted = new Date(d.getTime() - brOffsetMs);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  };
  return Math.round((calendarDayMs(to) - calendarDayMs(from)) / msPerDay);
};

const formatBR = (d) => d ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';

async function main() {
  const today = getBrazilToday();
  console.log(`\n📊 issue-266 — diagnóstico overdue subs [${formatBR(today)}]\n`);

  const studentsSnap = await db.collection('students').get();
  console.log(`   students lidos: ${studentsSnap.size}\n`);

  const recoverable = [];
  const legit = [];
  const noRenewal = [];
  const anomalies = []; // amount=0, type=vip overdue, etc.

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    const studentName = student.name ?? student.email ?? studentDoc.id;

    const subsSnap = await studentDoc.ref.collection('subscriptions').get();
    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data();
      if (sub.status !== 'overdue') continue;

      const renewalDate = sub.renewalDate?.toDate?.() ?? null;
      const grace = sub.gracePeriodDays ?? 5;
      const daysToRenewal = renewalDate ? daysBetween(today, renewalDate) : null;
      const willRecover = renewalDate && daysToRenewal >= -grace;

      const entry = {
        studentId: studentDoc.id,
        studentName,
        subId: subDoc.id,
        type: sub.type,
        plan: sub.plan,
        amount: sub.amount,
        currency: sub.currency,
        renewalDate: renewalDate ? formatBR(renewalDate) : null,
        daysToRenewal,
        grace,
        loginBlocked: student.loginBlocked === true,
        loginBlockedReason: student.loginBlockedReason ?? null,
        willAutoUnlock: student.loginBlocked === true && student.loginBlockedReason === 'auto',
      };

      // Sinalizadores de anomalias.
      const flags = [];
      if (!sub.amount || sub.amount === 0) flags.push('amount_zero');
      if (sub.type === 'vip') flags.push('vip_overdue_inesperado');
      if (sub.type === 'trial') flags.push('trial_overdue_inesperado');
      if (flags.length) {
        entry.flags = flags;
        anomalies.push(entry);
      }

      if (!renewalDate) {
        noRenewal.push(entry);
      } else if (willRecover) {
        recoverable.push(entry);
      } else {
        legit.push(entry);
      }
    }
  }

  // ── Output ──
  console.log(`── RECUPERÁVEIS (renewalDate >= today − grace) ── ${recoverable.length}\n`);
  for (const r of recoverable) {
    const unlock = r.willAutoUnlock ? ' [+auto-unlock]' : '';
    console.log(`  ${r.studentName} (${r.studentId})`);
    console.log(`    sub: ${r.subId} · type=${r.type} · plan=${r.plan} · amount=${r.amount} ${r.currency}`);
    console.log(`    renewalDate=${r.renewalDate} (${r.daysToRenewal} dias) · grace=${r.grace}${unlock}`);
  }

  console.log(`\n── LEGÍTIMOS (renewalDate < today − grace) ── ${legit.length}\n`);
  for (const r of legit) {
    console.log(`  ${r.studentName} — renewalDate=${r.renewalDate} (${r.daysToRenewal} dias)`);
  }

  console.log(`\n── SEM RENEWAL_DATE ── ${noRenewal.length}\n`);
  for (const r of noRenewal) {
    console.log(`  ${r.studentName} (${r.subId}) — type=${r.type} plan=${r.plan}`);
  }

  console.log(`\n── ANOMALIAS (independente de categoria) ── ${anomalies.length}\n`);
  for (const r of anomalies) {
    console.log(`  ${r.studentName} — flags=[${r.flags.join(',')}] · type=${r.type} · amount=${r.amount}`);
  }

  // Persiste log.
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(LOGS_DIR, `issue-266-diag-${ts}.json`);
  writeFileSync(path, JSON.stringify({
    today: formatBR(today),
    counts: {
      recoverable: recoverable.length,
      legit: legit.length,
      noRenewal: noRenewal.length,
      anomalies: anomalies.length,
    },
    recoverable, legit, noRenewal, anomalies,
  }, null, 2));
  console.log(`\n📝 Log: ${path}\n`);
}

main().catch((err) => {
  console.error('\n💥 erro:', err);
  process.exit(1);
});
