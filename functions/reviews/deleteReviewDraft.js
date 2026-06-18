/**
 * deleteReviewDraft.js — Cloud Function callable (#269 Fase B)
 *
 * Descarta um rascunho DRAFT: reverte os trades empenhados de volta a
 * `reviewState='NONE'` (rollback do bulk), apaga o doc da revisão e limpa o
 * ponteiro `plan.activeDraftReviewId`. Só rascunhos podem ser descartados —
 * CLOSED/ARCHIVED são imortais.
 *
 * Input:  { studentId: string, reviewId: string }
 * Output: { reverted: number }
 *
 * @version 1.0 — issue #269
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString } = require('./validators');

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode descartar rascunho de revisão');
    }

    const { studentId, reviewId } = request.data || {};
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
        throw new HttpsError('failed-precondition', `Só rascunho pode ser descartado (status=${review.status})`);
      }

      const planRef = review.planId ? db.collection('plans').doc(review.planId) : null;
      const planSnap = planRef ? await tx.get(planRef) : null;

      const draftQ = db.collection('trades').where('draftReviewId', '==', reviewId);
      const draftSnap = await tx.get(draftQ);

      // ── writes ────────────────────────────────────────────────────
      for (const d of draftSnap.docs) {
        tx.update(d.ref, {
          reviewState: 'NONE',
          draftReviewId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (planRef && planSnap?.exists && planSnap.data().activeDraftReviewId === reviewId) {
        tx.update(planRef, { activeDraftReviewId: null });
      }

      tx.delete(reviewRef);

      return { reverted: draftSnap.size };
    });

    console.log(`[deleteReviewDraft] review ${reviewId} (student ${studentId}) descartado — ${result.reverted} trades → NONE`);
    return result;
  }
);
