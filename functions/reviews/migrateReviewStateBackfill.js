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
 * Input:  { dryRun?: boolean, studentId?: string, expectedChanges?: number }
 *         studentId escopa a um aluno (batches por aluno, §9.2). Ausente → todos.
 * Output: { dryRun, totalPlannedChanges, applied, students: [{studentId, tradeUpdates,
 *           reviewSeqUpdates, planPointerUpdates, conflicts}], conflicts: [...] }
 *
 * @version 1.0 — issue #269
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor } = require('./validators');
const {
  buildReviewMaps, assignSequenceNumbers, targetReview, tradeNeedsUpdate, tradeUpdateData,
} = require('./migrationLogic');

const BATCH_SIZE = 400; // < limite 500 de ops por WriteBatch

/** Planeja (sem escrever) todas as mutações de UM aluno. */
async function planForStudent(db, studentId) {
  const studentRef = db.collection('students').doc(studentId);

  const [reviewsSnap, tradesSnap, plansSnap] = await Promise.all([
    studentRef.collection('reviews').get(),
    db.collection('trades').where('studentId', '==', studentId).get(),
    db.collection('plans').where('studentId', '==', studentId).get(),
  ]);

  const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const maps = buildReviewMaps(reviews);
  const seqMap = assignSequenceNumbers(reviews);

  const ops = []; // { ref, data }

  // Trades → reviewId (+ status=DISCUSSED quando em review fechada)
  let tradeUpdates = 0;
  for (const d of tradesSnap.docs) {
    const target = targetReview(d.id, maps);
    if (tradeNeedsUpdate(d.data(), target)) {
      ops.push({ ref: d.ref, data: tradeUpdateData(target) });
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

  // Plans → reconcilia activeDraftReviewId (seta o DRAFT ativo; limpa ponteiros órfãos)
  let planPointerUpdates = 0;
  for (const d of plansSnap.docs) {
    const target = maps.planPointers.get(d.id) || null;
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
    conflicts: maps.conflicts,
  };
}

async function commitOps(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) {
      batch.update(op.ref, { ...op.data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
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
      const plan = await planForStudent(db, sid);
      allOps.push(...plan.ops);
      if (plan.conflicts.length) allConflicts.push(...plan.conflicts.map((c) => ({ studentId: sid, ...c })));
      perStudent.push({
        studentId: sid,
        tradeUpdates: plan.tradeUpdates,
        reviewSeqUpdates: plan.reviewSeqUpdates,
        planPointerUpdates: plan.planPointerUpdates,
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
        students: perStudent.filter((s) => s.tradeUpdates || s.reviewSeqUpdates || s.planPointerUpdates || s.conflicts),
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
      students: perStudent.filter((s) => s.tradeUpdates || s.reviewSeqUpdates || s.planPointerUpdates || s.conflicts),
      conflicts: allConflicts,
    };
  }
);
