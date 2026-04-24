/**
 * classifyMaturityProgression.js — Cloud Function (callable)
 *
 * Classifica a progressão de maturidade de um aluno via API Claude Sonnet 4.6
 * após trigger de UP ou REGRESSION detectado pelo motor (§3.1 D12).
 *
 * Input:   { studentId, currentStage, baselineStage, scores, baselineScores,
 *            gates, tradesSummary, trigger }
 * Output:  { narrative, patternsDetected, nextStageGuidance, confidence, error }
 *
 * Modelo:  claude-sonnet-4-6
 * Trigger: invocado pelo frontend quando proposedTransition.proposed === 'UP'
 *          OU signalRegression.detected === true (gating na UI — D2/task 14).
 *
 * Cache:   resultado é persistido em students/{uid}/maturity/current
 *          (aiNarrative, aiPatternsDetected, aiNextStageGuidance,
 *           aiGeneratedAt, aiTrigger) — invalidação implícita no próximo trigger.
 *
 * Fallback: em falha de API, retorna { narrative: null, patternsDetected: [],
 *          nextStageGuidance: null, confidence: 'LOW', error: <msg> }
 *          e grava aiGeneratedAt/aiTrigger mas NÃO grava aiNarrative.
 *
 * @version 1.0.0 — issue #119 task 13
 */

// Lazy + fallback: permite testes rodarem sem firebase-functions instalado
// (a dep vive em functions/package.json, não no root). Em produção, a dep existe
// e onCall/HttpsError reais são usados.
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

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;

// Lazy require: mantém o módulo importável em testes sem `firebase-admin`
// e `@anthropic-ai/sdk` instalados localmente (seguem instalados em functions/).
function loadAnthropicClient() {
  const Anthropic = require('@anthropic-ai/sdk').default;
  return new Anthropic();
}
function loadAdmin() {
  return require('firebase-admin');
}

const STAGE_NAMES = {
  1: 'CHAOS',
  2: 'REACTIVE',
  3: 'METHODICAL',
  4: 'PROFESSIONAL',
  5: 'MASTERY',
};

function validateInput(data) {
  const errors = [];
  if (!data?.studentId || typeof data.studentId !== 'string') errors.push('studentId missing');
  if (!Number.isInteger(data?.currentStage) || data.currentStage < 1 || data.currentStage > 5) {
    errors.push('currentStage must be integer 1..5');
  }
  if (!Number.isInteger(data?.baselineStage) || data.baselineStage < 1 || data.baselineStage > 5) {
    errors.push('baselineStage must be integer 1..5');
  }
  if (!data?.scores || typeof data.scores !== 'object') errors.push('scores missing');
  if (!Array.isArray(data?.gates)) errors.push('gates must be array');
  if (!data?.tradesSummary || typeof data.tradesSummary !== 'object') errors.push('tradesSummary missing');
  // ONBOARDING_INITIAL adicionado em #119 task 22 (DEC-AUTO-119-16) — marco zero
  // pós-assessment. Cache policy em src/utils/maturityAITrigger.js permanece
  // inalterada: currentTrigger NUNCA retorna 'ONBOARDING_INITIAL', então
  // shouldGenerateAI segue comparando apenas UP/REGRESSION.
  if (!['UP', 'REGRESSION', 'ONBOARDING_INITIAL'].includes(data?.trigger)) {
    errors.push("trigger must be 'UP', 'REGRESSION' or 'ONBOARDING_INITIAL'");
  }
  return errors;
}

function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  return Number(value).toFixed(digits);
}

function buildPrompt(input) {
  const currentStageName = STAGE_NAMES[input.currentStage];
  const nextStageIdx = Math.min(input.currentStage + 1, 5);
  const nextStageName = STAGE_NAMES[nextStageIdx];

  const gatesMet = input.gates.filter((g) => g.met === true);
  const gatesPending = input.gates.filter((g) => g.met !== true);

  let triggerDescription;
  if (input.trigger === 'UP') {
    triggerDescription = `todos os gates para ${nextStageName} foram conquistados`;
  } else if (input.trigger === 'REGRESSION') {
    triggerDescription = 'métricas recentes sugerem regressão';
  } else {
    // ONBOARDING_INITIAL — marco zero do assessment 4D, ainda sem trades
    triggerDescription = `diagnóstico inicial concluído em ${currentStageName} — primeira leitura do aluno`;
  }

  const scores = input.scores ?? {};
  const baselineScores = input.baselineScores ?? {};
  const summary = input.tradesSummary ?? {};

  const journalPct = summary.journalRate != null
    ? fmt(Number(summary.journalRate) * 100, 1)
    : 'n/a';

  return `Você é um mentor comportamental para traders analisando a evolução de maturidade 4D × 5 stages.

# CONTEXTO DO ALUNO

- **Stage atual:** ${input.currentStage} (${currentStageName})
- **Stage de baseline (diagnóstico inicial):** ${input.baselineStage}
- **Trigger desta análise:** ${input.trigger} (${triggerDescription})

## Scores 4D atuais (0-100)
- Emocional: ${fmt(scores.emotional)}
- Financial: ${fmt(scores.financial)}
- Operacional: ${fmt(scores.operational)}
- Maturidade: ${fmt(scores.maturity)}
- Composite: ${fmt(scores.composite)}

## Scores de baseline (para contexto de evolução)
- Emocional: ${fmt(baselineScores.emotional)}
- Financial: ${fmt(baselineScores.financial)}
- Operacional: ${fmt(baselineScores.operational)}

## Gates conquistados (${gatesMet.length}/${input.gates.length})
${gatesMet.map((g) => `- ${g.label} (${g.value ?? 'n/a'})`).join('\n') || '- (nenhum)'}

## Gates pendentes
${gatesPending.map((g) => `- ${g.label} (você: ${g.value ?? 'n/a'}, threshold: ${g.threshold ?? 'n/a'})`).join('\n') || '- (nenhum)'}

## Resumo de trades (janela analisada)
- Trades: ${summary.windowSize ?? 'n/a'}
- Win rate: ${fmt(summary.winRate)}%
- Payoff: ${fmt(summary.payoff, 2)}
- Expectancy: ${fmt(summary.expectancy, 4)}
- Max DD: ${fmt(summary.maxDDPercent)}%
- Duração média: ${summary.avgDuration ?? 'n/a'}
- Tilts: ${summary.tiltCount ?? 0}
- Revenge trades: ${summary.revengeCount ?? 0}
- Compliance rate: ${fmt(summary.complianceRate)}%
- Journal rate: ${journalPct}%

# TAREFA

Tom "espelho": transparência total. Reconhece conquistas reais sem alimentar overconfidence; sinaliza regressões sem catastrofizar. Linguagem direta, sem jargão motivacional. Conecta números concretos dos scores/trades ao comportamento.

Gere um relatório em markdown com EXATAMENTE esta estrutura JSON como output:

\`\`\`json
{
  "narrative": "<markdown 150-250 palavras sobre a leitura atual. Para UP: celebra com precisão, aponta qual área consolidou mais. Para REGRESSION: identifica qual padrão emocional/operacional voltou a aparecer. Para ONBOARDING_INITIAL: apresenta o stage diagnosticado, destaca forças do baseline 4D e o gap principal a trabalhar — sem celebrar nem alarmar.>",
  "patternsDetected": ["<padrão 1 observado nos números — bullet conciso 10-20 palavras>", "<padrão 2>", "<até 5 bullets, mínimo 1>"],
  "nextStageGuidance": "<markdown 80-150 palavras com orientação prática. Para UP: o que focar no próximo stage. Para REGRESSION: ação específica para estabilizar. Para ONBOARDING_INITIAL: o que priorizar nas primeiras semanas de operação para consolidar o stage atual.>",
  "confidence": "HIGH|MED|LOW"
}
\`\`\`

Responda APENAS o JSON válido, sem comentário adicional ou formatação extra.`;
}

async function callClaude(prompt, clientOverride) {
  const client = clientOverride ?? loadAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude output missing JSON block');

  const parsed = JSON.parse(match[0]);
  if (typeof parsed.narrative !== 'string' || parsed.narrative.length < 50) {
    throw new Error('narrative missing or too short');
  }
  if (!Array.isArray(parsed.patternsDetected) || parsed.patternsDetected.length === 0) {
    throw new Error('patternsDetected missing or empty');
  }
  if (typeof parsed.nextStageGuidance !== 'string' || parsed.nextStageGuidance.length < 30) {
    throw new Error('nextStageGuidance missing or too short');
  }
  if (!['HIGH', 'MED', 'LOW'].includes(parsed.confidence)) {
    parsed.confidence = 'MED';
  }

  return {
    narrative: parsed.narrative,
    patternsDetected: parsed.patternsDetected,
    nextStageGuidance: parsed.nextStageGuidance,
    confidence: parsed.confidence,
  };
}

async function runClassify(request, { adminOverride, clientOverride } = {}) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Auth required');
  }

  const errors = validateInput(request.data);
  if (errors.length > 0) {
    throw new HttpsError('invalid-argument', errors.join('; '));
  }

  const { studentId, trigger } = request.data;
  const prompt = buildPrompt(request.data);

  let result;
  let errorMsg = null;

  try {
    result = await callClaude(prompt, clientOverride);
  } catch (err) {
    console.error('[classifyMaturityProgression] API or parse error:', err);
    errorMsg = err.message;
    result = {
      narrative: null,
      patternsDetected: [],
      nextStageGuidance: null,
      confidence: 'LOW',
    };
  }

  try {
    const admin = adminOverride ?? loadAdmin();
    const currentRef = admin.firestore()
      .collection('students').doc(studentId)
      .collection('maturity').doc('current');
    await currentRef.set(
      {
        aiNarrative: result.narrative,
        aiPatternsDetected: result.patternsDetected,
        aiNextStageGuidance: result.nextStageGuidance,
        aiGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiTrigger: trigger,
      },
      { merge: true }
    );
  } catch (writeErr) {
    console.error('[classifyMaturityProgression] firestore write error:', writeErr);
  }

  return { ...result, error: errorMsg };
}

const handler = (request) => runClassify(request);

const wrapped = onCall({ maxInstances: 10, secrets: ['ANTHROPIC_API_KEY'] }, handler);
wrapped._handler = handler;
wrapped._runClassify = runClassify;

module.exports = wrapped;
