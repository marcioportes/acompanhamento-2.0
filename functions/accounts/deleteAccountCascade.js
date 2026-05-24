/**
 * deleteAccountCascade.js — Cloud Function callable
 *
 * Apaga uma conta e todo o passivo dependente em cascata, via Admin SDK
 * (bypassa rules). Substitui o cascade client-side de `useAccounts.deleteAccount`,
 * que falhava silenciosamente em `orders` (`allow delete: if false`) e
 * `cycleClosures` (`allow write: if false`) e podia falhar em trades órfãos
 * quando o seal-check não conseguia validar o plano.
 *
 * Permission: mentor OU dono da conta (owner = `account.studentId`).
 *
 * Ordem de delete: movements → trades → orders → cycleClosures → plans → account.
 * Cada coleção em batches de 400 (limite Firestore: 500/batch, margem de segurança).
 *
 * Input:  { accountId: string }
 * Output: { deleted: { movements, trades, orders, cycleClosures, plans, account }, total: number }
 *
 * Issue #259 fast-follow — substitui cascade quebrado de 92d28022.
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

    const accountId = request.data?.accountId;
    if (typeof accountId !== 'string' || accountId.trim() === '') {
      throw new HttpsError('invalid-argument', 'accountId obrigatório');
    }

    const db = admin.firestore();
    const accountRef = db.collection('accounts').doc(accountId);
    const accountSnap = await accountRef.get();

    if (!accountSnap.exists) {
      throw new HttpsError('not-found', `Conta ${accountId} não encontrada`);
    }

    const account = accountSnap.data();
    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const callerIsMentor = isMentor(callerEmail);
    const isOwner = account.studentId === callerUid;

    if (!callerIsMentor && !isOwner) {
      throw new HttpsError(
        'permission-denied',
        'Apenas o dono da conta ou um mentor pode deletá-la',
      );
    }

    const plansSnap = await db.collection('plans').where('accountId', '==', accountId).get();
    const planRefs = plansSnap.docs.map((d) => d.ref);
    const planIds = plansSnap.docs.map((d) => d.id);

    const tradesSnap = await db.collection('trades').where('accountId', '==', accountId).get();
    const tradeRefs = tradesSnap.docs.map((d) => d.ref);

    const movementsSnap = await db.collection('movements').where('accountId', '==', accountId).get();
    const movementRefs = movementsSnap.docs.map((d) => d.ref);

    const closuresSnap = await db.collection('cycleClosures').where('accountId', '==', accountId).get();
    const closureRefs = closuresSnap.docs.map((d) => d.ref);

    const orderRefs = [];
    for (let i = 0; i < planIds.length; i += 10) {
      const chunk = planIds.slice(i, i + 10);
      const ordersSnap = await db.collection('orders').where('planId', 'in', chunk).get();
      ordersSnap.docs.forEach((d) => orderRefs.push(d.ref));
    }

    const counts = {
      movements:     await deleteDocsInBatches(db, movementRefs),
      trades:        await deleteDocsInBatches(db, tradeRefs),
      orders:        await deleteDocsInBatches(db, orderRefs),
      cycleClosures: await deleteDocsInBatches(db, closureRefs),
      plans:         await deleteDocsInBatches(db, planRefs),
      account:       0,
    };

    await accountRef.delete();
    counts.account = 1;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(
      `[deleteAccountCascade] caller=${callerEmail} role=${callerIsMentor ? 'mentor' : 'owner'} `
        + `accountId=${accountId} deleted=${JSON.stringify(counts)} total=${total}`,
    );

    return { deleted: counts, total };
  },
);
