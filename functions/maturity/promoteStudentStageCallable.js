/**
 * promoteStudentStageCallable.js — Cloud Function (callable)
 *
 * #376 (23/08/2026). O ato de promover um aluno de estágio. Regra de Marcio:
 * *"avisa da promoção tanto para o aluno quanto para mim, e eu faço a promoção
 * avisando o aluno."* — o motor sinaliza, o mentor decide. Nada roda automático.
 *
 * Input:  { studentId: string }
 * Output: { success: true, fromStage, toStage } | HttpsError
 *
 * Auth: SOMENTE mentor. O aluno vê o aviso de que está pronto, mas não se promove.
 *
 * A prontidão é revalidada no servidor contra `maturity/current`, com a mesma regra
 * do front (`promotionReadiness`, espelhado): cliente não é autoridade. Se o aluno
 * deixou de estar pronto entre a tela e o clique, a chamada é recusada.
 *
 * Mesmo padrão de `recomputeStudentMaturity.js` (lazy require com fallback, para os
 * testes rodarem sem firebase-functions no root).
 */

const { onCall, HttpsError } = (() => {
  try {
    return require('firebase-functions/v2/https');
  } catch (_e) {
    class HttpsError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
      }
    }
    return { onCall: (_opts, fn) => fn, HttpsError };
  }
})();

const MENTOR_EMAILS = ['marcio.portes@me.com'];
const isMentorEmail = (email) => MENTOR_EMAILS.includes(email?.toLowerCase?.());

function loadAdmin() {
  return require('firebase-admin');
}

function loadPromote() {
  return require('./promoteStudentStage').promoteStudentStage;
}

async function runPromote(request, overrides = {}) {
  const { adminOverride, promoteOverride } = overrides;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Auth required');
  }

  const callerEmail = request.auth.token?.email ?? null;
  if (!isMentorEmail(callerEmail)) {
    throw new HttpsError('permission-denied', 'Apenas o mentor promove um aluno de estágio');
  }

  const studentId = request.data?.studentId;
  if (!studentId || typeof studentId !== 'string') {
    throw new HttpsError('invalid-argument', 'studentId missing');
  }

  const admin = adminOverride ?? loadAdmin();
  const db = admin.firestore();
  const promote = promoteOverride ?? loadPromote();

  const r = await promote(db, admin, { studentId, promotedByEmail: callerEmail });

  if (!r.ok) {
    // `failed-precondition` e não `internal`: não é erro do sistema, é o aluno não
    // estar (mais) pronto. A tela mostra o motivo em vez de "falha".
    throw new HttpsError('failed-precondition', r.reason ?? 'promoção não permitida');
  }

  return { success: true, fromStage: r.fromStage, toStage: r.toStage };
}

const handler = (request) => runPromote(request);

const wrapped = onCall({ maxInstances: 10 }, handler);
wrapped._handler = handler;
wrapped._runPromote = runPromote;
wrapped._isMentorEmail = isMentorEmail;

module.exports = wrapped;
