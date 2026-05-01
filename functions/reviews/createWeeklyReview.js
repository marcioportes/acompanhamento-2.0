/**
 * createWeeklyReview.js — Cloud Function callable
 *
 * Cria uma revisão semanal no modo DRAFT com snapshot congelado enviado pelo mentor.
 * SWOT é preenchido em chamada separada (generateWeeklySwot).
 *
 * Input:
 *   {
 *     studentId: string,
 *     planId: string,
 *     weekStart: 'YYYY-MM-DD',
 *     weekEnd: 'YYYY-MM-DD',
 *     periodKey: string,                      // ex: '2026-W16'
 *     customPeriod: {start,end} | null,       // null = semana ISO
 *     cycleKey: string | null,                // ciclo ativo (ex: '2026-04')
 *     snapshot: {
 *       planContext: {planId, cycleKey, adjustmentCycle},
 *       kpis: {...shape A1...},
 *       topTrades: [...inline A2...],
 *       bottomTrades: [...inline A2...]
 *     }
 *   }
 *
 * Output:
 *   { reviewId: string, status: 'DRAFT' }
 *
 * @version 1.0 — issue #102
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {
  isMentor, isNonEmptyString, isISODate, isPeriodKey, validateSnapshot,
} = require('./validators');

const asHttpsValidator = (fn) => (arg) => {
  try { return fn(arg); }
  catch (e) { throw new HttpsError('invalid-argument', e.message); }
};

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode criar revisões semanais');
    }

    const {
      studentId,
      planId,
      weekStart,
      weekEnd,
      periodKey,
      customPeriod = null,
      cycleKey = null,
      snapshot,
    } = request.data || {};

    if (!isNonEmptyString(studentId)) throw new HttpsError('invalid-argument', 'studentId é obrigatório');
    if (!isNonEmptyString(planId)) throw new HttpsError('invalid-argument', 'planId é obrigatório');
    if (!isISODate(weekStart)) throw new HttpsError('invalid-argument', 'weekStart deve estar em YYYY-MM-DD');
    if (!isISODate(weekEnd)) throw new HttpsError('invalid-argument', 'weekEnd deve estar em YYYY-MM-DD');
    if (!isPeriodKey(periodKey)) throw new HttpsError('invalid-argument', 'periodKey inválido');
    if (customPeriod !== null) {
      if (!customPeriod?.start || !customPeriod?.end || !isISODate(customPeriod.start) || !isISODate(customPeriod.end)) {
        throw new HttpsError('invalid-argument', 'customPeriod deve ser {start,end} em YYYY-MM-DD ou null');
      }
    }
    asHttpsValidator(validateSnapshot)(snapshot);

    if (snapshot.planContext.planId !== planId) {
      throw new HttpsError('invalid-argument', 'snapshot.planContext.planId não bate com planId');
    }

    const db = admin.firestore();

    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      throw new HttpsError('not-found', 'Student não encontrado');
    }

    // Valida plan existe e pertence ao student
    const planRef = db.collection('plans').doc(planId);
    const planSnap = await planRef.get();
    if (!planSnap.exists) {
      throw new HttpsError('not-found', 'Plan não encontrado');
    }
    if (planSnap.data().studentId !== studentId) {
      throw new HttpsError('failed-precondition', 'Plan não pertence ao student informado');
    }

    // GUARD DE UNICIDADE: UM rascunho DRAFT por (student, plan), independente da janela.
    // Regra do ritual: 1 revisão por vez por plano. Se já existe QUALQUER DRAFT desse
    // plano, retorna o existente — mentor publica ou apaga antes de criar outro.
    const dupeQuery = await studentRef.collection('reviews')
      .where('status', '==', 'DRAFT')
      .get();
    const duplicate = dupeQuery.docs
      .map(d => ({ id: d.id, data: d.data() }))
      .find(r => r.data?.frozenSnapshot?.planContext?.planId === planId);
    if (duplicate) {
      console.log(`[createWeeklyReview] Duplicate DRAFT prevented (per-plan) — returning existing ${duplicate.id} for student ${studentId} plan ${planId}`);
      return { reviewId: duplicate.id, status: 'DRAFT', existing: true };
    }

    const timestampMs = Date.now();
    const reviewId = `${periodKey}-${timestampMs}`;
    const reviewRef = studentRef.collection('reviews').doc(reviewId);

    const doc = {
      studentId,
      planId,
      weekStart,
      weekEnd,
      periodKey,
      customPeriod,
      cycleKey,
      status: 'DRAFT',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      closedAt: null,
      archivedAt: null,
      frozenSnapshot: snapshot,
      swot: null,
      meetingLink: null,
      videoLink: null,
    };

    await reviewRef.set(doc);
    console.log(`[createWeeklyReview] Created review ${reviewId} for student ${studentId} plan ${planId} (${periodKey})`);

    return { reviewId, status: 'DRAFT', existing: false };
  }
);

