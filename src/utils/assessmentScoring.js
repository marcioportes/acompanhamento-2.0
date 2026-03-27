/**
 * assessmentScoring.js
 * 
 * Motor de scoring do assessment 4D.
 * Implementa TODAS as fórmulas da seção 6 do BRIEF-STUDENT-ONBOARDING-v3.md.
 * 
 * REGRA: Fórmulas são sagradas. NÃO simplificar, NÃO arredondar, NÃO mudar pesos.
 * Se algo parecer inconsistente, perguntar ao Marcio — não corrigir por conta própria.
 * 
 * Fórmulas implementadas:
 * - 6.1 Emocional: recognition, regulation, locus → emotionalScore (média simples)
 * - 6.2 Financeiro: discipline, loss_mgmt, profit_taking → financialScore (ponderada 0.40/0.40/0.20)
 * - 6.3 Operacional: 5 sub-dims com emotion_control herdado → operationalScore (ponderada 0.25/0.20/0.20/0.15/0.20)
 * - 6.4 Experiência: stageBase + 0 (DEC-022 — tábula rasa)
 * - 6.5 Composite: E×0.25 + F×0.25 + O×0.20 + X×0.30
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { getOptionScore, QUESTION_MAP } from './assessmentQuestions.js';

// ============================================================
// HELPERS
// ============================================================

/**
 * Calcula média de um array de números, ignorando nulls/undefined.
 * Retorna null se array vazio ou sem valores válidos.
 */
function safeAverage(values) {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Extrai score de uma resposta.
 * - Fechada: usa getOptionScore(questionId, selectedOption)
 * - Aberta: usa aiScore do response
 * 
 * @param {Object} response - Resposta do aluno (do Firestore)
 * @returns {number|null}
 */
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

/**
 * Dado um array de responses, cria lookup por questionId.
 */
function buildResponseMap(responses) {
  const map = {};
  for (const r of responses) {
    map[r.questionId] = r;
  }
  return map;
}

// ============================================================
// 6.1 EMOCIONAL
// ============================================================

/**
 * Calcula scores da dimensão emocional.
 * 
 * Fórmulas (BRIEF seção 6.1):
 *   recognition = média(EMO-01, EMO-02, EMO-03, aiScore(EMO-04))
 *   regulation  = média(EMO-05, EMO-06, EMO-07, aiScore(EMO-08))
 *   locus       = média(EMO-09, EMO-10, aiScore(EMO-11), aiScore(EMO-12))
 *   emotionalScore = (recognition + regulation + locus) / 3
 * 
 * @param {Array} responses - Array de respostas do aluno
 * @returns {Object} { recognition, regulation, locus, score }
 */
export function calculateEmotionalScore(responses) {
  const r = buildResponseMap(responses);

  const recognition = safeAverage([
    extractScore(r['EMO-01']),
    extractScore(r['EMO-02']),
    extractScore(r['EMO-03']),
    extractScore(r['EMO-04']),
  ]);

  const regulation = safeAverage([
    extractScore(r['EMO-05']),
    extractScore(r['EMO-06']),
    extractScore(r['EMO-07']),
    extractScore(r['EMO-08']),
  ]);

  const locus = safeAverage([
    extractScore(r['EMO-09']),
    extractScore(r['EMO-10']),
    extractScore(r['EMO-11']),
    extractScore(r['EMO-12']),
  ]);

  const score = safeAverage([recognition, regulation, locus]);

  return { recognition, regulation, locus, score };
}

// ============================================================
// 6.2 FINANCEIRO
// ============================================================

/**
 * Calcula scores da dimensão financeira.
 * 
 * Fórmulas (BRIEF seção 6.2):
 *   discipline     = média(FIN-01, FIN-03, FIN-05, aiScore(FIN-06))
 *   loss_mgmt      = média(FIN-02, aiScore(FIN-07), aiScore(FIN-08))  
 *   profit_taking  = FIN-04
 *   financialScore = (discipline × 0.40) + (loss_mgmt × 0.40) + (profit_taking × 0.20)
 * 
 * @param {Array} responses
 * @returns {Object} { discipline, loss_management, profit_taking, score }
 */
export function calculateFinancialScore(responses) {
  const r = buildResponseMap(responses);

  const discipline = safeAverage([
    extractScore(r['FIN-01']),
    extractScore(r['FIN-03']),
    extractScore(r['FIN-05']),
    extractScore(r['FIN-06']),
  ]);

  const loss_management = safeAverage([
    extractScore(r['FIN-02']),
    extractScore(r['FIN-07']),
    extractScore(r['FIN-08']),
  ]);

  const profit_taking = extractScore(r['FIN-04']);

  let score = null;
  if (discipline != null && loss_management != null && profit_taking != null) {
    score = (discipline * 0.40) + (loss_management * 0.40) + (profit_taking * 0.20);
  }

  return { discipline, loss_management, profit_taking, score };
}

// ============================================================
// 6.3 OPERACIONAL (5 sub-dimensões — inclui emotion_control herdado)
// ============================================================

/**
 * Calcula scores da dimensão operacional.
 * 
 * Fórmulas (BRIEF seção 6.3 — DEC-013):
 *   decision_mode   = média(OPE-01, OPE-05, aiScore(OPE-06))
 *   timeframe       = OPE-02
 *   strategy_fit    = OPE-03
 *   tracking        = OPE-04
 *   emotion_control = emotionalScore (herdado, calculado na 6.1)
 *   
 *   operationalScore = (decision_mode × 0.25) + (timeframe × 0.20) + 
 *                      (strategy_fit × 0.20) + (tracking × 0.15) + 
 *                      (emotion_control × 0.20)
 * 
 * Nota: emotion_control NÃO tem override pelo mentor na dimensão operacional.
 * É derivado automaticamente do emotionalScore já validado na dim. emocional.
 * 
 * @param {Array} responses
 * @param {number} emotionalScore - Score emocional já calculado (herdado)
 * @returns {Object} { decision_mode, timeframe, strategy_fit, tracking, emotion_control, score }
 */
export function calculateOperationalScore(responses, emotionalScore) {
  const r = buildResponseMap(responses);

  const decision_mode = safeAverage([
    extractScore(r['OPE-01']),
    extractScore(r['OPE-05']),
    extractScore(r['OPE-06']),
  ]);

  const timeframe = extractScore(r['OPE-02']);
  const strategy_fit = extractScore(r['OPE-03']);
  const tracking = extractScore(r['OPE-04']);
  const emotion_control = emotionalScore;

  let score = null;
  if (
    decision_mode != null &&
    timeframe != null &&
    strategy_fit != null &&
    tracking != null &&
    emotion_control != null
  ) {
    score =
      (decision_mode * 0.25) +
      (timeframe * 0.20) +
      (strategy_fit * 0.20) +
      (tracking * 0.15) +
      (emotion_control * 0.20);
  }

  return { decision_mode, timeframe, strategy_fit, tracking, emotion_control, score };
}

// ============================================================
// 6.4 EXPERIÊNCIA (DEC-021 + DEC-022)
// ============================================================

/**
 * Stage bases conforme BRIEF seção 6.4.
 */
export const STAGE_BASES = {
  1: 0,
  2: 20,
  3: 40,
  4: 60,
  5: 80,
};

/**
 * Calcula score de experiência.
 * 
 * Fórmula (BRIEF seção 6.4):
 *   experienceScore = stageBase + (gates_met / gates_total) × 20
 * 
 * DEC-021: stage é diagnosticado por IA (não por fórmula aritmética)
 * DEC-022: No marco zero, gates_met = 0 (tábula rasa)
 * 
 * @param {number} stage - Stage diagnosticado pela IA (1-5)
 * @param {number} gatesMet - Número de gates cumpridos (0 no baseline)
 * @param {number} gatesTotal - Número total de gates do próximo stage
 * @returns {Object} { stage, gates_met, gates_total, score }
 */
export function calculateExperienceScore(stage, gatesMet = 0, gatesTotal = 1) {
  const stageBase = STAGE_BASES[stage] ?? 0;
  const gateFraction = gatesTotal > 0 ? gatesMet / gatesTotal : 0;
  const score = stageBase + (gateFraction * 20);

  return {
    stage,
    gates_met: gatesMet,
    gates_total: gatesTotal,
    score,
  };
}

// ============================================================
// 6.5 COMPOSITE
// ============================================================

/**
 * Pesos do composite score.
 * 
 * Nota sobre dupla penalidade emocional (BRIEF seção 6.5):
 * emotionalScore impacta diretamente (0.25) E indiretamente via operacional
 * (emotion_control × 0.20 × peso operacional 0.20 = 0.04 adicional).
 * Contribuição efetiva total do emocional: ~0.29. Intencional.
 */
export const COMPOSITE_WEIGHTS = {
  emotional: 0.25,
  financial: 0.25,
  operational: 0.20,
  experience: 0.30,
};

/**
 * Calcula composite score.
 * 
 * Fórmula (BRIEF seção 6.5):
 *   composite = (emotional × 0.25) + (financial × 0.25) + 
 *               (operational × 0.20) + (experience × 0.30)
 * 
 * @param {number} emotionalScore
 * @param {number} financialScore
 * @param {number} operationalScore
 * @param {number} experienceScore
 * @returns {number|null}
 */
export function calculateCompositeScore(emotionalScore, financialScore, operationalScore, experienceScore) {
  if (
    emotionalScore == null ||
    financialScore == null ||
    operationalScore == null ||
    experienceScore == null
  ) {
    return null;
  }

  return (
    (emotionalScore * COMPOSITE_WEIGHTS.emotional) +
    (financialScore * COMPOSITE_WEIGHTS.financial) +
    (operationalScore * COMPOSITE_WEIGHTS.operational) +
    (experienceScore * COMPOSITE_WEIGHTS.experience)
  );
}

// ============================================================
// FULL ASSESSMENT SCORING
// ============================================================

/**
 * Calcula scores completos de todas as dimensões + composite.
 * Orquestra 6.1 → 6.2 → 6.3 (depende de 6.1) → 6.4 → 6.5.
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @param {number} diagnosedStage - Stage diagnosticado pela IA (DEC-021)
 * @param {number} gatesTotal - Total de gates do próximo stage
 * @returns {Object} Scores completos por dimensão + composite
 */
export function calculateFullAssessment(responses, diagnosedStage, gatesTotal = 0) {
  // 6.1 Emocional (calculado primeiro — operacional depende dele)
  const emotional = calculateEmotionalScore(responses);

  // 6.2 Financeiro
  const financial = calculateFinancialScore(responses);

  // 6.3 Operacional (recebe emotionalScore como emotion_control)
  const operational = calculateOperationalScore(responses, emotional.score);

  // 6.4 Experiência (DEC-022: gates_met = 0 no baseline)
  const experience = calculateExperienceScore(diagnosedStage, 0, gatesTotal);

  // 6.5 Composite
  const composite = calculateCompositeScore(
    emotional.score,
    financial.score,
    operational.score,
    experience.score
  );

  return {
    emotional,
    financial,
    operational,
    experience,
    composite,
  };
}
