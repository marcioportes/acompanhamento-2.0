/**
 * setMentorClosureComment.js — Cloud Function callable
 *
 * Mentor adiciona/atualiza `mentor.closingComment` em cycleClosures/{closureId}.
 * Permission: apenas mentor (isMentor email).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Input:
 *   { closureId: string, comment: string }
 *
 * Output:
 *   { closureId: string, success: true }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString } = require('./validators');

const MAX_COMMENT_CHARS = 2000;

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode adicionar comentário de fechamento');
    }

    const { closureId, comment } = request.data || {};
    if (!isNonEmptyString(closureId)) {
      throw new HttpsError('invalid-argument', 'closureId é obrigatório');
    }
    if (typeof comment !== 'string') {
      throw new HttpsError('invalid-argument', 'comment deve ser string (use string vazia pra remover)');
    }
    if (comment.length > MAX_COMMENT_CHARS) {
      throw new HttpsError('invalid-argument', `comment não pode passar de ${MAX_COMMENT_CHARS} chars`);
    }

    const db = admin.firestore();
    const ref = db.collection('cycleClosures').doc(closureId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', `Closure ${closureId} não encontrado`);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.update({
      'mentor.closingComment': comment.trim() || null,
      'mentor.closingCommentAt': now,
      'mentor.closingCommentBy': {
        uid: request.auth.uid,
        email: request.auth.token.email,
      },
    });

    return { closureId, success: true };
  },
);
