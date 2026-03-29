/**
 * generateAssessmentReport.js — Cloud Function (callable)
 * 
 * Processa todas as respostas (base + sondagem), executa cross-checks,
 * diagnostica stage (DEC-021), gera relatório completo pré-mentor.
 * 
 * Esta é a CF mais importante do assessment — orquestra tudo.
 * 
 * Input: { studentId, responses, incongruenceFlags, probingData, stagePayload }
 * Output: { scores, classifications, stageDigagnosis, reportSummary, developmentPriorities }
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

const client = new Anthropic();

module.exports = onCall({ maxInstances: 5, secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { stagePayload, scores, classifications, incongruenceFlags, probingData } = request.data;

  if (!stagePayload || !scores) {
    throw new HttpsError('invalid-argument', 'stagePayload e scores são obrigatórios');
  }

  // ── Stage Diagnosis (DEC-021) ───────────────────────────

  const evidence = stagePayload.evidence;
  const rubric = stagePayload.rubric;
  const instructions = stagePayload.instructions;

  const stageSystemPrompt = `Você é um avaliador de maturidade de traders usando o modelo Capability Maturity Model adaptado para trading. Você diagnostica o estágio de maturidade de um trader baseado em evidências do questionário e nos scores das outras dimensões.

Responda APENAS com JSON válido, sem markdown, sem backticks.`;

  const stageUserPrompt = `## Evidências das perguntas de experiência

### EXP-01 (Tempo de experiência): score=${evidence.timeline.score}, resposta="${evidence.timeline.selectedText}"
### EXP-02 (Mudanças de estratégia): score=${evidence.strategyStability.score}, resposta="${evidence.strategyStability.selectedText}"
### EXP-03 (Identificação de erros): score=${evidence.metacognition.score}, resposta="${evidence.metacognition.selectedText}"
### EXP-04 (Métricas acompanhadas): score=${evidence.analyticalSophistication.score}, resposta="${evidence.analyticalSophistication.selectedText}"
### EXP-05 (Evolução recente): aiScore=${evidence.evolutionAwareness.aiScore}
${evidence.evolutionAwareness.text ? `Texto: "${evidence.evolutionAwareness.text.substring(0, 500)}"` : ''}
### EXP-06 (Articulação de edge): aiScore=${evidence.edgeArticulation.aiScore}
${evidence.edgeArticulation.text ? `Texto: "${evidence.edgeArticulation.text.substring(0, 500)}"` : ''}

## Scores das outras dimensões (contexto)
- Emocional: ${stagePayload.context.emotionalScore} (${stagePayload.context.emotionalProfile})
- Financeiro: ${stagePayload.context.financialScore}
- Operacional: ${stagePayload.context.operationalScore}

## Rubrica dos 5 estágios
${Object.entries(rubric).map(([stage, data]) => `
### Stage ${stage}: ${data.label} (${data.typicalMonths})
Características: ${data.characteristics.join('; ')}
Indicadores: ${data.behavioralIndicators.join('; ')}
Métricas típicas: WR ${data.metrics.winRate}, Ratio ${data.metrics.avgRatio}, DD ${data.metrics.maxDrawdown}
`).join('')}

## Instruções
${instructions}`;

  // ── Report Generation ──────────────────────────────────

  const reportSystemPrompt = `Você é um mentor de trading comportamental gerando um relatório de assessment para o mentor revisar. O relatório deve ser conciso, acionável e focado em prioridades de desenvolvimento.

Responda APENAS com JSON válido, sem markdown, sem backticks:
{
  "profileName": "<nome descritivo do perfil, ex: 'Developing Day Trader'>",
  "reportSummary": "<2-3 parágrafos resumindo o perfil completo>",
  "developmentPriorities": [
    { "rank": 1, "priority": "<ação específica>", "dimension": "<dimensão>", "months": <prazo> }
  ],
  "mentorFocusAreas": ["<área1>", "<área2>"],
  "riskFlags": ["<risco1>"]
}`;

  const reportUserPrompt = `## Scores do Assessment
- Emocional: ${scores.emotional?.score} (${classifications?.emotional?.profile?.label})
  - Reconhecimento: ${scores.emotional?.recognition}
  - Regulação: ${scores.emotional?.regulation}
  - Locus: ${scores.emotional?.locus}
- Financeiro: ${scores.financial?.score} (${classifications?.financial?.status?.label})
  - Discipline: ${scores.financial?.discipline}
  - Loss Management: ${scores.financial?.loss_management}
  - Profit Taking: ${scores.financial?.profit_taking}
- Operacional: ${scores.operational?.score} (${classifications?.operational?.fit?.label})
  - Decision Mode: ${scores.operational?.decision_mode}
  - Timeframe: ${scores.operational?.timeframe}
  - Strategy Fit: ${scores.operational?.strategy_fit}
  - Tracking: ${scores.operational?.tracking}
  - Emotion Control: ${scores.operational?.emotion_control} (herdado)
- Composite: ${scores.composite}

## Flags de incongruência
${(incongruenceFlags || []).map((f) => `- ${f.type}: ${f.description} (delta: ${f.delta})`).join('\n') || 'Nenhuma'}

## Sondagem adaptativa
${probingData?.summary ? `Flags resolvidos: ${probingData.summary.flagsResolved}, Reforçados: ${probingData.summary.flagsReinforced}, Inconclusivos: ${probingData.summary.flagsInconclusive}` : 'Não realizada'}

Gere o relatório pré-mentor com prioridades de desenvolvimento (mínimo 1, máximo 3). Para alunos com scores baixos, as prioridades são ainda mais importantes.`;

  try {
    // Execute both prompts
    const [stageResponse, reportResponse] = await Promise.all([
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: stageSystemPrompt,
        messages: [{ role: 'user', content: stageUserPrompt }],
      }),
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: reportSystemPrompt,
        messages: [{ role: 'user', content: reportUserPrompt }],
      }),
    ]);

    // Parse stage diagnosis
    const stageText = stageResponse.content
      .filter((b) => b.type === 'text').map((b) => b.text).join('');
    const stageParsed = JSON.parse(stageText.replace(/```json|```/g, '').trim());

    // Parse report
    const reportText = reportResponse.content
      .filter((b) => b.type === 'text').map((b) => b.text).join('');
    const reportParsed = JSON.parse(reportText.replace(/```json|```/g, '').trim());

    return {
      stageDiagnosis: {
        stage: stageParsed.stage,
        confidence: stageParsed.confidence,
        justification: stageParsed.justification,
        keySignals: stageParsed.keySignals || [],
      },
      report: {
        profileName: reportParsed.profileName || '',
        reportSummary: reportParsed.reportSummary || '',
        developmentPriorities: reportParsed.developmentPriorities || [],
        mentorFocusAreas: reportParsed.mentorFocusAreas || [],
        riskFlags: reportParsed.riskFlags || [],
      },
      aiModelVersion: MODEL,
    };
  } catch (err) {
    console.error('generateAssessmentReport error:', err);
    throw new HttpsError('internal', `Erro ao gerar relatório: ${err.message}`);
  }
});
