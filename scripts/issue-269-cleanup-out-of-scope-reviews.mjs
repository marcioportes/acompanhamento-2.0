#!/usr/bin/env node
/**
 * issue-269-cleanup-out-of-scope-reviews.mjs — correção retroativa do filtro matriz (#269).
 *
 * A migration ancorou feedback ANTIGO num rascunho ABERTO de hoje também para alunos que
 * HOJE estão fora do escopo de Revisão (Espelho/VIP/sem-sub) — pauta de uma reunião que não
 * vai existir (não estão mais na dupla). Tier é temporal: tiveram feedback quando eram
 * alpha/trial, hoje não são.
 *
 * EFEITO (só para alunos com bucket fora de {alpha, trial-alpha}):
 *   1. apaga os reviews status=DRAFT (pauta aberta indevida)
 *   2. un-anchora os trades cujo reviewId aponta para esses DRAFTs → reviewId=null
 *      (mantém feedbackHistory + status — o feedback aconteceu de verdade)
 *   3. limpa plan.activeDraftReviewId que aponte para os DRAFTs apagados
 *
 *   NÃO toca reviews CLOSED/ARCHIVED (reuniões reais do passado) nem seus trades DISCUSSED.
 *
 * MODO DRY-RUN (default):  node scripts/issue-269-cleanup-out-of-scope-reviews.mjs
 * MODO EXECUTE:            node scripts/issue-269-cleanup-out-of-scope-reviews.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS: gcloud auth application-default login
 * LOG: scripts/logs/cleanup-out-of-scope-{dryrun|execute}-<ISO8601>.json
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
const { classifyStudent, inReviewScope } = require(join(PROJECT_ROOT, 'functions', '_shared', 'studentClassify'));

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
const log = { mode: MODE, startedAt: new Date().toISOString(), outOfScopeStudents: [], totals: {} };

async function deleteInBatches(refs) {
  const N = 450; let n = 0;
  for (let i = 0; i < refs.length; i += N) {
    const b = db.batch();
    for (const r of refs.slice(i, i + N)) b.delete(r);
    await b.commit(); n += Math.min(N, refs.length - i);
  }
  return n;
}
async function updateInBatches(refs, data) {
  const N = 450; let n = 0;
  for (let i = 0; i < refs.length; i += N) {
    const b = db.batch();
    for (const r of refs.slice(i, i + N)) b.update(r, data);
    await b.commit(); n += Math.min(N, refs.length - i);
  }
  return n;
}

async function main() {
  console.log(`[cleanup-out-of-scope] modo=${MODE}, iniciando...`);
  const studs = await db.collection('students').get();

  const draftRefs = [], tradeRefs = [], planRefs = [];
  let nStudents = 0;
  for (const sd of studs.docs) {
    const subsSnap = await sd.ref.collection('subscriptions').get();
    const bucket = classifyStudent(subsSnap.docs.map((d) => d.data()));
    if (inReviewScope(bucket)) continue; // em escopo — não mexe

    const reviewsSnap = await sd.ref.collection('reviews').where('status', '==', 'DRAFT').get();
    if (reviewsSnap.empty) continue;
    const draftIds = new Set(reviewsSnap.docs.map((d) => d.id));

    // trades ancorados nesses DRAFTs (un-anchor) — query só por studentId (sem índice composto),
    // filtra reviewId em memória.
    const tSnap = await db.collection('trades').where('studentId', '==', sd.id).get();
    const tHit = tSnap.docs.filter((d) => draftIds.has(d.data().reviewId));

    // plans com ponteiro para esses DRAFTs
    const pSnap = await db.collection('plans').where('studentId', '==', sd.id).get();
    const pHit = pSnap.docs.filter((d) => draftIds.has(d.data().activeDraftReviewId));

    nStudents += 1;
    reviewsSnap.docs.forEach((d) => draftRefs.push(d.ref));
    tHit.forEach((d) => tradeRefs.push(d.ref));
    pHit.forEach((d) => planRefs.push(d.ref));
    log.outOfScopeStudents.push({
      studentId: sd.id, name: sd.data().name, bucket,
      draftsDeleted: reviewsSnap.size, tradesUnanchored: tHit.length, pointersCleared: pHit.length,
    });
  }

  log.totals = { students: nStudents, drafts: draftRefs.length, trades: tradeRefs.length, pointers: planRefs.length };
  console.log(`[cleanup-out-of-scope] fora de escopo c/ DRAFT: ${nStudents} alunos`);
  console.log(`  drafts a apagar: ${draftRefs.length} | trades a un-anchorar: ${tradeRefs.length} | ponteiros a limpar: ${planRefs.length}`);
  for (const s of log.outOfScopeStudents) {
    console.log(`  - ${s.name} (${s.bucket ?? 'sem-sub/vip'}): drafts=${s.draftsDeleted} trades=${s.tradesUnanchored} ptr=${s.pointersCleared}`);
  }

  if (MODE === 'execute') {
    console.log('[cleanup-out-of-scope] modo execute — aplicando...');
    const tn = await updateInBatches(tradeRefs, { reviewId: null });
    const pn = await updateInBatches(planRefs, { activeDraftReviewId: null });
    const dn = await deleteInBatches(draftRefs);
    log.applied = { tradesUnanchored: tn, pointersCleared: pn, draftsDeleted: dn };
    console.log(`[cleanup-out-of-scope] aplicado: trades=${tn} ptr=${pn} drafts=${dn}`);
  } else {
    console.log('[cleanup-out-of-scope] dry-run — nada alterado.');
  }

  log.finishedAt = new Date().toISOString();
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const p = join(LOGS_DIR, `cleanup-out-of-scope-${MODE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(p, JSON.stringify(log, null, 2));
  console.log(`[cleanup-out-of-scope] log salvo em ${p}`);
}

main().catch((err) => { console.error('[cleanup-out-of-scope] erro fatal:', err); process.exit(1); });
