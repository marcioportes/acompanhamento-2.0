/**
 * profileClassifier.js
 * 
 * Classifica scores em labels/perfis para cada dimensão.
 * Labels e faixas conforme BRIEF seção 6.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

// ============================================================
// EMOTIONAL LABELS (BRIEF 6.1)
// ============================================================

const EMOTIONAL_LABELS = [
  { min: 85, label: 'SAGE', description: 'Consciência + controle = fundação sólida' },
  { min: 65, label: 'LEARNER', description: 'Consciência presente, precisa de estrutura' },
  { min: 50, label: 'DEVELOPING', description: 'Em desenvolvimento, reconhecimento parcial' },
  { min: 0, label: 'FRAGILE', description: 'Alta reatividade emocional, defensivo' },
];

/**
 * Sub-dimensão emocional: Reconhecimento
 * A (Reflexo Rápido, 70-100), B (Moderado, 50-70), C (Lento, <50)
 */
const RECOGNITION_CLASSIFICATIONS = [
  { min: 70, code: 'A', label: 'Reflexo Rápido' },
  { min: 50, code: 'B', label: 'Moderado' },
  { min: 0, code: 'C', label: 'Lento' },
];

/**
 * Sub-dimensão emocional: Regulação
 * 1 (Autocontrole Alto, 70-100), 2 (Moderado, 50-70), 3 (Baixo, <50)
 */
const REGULATION_CLASSIFICATIONS = [
  { min: 70, code: '1', label: 'Autocontrole Alto' },
  { min: 50, code: '2', label: 'Moderado' },
  { min: 0, code: '3', label: 'Baixo' },
];

/**
 * Sub-dimensão emocional: Locus de Controle
 * X (Interno, 70-100), Y (Misto, 50-70), Z (Externo, <50)
 */
const LOCUS_CLASSIFICATIONS = [
  { min: 70, code: 'X', label: 'Interno' },
  { min: 50, code: 'Y', label: 'Misto' },
  { min: 0, code: 'Z', label: 'Externo' },
];

// ============================================================
// FINANCIAL LABELS (BRIEF 6.2)
// ============================================================

const FINANCIAL_LABELS = [
  { min: 85, label: 'FORTIFIED', description: 'Pronto para escalar; gestão robusta' },
  { min: 70, label: 'SOLID', description: 'Sustentável; refinamentos menores necessários' },
  { min: 50, label: 'VULNERABLE', description: 'Em risco com volatilidade; precisa de guardrails' },
  { min: 0, label: 'CRITICAL', description: 'Alta probabilidade de ruína; pausar trading' },
];

/**
 * Sub-dimensão financeira: Discipline
 * Alpha (90-100), Beta (70-85), Gamma (50-65), Delta (<50)
 */
const DISCIPLINE_CLASSIFICATIONS = [
  { min: 86, code: 'Alpha', label: 'Sistemático sem violações' },
  { min: 70, code: 'Beta', label: 'Sistemático com violações pontuais' },
  { min: 50, code: 'Gamma', label: 'Ad-hoc, violações frequentes mas consciente' },
  { min: 0, code: 'Delta', label: 'Sem sistema visível' },
];

/**
 * Sub-dimensão financeira: Loss Management
 * 1 (85+), 2 (70-84), 3 (50-69), 4 (<50)
 */
const LOSS_MANAGEMENT_CLASSIFICATIONS = [
  { min: 85, code: '1', label: 'Excellent' },
  { min: 70, code: '2', label: 'Good' },
  { min: 50, code: '3', label: 'Fair' },
  { min: 0, code: '4', label: 'Poor' },
];

/**
 * Sub-dimensão financeira: Profit Taking
 * H (70+), M (50-69), L (<50)
 */
const PROFIT_TAKING_CLASSIFICATIONS = [
  { min: 70, code: 'H', label: 'Conservative' },
  { min: 50, code: 'M', label: 'Moderate' },
  { min: 0, code: 'L', label: 'Aggressive' },
];

// ============================================================
// OPERATIONAL LABELS (BRIEF 6.3)
// ============================================================

const OPERATIONAL_LABELS = [
  { min: 85, label: 'MASTERY FIT', description: 'Alinhamento completo modelo-perfil' },
  { min: 70, label: 'GOOD FIT', description: 'Bom alinhamento, ajustes menores' },
  { min: 50, label: 'PARTIAL FIT', description: 'Desalinhamentos significativos a resolver' },
  { min: 0, label: 'MISMATCH', description: 'Modelo operacional incompatível com perfil' },
];

/**
 * Sub-dimensão operacional: Decision Mode
 * S (75+), D (60-74), I (<60)
 */
const DECISION_MODE_CLASSIFICATIONS = [
  { min: 75, code: 'S', label: 'Systematic' },
  { min: 60, code: 'D', label: 'Discretionary' },
  { min: 0, code: 'I', label: 'Intuitive' },
];

/**
 * Sub-dimensão operacional: Timeframe
 * Classificado pela pergunta OPE-02 (fit score)
 */
const TIMEFRAME_CLASSIFICATIONS = [
  { min: 75, code: 'FIT', label: 'Alinhado' },
  { min: 50, code: 'PARTIAL', label: 'Parcial' },
  { min: 0, code: 'MISFIT', label: 'Desalinhado' },
];

// ============================================================
// EXPERIENCE LABELS (via Stage — DEC-021)
// ============================================================

const EXPERIENCE_STAGE_LABELS = {
  1: { label: 'CHAOS', description: 'Sem estratégia definida, experimental' },
  2: { label: 'REACTIVE', description: 'Embrião de sistema, reconhece erros' },
  3: { label: 'METHODICAL', description: 'Sistema definido, estratégia estável' },
  4: { label: 'PROFESSIONAL', description: 'Sistema robusto, dados dirigem decisões' },
  5: { label: 'MASTERY', description: 'Múltiplas estratégias, coaching capacity' },
};

// ============================================================
// COMPOSITE LABELS (BRIEF 6.5)
// ============================================================

const COMPOSITE_LABELS = [
  { min: 80, label: 'PROFESSIONAL TRADER', description: 'Consistência comprovada' },
  { min: 65, label: 'COMMITTED LEARNER', description: 'Comprometido com evolução' },
  { min: 40, label: 'DEVELOPING TRADER', description: 'Em formação, potencial identificado' },
  { min: 0, label: 'AT RISK', description: 'Alto risco; intervenção imediata' },
];

// ============================================================
// CLASSIFIER FUNCTIONS
// ============================================================

/**
 * Classifica um score em uma faixa (genérico).
 * Percorre as faixas de cima para baixo, retorna a primeira que o score atinge.
 */
function classify(score, ranges) {
  if (score == null || isNaN(score)) return null;
  for (const range of ranges) {
    if (score >= range.min) {
      return { ...range };
    }
  }
  return ranges[ranges.length - 1]; // fallback para a faixa mais baixa
}

/** Classificação geral da dimensão emocional */
export function classifyEmotional(score) {
  return classify(score, EMOTIONAL_LABELS);
}

/** Classificação da sub-dimensão reconhecimento */
export function classifyRecognition(score) {
  return classify(score, RECOGNITION_CLASSIFICATIONS);
}

/** Classificação da sub-dimensão regulação */
export function classifyRegulation(score) {
  return classify(score, REGULATION_CLASSIFICATIONS);
}

/** Classificação da sub-dimensão locus */
export function classifyLocus(score) {
  return classify(score, LOCUS_CLASSIFICATIONS);
}

/** Classificação geral da dimensão financeira */
export function classifyFinancial(score) {
  return classify(score, FINANCIAL_LABELS);
}

/** Classificação da sub-dimensão discipline */
export function classifyDiscipline(score) {
  return classify(score, DISCIPLINE_CLASSIFICATIONS);
}

/** Classificação da sub-dimensão loss management */
export function classifyLossManagement(score) {
  return classify(score, LOSS_MANAGEMENT_CLASSIFICATIONS);
}

/** Classificação da sub-dimensão profit taking */
export function classifyProfitTaking(score) {
  return classify(score, PROFIT_TAKING_CLASSIFICATIONS);
}

/** Classificação geral da dimensão operacional */
export function classifyOperational(score) {
  return classify(score, OPERATIONAL_LABELS);
}

/** Classificação da sub-dimensão decision mode */
export function classifyDecisionMode(score) {
  return classify(score, DECISION_MODE_CLASSIFICATIONS);
}

/** Classificação da sub-dimensão timeframe fit */
export function classifyTimeframeFit(score) {
  return classify(score, TIMEFRAME_CLASSIFICATIONS);
}

/** Classificação do stage de experiência */
export function classifyExperienceStage(stage) {
  return EXPERIENCE_STAGE_LABELS[stage] || null;
}

/** Classificação do composite score */
export function classifyComposite(score) {
  return classify(score, COMPOSITE_LABELS);
}

// ============================================================
// FULL CLASSIFICATION
// ============================================================

/**
 * Classifica um assessment completo (todos os scores → todos os labels).
 * 
 * @param {Object} scores - Output de calculateFullAssessment
 * @returns {Object} Classificações completas por dimensão
 */
export function classifyFullAssessment(scores) {
  const { emotional, financial, operational, experience, composite } = scores;

  return {
    emotional: {
      profile: classifyEmotional(emotional.score),
      recognition: classifyRecognition(emotional.recognition),
      regulation: classifyRegulation(emotional.regulation),
      locus: classifyLocus(emotional.locus),
    },
    financial: {
      status: classifyFinancial(financial.score),
      discipline: classifyDiscipline(financial.discipline),
      loss_management: classifyLossManagement(financial.loss_management),
      profit_taking: classifyProfitTaking(financial.profit_taking),
    },
    operational: {
      fit: classifyOperational(operational.score),
      decision_mode: classifyDecisionMode(operational.decision_mode),
      timeframe: classifyTimeframeFit(operational.timeframe),
    },
    experience: {
      stage: classifyExperienceStage(experience.stage),
    },
    composite: classifyComposite(composite),
  };
}

// ============================================================
// EXPORTS (for testing)
// ============================================================

export {
  EMOTIONAL_LABELS,
  FINANCIAL_LABELS,
  OPERATIONAL_LABELS,
  COMPOSITE_LABELS,
  EXPERIENCE_STAGE_LABELS,
};
