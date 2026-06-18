/**
 * publishReview.js — Cloud Function callable (#269 Fase B)
 *
 * Promove um rascunho DRAFT → CLOSED, tornando os trades empenhados imortais
 * (`reviewState='DISCUSSED'`, nunca regride). Atribui `sequenceNumber` (ordem por
 * aluno entre reviews CLOSED/ARCHIVED) e limpa o ponteiro `plan.activeDraftReviewId`.
 *
 * Conjunto discutido = trades WHERE `draftReviewId == reviewId` (todos os empenhados
 * no rascunho, inclusive os que nasceram DRAFT pelo ponteiro). Persistido em
 * `includedTradeIds` para o registro imortal e paridade com a migration retroativa
 * (periodTrades ∪ includedTradeIds — Fase C).
 *
 * `frozenSnapshot` e `swot` são opcionais aqui (passados pelo cliente quando a UI da
 * Fase D / SWOT da Fase E estiverem ligadas); na Fase B a callable cuida só da
 * máquina de estados. Campos ausentes não sobrescrevem o que já houver no doc.
 *
 * Input:  { studentId: string, reviewId: string, frozenSnapshot?: object, swot?: object }
 * Output: { reviewId: string, sequenceNumber: number, discussedCount: number }
 *
 * @version 1.0 — issue #269
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString, nextSequenceNumber } = require('./validators');

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode publicar revisão');
    }

    const { studentId, reviewId, frozenSnapshot = null, swot = null } = request.data || {};
    if (!isNonEmptyString(studentId)) throw new HttpsError('invalid-argument', 'studentId é obrigatório');
    if (!isNonEmptyString(reviewId)) throw new HttpsError('invalid-argument', 'reviewId é obrigatório');

    const db = admin.firestore();
    const studentRef = db.collection('students').doc(studentId);
    const reviewRef = studentRef.collection('reviews').doc(reviewId);

    const result = await db.runTransaction(async (tx) => {
      // ── reads (antes de qualquer write) ───────────────────────────
      const reviewSnap = await tx.get(reviewRef);
      if (!reviewSnap.exists) throw new HttpsError('not-found', 'Revisão não encontrada');
      const review = reviewSnap.data();
      if (review.status !== 'DRAFT') {
        throw new HttpsError('failed-precondition', `Revisão não está em DRAFT (status=${review.status})`);
      }

      const planRef = review.planId ? db.collection('plans').doc(review.planId) : null;
      const planSnap = planRef ? await tx.get(planRef) : null;

      // sequenceNumber = max(CLOSED/ARCHIVED do aluno) + 1
      const closedQ = studentRef.collection('reviews').where('status', 'in', ['CLOSED', 'ARCHIVED']);
      const closedSnap = await tx.get(closedQ);
      const nextSeq = nextSequenceNumber(closedSnap.docs.map((d) => d.data().sequenceNumber));

      // Trades empenhados nesse rascunho.
      const draftQ = db.collection('trades').where('draftReviewId', '==', reviewId);
      const draftSnap = await tx.get(draftQ);

      // ── writes ────────────────────────────────────────────────────
      const reviewPatch = {
        status: 'CLOSED',
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        sequenceNumber: nextSeq,
        includedTradeIds: draftSnap.docs.map((d) => d.id),
      };
      if (frozenSnapshot !== null) reviewPatch.frozenSnapshot = frozenSnapshot;
      if (swot !== null) reviewPatch.swot = swot;
      tx.update(reviewRef, reviewPatch);

      for (const d of draftSnap.docs) {
        tx.update(d.ref, {
          reviewState: 'DISCUSSED',
          draftReviewId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Limpa o ponteiro apenas se ainda apontar para este rascunho (defensivo).
      if (planRef && planSnap?.exists && planSnap.data().activeDraftReviewId === reviewId) {
        tx.update(planRef, { activeDraftReviewId: null });
      }

      return { reviewId, sequenceNumber: nextSeq, discussedCount: draftSnap.size };
    });

    console.log(
      `[publishReview] review ${reviewId} (student ${studentId}) → CLOSED seq=${result.sequenceNumber} `
      + `(${result.discussedCount} trades DISCUSSED)`
    );
    return result;
  }
);
