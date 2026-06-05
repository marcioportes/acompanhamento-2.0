// ⚠️ FONTE — espelhada em functions/maturity/behaviorWeights.js — MANTER SINCRONIZADO ⚠️
/**
 * behaviorWeights — agrega `trade.behaviorProfile.families` de uma janela em
 * penalidade/bônus por dimensão 4D (E/F/O) + `ruleViolationRate`, governado pelo
 * mapa de pesos do framework (`docs/dev/behavioral-weight-map.md`). CHUNK-11 Fase 2 (#305).
 *
 * Princípios:
 * - Severidade → penalidade (escala calibra na Fase D sobre baseline #299).
 * - Dimensão(ões) vêm da taxonomia (`pattern.dimensao`); positivos = bônus.
 * - "Vida nova": só trade COM `behaviorProfile` pesa. Legado (sem profile) é ignorado.
 * - Clearing estendido: finding com chave `canonicalCode:tradeId` em
 *   `trade.mentorClearedViolations` não penaliza.
 * - Cap por dimensão/janela: um dia ruim não zera a dimensão.
 *
 * PURO: sem I/O. O caller (computeEmotional/Financial/Operational + evaluateMaturity)
 * aplica `netByDimension` ao score base e usa `ruleViolationRate`/`gateCounts` nos gates.
 */
import { getPattern } from '../../constants/behavioralTaxonomy';

// Escala derivada da severidade — PONTO DE PARTIDA, calibra na Fase D (mapa de pesos §).
export const SEVERITY_PENALTY = Object.freeze({ HIGH: 15, MEDIUM: 8, LOW: 4 });
export const POSITIVE_BONUS = 3;
export const PENALTY_CAP_PER_DIM = 25;
export const BONUS_CAP_PER_DIM = 10;

// Famílias que alimentam os counts==0 dos gates (espelha GATE_CODES + #208).
const GATE_COUNT_MAP = Object.freeze({
  STOP_PANIC: 'tampering',
  CHASE_REENTRY: 'chase',
  SUB_SIZING: 'sizing',
  TILT: 'tiltRevenge',
  LOSS_CHASING: 'tiltRevenge',
});

const clearedKey = (code, tradeId) => `${code}:${tradeId}`;

/**
 * @param {Object[]} trades — janela; cada trade pode ter `behaviorProfile.families` +
 *   `mentorClearedViolations[]` (chaves `canonicalCode:tradeId`).
 * @returns {{
 *   byDimension:{E:number,F:number,O:number},        // penalidade capada (positiva)
 *   bonusByDimension:{E:number,F:number,O:number},    // bônus capado
 *   netByDimension:{E:number,F:number,O:number},      // bonus - penalidade (sinal a somar ao score)
 *   ruleViolationRate:number,                          // trades-com-violação / trades-com-profile
 *   gateCounts:{tampering,chase,sizing,tiltRevenge},
 *   withProfile:number, violationTrades:number
 * }}
 */
export function aggregateBehaviorWeights(trades = []) {
  const pen = { E: 0, F: 0, O: 0 };
  const bon = { E: 0, F: 0, O: 0 };
  const gateCounts = { tampering: 0, chase: 0, sizing: 0, tiltRevenge: 0 };
  let withProfile = 0;
  let violationTrades = 0;

  for (const t of Array.isArray(trades) ? trades : []) {
    const fams = t && t.behaviorProfile && t.behaviorProfile.families;
    if (!Array.isArray(fams)) continue; // vida nova: só trade com profile pesa
    withProfile += 1;
    const cleared = Array.isArray(t.mentorClearedViolations) ? t.mentorClearedViolations : [];
    let hasViolation = false;

    for (const f of fams) {
      const code = f && f.canonicalCode;
      if (!code) continue;
      if (cleared.includes(clearedKey(code, t.id))) continue; // clearing estendido
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
