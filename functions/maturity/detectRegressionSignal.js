// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/detectRegressionSignal.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const { STAGE_BASES } = require('./constants');
const { mapMetricsToStage } = require('./helpers');

const DEFAULT_BASELINE = 50;

function detectRegressionSignal({ composite, stageCurrent, E, F, baseline, metrics }) {
  const stageBase = STAGE_BASES[stageCurrent] ?? 0;
  const baselineE = baseline?.emotional ?? DEFAULT_BASELINE;
  const baselineF = baseline?.financial ?? DEFAULT_BASELINE;

  const reasons = [];

  if (typeof composite === 'number' && composite < stageBase - 5) {
    reasons.push(`composite ${composite.toFixed(1)} < base-stage ${stageBase - 5}`);
  }

  if (
    typeof E === 'number' && typeof F === 'number'
    && E < baselineE - 15 && F < baselineF - 15
  ) {
    reasons.push(`E ${E.toFixed(1)} < baseline ${baselineE}-15 AND F ${F.toFixed(1)} < baseline ${baselineF}-15`);
  }

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

  const suggestedStage = detected
    ? Math.max(1, Math.min(mappedStage, stageCurrent - 1))
    : null;

  return { detected, suggestedStage, reasons, severity };
}

module.exports = { detectRegressionSignal };
