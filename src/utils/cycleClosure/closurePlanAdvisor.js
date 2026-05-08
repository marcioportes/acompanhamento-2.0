/**
 * closurePlanAdvisor.js — IA stub heurístico (Plan Adjustment recommendation)
 *
 * Substitui em 1A a chamada LLM que entra em 1B (mesmo schema, source diferente).
 * Pure function consumida pela etapa 6 (Adjust) do wizard.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Regras determinísticas (decisão fechada 2026-05-06):
 *   if sample_size < 50:                                 → manter (edge precisa n≥50)
 *   elif kelly_safe > 2 × current AND no_regression:     → subir size em 25%
 *   elif maxDD > 70% × stop AND ruleAdherence < 90%:     → reduzir size em 25%
 *   elif regression_dimensions ≠ []:                     → manter + foco no improve do Q4
 *   else:                                                → manter + observar
 *
 * Schema do output é IDÊNTICO ao que LLM (1B) vai produzir — só `source` muda.
 */

const SOURCE = 'heuristic_stub';

const SAMPLE_THRESHOLD_SCALE_UP = 50;        // n mínimo pra escalar size
const KELLY_SCALE_UP_RATIO = 2;              // kelly_safe > 2 × current → escalar
const SCALE_UP_FACTOR = 1.25;                // +25% no risk
const SCALE_DOWN_FACTOR = 0.75;              // -25% no risk
const DD_RATIO_DANGER = 0.70;                // 70% do stop = margem fina
const RULE_ADHERENCE_DANGER = 0.90;          // <90% = disciplina caindo

/**
 * @param {Object} input
 * @param {Object} input.kelly                — saída de computeKelly (sampleSize, kellySafe, expectancy_R, reason)
 * @param {Object} input.cycleMetrics         — saída de computeCycleMetrics (winRate, maxDDPercent NÃO está aqui — passar separado)
 * @param {number|null} input.maxDDPercent    — drawdown decimal do ciclo (ex: 0.028)
 * @param {number|null} input.ruleAdherenceRate
 * @param {Object} input.currentPlan          — { pl, riskPerOperation, rrTarget, cycleStop }
 * @param {string[]} input.regression         — array de dimensões em regressão (ex: ['financial']) — vide maturity engine
 *
 * @returns {Object}
 *   {
 *     newPl, newRiskPerOp, newRRTarget,    // valores sugeridos (== current se manter)
 *     changed: bool,
 *     rationale: string,
 *     risks: string[],
 *     triggeredRule: 'insufficient_sample' | 'scale_up' | 'scale_down' | 'regression' | 'observe',
 *     source: 'heuristic_stub',
 *   }
 */
export function advisePlanAdjustment({ kelly, cycleMetrics, maxDDPercent, ruleAdherenceRate, currentPlan, regression }) {
  const cur = currentPlan || {};
  const reg = Array.isArray(regression) ? regression : [];
  const noRegression = reg.length === 0;
  const sampleSize = kelly?.sampleSize ?? 0;
  const kellySafe = kelly?.kellySafe;
  const currentRisk = cur.riskPerOperation;

  // Output base (manter tudo)
  const baseOutput = {
    newPl: cur.pl,
    newRiskPerOp: cur.riskPerOperation,
    newRRTarget: cur.rrTarget,
    changed: false,
    source: SOURCE,
  };

  // REGRA 1 — sample insuficiente (n<50)
  if (sampleSize < SAMPLE_THRESHOLD_SCALE_UP) {
    const expectancy = kelly?.expectancy_R;
    const expSign = typeof expectancy === 'number' && expectancy > 0 ? '+' : '';
    return {
      ...baseOutput,
      rationale:
        `Manter parâmetros e observar. Sample ${sampleSize} < ${SAMPLE_THRESHOLD_SCALE_UP} ` +
        `trades — edge ainda não tem confirmação estatística. ` +
        (typeof expectancy === 'number'
          ? `Expectancy atual ${expSign}${expectancy.toFixed(2)}R sinaliza tendência mas não justifica escalar size.`
          : 'Aguardar mais trades pra cálculo confiável.'),
      risks: [
        `Sample ${sampleSize} insuficiente — esperar n ≥ ${SAMPLE_THRESHOLD_SCALE_UP} trades antes de escalar size`,
      ],
      triggeredRule: 'insufficient_sample',
    };
  }

  // REGRA 2 — escalar size (Kelly safe alto + sem regression)
  if (
    typeof kellySafe === 'number' && typeof currentRisk === 'number' &&
    kellySafe > KELLY_SCALE_UP_RATIO * (currentRisk / 100) &&
    noRegression
  ) {
    const newRisk = Math.round((currentRisk * SCALE_UP_FACTOR) * 100) / 100;
    return {
      ...baseOutput,
      newRiskPerOp: newRisk,
      changed: true,
      rationale:
        `Subir risco por operação de ${currentRisk}% para ${newRisk}% (+25%). ` +
        `Kelly Quarter sugere até ${(kellySafe * 100).toFixed(1)}% — há margem clara pra escalar. ` +
        `Sem regressão de dimensão de maturidade.`,
      risks: [
        'Aumento de size eleva variância do drawdown — observe DD do próximo ciclo',
        'Caso aderência caia, reverter rapidamente',
      ],
      triggeredRule: 'scale_up',
    };
  }

  // REGRA 3 — reduzir size (DD perto do stop + aderência caindo)
  const ddDanger =
    typeof maxDDPercent === 'number' &&
    typeof cur.cycleStop === 'number' &&
    cur.cycleStop > 0 &&
    Math.abs(maxDDPercent) > DD_RATIO_DANGER * (cur.cycleStop / 100);
  const adherenceDanger =
    typeof ruleAdherenceRate === 'number' && ruleAdherenceRate < RULE_ADHERENCE_DANGER;

  if (ddDanger && adherenceDanger) {
    const newRisk = Math.round((currentRisk * SCALE_DOWN_FACTOR) * 100) / 100;
    return {
      ...baseOutput,
      newRiskPerOp: newRisk,
      changed: true,
      rationale:
        `Reduzir risco de ${currentRisk}% para ${newRisk}% (−25%). ` +
        `Drawdown chegou a ${(Math.abs(maxDDPercent) * 100).toFixed(1)}% (próximo do stop ${cur.cycleStop}%) ` +
        `e aderência ${(ruleAdherenceRate * 100).toFixed(1)}% caiu abaixo de 90%. ` +
        `Proteger até a disciplina firmar.`,
      risks: [
        'Reduzir size diminui ganho potencial — é trade-off intencional pra estabilizar',
      ],
      triggeredRule: 'scale_down',
    };
  }

  // REGRA 4 — regressão presente (manter, foco no improve)
  if (!noRegression) {
    return {
      ...baseOutput,
      rationale:
        `Manter parâmetros. Detectada regressão em: ${reg.join(', ')}. ` +
        `Próximo ciclo: foco no item improve do Q4 (AAR) antes de escalar.`,
      risks: [
        `Regressão em ${reg.join(', ')} sugere instabilidade — não escalar até estabilizar`,
      ],
      triggeredRule: 'regression',
    };
  }

  // REGRA 5 — fallback (manter + observar)
  return {
    ...baseOutput,
    rationale:
      `Manter parâmetros e observar. Edge confirmado e sem sinais de regressão, ` +
      `mas sem trigger pra mudança. Próximo ciclo: monitorar consistência.`,
    risks: [],
    triggeredRule: 'observe',
  };
}

export const ADVISOR_THRESHOLDS = Object.freeze({
  SAMPLE_THRESHOLD_SCALE_UP,
  KELLY_SCALE_UP_RATIO,
  SCALE_UP_FACTOR,
  SCALE_DOWN_FACTOR,
  DD_RATIO_DANGER,
  RULE_ADHERENCE_DANGER,
});
