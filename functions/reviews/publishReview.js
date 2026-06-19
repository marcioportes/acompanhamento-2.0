/**
 * publishReview.js — Cloud Function callable (#269 v2)
 *
 * Publica a revisão semanal na reunião: DRAFT → CLOSED. Os trades membros (já ancorados
 * via `reviewId` desde o 1º feedback do mentor) recebem o estado TERMINAL do ciclo único:
 * `status='DISCUSSED'` (imutável, imortal) — independente de o fio de feedback estar em
 * REVIEWED/QUESTION/CLOSED (a reunião ao vivo supera o fio assíncrono). A FK `reviewId`
 * NÃO é tocada — já está setada e nunca regride.
 *
 * Pertencimento = `trades WHERE reviewId == reviewId` (sem array `includedTradeIds`).
 * O período real da revisão é computado aqui a partir dos membros (o doc aberto nasceu
 * com period* null e weekStart/weekEnd placeholder).
 *
 * Atribui `sequenceNumber` (ordem por aluno entre CLOSED/ARCHIVED) e limpa o ponteiro
 * `plan.activeDraftReviewId` — a próxima revisão aberta nasce no próximo feedback.
 *
 * Input:  { studentId: string, reviewId: string, frozenSnapshot?: object, swot?: object }
 * Output: { reviewId: string, sequenceNumber: number, discussedCount: number }
 *
 * @version 2.0 — issue #269 v2
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString, nextSequenceNumber, computePeriodBounds } = require('./validators');

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
    const todayISO = new Date().toISOString().slice(0, 10);

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

      // Membros da revisão = trades ancorados nela (reviewId == reviewId).
      const memberQ = db.collection('trades').where('reviewId', '==', reviewId);
      const memberSnap = await tx.get(memberQ);

      // Período real a partir dos membros (o doc aberto tinha period* null).
      const bounds = computePeriodBounds(memberSnap.docs.map((d) => d.data().entryTime), todayISO);

      // ── writes ────────────────────────────────────────────────────
      const reviewPatch = {
        status: 'CLOSED',
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        sequenceNumber: nextSeq,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        weekStart: bounds.periodStart || review.weekStart || todayISO,
        weekEnd: bounds.periodEnd || review.weekEnd || todayISO,
      };
      if (frozenSnapshot !== null) reviewPatch.frozenSnapshot = frozenSnapshot;
      if (swot !== null) reviewPatch.swot = swot;
      tx.update(reviewRef, reviewPatch);

      // Membros → status TERMINAL DISCUSSED (não toca reviewId, já setado).
      for (const d of memberSnap.docs) {
        tx.update(d.ref, {
          status: 'DISCUSSED',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Limpa o ponteiro apenas se ainda apontar para esta revisão (defensivo).
      if (planRef && planSnap?.exists && planSnap.data().activeDraftReviewId === reviewId) {
        tx.update(planRef, { activeDraftReviewId: null });
      }

      return { reviewId, sequenceNumber: nextSeq, discussedCount: memberSnap.size };
    });

    console.log(
      `[publishReview] review ${reviewId} (student ${studentId}) → CLOSED seq=${result.sequenceNumber} `
      + `(${result.discussedCount} trades DISCUSSED)`
    );
    return result;
  }
);
