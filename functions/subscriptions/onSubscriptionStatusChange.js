/**
 * onSubscriptionStatusChange — Cloud Function (onUpdate)
 *
 * @description Reage a mudanças de status em /students/{studentId}/subscriptions/{subId}.
 *
 *   Caso atual coberto (G3 #263 / DEC-AUTO-263-21):
 *   Sub volta de `overdue` pra `active`/`pending` (mentor registrou pagamento ou
 *   renovou) → se o student está com `loginBlocked=true` E `loginBlockedReason='auto'`,
 *   desbloqueia (loginBlocked=false, todos os campos auxiliares limpos, Auth.disabled=false).
 *
 *   Idempotência: bloqueio manual (`reason='manual'`) NÃO é tocado — mentor controla.
 *   Sem-Auth: try/catch em admin.auth().updateUser pra sobreviver a aluno sem Auth user
 *   (legacy auto-id ou cadastro inline sem ritual).
 *
 * Issue: #263
 * Path: students/{studentId}/subscriptions/{subId}
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const OVERDUE = 'overdue';
const ACTIVE_LIKE = new Set(['active', 'pending']);

module.exports = functions.firestore
  .document('students/{studentId}/subscriptions/{subId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const cameBackFromOverdue =
      before?.status === OVERDUE && ACTIVE_LIKE.has(after?.status);
    if (!cameBackFromOverdue) return null;

    const { studentId } = context.params;
    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) return null;

    const student = studentSnap.data();
    const isAutoBlocked =
      student.loginBlocked === true && student.loginBlockedReason === 'auto';
    if (!isAutoBlocked) return null;

    await studentRef.update({
      loginBlocked: false,
      loginBlockedAt: null,
      loginBlockedBy: null,
      loginBlockedReason: null,
    });

    try {
      await admin.auth().updateUser(studentId, { disabled: false });
      console.log(`[onSubscriptionStatusChange] Auto-unblock ${studentId} — sub voltou pra ${after.status}`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`[onSubscriptionStatusChange] Auth user ${studentId} não existe — student doc desbloqueado mesmo assim`);
      } else {
        console.error(`[onSubscriptionStatusChange] Falha ao reabilitar Auth ${studentId}:`, e);
      }
    }

    return null;
  });
