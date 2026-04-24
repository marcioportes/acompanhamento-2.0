/**
 * src/utils/maturityEngine/evaluateGates.js
 *
 * Avaliador puro de gates para o motor de maturidade 4D (issue #119 task 04).
 *
 * Função pura: recebe stage atual + shape de métricas pré-computadas e retorna
 * veredito por gate, agregados (gatesMet/gatesTotal/gatesRatio) e flag mastery.
 * Zero Firestore, zero I/O, zero cálculo de métrica — isso é responsabilidade
 * do orchestrator (A5).
 *
 * Semântica (§3.1 D9):
 *   - stageCurrent fora de 1..5 → retorno vazio + mastery=false
 *   - stageCurrent === 5        → mastery=true, gates=[] (orchestrator força
 *                                 gatesMet=gatesTotal=1 no composite)
 *   - stageCurrent 1..4         → avalia transição `${stage}-${stage+1}`
 *
 * Gate com métrica ausente (undefined|null) → { met: null, reason:
 * 'METRIC_UNAVAILABLE', gap: null }. NÃO conta como met nem é filtrado do total
 * — é visível como "pendente" para a UI.
 *
 * Ordem dos gates preservada conforme GATES_BY_TRANSITION (determinística).
 */

import { GATES_BY_TRANSITION } from './constants.js';

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

/**
 * @param {number} stageCurrent  — 1..5 (stages válidos) ou qualquer outro (trata como inválido)
 * @param {Record<string, number|boolean|null|undefined>} metrics  — shape plano com métricas pré-computadas
 * @returns {{
 *   transition: '1-2'|'2-3'|'3-4'|'4-5'|null,
 *   gates: Array<{
 *     id: string, label: string, dim: 'emo'|'fin'|'op', metric: string,
 *     op: '>='|'<='|'<'|'=='|'>', threshold: number|boolean,
 *     value: number|boolean|null,
 *     met: boolean|null,
 *     gap: number|null,
 *     reason: string|null,
 *   }>,
 *   gatesMet: number,
 *   gatesTotal: number,
 *   gatesRatio: number|null,
 *   mastery: boolean,
 * }}
 */
export function evaluateGates(stageCurrent, metrics) {
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
