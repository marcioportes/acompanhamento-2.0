// ⚠️ ESPELHO de src/utils/maturityEngine/behaviorWeights.js — MANTER SINCRONIZADO ⚠️
/**
 * behaviorWeights (CJS) — agrega `trade.behaviorProfile.families` em penalidade/bônus por
 * dimensão 4D + `ruleViolationRate`. Rate-normalized (Fase D). Ver fonte ESM p/ doc.
 *
 * `ruleViolationRate` = trades com violação QUE ALIMENTA GATE / trades com profile (#416 C1):
 * `feedsGates` (via GATE_CODES) governa a taxa, `feedsScore` governa a penalidade por dimensão.
 */
const { getPattern, severidadeVigente, GATE_CODES } = require('./behavioralTaxonomyMirror');

const SEVERITY_WEIGHT = Object.freeze({ HIGH: 3, MEDIUM: 2, LOW: 1 });
const POSITIVE_WEIGHT = 1;
const INTENSITY_SCALE = 8;
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
  const wpen = { E: 0, F: 0, O: 0 };
  const wbon = { E: 0, F: 0, O: 0 };
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
      // #394 — exposição que o aluno FECHOU (recolocou proteção) não conta como violação
      // nem alimenta gate: o gate mede posição descoberta, e essa foi coberta. Continua
      // no card, porque o fato é verdadeiro e o mentor precisa ver. Ver
      // functions/shared/gateEligibility.
      // Teto de leitura (#101): a severidade gravada não sobrepõe o limite do padrão.
      const sev = severidadeVigente(code, f.severity);
      const elegivel = !(code === 'UNPROTECTED_SIZE' && sev !== 'HIGH');
      // #416 C1 — a taxa é de violação QUE ALIMENTA GATE, não de "toda família negativa".
      // A fonte é `feedsGates` via GATE_CODES, o mesmo flag que `behavioralDetection` usa
      // pra montar `gateInputs`. O mapa de pesos aprovado é explícito por padrão: TILT
      // "entra na rule-violation rate"; EARLY_EXIT/LATE_EXIT/HESITATION são só "penalidade
      // E+F" e nunca entraram na taxa. Lê `p.code` (canônico) e não `code`, pra código
      // legado alias não escapar do flag.
      const alimentaGate = GATE_CODES.includes(p.code);
      const dims = Array.isArray(p.dimensao) ? p.dimensao : [];
      if (f.valence === 'positive') {
        for (const d of dims) if (wbon[d] != null) wbon[d] += POSITIVE_WEIGHT;
      } else {
        const w = SEVERITY_WEIGHT[sev] ?? SEVERITY_WEIGHT.LOW;
        for (const d of dims) if (wpen[d] != null) wpen[d] += w;
        if (alimentaGate && elegivel) {
          hasViolation = true;
          const gc = GATE_COUNT_MAP[code];
          if (gc) gateCounts[gc] += 1;
        }
      }
    }
    if (hasViolation) violationTrades += 1;
  }

  const penDim = (d) => (withProfile > 0 ? Math.min(PENALTY_CAP_PER_DIM, Math.round((wpen[d] / withProfile) * INTENSITY_SCALE)) : 0);
  const bonDim = (d) => (withProfile > 0 ? Math.min(BONUS_CAP_PER_DIM, Math.round((wbon[d] / withProfile) * INTENSITY_SCALE)) : 0);
  const byDimension = { E: penDim('E'), F: penDim('F'), O: penDim('O') };
  const bonusByDimension = { E: bonDim('E'), F: bonDim('F'), O: bonDim('O') };
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
  SEVERITY_WEIGHT, POSITIVE_WEIGHT, INTENSITY_SCALE, PENALTY_CAP_PER_DIM, BONUS_CAP_PER_DIM,
};
