#!/usr/bin/env node
/**
 * issue-269-consolidate-duplicate-drafts.mjs — consolida rascunhos DRAFT duplicados por plano.
 *
 * Invariante v2: 1 rascunho aberto (DRAFT) por plano (garantido go-forward pelo ponteiro
 * `plan.activeDraftReviewId`). A migração escolheu o ponteiro quando havia 2 DRAFTs legados,
 * mas NÃO apagou o doc extra — sobra rascunho duplicado na UI (bug visto no Daniel Barbosa /
 * SWING EDUCACIONAL).
 *
 * EFEITO (por plano com >1 DRAFT):
 *   - mantém o canônico = `plan.activeDraftReviewId` se for DRAFT, senão o de weekStart mais recente.
 *   - re-anchora trades dos DRAFTs extras → `reviewId = canônico`.
 *   - apaga os DRAFTs extras.
 *   - garante `plan.activeDraftReviewId = canônico`.
 *
 * MODO DRY-RUN (default):  node scripts/issue-269-consolidate-duplicate-drafts.mjs
 * MODO EXECUTE:            node scripts/issue-269-consolidate-duplicate-drafts.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS: gcloud auth application-default login
 * LOG: scripts/logs/consolidate-drafts-{dryrun|execute}-<ISO8601>.json
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
if (MODE === 'execute-needs-confirm') { console.error('ERRO: --execute exige --confirm=SIM'); process.exit(1); }

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const log = { mode: MODE, startedAt: new Date().toISOString(), consolidations: [], totals: {} };

async function main() {
  console.log(`[consolidate-drafts] modo=${MODE}, iniciando...`);
  const studs = await db.collection('students').get();

  let planCount = 0, deletedDrafts = 0, reanchored = 0, pointerFixes = 0;

  for (const sd of studs.docs) {
    const draftsSnap = await sd.ref.collection('reviews').where('status', '==', 'DRAFT').get();
    if (draftsSnap.size < 2) continue;

    const byPlan = new Map(); // planId → [doc]
    for (const r of draftsSnap.docs) {
      const p = r.data().planId || '(sem)';
      if (!byPlan.has(p)) byPlan.set(p, []);
      byPlan.get(p).push(r);
    }

    for (const [planId, list] of byPlan.entries()) {
      if (list.length < 2 || planId === '(sem)') continue;
      planCount += 1;

      const planRef = db.collection('plans').doc(planId);
      const planSnap = await planRef.get();
      const ptr = planSnap.exists ? (planSnap.data().activeDraftReviewId ?? null) : null;

      // canônico: o do ponteiro (se for um dos DRAFTs), senão o de weekStart mais recente.
      const sorted = [...list].sort((a, b) => (a.data().weekStart < b.data().weekStart ? 1 : -1));
      const keep = list.find((r) => r.id === ptr) || sorted[0];
      const drop = list.filter((r) => r.id !== keep.id);
      const dropIds = new Set(drop.map((r) => r.id));

      // trades a re-anchorar (query só por studentId, filtra reviewId em memória — sem índice composto)
      const tSnap = await db.collection('trades').where('studentId', '==', sd.id).get();
      const tHit = tSnap.docs.filter((d) => dropIds.has(d.data().reviewId));

      const needPointerFix = ptr !== keep.id;
      log.consolidations.push({
        studentId: sd.id, name: sd.data().name, planId,
        keep: keep.id, drop: [...dropIds], reanchorTrades: tHit.length,
        pointerWas: ptr, pointerTo: needPointerFix ? keep.id : ptr,
      });
      console.log(`${sd.data().name} | plano ${planSnap.exists ? planSnap.data().name : planId}: keep=${keep.id} drop=[${[...dropIds].join(',')}] reanchor=${tHit.length} ptrFix=${needPointerFix}`);

      if (MODE === 'execute') {
        const batch = db.batch();
        for (const d of tHit) batch.update(d.ref, { reviewId: keep.id });
        for (const r of drop) batch.delete(r.ref);
        if (needPointerFix && planSnap.exists) batch.update(planRef, { activeDraftReviewId: keep.id });
        await batch.commit();
      }
      deletedDrafts += drop.length;
      reanchored += tHit.length;
      if (needPointerFix) pointerFixes += 1;
    }
  }

  log.totals = { plans: planCount, deletedDrafts, reanchored, pointerFixes };
  console.log(`\n[consolidate-drafts] planos=${planCount} | drafts apagados=${deletedDrafts} | trades re-anchorados=${reanchored} | ponteiros corrigidos=${pointerFixes}`);
  console.log(MODE === 'execute' ? '[consolidate-drafts] APLICADO.' : '[consolidate-drafts] dry-run — nada alterado.');

  log.finishedAt = new Date().toISOString();
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const p = join(LOGS_DIR, `consolidate-drafts-${MODE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(p, JSON.stringify(log, null, 2));
  console.log(`[consolidate-drafts] log salvo em ${p}`);
}

main().catch((e) => { console.error('[consolidate-drafts] erro fatal:', e); process.exit(1); });
