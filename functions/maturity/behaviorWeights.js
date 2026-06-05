// ⚠️ ESPELHO de src/utils/maturityEngine/behaviorWeights.js — MANTER SINCRONIZADO ⚠️
/**
 * behaviorWeights (CJS) — agrega `trade.behaviorProfile.families` em penalidade/bônus
 * por dimensão 4D + `ruleViolationRate`. CHUNK-11 Fase 2 (#305). Ver fonte ESM p/ doc.
 */
const { getPattern } = require('./behavioralTaxonomyMirror');

const SEVERITY_PENALTY = Object.freeze({ HIGH: 15, MEDIUM: 8, LOW: 4 });
const POSITIVE_BONUS = 3;
const PENALTY_CAP_PER_DIM = 25;
const BONUS_CAP_PER_DIM = 10;

const GATE_COUNT_MAP = Object.freeze({
  STOP_PANIC: 'tampering',
  CHASE_REENTRY: 'chase',
  SUB_SIZING: 'sizing',
  TILT: 'tiltRevenge',
  LOSS_CHASING: 'tiltRevenge',
});

const clearedKey = (code, tradeId) => `${code}:${tradeId}`;

function aggregateBehaviorWeights(trades = []) {
  const pen = { E: 0, F: 0, O: 0 };
  const bon = { E: 0, F: 0, O: 0 };
  const gateCounts = { tampering: 0, chase: 0, sizing: 0, tiltRevenge: 0 };
  let withProfile = 0;
  let violationTrades = 0;

  for (const t of Array.isArray(trades) ? trades : []) {
    const fams = t && t.behaviorProfile && t.behaviorProfile.families;
    if (!Array.isArray(fams)) continue;
    withProfile += 1;
    const cleared = Array.isArray(t.mentorClearedViolations) ? t.mentorClearedViolations : [];
    let hasViolation = false;

    for (const f of fams) {
      const code = f && f.canonicalCode;
      if (!code) continue;
      if (cleared.includes(clearedKey(code, t.id))) continue;
      const p = getPattern(code);
      if (!p) continue;
      const dims = Array.isArray(p.dimensao) ? p.dimensao : [];
      if (f.valence === 'positive') {
        for (const d of dims) if (bon[d] != null) bon[d] += POSITIVE_BONUS;
      } else {
        const points = SEVERITY_PENALTY[f.severity] ?? SEVERITY_PENALTY.LOW;
        for (const d of dims) if (pen[d] != null) pen[d] += points;
        hasViolation = true;
        const gc = GATE_COUNT_MAP[code];
        if (gc) gateCounts[gc] += 1;
      }
    }
    if (hasViolation) violationTrades += 1;
  }

  const capPen = (v) => Math.min(v, PENALTY_CAP_PER_DIM);
  const capBon = (v) => Math.min(v, BONUS_CAP_PER_DIM);
  const byDimension = { E: capPen(pen.E), F: capPen(pen.F), O: capPen(pen.O) };
  const bonusByDimension = { E: capBon(bon.E), F: capBon(bon.F), O: capBon(bon.O) };
  const netByDimension = {
    E: bonusByDimension.E - byDimension.E,
    F: bonusByDimension.F - byDimension.F,
    O: bonusByDimension.O - byDimension.O,
  };
  const ruleViolationRate = withProfile > 0 ? violationTrades / withProfile : 0;

  return { byDimension, bonusByDimension, netByDimension, ruleViolationRate, gateCounts, withProfile, violationTrades };
}

module.exports = {
  aggregateBehaviorWeights,
  SEVERITY_PENALTY, POSITIVE_BONUS, PENALTY_CAP_PER_DIM, BONUS_CAP_PER_DIM,
};
