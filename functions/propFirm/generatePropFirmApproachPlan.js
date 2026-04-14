/**
 * generatePropFirmApproachPlan.js — Cloud Function callable
 *
 * Gera narrativa estratégica (Sonnet 4.6) em cima do plano determinístico já calculado
 * para contas prop firm. IA NÃO recalcula números — narra, contextualiza e gera guidance
 * comportamental. Valida coerência mecânica antes de persistir.
 *
 * Input:
 *   {
 *     accountId: string,             // obrigatório — conta prop do estudante
 *     context: {                      // contexto completo preparado pelo cliente
 *       firm: {...},                  // dados da mesa (template)
 *       instrument: {...},            // símbolo, ATR, nyRange, minViableStop
 *       plan: {...},                  // plano determinístico (READ-ONLY na CF)
 *       dataSource: '4d_full'|'indicators'|'defaults',
 *       traderProfile: {...}
 *     }
 *   }
 *
 * Output:
 *   {
 *     plan: { ... schema completo ... },
 *     aiUnavailable: boolean,         // true se fallback determinístico
 *     generationCount: number,        // aiGenerationCount após incremento
 *   }
 *
 * Fluxo:
 *   1. Auth + validação de input
 *   2. Se dataSource === 'defaults' → fallback direto, SEM chamar IA, SEM incrementar count
 *   3. Load account → checar rate limit (aiGenerationCount < MAX_GENERATIONS)
 *   4. Chamar Claude com retry (até 3 tentativas; nova tentativa inclui erros da anterior)
 *   5. Se 3 tentativas falharem validação → fallback determinístico com aiUnavailable: true
 *   6. Persistir account.propFirm.aiApproachPlan + incrementar aiGenerationCount
 *   7. Retornar plano
 *
 * @version 1.0
 * @since issue #133
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default;

const {
  MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildTraderProfileBlock,
} = require('./prompt');

const { validateAIPlan, buildFallbackPlan } = require('./validate');

const MAX_GENERATIONS = 5;
const MAX_VALIDATION_RETRIES = 3;

const client = new Anthropic();

module.exports = onCall(
  { maxInstances: 5, secrets: ['ANTHROPIC_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const { accountId, context } = request.data || {};
    if (!accountId || typeof accountId !== 'string') {
      throw new HttpsError('invalid-argument', 'accountId é obrigatório');
    }
    if (!context || !context.firm || !context.instrument || !context.plan) {
      throw new HttpsError('invalid-argument', 'context.firm, context.instrument e context.plan são obrigatórios');
    }
    const { firm, instrument, plan, dataSource = 'defaults', traderProfile = {} } = context;

    const db = admin.firestore();
    const accountRef = db.collection('accounts').doc(accountId);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      throw new HttpsError('not-found', `Account ${accountId} não encontrada`);
    }
    const account = accountSnap.data();

    // ── Cenário 'defaults': não chama IA, retorna determinístico ─
    if (dataSource === 'defaults') {
      const fallback = buildFallbackPlan({ plan, firm, instrument }, 'Dados insuficientes — assessment 4D não concluído.');
      return {
        plan: fallback,
        aiUnavailable: true,
        generationCount: account.propFirm?.aiGenerationCount || 0,
      };
    }

    // ── Rate limit ───────────────────────────────────────────────
    const currentCount = account.propFirm?.aiGenerationCount || 0;
    if (currentCount >= MAX_GENERATIONS) {
      throw new HttpsError(
        'resource-exhausted',
        `Limite de ${MAX_GENERATIONS} gerações de IA atingido. Solicite reset ao mentor.`
      );
    }

    // ── Chamada à IA com retry ───────────────────────────────────
    const traderProfileBlock = buildTraderProfileBlock(dataSource, traderProfile);
    const userPromptBase = buildUserPrompt({ firm, instrument, plan, dataSource, traderProfileBlock });

    const constraints = { plan, firm, instrument };
    let lastErrors = [];
    let aiPlan = null;

    for (let attempt = 1; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      let userPrompt = userPromptBase;
      if (attempt > 1 && lastErrors.length > 0) {
        userPrompt += `\n\n⚠️ TENTATIVA ${attempt}/${MAX_VALIDATION_RETRIES} — a resposta anterior falhou validação:\n${lastErrors.map((e) => `- ${e}`).join('\n')}\n\nCorrija esses problemas e retorne um JSON válido.`;
      }

      let response;
      try {
        response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });
      } catch (err) {
        console.error(`[generatePropFirmApproachPlan] API error (attempt ${attempt}):`, err.message);
        lastErrors = [`API error: ${err.message}`];
        continue;
      }

      const text = response?.content?.[0]?.text;
      if (!text) {
        lastErrors = ['Resposta da API sem conteúdo textual'];
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        lastErrors = [`JSON inválido: ${err.message}`];
        continue;
      }

      const validation = validateAIPlan(parsed, constraints);
      if (validation.valid) {
        aiPlan = parsed;
        break;
      }
      lastErrors = validation.errors;
      console.warn(`[generatePropFirmApproachPlan] Validação falhou (attempt ${attempt}):`, lastErrors);
    }

    // ── Fallback se todas as tentativas falharam ─────────────────
    const finalPlan = aiPlan || buildFallbackPlan(constraints, `Validação falhou após ${MAX_VALIDATION_RETRIES} tentativas: ${lastErrors.slice(0, 2).join('; ')}`);
    const aiUnavailable = !aiPlan;

    // Garantir metadata consistente no plano que sai
    finalPlan.metadata = {
      ...finalPlan.metadata,
      model: aiPlan ? MODEL : 'deterministic',
      promptVersion: PROMPT_VERSION,
      dataSource,
      generatedAt: new Date().toISOString(),
      aiUnavailable,
    };

    // ── Persistência ─────────────────────────────────────────────
    // Só incrementa aiGenerationCount se a IA foi chamada com sucesso.
    // Fallback determinístico por falha da IA não consome cota.
    const updatePayload = {
      'propFirm.aiApproachPlan': finalPlan,
    };
    if (aiPlan) {
      updatePayload['propFirm.aiGenerationCount'] = admin.firestore.FieldValue.increment(1);
    }
    await accountRef.update(updatePayload);

    const newCount = aiPlan ? currentCount + 1 : currentCount;

    return {
      plan: finalPlan,
      aiUnavailable,
      generationCount: newCount,
    };
  }
);
