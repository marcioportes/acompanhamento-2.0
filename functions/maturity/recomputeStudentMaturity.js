/**
 * recomputeStudentMaturity.js — Cloud Function (callable)
 *
 * Dispara recálculo single-point do motor de maturidade de um aluno sob demanda,
 * sem depender de um trade novo. Reusa `recomputeForStudent(db, studentId)`.
 *
 * Input:   { studentId: string }
 * Output:  { success: true, stageCurrent, gatesMet, gatesTotal, timestamp }
 *       | { throttled: true, nextAllowedAt }
 *
 * Auth:
 *  - Aluno só pode recalcular a si mesmo (auth.uid === studentId)
 *  - Mentor (isMentorEmail) pode recalcular qualquer aluno
 *
 * Rate limit: 1×/hora por (studentId, callerUid). Timestamp persistido em
 *  `students/{studentId}/maturity/_rateLimit.calls[<callerUid>]`.
 *  Re-chamada dentro da janela retorna `{ throttled: true }` sem throw.
 *
 * Isolamento (INV-03): erros internos viram HttpsError com code apropriado.
 *
 * Issue #119 task 20 (H1).
 */

// Lazy + fallback (mesmo padrão de classifyMaturityProgression.js):
// permite testes rodarem sem firebase-functions instalado no root.
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

const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora

function loadAdmin() {
  return require('firebase-admin');
}

function loadRecomputeForStudent() {
  return require('./recomputeMaturity').recomputeForStudent;
}

/**
 * Converte Timestamp do Firestore (ou Date) para milliseconds.
 * Retorna null se entrada inválida.
 */
function tsToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value._seconds === 'number') {
    return value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1e6);
  }
  return null;
}

async function runRecompute(request, overrides = {}) {
  const { adminOverride, recomputeOverride } = overrides;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Auth required');
  }

  const studentId = request.data?.studentId;
  if (!studentId || typeof studentId !== 'string') {
    throw new HttpsError('invalid-argument', 'studentId missing');
  }

  const callerUid = request.auth.uid;
  const callerEmail = request.auth.token?.email ?? null;
  const callerIsMentor = isMentorEmail(callerEmail);

  if (!callerIsMentor && callerUid !== studentId) {
    throw new HttpsError('permission-denied', 'Student can only recompute itself');
  }

  const admin = adminOverride ?? loadAdmin();
  const db = admin.firestore();

  // --- Rate limit check (per callerUid) ---
  const rateRef = db
    .collection('students').doc(studentId)
    .collection('maturity').doc('_rateLimit');

  let rateDoc;
  try {
    rateDoc = await rateRef.get();
  } catch (err) {
    console.error('[recomputeStudentMaturity] rate-limit read error:', err);
    throw new HttpsError('internal', 'Failed to read rate limit state');
  }

  const now = Date.now();
  const rateData = rateDoc.exists ? (rateDoc.data() ?? {}) : {};
  const calls = rateData.calls ?? {};
  const lastMs = tsToMillis(calls[callerUid]);

  if (lastMs != null && now - lastMs < RATE_LIMIT_MS) {
    const nextAllowedAt = admin.firestore.Timestamp.fromMillis(lastMs + RATE_LIMIT_MS);
    return { throttled: true, nextAllowedAt };
  }

  // --- Invoke engine ---
  const recomputeForStudent = recomputeOverride ?? loadRecomputeForStudent();
  let engineResult;
  try {
    engineResult = await recomputeForStudent(db, studentId, { admin });
  } catch (err) {
    console.error('[recomputeStudentMaturity] engine exception:', err);
    throw new HttpsError('internal', err.message);
  }

  if (engineResult?.skipped) {
    console.warn('[recomputeStudentMaturity] engine skipped:', engineResult);
    throw new HttpsError('internal', `engine skipped: ${engineResult.reason ?? 'unknown'}`);
  }

  // --- Persist rate-limit stamp (per callerUid) ---
  try {
    await rateRef.set(
      {
        calls: { [callerUid]: admin.firestore.FieldValue.serverTimestamp() },
        lastRecomputeAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Não falha a operação — o recompute já foi aplicado. Só loga.
    console.error('[recomputeStudentMaturity] rate-limit write error:', err);
  }

  // --- Read fresh snapshot para devolver stageCurrent/gates/timestamp ---
  let currentDoc = null;
  try {
    const currentSnap = await db
      .collection('students').doc(studentId)
      .collection('maturity').doc('current')
      .get();
    if (currentSnap.exists) currentDoc = currentSnap.data();
  } catch (err) {
    console.error('[recomputeStudentMaturity] current snapshot read error:', err);
  }

  return {
    success: true,
    stageCurrent: currentDoc?.currentStage ?? engineResult?.currentStage ?? null,
    gatesMet: currentDoc?.gatesMet ?? null,
    gatesTotal: currentDoc?.gatesTotal ?? null,
    timestamp: currentDoc?.computedAt ?? null,
  };
}

const handler = (request) => runRecompute(request);

const wrapped = onCall({ maxInstances: 10 }, handler);
wrapped._handler = handler;
wrapped._runRecompute = runRecompute;
wrapped._isMentorEmail = isMentorEmail;
wrapped._RATE_LIMIT_MS = RATE_LIMIT_MS;

module.exports = wrapped;
