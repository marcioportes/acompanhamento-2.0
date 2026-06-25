#!/usr/bin/env node
/**
 * issue-269-cleanup-orphan-reviews.mjs — purga de revisões órfãs (#269 v2)
 *
 * CONTEXTO:
 *   No modelo v2 a revisão semanal (`students/{studentId}/reviews/{id}`) nasce sob
 *   demanda no 1º feedback do mentor e guarda o `planId` do plano que originou a pauta.
 *   Testes e exclusões de plano deixaram revisões cujo `planId` aponta pra um plano que
 *   não existe mais (ou sem `planId`) — sujeira que não tem como ser apagada pela UI
 *   (o `deleteReviewDraft` foi removido por decisão de 19/06).
 *
 * CRITÉRIO DE ÓRFÃ:
 *   review.planId ausente/null  OR  review.planId NOT IN alivePlanIds
 *
 * EFEITO:
 *   1. apaga o doc da review órfã (subcollection reviews)
 *   2. reconcilia trades cujo reviewId aponta pra review apagada → reviewId = null
 *      (evita FK pendurada; o trade volta ao backlog)
 *
 *   NÃO toca plan.activeDraftReviewId: só apagamos reviews de planos MORTOS, e ponteiro
 *   de plano vivo nunca aponta pra review órfã (a review de plano vivo não é órfã).
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-269-cleanup-orphan-reviews.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-269-cleanup-orphan-reviews.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS:
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/cleanup-orphan-reviews-{dryrun|execute}-<ISO8601>.json
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

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const CONFIRMED = args.includes('--confirm=SIM');
const MODE = EXECUTE ? (CONFIRMED ? 'execute' : 'execute-needs-confirm') : 'dryrun';

if (MODE === 'execute-needs-confirm') {
  console.error('ERRO: --execute exige também --confirm=SIM');
  process.exit(1);
}

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const log = { mode: MODE, startedAt: new Date().toISOString(), counts: {}, orphanReviews: [], tradeReconcile: [] };

async function loadAlivePlanIds() {
  const plansSnap = await db.collection('plans').get();
  return new Set(plansSnap.docs.map((d) => d.id));
}

async function collectOrphanReviews(alivePlanIds) {
  // collectionGroup varre todas as subcollections "reviews" de todos os students.
  const reviewsSnap = await db.collectionGroup('reviews').get();
  const orphans = reviewsSnap.docs.filter((d) => {
    const x = d.data();
    return !x.planId || !alivePlanIds.has(x.planId);
  });
  return { orphans, totalReviews: reviewsSnap.size };
}

async function collectTradesToReconcile(orphanReviewIds) {
  if (orphanReviewIds.size === 0) return [];
  // Sem índice composto p/ "reviewId IN [...]"; varre trades com reviewId != null e filtra em memória.
  const tradesSnap = await db.collection('trades').where('reviewId', '!=', null).get();
  return tradesSnap.docs.filter((d) => orphanReviewIds.has(d.data().reviewId));
}

async function deleteInBatches(refs) {
  if (refs.length === 0) return 0;
  const BATCH_SIZE = 450;
  let n = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
    n += Math.min(BATCH_SIZE, refs.length - i);
  }
  return n;
}

async function nullReviewIdInBatches(refs) {
  if (refs.length === 0) return 0;
  const BATCH_SIZE = 450;
  let n = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.update(ref, { reviewId: null });
    await batch.commit();
    n += Math.min(BATCH_SIZE, refs.length - i);
  }
  return n;
}

async function main() {
  console.log(`[cleanup-orphan-reviews] modo=${MODE}, iniciando...`);

  const alivePlanIds = await loadAlivePlanIds();
  log.counts.alivePlans = alivePlanIds.size;
  console.log(`[cleanup-orphan-reviews] planos vivos: ${alivePlanIds.size}`);

  const { orphans, totalReviews } = await collectOrphanReviews(alivePlanIds);
  log.counts.totalReviews = totalReviews;
  log.counts.orphanReviews = orphans.length;
  log.orphanReviews = orphans.map((d) => ({
    path: d.ref.path,
    reviewId: d.id,
    studentId: d.data().studentId ?? null,
    planId: d.data().planId ?? null,
    status: d.data().status ?? null,
    reason: !d.data().planId ? 'sem planId' : 'plano inexistente',
  }));

  const orphanReviewIds = new Set(orphans.map((d) => d.id));
  const tradesToFix = await collectTradesToReconcile(orphanReviewIds);
  log.counts.tradesToReconcile = tradesToFix.length;
  log.tradeReconcile = tradesToFix.map((d) => ({
    tradeId: d.id,
    reviewId: d.data().reviewId,
    status: d.data().status ?? null,
  }));

  console.log(`[cleanup-orphan-reviews] reviews órfãs: ${orphans.length}/${totalReviews}`);
  console.log(`[cleanup-orphan-reviews] trades a reconciliar (reviewId→null): ${tradesToFix.length}`);
  for (const o of log.orphanReviews) {
    console.log(`  - ${o.path} | plano=${o.planId ?? '(nenhum)'} | status=${o.status} | ${o.reason}`);
  }

  if (MODE === 'execute') {
    console.log('[cleanup-orphan-reviews] modo execute — reconciliando trades e apagando reviews...');
    const fixed = await nullReviewIdInBatches(tradesToFix.map((d) => d.ref));
    const deleted = await deleteInBatches(orphans.map((d) => d.ref));
    log.applied = { tradesReconciled: fixed, reviewsDeleted: deleted };
    console.log(`[cleanup-orphan-reviews] trades reconciliados: ${fixed}, reviews apagadas: ${deleted}`);
  } else {
    console.log('[cleanup-orphan-reviews] dry-run — nada alterado.');
  }

  log.finishedAt = new Date().toISOString();

  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = join(LOGS_DIR, `cleanup-orphan-reviews-${MODE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`[cleanup-orphan-reviews] log salvo em ${logPath}`);
}

main().catch((err) => {
  console.error('[cleanup-orphan-reviews] erro fatal:', err);
  process.exit(1);
});
