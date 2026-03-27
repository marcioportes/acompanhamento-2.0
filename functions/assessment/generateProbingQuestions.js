/**
 * generateProbingQuestions.js — Cloud Function (callable)
 * 
 * Gera 3-5 perguntas de sondagem adaptativa baseadas em:
 * - Incongruências inter-dimensionais (delta ≥ 30)
 * - Incongruências intra-dimensionais (delta ≥ 25)
 * - Hesitações suspeitas (responseTime < 5s)
 * - Gaming suspect
 * - Respostas abertas rasas (charCount < 80)
 * 
 * DEC-016: Sondagem é transparente, acontece pós-questionário/pré-mentor,
 * NÃO altera scores base.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

const client = new Anthropic();

module.exports = onCall({ maxInstances: 10, secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { triggers, responseTimeSummary, hasRealFlags, allResponses } = request.data;

  if (!triggers || triggers.length === 0) {
    throw new HttpsError('invalid-argument', 'triggers é obrigatório e não pode ser vazio');
  }

  // Build trigger descriptions for the prompt
  const triggerDescriptions = triggers.map((t, i) => {
    let desc = `${i + 1}. [${t.type}] (prioridade ${t.priority})`;
    if (t.delta) desc += ` — delta: ${t.delta}`;
    if (t.description) desc += `\n   ${t.description}`;
    if (t.suggestedInvestigation) desc += `\n   Sugestão: ${t.suggestedInvestigation}`;
    if (t.questionId) desc += `\n   Pergunta: ${t.questionId}`;
    if (t.responseTime != null) desc += ` (tempo: ${t.responseTime}s)`;
    if (t.charCount != null) desc += ` (chars: ${t.charCount})`;
    if (t.probingDirection) desc += `\n   Direção: ${t.probingDirection}`;
    return desc;
  }).join('\n\n');

  // Build response context
  const responseContext = (allResponses || [])
    .filter((r) => r.type === 'open' && r.text)
    .map((r) => `${r.questionId}: "${r.text.substring(0, 200)}${r.text.length > 200 ? '...' : ''}"`)
    .join('\n');

  const systemPrompt = `Você é um avaliador comportamental de traders gerando perguntas de sondagem adaptativa.

Contexto: O aluno completou um questionário de 34 perguntas (assessment 4D). O sistema detectou incongruências e sinais que precisam ser investigados. Você vai gerar perguntas abertas personalizadas para sondar esses pontos ENQUANTO o aluno ainda está no contexto emocional do questionário.

Princípios:
- Perguntas devem ser ABERTAS (exigem reflexão, não sim/não)
- Tom: curioso e respeitoso, nunca acusatório
- A mensagem ao aluno será: "Baseado nas suas respostas, gostaríamos de aprofundar alguns pontos."
- Cada pergunta investiga um flag/trigger específico
- A rubrica de cada pergunta deve guiar a análise posterior

${!hasRealFlags ? 'NOTA: Não foram detectadas incongruências significativas. Gere perguntas de aprofundamento sobre a dimensão emocional que revelem blind spots.' : ''}

Responda APENAS com JSON válido, sem markdown, sem backticks:
{
  "questions": [
    {
      "probingId": "PROBE-01",
      "triggeredByFlag": "<tipo do flag>",
      "sourceQuestions": ["<questionId1>", "<questionId2>"],
      "text": "<pergunta aberta contextualizada>",
      "rubric": "<o que a IA deve buscar na resposta>"
    }
  ]
}`;

  const userPrompt = `## Triggers identificados (gere 1 pergunta por trigger, máximo 5):

${triggerDescriptions}

${responseContext ? `## Respostas abertas do aluno (contexto):
${responseContext}` : ''}

${responseTimeSummary ? `## Tempo de resposta: média ${responseTimeSummary.avg}s, min ${responseTimeSummary.min}s, max ${responseTimeSummary.max}s` : ''}

Gere ${Math.min(triggers.length, 5)} perguntas de sondagem. Cada pergunta deve:
1. Ser contextualizada (referenciar o que o aluno disse, sem citar scores)
2. Buscar reconciliação honesta vs. racionalização
3. Ter rubrica clara para análise posterior
4. Exigir resposta reflexiva (mínimo 80 caracteres esperados)`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      questions: parsed.questions || [],
      aiModelVersion: MODEL,
    };
  } catch (err) {
    console.error('generateProbingQuestions error:', err);
    throw new HttpsError('internal', `Erro ao gerar perguntas de sondagem: ${err.message}`);
  }
});
