#!/usr/bin/env node
/**
 * issue-269-migration-dryrun.mjs — dry-run standalone da migration #269 v2.
 *
 * READ-ONLY. Reusa `planForStudent` da callable migrateReviewStateBackfill (mesma lógica,
 * sem deploy, sem duplicar regra) para MEDIR o que a migration faria — em especial quantos
 * trades legados com feedback fora de review seriam ancorados no rascunho vigente do plano
 * (orphanAnchored) e quantos rascunhos novos seriam provisionados (reviewsCreated).
 *
 * NÃO escreve nada. Só lê e conta.
 *
 * USO:
 *   node scripts/issue-269-migration-dryrun.mjs                 # todos os alunos
 *   node scripts/issue-269-migration-dryrun.mjs <studentId>     # escopa a um aluno
 *
 * PRÉ-REQUISITOS:
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/migration-dryrun-<ISO8601>.json
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
const { planForStudent } = require(join(PROJECT_ROOT, 'functions', 'reviews', 'migrateReviewStateBackfill'));

const onlyStudentId = process.argv[2] || null;

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const todayISO = new Date().toISOString().slice(0, 10);

async function main() {
  console.log(`[migration-dryrun] iniciando (READ-ONLY)${onlyStudentId ? ` — aluno ${onlyStudentId}` : ' — todos os alunos'}`);

  const studentIds = onlyStudentId
    ? [onlyStudentId]
    : (await db.collection('students').get()).docs.map((d) => d.id);

  const perStudent = [];
  const allConflicts = [];
  let totalOps = 0;
  const totals = { tradeUpdates: 0, reviewSeqUpdates: 0, planPointerUpdates: 0, reviewsCreated: 0, orphanAnchored: 0 };

  for (const sid of studentIds) {
    const plan = await planForStudent(db, sid, todayISO);
    totalOps += plan.ops.length;
    totals.tradeUpdates += plan.tradeUpdates;
    totals.reviewSeqUpdates += plan.reviewSeqUpdates;
    totals.planPointerUpdates += plan.planPointerUpdates;
    totals.reviewsCreated += plan.reviewsCreated;
    totals.orphanAnchored += plan.orphanAnchored;
    if (plan.conflicts.length) allConflicts.push(...plan.conflicts.map((c) => ({ studentId: sid, ...c })));
    if (plan.ops.length) {
      perStudent.push({
        studentId: sid,
        ops: plan.ops.length,
        tradeUpdates: plan.tradeUpdates,
        reviewSeqUpdates: plan.reviewSeqUpdates,
        planPointerUpdates: plan.planPointerUpdates,
        reviewsCreated: plan.reviewsCreated,
        orphanAnchored: plan.orphanAnchored,
        conflicts: plan.conflicts.length,
      });
    }
  }

  console.log('\n[migration-dryrun] === RESUMO (nada foi escrito) ===');
  console.log(`  alunos analisados:       ${studentIds.length}`);
  console.log(`  totalPlannedChanges:     ${totalOps}`);
  console.log(`  ├─ trades atualizados:   ${totals.tradeUpdates}`);
  console.log(`  ├─ órfãos ancorados:     ${totals.orphanAnchored}  (feedback fora de review → rascunho vigente)`);
  console.log(`  ├─ rascunhos criados:    ${totals.reviewsCreated}`);
  console.log(`  ├─ sequenceNumbers:      ${totals.reviewSeqUpdates}`);
  console.log(`  └─ ponteiros de plano:   ${totals.planPointerUpdates}`);
  console.log(`  conflitos reportados:    ${allConflicts.length}`);
  console.log('\n[migration-dryrun] por aluno (só os com mudança):');
  for (const s of perStudent) {
    console.log(`  - ${s.studentId}: ops=${s.ops} trades=${s.tradeUpdates} órfãos=${s.orphanAnchored} drafts+=${s.reviewsCreated} seq=${s.reviewSeqUpdates} ptr=${s.planPointerUpdates} conf=${s.conflicts}`);
  }

  const log = {
    mode: 'dryrun', startedAt: todayISO, scope: onlyStudentId || 'all',
    studentsAnalyzed: studentIds.length, totalPlannedChanges: totalOps, totals,
    students: perStudent, conflicts: allConflicts, finishedAt: new Date().toISOString(),
  };
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = join(LOGS_DIR, `migration-dryrun-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\n[migration-dryrun] log salvo em ${logPath}`);
  console.log(`[migration-dryrun] >>> use totalPlannedChanges=${totalOps} como expectedChanges no apply <<<`);
}

main().catch((err) => {
  console.error('[migration-dryrun] erro fatal:', err);
  process.exit(1);
});
