/**
 * probingTriggers.js
 * 
 * Identifica triggers para a sondagem adaptativa (DEC-016).
 * Prioriza e seleciona 3-5 triggers para geração de perguntas pela IA.
 * 
 * Triggers (por prioridade):
 * 1. Incongruência inter-dimensional (delta ≥ 30) — prioridade máxima
 * 2. Incongruência intra-dimensional (delta ≥ 25) — prioridade alta
 * 3. Gaming suspect — prioridade alta
 * 4. Hesitação suspeita (responseTime < 5s em pergunta introspectiva) — prioridade média
 * 5. Respostas abertas rasas (charCount < 80) — prioridade baixa
 * 
 * Se não houver flags suficientes, gera triggers genéricos sobre
 * dimensão emocional (nunca zero — aluno não deve perceber que "passou").
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { QUESTION_MAP } from './assessmentQuestions.js';

// ============================================================
// PRIORITY LEVELS
// ============================================================

const PRIORITY = {
  INTER_DIMENSIONAL: 1,   // Mais urgente
  INTRA_DIMENSIONAL: 2,
  GAMING_SUSPECT: 2,
  HESITATION: 3,
  SHALLOW_RESPONSE: 4,
  GENERIC_EMOTIONAL: 5,   // Menos urgente (fallback)
};

// ============================================================
// TRIGGER IDENTIFICATION
// ============================================================

/**
 * IDs de perguntas introspectivas complexas — responseTime < 5s é suspeito.
 * São perguntas que exigem reflexão e não têm "resposta óbvia".
 */
const INTROSPECTIVE_QUESTIONS = [
  'EMO-04', 'EMO-08', 'EMO-11', 'EMO-12',
  'FIN-06', 'FIN-07', 'FIN-08',
  'OPE-06', 'OPE-07', 'OPE-08',
  'EXP-05', 'EXP-06',
];

/**
 * Perguntas que pedem "descrição detalhada" — charCount < 80 é raso.
 */
const DETAILED_RESPONSE_QUESTIONS = [
  'EMO-04', 'EMO-08', 'EMO-11',
  'FIN-06', 'FIN-07',
  'OPE-06', 'OPE-07',
  'EXP-05',
];

/**
 * Identifica triggers de hesitação suspeita.
 * ResponseTime < 5s em pergunta introspectiva complexa = resposta sem reflexão.
 * 
 * @param {Array} responses
 * @returns {Array<Object>} Triggers de hesitação
 */
function identifyHesitationTriggers(responses) {
  const triggers = [];

  for (const response of responses) {
    if (
      response.type === 'open' &&
      INTROSPECTIVE_QUESTIONS.includes(response.questionId) &&
      response.responseTime != null &&
      response.responseTime < 5
    ) {
      triggers.push({
        type: 'HESITATION',
        priority: PRIORITY.HESITATION,
        questionId: response.questionId,
        responseTime: response.responseTime,
        description: `Resposta em ${response.responseTime}s para pergunta introspectiva — possível falta de reflexão`,
      });
    }
  }

  return triggers;
}

/**
 * Identifica triggers de respostas abertas rasas.
 * charCount < 80 em pergunta que pede descrição detalhada.
 * 
 * @param {Array} responses
 * @returns {Array<Object>}
 */
function identifyShallowResponseTriggers(responses) {
  const triggers = [];

  for (const response of responses) {
    if (
      response.type === 'open' &&
      DETAILED_RESPONSE_QUESTIONS.includes(response.questionId) &&
      response.charCount != null &&
      response.charCount < 80
    ) {
      triggers.push({
        type: 'SHALLOW_RESPONSE',
        priority: PRIORITY.SHALLOW_RESPONSE,
        questionId: response.questionId,
        charCount: response.charCount,
        description: `Resposta curta (${response.charCount} chars) para pergunta que pede descrição detalhada`,
      });
    }
  }

  return triggers;
}

/**
 * Converte flags de incongruência em triggers com prioridade.
 * 
 * @param {Array} interFlags - Flags inter-dimensionais
 * @param {Array} intraFlags - Flags intra-dimensionais
 * @param {boolean} gamingSuspect
 * @returns {Array<Object>}
 */
function convertFlagsToTriggers(interFlags, intraFlags, gamingSuspect) {
  const triggers = [];

  // Inter-dimensional: prioridade máxima, ordenados por delta
  for (const flag of interFlags) {
    if (flag.delta >= 30) {
      triggers.push({
        type: flag.type,
        priority: PRIORITY.INTER_DIMENSIONAL,
        delta: flag.delta,
        sourceQuestion: flag.sourceQuestion,
        targetQuestion: flag.targetQuestion,
        description: flag.description,
        suggestedInvestigation: flag.suggestedInvestigation,
      });
    }
  }

  // Intra-dimensional: prioridade alta
  for (const flag of intraFlags) {
    triggers.push({
      type: 'INTRA_' + flag.dimension.toUpperCase(),
      priority: PRIORITY.INTRA_DIMENSIONAL,
      delta: flag.delta,
      dimension: flag.dimension,
      description: flag.description,
    });
  }

  // Gaming suspect: prioridade alta
  if (gamingSuspect) {
    triggers.push({
      type: 'GAMING_SUSPECT',
      priority: PRIORITY.GAMING_SUSPECT,
      description: 'Padrão consistente de "melhores respostas" nas fechadas — possível gaming',
    });
  }

  return triggers;
}

// ============================================================
// GENERIC FALLBACKS
// ============================================================

/**
 * Triggers genéricos sobre dimensão emocional.
 * Usados quando não há flags suficientes.
 * O aluno não deve perceber que "passou sem flags".
 */
const GENERIC_EMOTIONAL_TRIGGERS = [
  {
    type: 'GENERIC_EMOTIONAL_DEPTH',
    priority: PRIORITY.GENERIC_EMOTIONAL,
    description: 'Aprofundar autoconhecimento emocional',
    probingDirection: 'Explore como o aluno lida com a incerteza no dia a dia — não apenas no trading mas na vida. Busque padrões de coping.',
  },
  {
    type: 'GENERIC_EMOTIONAL_BLIND_SPOTS',
    priority: PRIORITY.GENERIC_EMOTIONAL,
    description: 'Investigar blind spots emocionais',
    probingDirection: 'Pergunte sobre situações onde outras pessoas (cônjuge, amigos, colegas) percebem que o aluno está afetado antes dele mesmo perceber.',
  },
  {
    type: 'GENERIC_EMOTIONAL_RESILIENCE',
    priority: PRIORITY.GENERIC_EMOTIONAL,
    description: 'Explorar resiliência sob pressão prolongada',
    probingDirection: 'Pergunte sobre o período mais longo de drawdown e como o aluno se sentiu na 3ª semana consecutiva de perdas.',
  },
];

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Identifica todos os triggers para sondagem adaptativa.
 * 
 * @param {Object} params
 * @param {Array} params.responses - Todas as respostas do aluno
 * @param {Array} params.interFlags - Flags inter-dimensionais
 * @param {Array} params.intraFlags - Flags intra-dimensionais
 * @param {boolean} params.gamingSuspect
 * @returns {Array<Object>} Triggers ordenados por prioridade + delta
 */
export function identifyAllTriggers({ responses, interFlags, intraFlags, gamingSuspect }) {
  const flagTriggers = convertFlagsToTriggers(interFlags, intraFlags, gamingSuspect);
  const hesitationTriggers = identifyHesitationTriggers(responses);
  const shallowTriggers = identifyShallowResponseTriggers(responses);

  const allTriggers = [...flagTriggers, ...hesitationTriggers, ...shallowTriggers];

  // Ordenar por prioridade (menor = mais urgente), depois por delta (maior = mais urgente)
  allTriggers.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.delta || 0) - (a.delta || 0);
  });

  return allTriggers;
}

/**
 * Seleciona 3-5 triggers para geração de perguntas de sondagem.
 * 
 * Regras (DEC-016):
 * - Mínimo 3, máximo 5
 * - Priorizados por urgência
 * - Se < 3 triggers reais, completa com genéricos sobre dimensão emocional
 * - Nunca zero (aluno não deve perceber que "passou sem flags")
 * 
 * @param {Object} params - Mesmo params de identifyAllTriggers
 * @returns {Array<Object>} 3-5 triggers selecionados para sondagem
 */
export function selectProbingTriggers(params) {
  const allTriggers = identifyAllTriggers(params);

  // Pegar até 5 dos triggers reais
  const selected = allTriggers.slice(0, 5);

  // Se menos de 3, completar com genéricos
  if (selected.length < 3) {
    const genericsNeeded = 3 - selected.length;
    const generics = GENERIC_EMOTIONAL_TRIGGERS.slice(0, genericsNeeded);
    selected.push(...generics);
  }

  return selected;
}

/**
 * Prepara payload para a CF generateProbingQuestions.
 * 
 * @param {Object} params
 * @param {Array} params.responses - Todas as respostas do aluno
 * @param {Array} params.interFlags - Flags inter-dimensionais
 * @param {Array} params.intraFlags - Flags intra-dimensionais
 * @param {boolean} params.gamingSuspect
 * @returns {Object} Payload pronto para enviar à CF
 */
export function prepareProbingPayload(params) {
  const selectedTriggers = selectProbingTriggers(params);

  return {
    triggers: selectedTriggers,
    totalTriggersIdentified: identifyAllTriggers(params).length,
    hasRealFlags: selectedTriggers.some((t) => t.priority <= PRIORITY.GAMING_SUSPECT),
    responseTimeSummary: buildResponseTimeSummary(params.responses),
  };
}

/**
 * Sumariza tempos de resposta para contexto da CF.
 */
function buildResponseTimeSummary(responses) {
  const openResponses = responses.filter((r) => r.type === 'open' && r.responseTime != null);
  if (openResponses.length === 0) return null;

  const times = openResponses.map((r) => r.responseTime);
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    count: times.length,
  };
}

// Exports for testing
export {
  PRIORITY,
  INTROSPECTIVE_QUESTIONS,
  DETAILED_RESPONSE_QUESTIONS,
  GENERIC_EMOTIONAL_TRIGGERS,
  identifyHesitationTriggers,
  identifyShallowResponseTriggers,
};
