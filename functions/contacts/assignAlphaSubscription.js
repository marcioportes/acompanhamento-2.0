/**
 * assignAlphaSubscription — issue #237 F3
 *
 * Promove um contact para Alpha:
 *  1. Cria usuário no Firebase Auth (email obrigatório).
 *  2. Cria doc em students/{uid} com status='active'.
 *  3. Atualiza contacts/{id} com studentUid + status='alpha' + subscription.
 *  4. Envia email de boas-vindas com reset link (via coleção /mail,
 *     mesmo padrão de createStudent).
 *
 * Auth: mentor-only.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const MENTOR_EMAIL = 'marcio.portes@me.com';
const APP_NAME = 'Espelho';

function isMentorEmail(email) {
  return email === MENTOR_EMAIL;
}

function getWelcomeEmailHtml(name, resetLink) {
  return `
    <!DOCTYPE html>
    <html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2>Bem-vindo ao ${APP_NAME}, ${name}!</h2>
      <p>Configure sua senha clicando no link abaixo:</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;">Configurar senha</a></p>
      <p style="font-size:12px;color:#666;">Se o botão não funcionar, copie este link no navegador:<br>${resetLink}</p>
    </body></html>
  `;
}

module.exports = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }
  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentor pode atribuir Alpha');
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

  if (!contact.email) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Contact sem email — adicione email antes de atribuir Alpha'
    );
  }

  if (contact.studentUid) {
    throw new functions.https.HttpsError(
      'already-exists',
      `Contact já tem student vinculado: ${contact.studentUid}`
    );
  }

  // 1. Criar Auth user (ou reusar se já existe)
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: contact.email,
      displayName: contact.nome,
      disabled: false,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError(
        'already-exists',
        `Email ${contact.email} já cadastrado no Auth (sem vínculo com este contact). Resolva manualmente.`
      );
    }
    throw new functions.https.HttpsError('internal', err.message);
  }

  const uid = userRecord.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 2. Criar students/{uid}
  await db.collection('students').doc(uid).set({
    uid,
    email: contact.email,
    name: contact.nome,
    status: 'active',
    contactId,
    createdAt: now,
    createdBy: context.auth.token.email,
    firstLoginAt: null,
  });

  // 3. Atualizar contacts/{id}
  await contactRef.update({
    status: 'alpha',
    studentUid: uid,
    subscription: {
      ...contact.subscription,
      type: 'alpha',
      since: contact.subscription?.since ?? now,
      endsAt: contact.subscription?.endsAt ?? null,
      isVIP: contact.subscription?.isVIP ?? false,
      notes: contact.subscription?.notes ?? null,
    },
    updatedAt: now,
    updatedBy: { uid: context.auth.uid, email: context.auth.token.email },
  });

  // 4. Reset link + email de boas-vindas
  let resetLink = null;
  try {
    resetLink = await admin.auth().generatePasswordResetLink(contact.email);
    await db.collection('mail').add({
      to: contact.email,
      message: {
        subject: `Bem-vindo ao ${APP_NAME} — Configure sua senha`,
        html: getWelcomeEmailHtml(contact.nome, resetLink),
      },
    });
  } catch (err) {
    console.warn('[assignAlphaSubscription] Falha em welcome email (non-fatal):', err.message);
  }

  return { success: true, uid, resetLink };
});
