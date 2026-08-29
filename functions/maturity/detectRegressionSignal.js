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

function detectRegressionSignal({ composite, stageCurrent, E, F, baseline, metrics, emCarencia = false }) {
  // CARÊNCIA PÓS-PROMOÇÃO (#101, 29/08/2026).
  //
  // O gatilho 3 abaixo compara as métricas com o ESTÁGIO ATUAL. Promover sobe o
  // estágio sem mudar uma linha dos dados — então toda promoção produzia, no
  // recompute seguinte, "métricas mapeiam para stage N-1 (< N)" e o mentor recebia
  // um alerta mandando desfazer o que tinha acabado de fazer. Foi o que Marcio viu
  // minutos depois de promover o Wilson.
  //
  // Enquanto a janela de avaliação ainda contém trades do estágio anterior, não há
  // evidência sobre o estágio novo: julgar regressão ali é julgar o passado com a
  // régua do presente. A carência acaba quando a janela é inteiramente posterior à
  // promoção — quem decide isso é o caller, que conhece os trades.
  if (emCarencia) {
    return {
      detected: false,
      suggestedStage: null,
      reasons: ['carência pós-promoção — a janela ainda contém trades do estágio anterior'],
      severity: null,
    };
  }

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
