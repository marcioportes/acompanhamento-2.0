/**
 * incongruenceDetector.js
 * 
 * Detecção de incongruências intra e inter-dimensionais.
 * 
 * Intra-dimensional: compara scores de fechadas vs abertas dentro da mesma dimensão.
 * Inter-dimensional: cruza respostas entre dimensões para detectar inflação (DEC-014).
 * Gaming detection: identifica padrão de respostas consistentemente "melhores".
 * 
 * Extensível: novos cross-checks podem ser adicionados como regras sem mudar o fluxo.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { getOptionScore, QUESTION_MAP, QUESTIONS_BY_DIMENSION } from './assessmentQuestions.js';

// ============================================================
// HELPERS
// ============================================================

function buildResponseMap(responses) {
  const map = {};
  for (const r of responses) {
    map[r.questionId] = r;
  }
  return map;
}

function extractScore(response) {
  if (!response) return null;
  if (response.type === 'closed') {
    return getOptionScore(response.questionId, response.selectedOption);
  }
  if (response.type === 'open') {
    return response.aiScore != null ? response.aiScore : null;
  }
  return null;
}

function safeAverage(values) {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Para uma pergunta fechada, retorna o score máximo possível.
 */
function getMaxScore(questionId) {
  const q = QUESTION_MAP[questionId];
  if (!q || q.type !== 'closed') return null;
  return Math.max(...q.options.map((o) => o.score));
}

// ============================================================
// INTRA-DIMENSIONAL: Fechadas vs Abertas
// ============================================================

/**
 * Detecta incongruências INTRA-dimensionais.
 * 
 * Para cada dimensão, compara a média de scores das fechadas
 * contra a média de aiScores das abertas.
 * Flag se delta >= threshold (default 25 pontos).
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @param {number} threshold - Delta mínimo para flaggear (default: 25)
 * @returns {Array<Object>} Flags de incongruência intra-dimensional
 */
export function detectIntraDimensionalFlags(responses, threshold = 25) {
  const rMap = buildResponseMap(responses);
  const flags = [];
  const dimensions = ['emotional', 'financial', 'operational', 'experience'];

  for (const dim of dimensions) {
    const questions = QUESTIONS_BY_DIMENSION[dim] || [];
    
    const closedScores = questions
      .filter((q) => q.type === 'closed' && rMap[q.id])
      .map((q) => extractScore(rMap[q.id]))
      .filter((s) => s != null);

    const openScores = questions
      .filter((q) => q.type === 'open' && rMap[q.id])
      .map((q) => extractScore(rMap[q.id]))
      .filter((s) => s != null);

    if (closedScores.length === 0 || openScores.length === 0) continue;

    const closedAvg = safeAverage(closedScores);
    const openAvg = safeAverage(openScores);

    if (closedAvg == null || openAvg == null) continue;

    const delta = closedAvg - openAvg;

    if (delta >= threshold) {
      flags.push({
        type: 'CLOSED_VS_OPEN',
        dimension: dim,
        closedScore: Math.round(closedAvg * 100) / 100,
        openScore: Math.round(openAvg * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        description: `Fechadas indicam score ${Math.round(closedAvg)} mas abertas revelam score ${Math.round(openAvg)} — possível inflação nas respostas fechadas`,
      });
    }
  }

  return flags;
}

// ============================================================
// INTER-DIMENSIONAL: Cross-checks entre dimensões (DEC-014)
// ============================================================

/**
 * Definição das 5 flags inter-dimensionais iniciais.
 * 
 * Cada regra cruza uma pergunta-fonte (tipicamente financeiro/operacional)
 * contra uma pergunta-alvo (tipicamente emocional).
 * Flag se source >= sourceThreshold E target <= targetThreshold.
 * 
 * Extensível: adicionar novas regras aqui.
 */
const INTER_DIMENSIONAL_RULES = [
  {
    type: 'STOP_CLAIM_VS_BEHAVIOR',
    sourceQuestion: 'FIN-03',
    sourceDimension: 'financial',
    sourceThreshold: 72,
    targetQuestion: 'EMO-07',
    targetDimension: 'emotional',
    targetThreshold: 40,
    description: 'Diz que usa stop mas admite mover/cancelar',
    suggestedInvestigation: 'Pergunte: "Me conte sobre a última vez que seu trade atingiu o stop. O que aconteceu exatamente?"',
  },
  {
    type: 'PROCESS_VS_IMPULSE',
    sourceQuestion: 'OPE-01',
    sourceDimension: 'operational',
    sourceThreshold: 72,
    targetQuestion: 'EMO-05',
    targetDimension: 'emotional',
    targetThreshold: 30,
    description: 'Diz ter processo sistemático mas age impulsivamente após perdas',
    suggestedInvestigation: 'Pergunte: "Descreva seu último trade logo após uma perda. Você seguiu o checklist?"',
  },
  {
    type: 'SIZING_VS_REVENGE',
    sourceQuestion: 'FIN-01',
    sourceDimension: 'financial',
    sourceThreshold: 72,
    targetQuestion: 'EMO-06',
    targetDimension: 'emotional',
    targetThreshold: 28,
    description: 'Diz ter sizing disciplinado mas escala após perdas',
    suggestedInvestigation: 'Pergunte: "Após 3 perdas seguidas, o tamanho do seu próximo trade muda? Se sim, para mais ou para menos?"',
  },
  {
    type: 'DISCIPLINE_VS_LOCUS',
    sourceQuestion: 'FIN-03',
    sourceDimension: 'financial',
    sourceThreshold: 72,
    targetQuestion: 'EMO-09',
    targetDimension: 'emotional',
    targetThreshold: 40,
    description: 'Diz ser disciplinado mas externaliza culpa',
    suggestedInvestigation: 'Pergunte: "Na sua última semana ruim, quais foram SEUS erros específicos?"',
  },
  {
    type: 'JOURNAL_VS_AWARENESS',
    sourceQuestion: 'OPE-04',
    sourceDimension: 'operational',
    sourceThreshold: 70,
    targetQuestion: 'EMO-03',
    targetDimension: 'emotional',
    targetThreshold: 30,
    description: 'Diz manter journal completo mas não identifica padrões próprios',
    suggestedInvestigation: 'Pergunte: "Revise seu journal da semana passada — que padrão de erro apareceu mais de uma vez?"',
  },
];

/**
 * Detecta incongruências INTER-dimensionais.
 * 
 * Para cada regra: verifica se source score >= sourceThreshold
 * E target score <= targetThreshold.
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @returns {Array<Object>} Flags de incongruência inter-dimensional
 */
export function detectInterDimensionalFlags(responses) {
  const rMap = buildResponseMap(responses);
  const flags = [];

  for (const rule of INTER_DIMENSIONAL_RULES) {
    const sourceResponse = rMap[rule.sourceQuestion];
    const targetResponse = rMap[rule.targetQuestion];

    if (!sourceResponse || !targetResponse) continue;

    const sourceScore = extractScore(sourceResponse);
    const targetScore = extractScore(targetResponse);

    if (sourceScore == null || targetScore == null) continue;

    if (sourceScore >= rule.sourceThreshold && targetScore <= rule.targetThreshold) {
      flags.push({
        type: rule.type,
        sourceDimension: rule.sourceDimension,
        sourceQuestion: rule.sourceQuestion,
        sourceScore,
        targetDimension: rule.targetDimension,
        targetQuestion: rule.targetQuestion,
        targetScore,
        delta: sourceScore - targetScore,
        description: rule.description,
        suggestedInvestigation: rule.suggestedInvestigation,
      });
    }
  }

  return flags;
}

// ============================================================
// GAMING DETECTION
// ============================================================

/**
 * Detecta gaming suspect: aluno escolheu consistentemente
 * as opções com scores mais altos em fechadas.
 * 
 * Critério: se em 80%+ das perguntas fechadas o aluno selecionou
 * a opção com score máximo, flaggeia como GAMING_SUSPECT.
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @param {number} threshold - % mínimo de "best answers" (default: 0.80)
 * @returns {boolean}
 */
export function detectGamingSuspect(responses, threshold = 0.80) {
  const closedResponses = responses.filter((r) => r.type === 'closed');
  if (closedResponses.length === 0) return false;

  let maxScoreCount = 0;
  for (const response of closedResponses) {
    const selectedScore = getOptionScore(response.questionId, response.selectedOption);
    const maxScore = getMaxScore(response.questionId);
    if (selectedScore != null && maxScore != null && selectedScore === maxScore) {
      maxScoreCount++;
    }
  }

  return (maxScoreCount / closedResponses.length) >= threshold;
}

// ============================================================
// FULL DETECTION
// ============================================================

/**
 * Executa todas as detecções de incongruência.
 * Chamado APÓS todas as respostas serem coletadas e classificadas pela IA.
 * 
 * @param {Array} responses - Todas as respostas com scores
 * @returns {Object} { intraFlags, interFlags, gamingSuspect }
 */
export function detectAllIncongruences(responses) {
  const intraFlags = detectIntraDimensionalFlags(responses);
  const interFlags = detectInterDimensionalFlags(responses);
  const gamingSuspect = detectGamingSuspect(responses);

  return {
    intraFlags,
    interFlags,
    gamingSuspect,
    totalFlags: intraFlags.length + interFlags.length + (gamingSuspect ? 1 : 0),
  };
}

// Export rules for testing
export { INTER_DIMENSIONAL_RULES };
