/**
 * deletePlanCascade.js — Cloud Function callable
 *
 * Apaga um plano e todo o passivo dependente em cascata via Admin SDK
 * (bypassa rules). Espelha `deleteAccountCascade` para o escopo de plano
 * isolado, sem tocar a conta.
 *
 * O cascade client-side de `usePlans.deletePlan` cobria só trades + movements
 * via tradeId. Orders (`allow delete: if false`) e cycleClosures
 * (`allow write: if false`) ficavam órfãos.
 *
 * Permission: mentor OU dono do plano (`plan.studentId`).
 *
 * Ordem de delete:
 *   movements (por tradeId dos trades do plano) →
 *   trades (por planId) →
 *   orders (por planId) →
 *   cycleClosures (por planId) →
 *   reviews (subcollection students/{studentId}/reviews, por planId — #269 v2) →
 *   plan.
 *
 * Cada coleção em batches de 400 (limite 500/batch).
 *
 * Input:  { planId: string }
 * Output: { deleted: { movements, trades, orders, cycleClosures, reviews, plan }, total: number }
 *
 * Issue #259 fast-follow — paralelo a deleteAccountCascade.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const MENTOR_EMAILS = ['marcio.portes@me.com'];
const isMentor = (email) => MENTOR_EMAILS.includes(String(email || '').toLowerCase());

const BATCH_LIMIT = 400;

async function deleteDocsInBatches(db, docRefs) {
  if (docRefs.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += BATCH_LIMIT) {
    const slice = docRefs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const planId = request.data?.planId;
    if (typeof planId !== 'string' || planId.trim() === '') {
      throw new HttpsError('invalid-argument', 'planId obrigatório');
    }

    const db = admin.firestore();
    const planRef = db.collection('plans').doc(planId);
    const planSnap = await planRef.get();

    if (!planSnap.exists) {
      throw new HttpsError('not-found', `Plano ${planId} não encontrado`);
    }

    const plan = planSnap.data();
    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const callerIsMentor = isMentor(callerEmail);
    const isOwner = plan.studentId === callerUid;

    if (!callerIsMentor && !isOwner) {
      throw new HttpsError(
        'permission-denied',
        'Apenas o dono do plano ou um mentor pode deletá-lo',
      );
    }

    const tradesSnap = await db.collection('trades').where('planId', '==', planId).get();
    const tradeRefs = tradesSnap.docs.map((d) => d.ref);
    const tradeIds = tradesSnap.docs.map((d) => d.id);

    const movementRefs = [];
    for (let i = 0; i < tradeIds.length; i += 10) {
      const chunk = tradeIds.slice(i, i + 10);
      const movSnap = await db.collection('movements').where('tradeId', 'in', chunk).get();
      movSnap.docs.forEach((d) => movementRefs.push(d.ref));
    }

    const ordersSnap = await db.collection('orders').where('planId', '==', planId).get();
    const orderRefs = ordersSnap.docs.map((d) => d.ref);

    const closuresSnap = await db.collection('cycleClosures').where('planId', '==', planId).get();
    const closureRefs = closuresSnap.docs.map((d) => d.ref);

    // #269 v2 — reviews semanais vivem em students/{studentId}/reviews com FK planId.
    // Cascade impede revisões órfãs quando o plano some.
    const reviewRefs = [];
    if (plan.studentId) {
      const reviewsSnap = await db
        .collection('students').doc(plan.studentId).collection('reviews')
        .where('planId', '==', planId).get();
      reviewsSnap.docs.forEach((d) => reviewRefs.push(d.ref));
    }

    const counts = {
      movements:     await deleteDocsInBatches(db, movementRefs),
      trades:        await deleteDocsInBatches(db, tradeRefs),
      orders:        await deleteDocsInBatches(db, orderRefs),
      cycleClosures: await deleteDocsInBatches(db, closureRefs),
      reviews:       await deleteDocsInBatches(db, reviewRefs),
      plan:          0,
    };

    await planRef.delete();
    counts.plan = 1;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(
      `[deletePlanCascade] caller=${callerEmail} role=${callerIsMentor ? 'mentor' : 'owner'} `
        + `planId=${planId} deleted=${JSON.stringify(counts)} total=${total}`,
    );

    return { deleted: counts, total };
  },
);
