/**
 * reopenCycle.js — Cloud Function callable
 *
 * Reabre um cycleClosure CLOSED, copiando snapshot atual em `originalSnapshot`
 * (auditabilidade) e mudando status pra REOPENED. Aluno pode editar/re-fechar depois.
 *
 * Permission: aluno (próprio) OU mentor.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Input:
 *   { closureId: string, reopenReason: string }
 *
 * Output:
 *   { closureId: string, success: true }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString } = require('./validators');

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const userEmail = request.auth.token.email;
    const userUid = request.auth.uid;
    const role = isMentor(userEmail) ? 'mentor' : 'student';

    const { closureId } = request.data || {};

    if (!isNonEmptyString(closureId)) {
      throw new HttpsError('invalid-argument', 'closureId é obrigatório');
    }

    const db = admin.firestore();
    const closureRef = db.collection('cycleClosures').doc(closureId);

    try {
      await db.runTransaction(async (tx) => {
        const closureSnap = await tx.get(closureRef);
        if (!closureSnap.exists) {
          throw new HttpsError('not-found', `Closure ${closureId} não encontrado`);
        }
        const closure = closureSnap.data();

        // Permission: aluno só reabre o próprio
        if (role === 'student' && userUid !== closure.studentId) {
          throw new HttpsError(
            'permission-denied',
            'Aluno só pode reabrir o próprio ciclo',
          );
        }

        // Aceita CLOSED (caso normal) e REOPENED (cleanup de docs legados da versão
        // anterior que mantinha audit trail). Em ambos os casos, doc é deletado.

        // Plan deve existir (sanidade — closure aponta planId)
        const planRef = db.collection('plans').doc(closure.planId);
        const planSnap = await tx.get(planRef);
        if (!planSnap.exists) {
          throw new HttpsError('not-found', `Plano ${closure.planId} não encontrado`);
        }
        const plan = planSnap.data();

        const now = admin.firestore.FieldValue.serverTimestamp();

        // Reabrir = deletar o doc. Re-fechamento depois cria documento novo do zero.
        console.log('[reopenCycle]', {
          closureId,
          studentId: closure.studentId,
          reopenedBy: { uid: userUid, email: userEmail, role },
        });
        tx.delete(closureRef);

        // Plan: remove range do hard seal (libera writes naquela janela)
        // arrayRemove exige objeto idêntico — usamos os campos originais do closure.
        const sealedRange = {
          closureId,
          cycleStart: closure.cycleStart,
          cycleEnd: closure.cycleEnd,
        };
        const planUpdate = {
          sealedCycleRanges: admin.firestore.FieldValue.arrayRemove(sealedRange),
          updatedAt: now,
        };

        // Cache lastClosedCycleEnd: só recua se este era o último ciclo fechado.
        // Senão o ciclo seguinte (CLOSED) ainda guarda o cache.
        if (plan.lastClosedCycleEnd === closure.cycleEnd) {
          // Calcular maior cycleEnd dos ranges restantes (excluindo este)
          const remaining = (plan.sealedCycleRanges || [])
            .filter((r) => r && r.closureId !== closureId)
            .map((r) => r.cycleEnd)
            .sort();
          planUpdate.lastClosedCycleEnd = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }

        tx.update(planRef, planUpdate);
      });

      return { closureId, success: true };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('[reopenCycle] erro inesperado:', e);
      throw new HttpsError('internal', `Erro ao reabrir ciclo: ${e.message}`);
    }
  },
);
