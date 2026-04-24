// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/evaluateGates.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { GATES_BY_TRANSITION } = require('./constants');

const EMPTY_RESULT = {
  transition: null,
  gates: [],
  gatesMet: 0,
  gatesTotal: 0,
  gatesRatio: null,
};

function isValidStage(s) {
  return typeof s === 'number' && Number.isInteger(s) && s >= 1 && s <= 5;
}

function applyOperator(op, value, threshold) {
  switch (op) {
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '<':  return value < threshold;
    case '>':  return value > threshold;
    case '==': return value === threshold;
    default:   return false;
  }
}

function computeGap(op, value, threshold, met) {
  if (met) return 0;
  switch (op) {
    case '>=': return threshold - value;
    case '>':  return threshold - value;
    case '<=': return value - threshold;
    case '<':  return value - threshold;
    case '==': return 1;
    default:   return null;
  }
}

function evaluateGates(stageCurrent, metrics) {
  if (!isValidStage(stageCurrent)) {
    return { ...EMPTY_RESULT, mastery: false };
  }

  if (stageCurrent === 5) {
    return { ...EMPTY_RESULT, mastery: true };
  }

  const transition = `${stageCurrent}-${stageCurrent + 1}`;
  const catalog = GATES_BY_TRANSITION[transition] ?? [];
  const safeMetrics = metrics ?? {};

  const gates = catalog.map((gate) => {
    const raw = safeMetrics[gate.metric];
    const missing = raw === undefined || raw === null;

    if (missing) {
      return {
        id: gate.id,
        label: gate.label,
        dim: gate.dim,
        metric: gate.metric,
        op: gate.op,
        threshold: gate.threshold,
        value: null,
        met: null,
        gap: null,
        reason: 'METRIC_UNAVAILABLE',
      };
    }

    const met = applyOperator(gate.op, raw, gate.threshold);
    const gap = computeGap(gate.op, raw, gate.threshold, met);

    return {
      id: gate.id,
      label: gate.label,
      dim: gate.dim,
      metric: gate.metric,
      op: gate.op,
      threshold: gate.threshold,
      value: raw,
      met,
      gap,
      reason: null,
    };
  });

  const gatesTotal = gates.length;
  const gatesMet = gates.filter((g) => g.met === true).length;
  const gatesRatio = gatesTotal > 0 ? gatesMet / gatesTotal : null;

  return {
    transition,
    gates,
    gatesMet,
    gatesTotal,
    gatesRatio,
    mastery: false,
  };
}

module.exports = { evaluateGates };
