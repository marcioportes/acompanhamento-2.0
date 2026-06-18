/**
 * createReviewDraft.js — Cloud Function callable (#269 Fase B)
 *
 * Cria um rascunho de Revisão por backlog e absorve em bulk todos os trades
 * disponíveis (`reviewState='NONE'`) DAQUELE PLANO — granularidade por plano
 * (decisão do gate 16/06): `planId` determina o aluno, preservando o invariante
 * single-currency (#289/#111). Substitui o fluxo de janela ISO do `createWeeklyReview`.
 *
 * Mantém o ponteiro denormalizado `plan.activeDraftReviewId` (D7): o
 * `tradeGateway.createTrade` lê esse ponteiro para nascer DRAFT enquanto o
 * rascunho está aberto. Unicidade por plano: se o ponteiro já aponta para um
 * rascunho, retorna o existente (idempotente) — mentor publica ou descarta antes
 * de abrir outro.
 *
 * Input:
 *   { studentId: string, planId: string, skipTradeIds?: string[] }
 *   skipTradeIds — trades que o mentor optou por NÃO incluir (ficam em NONE; D-UI).
 *
 * Output:
 *   { reviewId: string, draftedCount: number, existing: boolean }
 *
 * Transação atômica: dupe-check (ponteiro) + criação do review + bulk de
 * reviewState + escrita do ponteiro. Volume por plano (trades NONE desde a última
 * revisão) é pequeno; fica dentro do limite de escritas por transação do Firestore.
 *
 * @version 1.0 — issue #269
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor, isNonEmptyString, computePeriodBounds } = require('./validators');

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode criar rascunho de revisão');
    }

    const { studentId, planId } = request.data || {};
    if (!isNonEmptyString(studentId)) throw new HttpsError('invalid-argument', 'studentId é obrigatório');
    if (!isNonEmptyString(planId)) throw new HttpsError('invalid-argument', 'planId é obrigatório');
    const skipTradeIds = Array.isArray(request.data?.skipTradeIds) ? request.data.skipTradeIds : [];
    const cycleKey = isNonEmptyString(request.data?.cycleKey) ? request.data.cycleKey : null;

    const db = admin.firestore();
    const studentRef = db.collection('students').doc(studentId);
    const planRef = db.collection('plans').doc(planId);
    const reviewRef = studentRef.collection('reviews').doc(); // gera id antes da transação
    const todayISO = new Date().toISOString().slice(0, 10);

    const result = await db.runTransaction(async (tx) => {
      // ── reads (antes de qualquer write) ───────────────────────────
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new HttpsError('not-found', 'Plano não encontrado');
      const plan = planSnap.data();
      if (plan.studentId !== studentId) {
        throw new HttpsError('failed-precondition', 'Plano não pertence ao aluno informado');
      }

      // Unicidade por plano via ponteiro (D7): 1 rascunho por vez por plano.
      if (plan.activeDraftReviewId) {
        return { reviewId: plan.activeDraftReviewId, draftedCount: 0, existing: true };
      }

      // Backlog do plano: trades NONE. planId já escopa um único aluno/moeda.
      const pendingQ = db.collection('trades')
        .where('planId', '==', planId)
        .where('reviewState', '==', 'NONE');
      const pendingSnap = await tx.get(pendingQ);

      const skip = new Set(skipTradeIds);
      const drafted = pendingSnap.docs.filter((d) => !skip.has(d.id));
      const bounds = computePeriodBounds(drafted.map((d) => d.data().entryTime), todayISO);
      // Aliases legados weekStart/weekEnd (D2): muitas queries/ordenações da UI ainda
      // ordenam por weekStart — Firestore exclui docs sem o campo. Fallback p/ hoje
      // quando o backlog está vazio (periodStart null), garantindo presença/ordenação.
      const weekStart = bounds.periodStart || todayISO;
      const weekEnd = bounds.periodEnd || todayISO;

      // ── writes ────────────────────────────────────────────────────
      tx.set(reviewRef, {
        studentId,
        planId,
        cycleKey,
        status: 'DRAFT',
        sequenceNumber: null,          // atribuído no publishReview
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        weekStart,
        weekEnd,
        includedTradeIds: [],          // congelado no publish
        frozenSnapshot: null,          // construído no publish (Fase D)
        swot: null,                    // gerado no publish (Fase E)
        source: 'backlog',             // distingue do fluxo legado de janela ISO
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        closedAt: null,
        archivedAt: null,
        meetingLink: null,
        videoLink: null,
      });

      for (const d of drafted) {
        tx.update(d.ref, {
          reviewState: 'DRAFT',
          draftReviewId: reviewRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      tx.update(planRef, { activeDraftReviewId: reviewRef.id });

      return { reviewId: reviewRef.id, draftedCount: drafted.length, existing: false };
    });

    console.log(
      `[createReviewDraft] student ${studentId} plan ${planId} → review ${result.reviewId} `
      + `(${result.draftedCount} trades, existing=${result.existing})`
    );
    return result;
  }
);
