/**
 * assignEspelhoSubscription — issue #237 F3
 *
 * Atribui assinatura Espelho a um contact:
 *  - Não cria student/{uid} (Espelho não tem dashboard, só WhatsApp)
 *  - Se já era Alpha (studentUid presente), marca students/{uid}.status='inactive'
 *    (preserva trades/maturity para histórico — INV-15 design)
 *
 * Auth: mentor-only.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const MENTOR_EMAIL = 'marcio.portes@me.com';

function isMentorEmail(email) {
  return email === MENTOR_EMAIL;
}

module.exports = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }
  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentor pode atribuir Espelho');
  }

  const { contactId } = data || {};
  if (!contactId || typeof contactId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', '`contactId` obrigatório');
  }

  const db = admin.firestore();
  const contactRef = db.collection('contacts').doc(contactId);

  const snap = await contactRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', `contacts/${contactId} não existe`);
  }
  const contact = snap.data();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Se vinha de Alpha, desativa o student (preserva histórico)
  if (contact.studentUid) {
    await db.collection('students').doc(contact.studentUid).update({
      status: 'inactive',
      updatedAt: now,
      updatedBy: { uid: context.auth.uid, email: context.auth.token.email },
    });
  }

  await contactRef.update({
    status: 'espelho',
    subscription: {
      type: 'espelho',
      since: now,
      endsAt: null,
      isVIP: contact.subscription?.isVIP ?? false,
      notes: contact.subscription?.notes ?? null,
    },
    updatedAt: now,
    updatedBy: { uid: context.auth.uid, email: context.auth.token.email },
  });

  return { success: true };
});
