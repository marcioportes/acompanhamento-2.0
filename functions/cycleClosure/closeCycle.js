/**
 * closeCycle.js — Cloud Function callable
 *
 * Cria documento imutável em `cycleClosures/{closureId}` com snapshot completo do
 * ritual de fechamento (10 seções A-J). Aplica plan adjustment (se houver) atomicamente.
 *
 * Permission: aluno (próprio ciclo) OU mentor (fecha pelo aluno em modo demonstração).
 * Idempotência: closureId determinístico = `${planId}_${cycleKey}`. Recriar = error.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Input (payload):
 *   {
 *     planId, studentId, accountId,
 *     cycleKey, cycleNumber, cycleStart, cycleEnd,
 *     closeMode: 'self' | 'demonstrated' | 'co_edited',
 *     snapshot, metrics, patterns, aar, maturity, swot, mentor, forward,
 *     notes?: string | null
 *   }
 *
 * Output:
 *   { closureId: string, success: true }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {
  isMentor,
  validateClosurePayload,
  validateRoleCloseMode,
  buildClosureId,
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

    const userEmail = request.auth.token.email;
    const userUid = request.auth.uid;
    const role = isMentor(userEmail) ? 'mentor' : 'student';

    // Validação estrutural do payload
    const payload = request.data || {};
    asHttpsValidator(validateClosurePayload)(payload);

    // Permission gate aluno OU mentor
    if (role === 'student' && userUid !== payload.studentId) {
      throw new HttpsError(
        'permission-denied',
        'Aluno só pode fechar o próprio ciclo',
      );
    }
    // role === 'mentor' não tem restrição adicional hoje (mentor único = Marcio).
    // Quando houver múltiplos mentores, validar `mentor.studentIds INCLUDES studentId`.

    // Validação role ↔ closeMode coerente
    asHttpsValidator(validateRoleCloseMode)(role, payload.closeMode);

    const closureId = asHttpsValidator(() => buildClosureId(payload.planId, payload.cycleKey))();
    const db = admin.firestore();
    const closureRef = db.collection('cycleClosures').doc(closureId);
    const planRef = db.collection('plans').doc(payload.planId);

    // Transação atomica: validar plano + verificar não-duplicação + persistir + atualizar plan
    try {
      const result = await db.runTransaction(async (tx) => {
        const planSnap = await tx.get(planRef);
        if (!planSnap.exists) {
          throw new HttpsError('not-found', `Plano ${payload.planId} não encontrado`);
        }
        const plan = planSnap.data();

        // Coerência studentId
        if (plan.studentId !== payload.studentId) {
          throw new HttpsError(
            'invalid-argument',
            `studentId do payload (${payload.studentId}) não bate com plan.studentId (${plan.studentId})`,
          );
        }

        const existingSnap = await tx.get(closureRef);
        if (existingSnap.exists) {
          throw new HttpsError(
            'already-exists',
            `Closure ${closureId} já existe — use reopenCycle se precisar editar`,
          );
        }

        // Build closure doc
        const now = admin.firestore.FieldValue.serverTimestamp();
        const closureDoc = {
          // Identidade
          planId: payload.planId,
          studentId: payload.studentId,
          accountId: payload.accountId || null,
          cycleKey: payload.cycleKey,
          cycleNumber: payload.cycleNumber,
          cycleStart: payload.cycleStart,
          cycleEnd: payload.cycleEnd,

          // Conteúdo (10 seções)
          snapshot: payload.snapshot,
          metrics: payload.metrics,
          patterns: payload.patterns,
          aar: payload.aar,
          maturity: payload.maturity,
          swot: payload.swot,
          mentor: payload.mentor,
          forward: payload.forward,
          notes: payload.notes ?? null,

          // Status + reopen
          status: 'CLOSED',
          originalSnapshot: null,
          reopenedAt: null,
          reopenedBy: null,
          reopenReason: null,

          // Auditoria
          closedAt: now,
          closedBy: { uid: userUid, email: userEmail, role },
          closeMode: payload.closeMode,
          movementId: null,                      // FK pra movements se result ≠ 0 (A-fase futura)
          schemaVersion: 2,
          createdAt: now,
        };

        tx.set(closureRef, closureDoc);

        // Plan update — hard seal range + cycle bookkeeping + plan adjustment (se houver)
        // sealedCycleRanges é fonte canônica de verdade pro hard seal (suporta reopen seletivo).
        // lastClosedCycleEnd é cache simples pra rules.firestore (defesa em profundidade).
        const sealedRange = {
          closureId,
          cycleStart: payload.cycleStart,
          cycleEnd: payload.cycleEnd,
        };
        const planUpdate = {
          sealedCycleRanges: admin.firestore.FieldValue.arrayUnion(sealedRange),
          lastClosedCycleEnd: payload.cycleEnd,    // cache otimista pra rules
          lastCycleClosureId: closureId,
          currentCycleNumber: payload.cycleNumber + 1,
          updatedAt: now,
        };

        const adj = payload.forward?.planAdjustment;
        if (adj?.changed) {
          if (typeof adj.newPl === 'number') planUpdate.pl = adj.newPl;
          if (typeof adj.newRiskPerOp === 'number') planUpdate.riskPerOperation = adj.newRiskPerOp;
          if (typeof adj.newRRTarget === 'number') planUpdate.rrTarget = adj.newRRTarget;
        }

        tx.update(planRef, planUpdate);

        return { closureId };
      });

      return { closureId: result.closureId, success: true };
    } catch (e) {
      // Re-throw HttpsError; convert outros pra internal
      if (e instanceof HttpsError) throw e;
      console.error('[closeCycle] erro inesperado:', e);
      throw new HttpsError('internal', `Erro ao fechar ciclo: ${e.message}`);
    }
  },
);
