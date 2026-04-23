/**
 * src/utils/maturityEngine/maturityDocSchema.js
 *
 * Validador de shape para documentos persistidos do motor de maturidade
 * (issue #119 task 06). Defesa em profundidade — Cloud Function deve chamar
 * antes de escrever em `students/{uid}/maturity/{current|history/{YYYY-MM-DD}}`.
 *
 * Shape literal: §3.1 D10 do issue control file.
 *
 * Pure JS, zero deps.
 */

const STAGES = [1, 2, 3, 4, 5];
const CONFIDENCES = ['HIGH', 'MED', 'LOW'];
const TRANSITION_PROPOSED = ['UP', 'STAY', 'DOWN_DETECTED'];
const SEVERITIES = ['LOW', 'MED', 'HIGH'];
const DIM_KEYS = ['emotional', 'financial', 'operational', 'maturity', 'composite'];
// Permissivo: validação semântica (mês 1-12, dia 1-31) seria over-engineering aqui.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function fmt(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return String(v);
}

function checkStage(value, field, errors) {
  if (!isInt(value) || !STAGES.includes(value)) {
    errors.push(`${field} must be integer in 1..5 (got: ${fmt(value)})`);
  }
}

function checkScore(value, field, errors) {
  if (!isFiniteNumber(value) || value < 0 || value > 100) {
    errors.push(`${field} must be number in [0,100] (got: ${fmt(value)})`);
  }
}

function checkDimensionScores(ds, field, errors) {
  if (!isPlainObject(ds)) {
    errors.push(`${field} must be object (got: ${fmt(ds)})`);
    return;
  }
  for (const key of DIM_KEYS) {
    if (!(key in ds)) {
      errors.push(`${field}.${key} missing`);
    } else {
      checkScore(ds[key], `${field}.${key}`, errors);
    }
  }
}

function checkArray(value, field, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be array (got: ${fmt(value)})`);
  }
}

function checkNonNegativeNumber(value, field, errors) {
  if (!isFiniteNumber(value) || value < 0) {
    errors.push(`${field} must be non-negative number (got: ${fmt(value)})`);
  }
}

function checkConfidence(value, field, errors) {
  if (!CONFIDENCES.includes(value)) {
    errors.push(`${field} must be one of HIGH|MED|LOW (got: ${fmt(value)})`);
  }
}

function checkProposedTransition(pt, field, errors) {
  if (!isPlainObject(pt)) {
    errors.push(`${field} must be object (got: ${fmt(pt)})`);
    return;
  }
  if (!TRANSITION_PROPOSED.includes(pt.proposed)) {
    errors.push(
      `${field}.proposed must be one of UP|STAY|DOWN_DETECTED (got: ${fmt(pt.proposed)})`
    );
  }
  if (pt.nextStage !== null && !(isInt(pt.nextStage) && STAGES.includes(pt.nextStage))) {
    errors.push(`${field}.nextStage must be integer in 1..5 or null (got: ${fmt(pt.nextStage)})`);
  }
  checkArray(pt.blockers, `${field}.blockers`, errors);
  checkConfidence(pt.confidence, `${field}.confidence`, errors);
}

function checkSignalRegression(sr, field, errors) {
  if (!isPlainObject(sr)) {
    errors.push(`${field} must be object (got: ${fmt(sr)})`);
    return;
  }
  if (typeof sr.detected !== 'boolean') {
    errors.push(`${field}.detected must be boolean (got: ${fmt(sr.detected)})`);
  }
  if (sr.suggestedStage !== null && !(isInt(sr.suggestedStage) && STAGES.includes(sr.suggestedStage))) {
    errors.push(
      `${field}.suggestedStage must be integer in 1..5 or null (got: ${fmt(sr.suggestedStage)})`
    );
  }
  checkArray(sr.reasons, `${field}.reasons`, errors);
  if (sr.severity !== null && !SEVERITIES.includes(sr.severity)) {
    errors.push(
      `${field}.severity must be one of LOW|MED|HIGH or null (got: ${fmt(sr.severity)})`
    );
  }
}

/**
 * Valida shape do doc `students/{uid}/maturity/current` (§3.1 D10).
 * Coleta todos os erros — não aborta no primeiro.
 *
 * Campos opcionais (tolerados se ausentes ou null): lastTradeId, computedAt,
 * asOf, aiNarrative, aiPatternsDetected, aiNextStageGuidance, aiGeneratedAt,
 * aiTrigger.
 *
 * @param {object} doc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCurrentDoc(doc) {
  const errors = [];
  if (!isPlainObject(doc)) {
    return { valid: false, errors: [`doc must be object (got: ${fmt(doc)})`] };
  }

  checkStage(doc.currentStage, 'currentStage', errors);
  checkStage(doc.baselineStage, 'baselineStage', errors);
  checkArray(doc.stageHistory, 'stageHistory', errors);
  checkDimensionScores(doc.dimensionScores, 'dimensionScores', errors);
  checkArray(doc.gates, 'gates', errors);
  checkNonNegativeNumber(doc.gatesMet, 'gatesMet', errors);
  checkNonNegativeNumber(doc.gatesTotal, 'gatesTotal', errors);
  if (doc.gatesRatio !== null && !(isFiniteNumber(doc.gatesRatio) && doc.gatesRatio >= 0 && doc.gatesRatio <= 1)) {
    errors.push(`gatesRatio must be number in [0,1] or null (got: ${fmt(doc.gatesRatio)})`);
  }
  checkProposedTransition(doc.proposedTransition, 'proposedTransition', errors);
  checkSignalRegression(doc.signalRegression, 'signalRegression', errors);
  checkNonNegativeNumber(doc.windowSize, 'windowSize', errors);
  checkConfidence(doc.confidence, 'confidence', errors);
  if (typeof doc.sparseSample !== 'boolean') {
    errors.push(`sparseSample must be boolean (got: ${fmt(doc.sparseSample)})`);
  }
  if (!isNonEmptyString(doc.engineVersion)) {
    errors.push(`engineVersion must be non-empty string (got: ${fmt(doc.engineVersion)})`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida shape do doc `students/{uid}/maturity/history/{YYYY-MM-DD}` (§3.1 D10).
 * Coleta todos os erros.
 *
 * @param {object} doc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateHistoryDoc(doc) {
  const errors = [];
  if (!isPlainObject(doc)) {
    return { valid: false, errors: [`doc must be object (got: ${fmt(doc)})`] };
  }

  if (typeof doc.date !== 'string' || !DATE_REGEX.test(doc.date)) {
    errors.push(`date must match YYYY-MM-DD (got: ${fmt(doc.date)})`);
  }
  checkDimensionScores(doc.dimensionScores, 'dimensionScores', errors);
  checkStage(doc.currentStage, 'currentStage', errors);
  checkNonNegativeNumber(doc.gatesMet, 'gatesMet', errors);
  checkNonNegativeNumber(doc.gatesTotal, 'gatesTotal', errors);
  checkConfidence(doc.confidence, 'confidence', errors);
  checkNonNegativeNumber(doc.tradesInDay, 'tradesInDay', errors);
  if (!doc.computedAt) {
    errors.push(`computedAt must be present (got: ${fmt(doc.computedAt)})`);
  }
  if (!isNonEmptyString(doc.engineVersion)) {
    errors.push(`engineVersion must be non-empty string (got: ${fmt(doc.engineVersion)})`);
  }

  return { valid: errors.length === 0, errors };
}
