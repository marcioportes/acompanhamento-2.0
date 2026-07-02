/**
 * openReview.js — revisão semanal "aberta" sob demanda (#269 v2).
 *
 * No modelo v2 a revisão semanal NÃO é criada por ação manual do mentor. Ela nasce
 * sozinha no PRIMEIRO feedback do mentor num trade do plano (transição OPEN→REVIEWED,
 * disparada pelo trigger onTradeUpdated) e vai acumulando os trades revisados até a
 * reunião, quando o mentor publica (publishReview).
 *
 * `getOrCreateOpenReview` é transacional no doc do PLANO e idempotente via o ponteiro
 * denormalizado `plan.activeDraftReviewId`: mesmo que N trades virem REVIEWED ao mesmo
 * tempo (feedback em massa → N triggers concorrentes), as transações no mesmo plano
 * serializam e criam UMA revisão só; as demais reusam o ponteiro.
 *
 * @version 2.0 — issue #269 v2
 */

const admin = require('firebase-admin');

/** Doc de uma revisão recém-aberta. period* ficam null (computados no publish a partir
 *  dos trades membros); weekStart/weekEnd recebem placeholder p/ ordenação das queries. */
function buildOpenReviewDoc(studentId, planId, todayISO) {
  return {
    studentId,
    planId,
    cycleKey: null,
    status: 'DRAFT',
    sequenceNumber: null,          // atribuído no publishReview
    periodStart: null,             // computado no publish (membros = trades WHERE reviewId==id)
    periodEnd: null,
    weekStart: todayISO,           // placeholder p/ ordenação; recomputado no publish
    weekEnd: todayISO,
    frozenSnapshot: null,          // congelado no publish
    swot: null,                    // gerado no publish
    source: 'backlog',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system:feedback',  // nasce do trigger de feedback, não de ação de UI
    closedAt: null,
    archivedAt: null,
    meetingLink: null,
    videoLink: null,
  };
}

/**
 * Retorna a revisão aberta do plano, criando-a se não houver.
 * @returns {Promise<{ reviewId: string, created: boolean }>}
 */
async function getOrCreateOpenReview(db, studentId, planId, todayISO) {
  const planRef = db.collection('plans').doc(planId);
  return db.runTransaction(async (tx) => {
    const planSnap = await tx.get(planRef);
    if (!planSnap.exists) throw new Error(`Plano ${planId} não encontrado`);
    const plan = planSnap.data();
    if (plan.studentId && plan.studentId !== studentId) {
      throw new Error(`Plano ${planId} não pertence ao aluno ${studentId}`);
    }
    if (plan.activeDraftReviewId) {
      return { reviewId: plan.activeDraftReviewId, created: false };
    }
    const reviewRef = db.collection('students').doc(studentId).collection('reviews').doc();
    tx.set(reviewRef, buildOpenReviewDoc(studentId, planId, todayISO));
    tx.update(planRef, { activeDraftReviewId: reviewRef.id });
    return { reviewId: reviewRef.id, created: true };
  });
}

/**
 * Carry-over best-effort: ao abrir a revisão do plano, replica os takeaways NÃO encerrados
 * (!done) da última revisão CLOSED/ARCHIVED do mesmo plano. Preserva a feature que no v1
 * vivia no cliente (createReviewDraft). Não-transacional, idempotente por novo reviewId.
 */
async function carryOverOpenTakeaways(db, studentId, planId, newReviewId) {
  const reviewsRef = db.collection('students').doc(studentId).collection('reviews');
  const snap = await reviewsRef.get();
  const prev = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.id !== newReviewId
      && (r.status === 'CLOSED' || r.status === 'ARCHIVED')
      && (r.planId === planId || r.frozenSnapshot?.planContext?.planId === planId))
    .sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')))[0];
  if (!prev) return 0;
  const openItems = (Array.isArray(prev.takeawayItems) ? prev.takeawayItems : []).filter((it) => !it.done);
  if (openItems.length === 0) return 0;
  const carried = openItems.map((it, i) => ({
    id: `carry-${newReviewId}-${i}`,
    text: it.text,
    done: false,
    createdAt: new Date().toISOString(),
    sourceTradeId: it.sourceTradeId || null,
    carriedOverFromReviewId: prev.id,
  }));
  await reviewsRef.doc(newReviewId).update({ takeawayItems: carried });
  return carried.length;
}

/**
 * Acrescenta (append) um ponto às Notas da Sessão (sessionNotes) de um rascunho — #325.
 * Transacional pra preservar notas concorrentes. Ponto pré-prefixado com dados do trade
 * pelo cliente. No-op se texto vazio.
 * @returns {Promise<boolean>} true se anexou.
 */
async function appendReviewSessionNote(db, studentId, reviewId, text) {
  const addition = (typeof text === 'string' ? text : '').trim();
  if (!addition) return false;
  const reviewRef = db.collection('students').doc(studentId).collection('reviews').doc(reviewId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(reviewRef);
    if (!snap.exists) throw new Error(`Revisão ${reviewId} não encontrada`);
    const current = typeof snap.data().sessionNotes === 'string' ? snap.data().sessionNotes : '';
    const next = current ? `${current}\n${addition}` : addition;
    tx.update(reviewRef, { sessionNotes: next });
  });
  return true;
}

module.exports = { getOrCreateOpenReview, buildOpenReviewDoc, carryOverOpenTakeaways, appendReviewSessionNote };
