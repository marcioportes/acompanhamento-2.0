/**
 * src/utils/maturityEngine/detectRegressionSignal.js
 *
 * Detector de sinal de regressão (§3.1 D7) do motor de maturidade (issue #119 task 05).
 *
 * Função pura: zero I/O. Avalia 3 gatilhos independentes; cada gatilho contribui
 * uma reason. `severity` é derivada da contagem de gatilhos (1=LOW, 2=MED, 3=HIGH).
 *
 * Gatilhos:
 *   1. composite < STAGE_BASES[stageCurrent] - 5
 *   2. E < baseline.emotional - 15 AND F < baseline.financial - 15
 *   3. mapMetricsToStage({winRate, payoff, maxDD}) < stageCurrent
 *
 * stageCurrent NUNCA é mutado aqui (DEC-020) — apenas suggestedStage sugere
 * regressão. Clampado em [1, stageCurrent - 1] se detectado, null caso contrário.
 *
 * DEC-AUTO-119-04 (clamp suggestedStage): min(mappedStage, stageCurrent - 1) em
 * stage 1 produz 0, quebrando a enum 1..5. Clampeamos para 1 (sentinel "já está
 * no mais baixo, não há como regredir mais"). Gatilho 3 nunca dispara se
 * mappedStage === 1 e stageCurrent === 1 (precisa mappedStage < stageCurrent).
 */

import { STAGE_BASES } from './constants.js';
import { mapMetricsToStage } from './helpers.js';

const DEFAULT_BASELINE = 50;

/**
 * @param {{
 *   composite: number,
 *   stageCurrent: 1|2|3|4|5,
 *   E: number,
 *   F: number,
 *   baseline?: { emotional?: number, financial?: number, operational?: number } | null,
 *   metrics?: { winRate?: number|null, payoff?: number|null, maxDDPercent?: number|null },
 * }} input
 * @returns {{
 *   detected: boolean,
 *   suggestedStage: 1|2|3|4|5|null,
 *   reasons: string[],
 *   severity: 'LOW'|'MED'|'HIGH'|null,
 * }}
 */
export function detectRegressionSignal({ composite, stageCurrent, E, F, baseline, metrics }) {
  const stageBase = STAGE_BASES[stageCurrent] ?? 0;
  const baselineE = baseline?.emotional ?? DEFAULT_BASELINE;
  const baselineF = baseline?.financial ?? DEFAULT_BASELINE;

  const reasons = [];

  // Gatilho 1 — composite muito abaixo da base do stage
  if (typeof composite === 'number' && composite < stageBase - 5) {
    reasons.push(`composite ${composite.toFixed(1)} < base-stage ${stageBase - 5}`);
  }

  // Gatilho 2 — E e F ambos 15+ abaixo do baseline
  if (
    typeof E === 'number' && typeof F === 'number'
    && E < baselineE - 15 && F < baselineF - 15
  ) {
    reasons.push(`E ${E.toFixed(1)} < baseline ${baselineE}-15 AND F ${F.toFixed(1)} < baseline ${baselineF}-15`);
  }

  // Gatilho 3 — mapMetricsToStage retorna stage menor que o atual
  const mappedStage = mapMetricsToStage({
    winRate: metrics?.winRate,
    payoff: metrics?.payoff,
    maxDD: metrics?.maxDDPercent,
  });
  if (mappedStage < stageCurrent) {
    reasons.push(`métricas mapeiam para stage ${mappedStage} (< ${stageCurrent})`);
  }

  const detected = reasons.length > 0;

  let severity = null;
  if (detected) {
    severity = reasons.length === 1 ? 'LOW' : reasons.length === 2 ? 'MED' : 'HIGH';
  }

  // DEC-AUTO-119-04: clamp em [1, stageCurrent - 1]
  const suggestedStage = detected
    ? Math.max(1, Math.min(mappedStage, stageCurrent - 1))
    : null;

  return { detected, suggestedStage, reasons, severity };
}
