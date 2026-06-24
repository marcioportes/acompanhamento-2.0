#!/usr/bin/env node
/**
 * issue-269-migration-apply.mjs — APPLY da migration #269 v2 (ESCREVE em prod).
 *
 * Reusa planForStudent + commitOps da callable migrateReviewStateBackfill (mesma lógica,
 * mesma safeguard D8). Honra `expectedChanges`: recomputa o plano e só escreve se o total
 * bater com o número visto no dry-run (prova que nada derivou no meio).
 *
 * USO:
 *   node scripts/issue-269-migration-apply.mjs <expectedChanges> --confirm=SIM
 *   node scripts/issue-269-migration-apply.mjs <expectedChanges> --confirm=SIM <studentId>
 *
 * Sem --confirm=SIM → aborta (não escreve).
 *
 * PRÉ-REQUISITOS: gcloud auth application-default login
 * LOG: scripts/logs/migration-apply-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
const { planForStudent, commitOps } = require(join(PROJECT_ROOT, 'functions', 'reviews', 'migrateReviewStateBackfill'));

const args = process.argv.slice(2);
const expectedChanges = Number(args.find((a) => /^\d+$/.test(a)));
const CONFIRMED = args.includes('--confirm=SIM');
const onlyStudentId = args.find((a) => !/^\d+$/.test(a) && !a.startsWith('--')) || null;

if (!Number.isInteger(expectedChanges)) {
  console.error('ERRO: informe <expectedChanges> (número visto no dry-run). Ex.: ... apply.mjs 582 --confirm=SIM');
  process.exit(1);
}
if (!CONFIRMED) {
  console.error('ERRO: apply ESCREVE em prod — exige --confirm=SIM');
  process.exit(1);
}

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const todayISO = new Date().toISOString().slice(0, 10);

async function main() {
  console.log(`[migration-apply] recomputando plano (safeguard D8, expectedChanges=${expectedChanges})...`);

  const studentIds = onlyStudentId
    ? [onlyStudentId]
    : (await db.collection('students').get()).docs.map((d) => d.id);

  const allOps = [];
  const totals = { tradeUpdates: 0, reviewSeqUpdates: 0, planPointerUpdates: 0, reviewsCreated: 0, orphanAnchored: 0, conflicts: 0 };
  for (const sid of studentIds) {
    const plan = await planForStudent(db, sid, todayISO);
    allOps.push(...plan.ops);
    totals.tradeUpdates += plan.tradeUpdates;
    totals.reviewSeqUpdates += plan.reviewSeqUpdates;
    totals.planPointerUpdates += plan.planPointerUpdates;
    totals.reviewsCreated += plan.reviewsCreated;
    totals.orphanAnchored += plan.orphanAnchored;
    totals.conflicts += plan.conflicts.length;
  }

  const totalPlannedChanges = allOps.length;
  console.log(`[migration-apply] totalPlannedChanges recomputado = ${totalPlannedChanges}`);

  // ── Safeguard D8 ──
  if (totalPlannedChanges !== expectedChanges) {
    console.error(`ABORTADO: o recomputo deu ${totalPlannedChanges}, mas expectedChanges=${expectedChanges}. `
      + 'O banco derivou desde o dry-run — rode o dry-run de novo e confirme a contagem.');
    process.exit(2);
  }

  console.log(`[migration-apply] contagem confere — ESCREVENDO ${totalPlannedChanges} mudanças...`);
  await commitOps(db, allOps);
  console.log(`[migration-apply] APPLY concluído: ${totalPlannedChanges} mudanças aplicadas.`);
  console.log(`  trades=${totals.tradeUpdates} órfãos=${totals.orphanAnchored} drafts+=${totals.reviewsCreated} seq=${totals.reviewSeqUpdates} ptr=${totals.planPointerUpdates} conf=${totals.conflicts}`);

  const log = {
    mode: 'apply', startedAt: todayISO, scope: onlyStudentId || 'all',
    expectedChanges, totalPlannedChanges, applied: true, totals,
    studentsAnalyzed: studentIds.length, finishedAt: new Date().toISOString(),
  };
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = join(LOGS_DIR, `migration-apply-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`[migration-apply] log salvo em ${logPath}`);
}

main().catch((err) => {
  console.error('[migration-apply] erro fatal:', err);
  process.exit(1);
});
