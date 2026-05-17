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

    // Servidor decide closeMode a partir do role autenticado.
    // Cliente não precisa mandar; se mentor mandar 'co_edited', respeitamos como hint.
    payload.closeMode = role === 'student'
      ? 'self'
      : (payload.closeMode === 'co_edited' ? 'co_edited' : 'demonstrated');

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

        // Behavioral summary — derivado de patterns + forward.aiSuggestion.
        // Persistir aqui evita recálculo no front e dá ao inbox de mentor um campo
        // queryable pra priorizar items críticos (REGRA 0 do advisor).
        const counts = payload.patterns?.eventCounts || {};
        const breach = payload.snapshot?.stopBreach || {};
        const ai = payload.forward?.aiSuggestion || {};
        const isCritical = ai.triggeredRule === 'pause_restructure';
        const severity =
          isCritical ? 'critical' :
          (breach.severity && breach.severity !== 'clean') ? breach.severity :
          ((counts.tilt || 0) + (counts.revenge || 0) + (counts.stopTampering || 0)) > 0 ? 'minor' :
          'clean';

        // Denial flag (R2.B10) — aluno atribui resultado a sorte/mercado em ciclo
        // crítico apesar de erros internos detectados. Sinaliza ao mentor que vai
        // precisar fazer o diálogo de ancoragem em fatos no review.
        const detectedInternalErrors =
          (counts.tilt || 0) > 0 ||
          (counts.revenge || 0) > 0 ||
          (counts.stopTampering || 0) > 0 ||
          (breach.tradesAfterStop || 0) > 0;
        const attrs = Array.isArray(payload.aar?.whyDifference?.attributions)
          ? payload.aar.whyDifference.attributions
          : [];
        const onlyExternalAttribution =
          attrs.length > 0 &&
          !attrs.includes('error') &&
          (attrs.includes('luck') || attrs.includes('market'));
        const denialFlag = isCritical && detectedInternalErrors && onlyExternalAttribution;

        const behavioralSummary = {
          tilt: counts.tilt || 0,
          tiltDaysCount: counts.tiltDaysCount || 0,
          revenge: counts.revenge || 0,
          overtrading: counts.overtrading || 0,
          stopTampering: counts.stopTampering || 0,
          rapidReentry: counts.rapidReentry || 0,
          stopBreachIndex: breach.stopBreachIndex ?? -1,
          tradesAfterStop: breach.tradesAfterStop || 0,
          pnlAfterStop: breach.pnlAfterStop || 0,
          pnlPctOfStop: breach.pnlPctOfStop ?? null,
          cycleStopViolated: (breach.stopBreachIndex ?? -1) !== -1,
          critical: isCritical,
          notifyMentor: !!ai.notifyMentor,
          severity,
          triggeredRule: ai.triggeredRule || null,
          denialFlag,
        };

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
          behavioralSummary,

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
