/**
 * removeSubscription — issue #237 F3
 *
 * Remove a assinatura ativa de um contact:
 *  - Marca students/{uid}.status='inactive' se havia studentUid (preserva trades).
 *  - Atualiza contacts/{id}: subscription.endsAt=now, status=newStatus.
 *  - Aceita newStatus 'ex' (default) ou 'lead' (downgrade pra ainda-em-prospecção).
 *
 * Auth: mentor-only.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const MENTOR_EMAIL = 'marcio.portes@me.com';
const VALID_NEW_STATUS = new Set(['ex', 'lead']);

function isMentorEmail(email) {
  return email === MENTOR_EMAIL;
}

module.exports = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }
  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentor pode remover assinatura');
  }

  const { contactId, newStatus = 'ex' } = data || {};
  if (!contactId || typeof contactId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', '`contactId` obrigatório');
  }
  if (!VALID_NEW_STATUS.has(newStatus)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `newStatus inválido: '${newStatus}'. Use 'ex' ou 'lead'.`
    );
  }

  const db = admin.firestore();
  const contactRef = db.collection('contacts').doc(contactId);

  const snap = await contactRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', `contacts/${contactId} não existe`);
  }
  const contact = snap.data();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (contact.studentUid) {
    await db.collection('students').doc(contact.studentUid).update({
      status: 'inactive',
      updatedAt: now,
      updatedBy: { uid: context.auth.uid, email: context.auth.token.email },
    });
  }

  await contactRef.update({
    status: newStatus,
    'subscription.type': null,
    'subscription.endsAt': now,
    updatedAt: now,
    updatedBy: { uid: context.auth.uid, email: context.auth.token.email },
  });

  return { success: true };
});
