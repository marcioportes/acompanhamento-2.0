/**
 * classifyOpenResponse.js — Cloud Function (callable)
 * 
 * Classifica uma resposta aberta do questionário via API Claude.
 * 
 * Input: { questionId, questionText, responseText, rubric, closedResponses }
 * Output: { score, classification, justification, flags, confidence }
 * 
 * Modelo: claude-sonnet-4-20250514
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

const client = new Anthropic();

module.exports = onCall({ maxInstances: 10, secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  // Auth check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { questionId, questionText, responseText, rubric, closedResponses, dimension, subDimension } = request.data;

  if (!questionId || !responseText || !rubric) {
    throw new HttpsError('invalid-argument', 'questionId, responseText e rubric são obrigatórios');
  }

  // Build context from closed responses for cross-check
  const closedContext = (closedResponses || [])
    .map((r) => `${r.questionId}: "${r.selectedText}" (score: ${r.score})`)
    .join('\n');

  const systemPrompt = `Você é um avaliador comportamental de traders, especializado em análise psicológica e operacional de traders de varejo. Você avalia respostas abertas de um questionário de assessment 4D (Emocional, Financeiro, Operacional, Experiência).

Sua tarefa é classificar a resposta do aluno com rigor clínico, buscando sinais de:
- Honestidade vs. racionalização
- Internalização (agency) vs. externalização (culpa o mercado)
- Profundidade de auto-conhecimento vs. superficialidade
- Consistência com as respostas fechadas (cross-check)

Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional.

Formato:
{
  "score": <número 0-100>,
  "classification": "<código de classificação conforme rubrica>",
  "justification": "<1-2 frases explicando a classificação>",
  "flags": ["<flag1>", "<flag2>"],
  "confidence": <número 0.0-1.0>
}`;

  const userPrompt = `## Pergunta
ID: ${questionId}
Dimensão: ${dimension} / ${subDimension}
Texto: "${questionText}"

## Rubrica de avaliação
${rubric}

## Resposta do aluno
"${responseText}"

${closedContext ? `## Respostas fechadas da mesma dimensão (para cross-check)
${closedContext}` : ''}

Classifique esta resposta conforme a rubrica. Se houver incongruência entre a resposta aberta e as fechadas, inclua flag "CLOSED_VS_OPEN" no array de flags.`;

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

    // Parse JSON response
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      aiScore: parsed.score,
      aiClassification: parsed.classification,
      aiJustification: parsed.justification,
      aiFlags: parsed.flags || [],
      aiConfidence: parsed.confidence,
      aiModelVersion: MODEL,
    };
  } catch (err) {
    console.error('classifyOpenResponse error:', err);
    throw new HttpsError('internal', `Erro ao classificar resposta: ${err.message}`);
  }
});
