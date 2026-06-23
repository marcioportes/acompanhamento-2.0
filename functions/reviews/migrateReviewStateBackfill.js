/**
 * migrateReviewStateBackfill.js — Cloud Function callable (#269 Fase C, D8).
 *
 * Migration retroativa idempotente que preenche `trade.reviewId` (+ status=DISCUSSED),
 * `review.sequenceNumber` e o ponteiro `plan.activeDraftReviewId` a partir das reviews
 * existentes. Núcleo de decisão em reviews/migrationLogic.js (puro, testado).
 *
 * Modos:
 *   dryRun:true  (default) → só conta o que mudaria, NÃO escreve. Retorna totalPlannedChanges.
 *   dryRun:false (apply)   → exige `expectedChanges === totalPlannedChanges` recomputado.
 *                            Safeguard D8: prova que o mentor rodou o dry-run e que nada
 *                            derivou entre dry-run e apply (sem precisar de collection de guard).
 *
 * Trades legados COM feedback fora de qualquer review são ancorados no rascunho VIGENTE do
 * plano (provisionado aqui se não existir) — invariante "rascunho aberto = feedback ∧ ≠DISCUSSED"
 * também no legado, pra nada escapar da próxima reunião.
 *
 * Input:  { dryRun?: boolean, studentId?: string, expectedChanges?: number }
 *         studentId escopa a um aluno (batches por aluno, §9.2). Ausente → todos.
 * Output: { dryRun, totalPlannedChanges, applied, students: [{studentId, tradeUpdates,
 *           reviewSeqUpdates, planPointerUpdates, reviewsCreated, orphanAnchored, conflicts}],
 *           conflicts: [...] }
 *
 * @version 2.0 — issue #269 v2 (ancoragem de órfãos-com-feedback no rascunho vigente)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor } = require('./validators');
const {
  buildReviewMaps, assignSequenceNumbers, targetReview, tradeNeedsUpdate, tradeUpdateData,
} = require('./migrationLogic');

const BATCH_SIZE = 400; // < limite 500 de ops por WriteBatch

/** Doc de um rascunho aberto provisionado pela migration (espelha openReview.buildOpenReviewDoc,
 *  mas marcado como origem backfill). period* nulos; weekStart/End = placeholder de ordenação. */
function buildMigrationDraftDoc(studentId, planId, todayISO) {
  return {
    studentId,
    planId,
    cycleKey: null,
    status: 'DRAFT',
    sequenceNumber: null,
    periodStart: null,
    periodEnd: null,
    weekStart: todayISO,
    weekEnd: todayISO,
    frozenSnapshot: null,
    swot: null,
    source: 'backfill',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system:migration',
    closedAt: null,
    archivedAt: null,
    meetingLink: null,
    videoLink: null,
  };
}

/** Planeja (sem escrever) todas as mutações de UM aluno. */
async function planForStudent(db, studentId, todayISO) {
  const studentRef = db.collection('students').doc(studentId);

  const [reviewsSnap, tradesSnap, plansSnap] = await Promise.all([
    studentRef.collection('reviews').get(),
    db.collection('trades').where('studentId', '==', studentId).get(),
    db.collection('plans').where('studentId', '==', studentId).get(),
  ]);

  const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const maps = buildReviewMaps(reviews);
  const seqMap = assignSequenceNumbers(reviews);

  const ops = []; // { ref, data, type? } — type 'set' cria doc novo; default = update

  // Reviews DRAFT existentes (para validar o fallback de draftReviewId legado).
  const draftReviewIds = new Set(
    reviewsSnap.docs.filter((r) => r.data().status === 'DRAFT').map((r) => r.id)
  );
  // Planos vivos do aluno — só ancoramos órfãos em plano existente.
  const alivePlanIds = new Set(plansSnap.docs.map((d) => d.id));

  // ── Passo 1: alvo base por trade + coleta dos órfãos-com-feedback por plano ──
  // resolvedTargets guarda o alvo já decidido (exceto reviewId dos órfãos, resolvido no passo 2).
  const resolvedTargets = new Map(); // tradeId → { ref, data, target }
  const orphanByPlan = new Map();    // planId → [tradeId]
  for (const d of tradesSnap.docs) {
    const data = d.data();
    let target = targetReview(d.id, maps, data);
    // Fallback v1: rascunho legado guardava a associação no TRADE (draftReviewId). Tem
    // prioridade sobre a ancoragem genérica: é uma FK explícita para um DRAFT existente.
    if (target.reviewId === null && data.draftReviewId && draftReviewIds.has(data.draftReviewId)) {
      target = { reviewId: data.draftReviewId, status: null };
    } else if (target.anchorToPlanDraft) {
      // Órfão com feedback: vai pro rascunho vigente do plano (resolvido no passo 2).
      if (data.planId && alivePlanIds.has(data.planId)) {
        const list = orphanByPlan.get(data.planId) || [];
        list.push(d.id);
        orphanByPlan.set(data.planId, list);
      } else {
        // Sem plano vivo: não há rascunho onde ancorar → fica backlog (reviewId=null).
        target = { reviewId: null, status: null };
      }
    }
    resolvedTargets.set(d.id, { ref: d.ref, data, target });
  }

  // ── Passo 2: provisiona o rascunho vigente por plano (reusa o DRAFT existente; cria se não houver) ──
  const effectivePointers = new Map(maps.planPointers); // planId → reviewId DRAFT vigente
  let reviewsCreated = 0;
  for (const planId of orphanByPlan.keys()) {
    if (!effectivePointers.has(planId)) {
      const reviewRef = studentRef.collection('reviews').doc();
      ops.push({ ref: reviewRef, data: buildMigrationDraftDoc(studentId, planId, todayISO), type: 'set' });
      effectivePointers.set(planId, reviewRef.id);
      reviewsCreated += 1;
    }
  }
  // Resolve o reviewId dos órfãos agora que o draft do plano existe.
  let orphanAnchored = 0;
  for (const [planId, tradeIds] of orphanByPlan.entries()) {
    const draftId = effectivePointers.get(planId);
    for (const tid of tradeIds) {
      resolvedTargets.get(tid).target = { reviewId: draftId, status: null };
      orphanAnchored += 1;
    }
  }

  // ── Passo 3: ops de trade (só quando difere do alvo) ──
  let tradeUpdates = 0;
  for (const { ref, data, target } of resolvedTargets.values()) {
    if (tradeNeedsUpdate(data, target)) {
      ops.push({ ref, data: tradeUpdateData(target) });
      tradeUpdates += 1;
    }
  }

  // Reviews CLOSED/ARCHIVED → sequenceNumber (só quando difere)
  let reviewSeqUpdates = 0;
  for (const d of reviewsSnap.docs) {
    const seq = seqMap.get(d.id);
    if (seq != null && d.data().sequenceNumber !== seq) {
      ops.push({ ref: d.ref, data: { sequenceNumber: seq } });
      reviewSeqUpdates += 1;
    }
  }

  // Plans → reconcilia activeDraftReviewId (inclui os drafts recém-provisionados).
  let planPointerUpdates = 0;
  for (const d of plansSnap.docs) {
    const target = effectivePointers.get(d.id) || null;
    const current = d.data().activeDraftReviewId ?? null;
    if (current !== target) {
      ops.push({ ref: d.ref, data: { activeDraftReviewId: target } });
      planPointerUpdates += 1;
    }
  }

  return {
    studentId,
    ops,
    tradeUpdates,
    reviewSeqUpdates,
    planPointerUpdates,
    reviewsCreated,
    orphanAnchored,
    conflicts: maps.conflicts,
  };
}

async function commitOps(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data); // doc novo (createdAt já no payload)
      } else {
        batch.update(op.ref, { ...op.data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
    await batch.commit();
  }
}

module.exports = onCall(
  { maxInstances: 1, timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária');
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode rodar a migration');
    }

    const dryRun = request.data?.dryRun !== false; // default true
    const onlyStudentId = typeof request.data?.studentId === 'string' ? request.data.studentId : null;
    const expectedChanges = request.data?.expectedChanges;

    const db = admin.firestore();
    const todayISO = new Date().toISOString().slice(0, 10); // placeholder weekStart dos drafts provisionados

    // Lista de alunos a processar.
    let studentIds;
    if (onlyStudentId) {
      studentIds = [onlyStudentId];
    } else {
      const all = await db.collection('students').get();
      studentIds = all.docs.map((d) => d.id);
    }

    const perStudent = [];
    const allOps = [];
    const allConflicts = [];
    for (const sid of studentIds) {
      const plan = await planForStudent(db, sid, todayISO);
      allOps.push(...plan.ops);
      if (plan.conflicts.length) allConflicts.push(...plan.conflicts.map((c) => ({ studentId: sid, ...c })));
      perStudent.push({
        studentId: sid,
        tradeUpdates: plan.tradeUpdates,
        reviewSeqUpdates: plan.reviewSeqUpdates,
        planPointerUpdates: plan.planPointerUpdates,
        reviewsCreated: plan.reviewsCreated,
        orphanAnchored: plan.orphanAnchored,
        conflicts: plan.conflicts.length,
      });
    }

    const totalPlannedChanges = allOps.length;

    if (dryRun) {
      console.log(`[migrateReviewStateBackfill] DRY-RUN — ${totalPlannedChanges} mudanças planejadas em ${studentIds.length} alunos, ${allConflicts.length} conflitos`);
      return {
        dryRun: true,
        applied: false,
        totalPlannedChanges,
        students: perStudent.filter((s) => s.tradeUpdates || s.reviewSeqUpdates || s.planPointerUpdates || s.reviewsCreated || s.orphanAnchored || s.conflicts),
        conflicts: allConflicts,
      };
    }

    // ── APPLY — safeguard D8 ──────────────────────────────────────────
    if (typeof expectedChanges !== 'number') {
      throw new HttpsError('failed-precondition',
        'apply exige expectedChanges (número visto no dry-run). Rode dryRun primeiro.');
    }
    if (expectedChanges !== totalPlannedChanges) {
      throw new HttpsError('failed-precondition',
        `dry-run desatualizado: expectedChanges=${expectedChanges} mas o recomputo deu ${totalPlannedChanges}. `
        + 'Rode dryRun de novo e confirme a contagem.');
    }

    await commitOps(db, allOps);
    console.log(`[migrateReviewStateBackfill] APPLY — ${totalPlannedChanges} mudanças aplicadas em ${studentIds.length} alunos`);

    return {
      dryRun: false,
      applied: true,
      totalPlannedChanges,
      students: perStudent.filter((s) => s.tradeUpdates || s.reviewSeqUpdates || s.planPointerUpdates || s.reviewsCreated || s.orphanAnchored || s.conflicts),
      conflicts: allConflicts,
    };
  }
);

// Reuso pelo runner de dry-run standalone (scripts/issue-269-migration-dryrun.mjs): mesma
// lógica de planejamento da callable, sem deploy e sem duplicar regra.
module.exports.planForStudent = planForStudent;
module.exports.buildMigrationDraftDoc = buildMigrationDraftDoc;
