/**
 * generateWeeklySwot.js — Cloud Function callable
 *
 * Gera SWOT (Sonnet 4.6) a partir do frozenSnapshot da revisão.
 *
 * Input:  { studentId, reviewId }
 * Output: { swot: {strengths, weaknesses, opportunities, threats, ...meta}, aiUnavailable }
 *
 * Fluxo:
 *   1. Auth + validação input + mentor-only
 *   2. Load review doc; valida status != ARCHIVED
 *   3. Load review anterior (mesmo student, mesmo plano, weekStart < current) p/ comparação
 *   4. Chamar Claude com retry (até 3 tentativas, incluindo erro anterior no prompt)
 *   5. Se 3 tentativas falharem → fallback determinístico com aiUnavailable=true
 *   6. Persistir review.swot (sobrescreve — A6) + incrementar generationCount
 *   7. Retornar {swot, aiUnavailable}
 *
 * @version 1.0 — issue #102
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default;

const {
  MODEL, MAX_TOKENS, TEMPERATURE, PROMPT_VERSION,
  SYSTEM_PROMPT, buildUserPrompt, parseAndValidateSwot, buildFallbackSwot,
} = require('./prompt');

const { isMentor } = require('./validators');

const MAX_VALIDATION_RETRIES = 3;

const client = new Anthropic();

const callClaudeWithRetry = async ({ currentSnapshot, previousSnapshot, periodLabel }) => {
  let lastError = null;
  const errorsAccum = [];
  for (let attempt = 1; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const userPrompt = buildUserPrompt({ currentSnapshot, previousSnapshot, periodLabel })
      + (errorsAccum.length > 0 ? `\n\nTENTATIVAS ANTERIORES FALHARAM POR:\n- ${errorsAccum.join('\n- ')}` : '');
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = response?.content?.[0]?.text || '';
      const swot = parseAndValidateSwot(text);
      return { swot, attempt };
    } catch (e) {
      lastError = e;
      errorsAccum.push(`(tentativa ${attempt}) ${e.message}`);
      console.warn(`[generateWeeklySwot] attempt ${attempt} failed:`, e.message);
    }
  }
  throw lastError || new Error('Falha após todas as tentativas');
};

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 300, secrets: ['ANTHROPIC_API_KEY'] },
  async (request) => {
    const t0 = Date.now();
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode gerar SWOT');
    }

    const { studentId, reviewId } = request.data || {};
    if (!studentId || typeof studentId !== 'string') {
      throw new HttpsError('invalid-argument', 'studentId é obrigatório');
    }
    if (!reviewId || typeof reviewId !== 'string') {
      throw new HttpsError('invalid-argument', 'reviewId é obrigatório');
    }

    const db = admin.firestore();
    const reviewRef = db.collection('students').doc(studentId)
      .collection('reviews').doc(reviewId);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      throw new HttpsError('not-found', 'Review não encontrada');
    }
    const review = reviewSnap.data();
    if (review.status === 'ARCHIVED') {
      throw new HttpsError('failed-precondition', 'Review arquivada não pode receber novo SWOT');
    }
    if (!review.frozenSnapshot) {
      throw new HttpsError('failed-precondition', 'Review sem frozenSnapshot — não é possível gerar SWOT');
    }

    const planId = review.frozenSnapshot?.planContext?.planId;

    // Busca revisão anterior do mesmo plano para comparação
    let previousSnapshot = null;
    if (planId) {
      const prevQuery = await db.collection('students').doc(studentId)
        .collection('reviews')
        .where('weekStart', '<', review.weekStart)
        .orderBy('weekStart', 'desc')
        .limit(5)
        .get();
      const previousForPlan = prevQuery.docs
        .map(d => d.data())
        .find(r => r.frozenSnapshot?.planContext?.planId === planId);
      if (previousForPlan?.frozenSnapshot) {
        previousSnapshot = previousForPlan.frozenSnapshot;
      }
    }

    const periodLabel = review.customPeriod
      ? `${review.customPeriod.start} → ${review.customPeriod.end} (custom)`
      : `${review.weekStart} → ${review.weekEnd} (${review.periodKey})`;

    const prevGenerationCount = Number(review.swot?.generationCount) || 0;
    let swotPayload;
    let aiUnavailable = false;

    try {
      const { swot } = await callClaudeWithRetry({
        currentSnapshot: review.frozenSnapshot,
        previousSnapshot,
        periodLabel,
      });
      swotPayload = {
        ...swot,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion: MODEL,
        promptVersion: PROMPT_VERSION,
        aiUnavailable: false,
        generationCount: prevGenerationCount + 1,
      };
    } catch (e) {
      console.warn('[generateWeeklySwot] Fallback determinístico:', e.message);
      const fallback = buildFallbackSwot(review.frozenSnapshot);
      swotPayload = {
        ...fallback,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion: MODEL,
        promptVersion: PROMPT_VERSION,
        aiUnavailable: true,
        generationCount: prevGenerationCount + 1,
      };
      aiUnavailable = true;
    }

    await reviewRef.update({ swot: swotPayload });
    console.log(`[generateWeeklySwot] ${reviewId} swot updated in ${Date.now() - t0}ms (aiUnavailable=${aiUnavailable})`);

    return { swot: swotPayload, aiUnavailable };
  }
);
