/**
 * classifyOpenResponse.js — Cloud Function (callable)
 *
 * Classifica uma resposta aberta do questionário via API Claude.
 * Prompt alinhado ao Trader Evolution Framework (trader_evolution_framework.md v1.0).
 *
 * Input:  { questionId, questionText, responseText, rubric, closedResponses, dimension, subDimension }
 * Output: { aiScore, aiClassification, aiJustification, aiFinding, aiFlags, aiConfidence }
 *
 * Modelo: claude-sonnet-4-20250514
 *
 * v1.1.0 — prompt reescrito com framework completo, âncoras numéricas por dimensão,
 *           constructos teóricos (Kahneman/Tversky, Prospect Theory, TPI), e output
 *           enriquecido com campo `finding` separado de `justification`.
 *
 * @version 1.1.0 — framework-aligned prompt (DEC-027)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1500;

const client = new Anthropic();

// ── Framework context por dimensão ───────────────────────────

const DIMENSION_CONTEXT = {
  emotional: `
DIMENSÃO EMOCIONAL — Sistema 1 vs Sistema 2 (Kahneman)
Você avalia a maturidade emocional de um trader usando o modelo de duas classificações:
- Reconhecimento (A/B/C): Rapidez e precisão com que o trader percebe e nomeia estados emocionais
  A (80-100): Percebe em <30s, nomeia com precisão, age deliberadamente
  B (55-79): Reconhece após minutos, linguagem emocional presente mas vaga
  C (<55): Reconhecimento tardio (horas), negação ou foco exclusivo no resultado/mercado
- Regulação (1/2/3): Capacidade de interromper comportamento prejudicial ao reconhecer o estado
  1 (80-100): Interrompe e aplica mecanismo de regulação deliberado
  2 (55-79): Reconhece mas precisa de regras externas como âncora
  3 (<55): Reconhece mas age de qualquer forma, ou nega mecanismos
- Locus de Controle (X/Y/Z): Internalização vs. externalização de responsabilidade
  X (80-100): "Eu decidi", "violei minha regra" — agência clara, zero externalização
  Y (55-79): Mix de responsabilidade pessoal e fatores externos
  Z (<55): "O mercado me pegou", "não tinha como prever" — externalização dominante

VIESES CRÍTICOS A DETECTAR:
- Loss Aversion (Kahneman/Tversky): Perda valorada 2x o ganho equivalente — manifesta como mover stops, segurar losers, catastrofização de perdas
- Narrative Override (System 1): Trader constrói justificativa elaborada e coerente para decisão emocional — aparece como análise técnica post-hoc que "explica" por que devia esperar
- Overconfidence Bias: "Sabia que estava certo" sem evidência objetiva — System 1 gerando certeza subjetiva sem calibração real
- Disposition Effect: Vendedor winners cedo, segura losers — medo de devolver lucro + esperança de reversão
`,

  financial: `
DIMENSÃO FINANCEIRA — Gestão de Risco (Prospect Theory + Behavioral Biases)
Você avalia a disciplina financeira usando o modelo de três classificações:
- Risk Discipline (Alpha/Beta/Gamma/Delta): Consistência na aplicação de regras de sizing e stop
  Alpha (90-100): Sistemático, documentado, zero violações identificáveis
  Beta (70-85): Sistemático com 1-2 violações isoladas; corrigidas rapidamente com mecanismo
  Gamma (50-65): Ad-hoc; violações frequentes mas com consciência do problema
  Delta (<50): Sem sistema visível; violações sistemáticas sem reconhecimento
- Loss Management (1/2/3/4): Como o trader gerencia drawdowns acumulados
  1 (85-100): Decisão deliberada de reduzir/parar; drawdown <10%; recuperação <2 semanas
  2 (70-80): Decisão presente mas parcialmente reativa; drawdown 10-15%
  3 (50-69): Drawdown 15-20%; parada acidental ou por esgotamento, não deliberada
  4 (<50): Drawdown >20%; escalada para recuperar (martingale); parada acidental
- Profit Taking (H/M/L): Relação com ganhos — greed control
  H (70-100): Avg winner / avg loser >2.0; target pré-definido por análise
  M (50-70): Ratio 1.5-2.0; mix de target e feeling
  L (<50): Ratio <1.5; vende winners cedo por medo de devolver

VIESES CRÍTICOS A DETECTAR:
- Martingale Behavior: Dobra posição após perda para "recuperar" — acelerador de ruin
- FOMO (Fear of Missing Out): Viola sizing para "não perder" oportunidade
- Revenge Trading: Entra maior após perda para compensar — emocional, não racional
- Sunk Cost Fallacy: "Já perdi, vou esperar voltar" — loss aversion manifesta
`,

  operational: `
DIMENSÃO OPERACIONAL — Modelo de Trading (TPI — Trader Personality Indicator)
Você avalia o fit operacional usando o modelo de quatro dimensões (TPI):
- Decision Mode (S/D/I): Como o trader toma decisões de entrada
  S — Systematic (75-100): Checklist objetivo, critérios pré-definidos, backtestado, rules-based
  D — Discretionary (60-75): Framework claro mas ajustado por contexto, flexível com limites
  I — Intuitive (<60): Baseado em feeling, reconhecimento de padrão sem critérios objetivos, muda frequentemente
- Timeframe Fit: Match entre timeframe operado e disponibilidade/perfil emocional
  Fit excelente (75-100): Timeframe alinhado com vida, horário, tolerância ao stress
  Fit parcial (50-74): Mismatch presente mas gerenciável
  Mismatch (<50): Timeframe incompatível com vida ou perfil emocional — fonte de stress e erro
- Strategy Consistency: Capacidade de manter estratégia sob adversidade temporária
  Consistente (75-100): Mantém ≥8 semanas sem mudança; ajusta baseado em dados, não em emoção
  Semi-consistente (50-74): Mantém mas com tentações de mudança; data-driven parcialmente
  Strategy-hopper (<50): Muda sob pressão emocional; confunde drawdown normal com estratégia quebrada

VIESES CRÍTICOS A DETECTAR:
- Hypothesis-chasing: Trader que acredita que a próxima estratégia vai resolver o problema estrutural
- Overfit: Backtesta excessivamente em histórico específico, falha em condições novas
- Timeframe mismatch: Day trading + emocional fragile = recipe para erros — source de stress que amplifica vieses
`,

  experience: `
DIMENSÃO EXPERIÊNCIA — Maturity Model (5 Estágios de Maturidade)
Você avalia o estágio de maturidade usando o Capability Maturity Model adaptado para trading:
- Stage 1 — CHAOS (<30): Sem estratégia definida; FOMO/feeling; journal inexistente; drawdown >20%; win rate <40%
- Stage 2 — REACTIVE (30-50): Embrião de sistema; regras soltas; journal básico; reconhece alguns padrões de erro; drawdown 12-18%
- Stage 3 — METHODICAL (50-75): Sistema definido e testado (6+ meses live); journal completo com emoções; identifica e evita 3+ padrões; drawdown 5-12%; win rate 50-60%
- Stage 4 — PROFESSIONAL (75-90): Sistema robusto multi-condição; métricas avançadas (MFE/MAE, Sharpe); emotion control; drawdown <5%; win rate 55-70%
- Stage 5 — MASTERY (90-100): Multi-estratégia; documenta pesquisa; zero incidentes emocionais; drawdown <3%; contribui conhecimento

GATE CRÍTICO — Stage 3: Win rate ≥45%, stop usage ≥90%, emotional score ≥55, compliance ≥80%, payoff ≥1.0, mesma estratégia 8+ semanas, journal ≥90% trades. Trader que não cumpre todos os gates está em Stage 2 independente do tempo de mercado.

INDICADORES DE STAGE NA LINGUAGEM:
- Stage 1: Não sabe por que ganha/perde; estratégia vaga; não identifica padrões próprios
- Stage 2: Identifica 1-2 padrões; reconhece erros depois; mudança mensal de estratégia
- Stage 3: 3+ padrões com triggers e mecanismos; dados guiam decisões; edge parcialmente articulado
- Stage 4: Edge quantificado; métricas avançadas; processo quase automático; escala com disciplina
`,
};

module.exports = onCall({ maxInstances: 10, secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { questionId, questionText, responseText, rubric, closedResponses, dimension, subDimension } = request.data;

  if (!questionId || !responseText || !rubric) {
    throw new HttpsError('invalid-argument', 'questionId, responseText e rubric são obrigatórios');
  }

  const dimContext = DIMENSION_CONTEXT[dimension] || '';

  // Build closed responses context with behavioral interpretation
  const closedContext = (closedResponses || [])
    .map((r) => `  ${r.questionId}: "${r.selectedText}" (score: ${r.score}/100)`)
    .join('\n');

  const systemPrompt = `Você é um avaliador comportamental especializado em psicologia de traders, usando o Four-D Trader Assessment Framework baseado em:
- Kahneman & Tversky (Prospect Theory, System 1/System 2)
- Behavioral Finance (Shefrin, Barberis & Thaler)
- Trader Personality Indicator — TPI (Decision Mode, Timeframe, Risk Attitude, Emotion Control)
- Capability Maturity Model adaptado para trading (5 stages: Chaos → Reactive → Methodical → Professional → Mastery)

Seu papel é classificar respostas abertas com rigor clínico, identificando:
1. O que o trader DIZ (narrativa declarada)
2. O que os dados e padrões de linguagem REVELAM (realidade comportamental)
3. A distância entre os dois (incongruência)

Você busca evidências de System 1 (narrativa coerente, post-hoc, emocional) vs System 2 (reflexão deliberada, questionamento próprio). Uma resposta elaborada e "lógica" pode ser System 1 — coerência narrativa não é evidência de qualidade de decisão.

Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional.

Formato obrigatório:
{
  "score": <número 0-100>,
  "classification": "<código específico conforme rubrica: A/B/C para reconhecimento, 1/2/3 para regulação, X/Y/Z para locus, S/D/I para decision mode, Alpha/Beta/Gamma/Delta para discipline, etc.>",
  "justification": "<1-2 frases explicando o score — linguagem operacional, sem jargão psicológico desnecessário>",
  "finding": "<observação clínica principal: o que esta resposta revela que o aluno talvez não perceba sobre si mesmo. Seja específico e cite trechos da resposta como evidência>",
  "flags": ["<flag1>", "<flag2>"],
  "confidence": <número 0.0-1.0>
}

FLAGS disponíveis: CLOSED_VS_OPEN, LOSS_AVERSION, NARRATIVE_OVERRIDE, OVERCONFIDENCE, DISPOSITION_EFFECT, REVENGE_TRADING, FOMO, MARTINGALE, EXTERNALIZATION, STRATEGY_HOPPING, GAMING_SUSPECT`;

  const userPrompt = `## Contexto da dimensão avaliada
${dimContext}

## Pergunta sendo avaliada
ID: ${questionId} | Sub-dimensão: ${subDimension}
Texto: "${questionText}"

## Rubrica específica desta pergunta (com âncoras de score)
${rubric}

## Resposta do aluno
"${responseText}"

${closedContext ? `## Respostas fechadas da mesma dimensão (para cross-check)
${closedContext}

Se houver incongruência entre o score declarado nas fechadas e o que a resposta aberta revela, inclua flag CLOSED_VS_OPEN e explique a discrepância no campo "finding".` : ''}

## Instrução de avaliação
1. Leia a resposta buscando evidências concretas (citações, padrões de linguagem, o que está AUSENTE na resposta)
2. Aplique as âncoras de score da rubrica — não invente classificações; use os códigos definidos
3. Identifique o gap entre o que o aluno diz e o que a resposta revela comportamentalmente
4. O campo "finding" deve ser a observação mais valiosa para o mentor — o que ele precisa investigar na entrevista`;

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
      aiScore: parsed.score,
      aiClassification: parsed.classification,
      aiJustification: parsed.justification,
      aiFinding: parsed.finding,      // campo novo — observação clínica principal
      aiFlags: parsed.flags || [],
      aiConfidence: parsed.confidence,
      aiModelVersion: MODEL,
    };
  } catch (err) {
    console.error('classifyOpenResponse error:', err);
    throw new HttpsError('internal', `Erro ao classificar resposta: ${err.message}`);
  }
});
