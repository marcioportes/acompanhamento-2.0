/**
 * analyzeProbingResponse.js — Cloud Function (callable)
 * 
 * Analisa uma resposta de sondagem adaptativa contra o flag original.
 * Determina se a resposta resolve, reforça ou é inconclusiva sobre a incongruência.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

const client = new Anthropic();

module.exports = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { probingId, probingText, triggeredByFlag, sourceQuestions, rubric, responseText, responseTime } = request.data;

  if (!probingId || !responseText || !rubric) {
    throw new HttpsError('invalid-argument', 'probingId, responseText e rubric são obrigatórios');
  }

  const systemPrompt = `Você é um avaliador comportamental de traders analisando respostas de sondagem adaptativa.

Contexto: O aluno respondeu um questionário de assessment 4D. O sistema detectou uma incongruência (flag) e gerou uma pergunta de sondagem para investigar. Agora você analisa a resposta do aluno a essa sondagem.

Sua análise deve determinar:
1. **flagResolution**: Se a resposta RESOLVE (aluno esclareceu satisfatoriamente), REFORÇA (confirma a incongruência), ou é INCONCLUSIVA
2. **finding**: O que a resposta revela sobre o comportamento real do aluno
3. **emotionalInsight**: Insight sobre o estado emocional/comportamental subjacente

Indicadores de resolução:
- Aluno admite e reflete honestamente → resolved
- Aluno racionaliza ("era diferente, eu sabia que ia voltar") → reinforced
- Aluno nega contradição → reinforced + flag DEFENSIVE adicional
- Resposta vaga ou evasiva → inconclusive

Responda APENAS com JSON válido, sem markdown, sem backticks:
{
  "finding": "<o que a resposta revela>",
  "flagResolution": "resolved" | "reinforced" | "inconclusive",
  "emotionalInsight": "<insight comportamental>",
  "confidence": <0.0-1.0>,
  "additionalFlags": ["<flag>"]
}`;

  const userPrompt = `## Flag investigado
Tipo: ${triggeredByFlag}
Perguntas fonte: ${(sourceQuestions || []).join(', ')}

## Pergunta de sondagem
"${probingText}"

## Rubrica
${rubric}

## Resposta do aluno
"${responseText}"

${responseTime ? `Tempo de resposta: ${responseTime} segundos` : ''}

Analise esta resposta conforme a rubrica.`;

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
      finding: parsed.finding || '',
      flagResolution: parsed.flagResolution || 'inconclusive',
      emotionalInsight: parsed.emotionalInsight || '',
      confidence: parsed.confidence || 0,
      additionalFlags: parsed.additionalFlags || [],
    };
  } catch (err) {
    console.error('analyzeProbingResponse error:', err);
    throw new HttpsError('internal', `Erro ao analisar resposta: ${err.message}`);
  }
});
