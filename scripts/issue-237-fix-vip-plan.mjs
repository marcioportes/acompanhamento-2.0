#!/usr/bin/env node
/**
 * issue-237-fix-vip-plan.mjs — corrige plan dos VIPs existentes
 *
 * Backfill anterior (issue-237-backfill-vip.mjs) gravou subs VIP com
 * plan='self_service'. UI agora exibe/cria com plan='vip'. Este script
 * sincroniza os VIPs já no banco.
 *
 * Para cada subscription com type='vip' E plan!='vip', atualiza plan='vip'.
 * Idempotente.
 *
 * MODO DRY-RUN:
 *   node scripts/issue-237-fix-vip-plan.mjs
 *
 * MODO EXECUTE:
 *   node scripts/issue-237-fix-vip-plan.mjs --execute --confirm=SIM
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');
const PROJECT_ID = 'acompanhamento-20';

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-237-fix-vip-plan-${mode}-${ts()}.json`);
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
  console.log(`\n🔧 issue-237 — fix VIP plan [${mode.toUpperCase()}]\n`);

  const admin = initAdmin();
  const db = admin.firestore();

  const allSubs = await db.collectionGroup('subscriptions').get();
  const snap = { docs: allSubs.docs.filter((d) => d.data().type === 'vip'), size: 0 };
  snap.size = snap.docs.length;
  console.log(`   subscriptions totais: ${allSubs.size} · VIP: ${snap.size}\n`);

  const startedMs = Date.now();
  const results = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const path = docSnap.ref.path;
    if (data.plan === 'vip') {
      results.push({ path, action: 'skip', reason: 'already_vip' });
      continue;
    }
    if (mode === 'execute') {
      await docSnap.ref.update({
        plan: 'vip',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    results.push({ path, action: mode === 'execute' ? 'wrote' : 'plan', oldPlan: data.plan ?? null });
    console.log(`  [${mode === 'execute' ? 'wrote' : 'plan'}] ${path} (${data.plan ?? 'null'} → vip)`);
  }

  const summary = {
    mode,
    started_at: new Date(startedMs).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    by_action: results.reduce((acc, r) => ((acc[r.action] = (acc[r.action] || 0) + 1), acc), {}),
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
    console.log('     node scripts/issue-237-fix-vip-plan.mjs --execute --confirm=SIM\n');
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 erro:', err);
    process.exit(1);
  });
}
