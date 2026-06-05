// ⚠️ FONTE — espelhada em functions/maturity/behaviorWeights.js — MANTER SINCRONIZADO ⚠️
/**
 * behaviorWeights — agrega `trade.behaviorProfile.families` de uma janela em
 * penalidade/bônus por dimensão 4D (E/F/O) + `ruleViolationRate`, governado pelo
 * mapa de pesos do framework (`docs/dev/behavioral-weight-map.md`). CHUNK-11 Fase 2 (#305).
 *
 * Penalidade RATE-NORMALIZED (calibrado na Fase D, 05/06/2026): a penalidade por
 * dimensão é a INTENSIDADE MÉDIA por trade — `Σ(peso_severidade na dim) / N_trades × SCALE`,
 * capada. Proporcional ao tamanho da janela e ao rate (não conta absoluto, não satura cedo).
 * Pesos relativos: HIGH=3 / MEDIUM=2 / LOW=1. Positivos = bônus análogo.
 *
 * Princípios:
 * - "Vida nova": só trade COM `behaviorProfile` pesa; legado (sem profile) é ignorado e
 *   também fica fora do denominador N.
 * - Clearing estendido: finding com chave `canonicalCode:tradeId` em
 *   `trade.mentorClearedViolations` não penaliza nem conta como violação.
 *
 * PURO: sem I/O. O caller aplica `netByDimension` ao score base + usa
 * `ruleViolationRate`/`gateCounts` nos gates.
 */
import { getPattern } from '../../constants/behavioralTaxonomy';

// Peso relativo de severidade (intensidade); SCALE converte intensidade média → pontos.
// PONTO DE PARTIDA calibrado na Fase D: janela 100% HIGH numa dimensão ≈ −24 (≈ cap).
export const SEVERITY_WEIGHT = Object.freeze({ HIGH: 3, MEDIUM: 2, LOW: 1 });
export const POSITIVE_WEIGHT = 1;
export const INTENSITY_SCALE = 8;
export const PENALTY_CAP_PER_DIM = 25;
export const BONUS_CAP_PER_DIM = 10;

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
 *   ruleViolationRate:number, gateCounts, withProfile, violationTrades
 * }}
 */
export function aggregateBehaviorWeights(trades = []) {
  const wpen = { E: 0, F: 0, O: 0 }; // soma de pesos de severidade por dimensão
  const wbon = { E: 0, F: 0, O: 0 };
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
        for (const d of dims) if (wbon[d] != null) wbon[d] += POSITIVE_WEIGHT;
      } else {
        const w = SEVERITY_WEIGHT[f.severity] ?? SEVERITY_WEIGHT.LOW;
        for (const d of dims) if (wpen[d] != null) wpen[d] += w;
        hasViolation = true;
        const gc = GATE_COUNT_MAP[code];
        if (gc) gateCounts[gc] += 1;
      }
    }
    if (hasViolation) violationTrades += 1;
  }

  // Intensidade média por trade × escala, capada → proporcional ao rate e à janela.
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
