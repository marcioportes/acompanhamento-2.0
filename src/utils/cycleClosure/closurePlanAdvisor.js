/**
 * closurePlanAdvisor.js — IA stub heurístico (Plan Adjustment recommendation)
 *
 * Pure function consumida pela etapa 6 (Adjust) do wizard. Substitui em 1A
 * a chamada LLM que entra em 1B (mesmo schema, source diferente).
 *
 * Issue #259 R2 — rebuild:
 *   1) Capital base do recalc passa a ser `snapshotPlEnd` (saldo pós-ciclo),
 *      não `plan.pl` original. Mark Douglas: o próximo ciclo opera sobre o
 *      capital QUE EXISTE, não sobre o que existia antes do drawdown.
 *   2) Nova REGRA 0 — PAUSA: dispara antes de qualquer outra regra se houver
 *      sinais primários de blow-up iminente (violação de stop com trades
 *      pós-breach, tilt sistêmico ≥5 dias, revenge ≥3, perda > 1.5× cap).
 *      Recomenda size=0 + sessão com mentor e seta `notifyMentor: true`.
 *      Stop tampering é sinal de APOIO: agrega contexto à rationale quando
 *      a PAUSA já dispara por outro motivo, mas SOZINHO não justifica pausa
 *      (mover stop pode ser trail legítimo; precisa de outro descarrilamento
 *      pra virar bandeira crítica).
 *   3) REGRA 3 (reduzir) absorve sinais menores: tilt ≥2 dias OU stop
 *      tampering ≥1 OU revenge ≥1 já merece scale-down preventivo.
 *
 * Ordem das regras (early-return):
 *   REGRA 0 — pause_restructure (sinal crítico)
 *   REGRA 1 — insufficient_sample (n < 50)
 *   REGRA 2 — scale_up (Kelly alto, sem regression, sem sinais)
 *   REGRA 3 — scale_down (DD+adherence OU sinais menores)
 *   REGRA 4 — regression (manter, foco no improve do Q4)
 *   REGRA 5 — observe (fallback)
 */

const SOURCE = 'heuristic_stub';

const SAMPLE_THRESHOLD_SCALE_UP = 50;
const KELLY_SCALE_UP_RATIO = 2;
const SCALE_UP_FACTOR = 1.25;
const SCALE_DOWN_FACTOR = 0.75;
const DD_RATIO_DANGER = 0.70;
const RULE_ADHERENCE_DANGER = 0.90;

// REGRA 0 — gatilhos PRIMÁRIOS (qualquer um dispara pausa sozinho)
const PAUSE_TRADES_AFTER_STOP_MIN = 3;
const PAUSE_TILT_DAYS_MIN = 5;
const PAUSE_REVENGE_MIN = 3;
const PAUSE_LOSS_RATIO_OF_STOP = 1.5;   // perda final ≥ 1.5× stop planejado

// REGRA 0 — sinais de APOIO (não disparam pausa sozinhos, só agregam contexto
// quando um primary já dispara). Stop tampering isolado pode ser trail legítimo;
// só vira bandeira crítica em combinação com outro descarrilamento.
const PAUSE_STOP_TAMPERING_MIN = 2;

/**
 * @param {Object} input
 * @param {Object} input.kelly                — saída de computeKelly (sampleSize, kellySafe, expectancy_R)
 * @param {Object} input.cycleMetrics
 * @param {number|null} input.maxDDPercent
 * @param {number|null} input.ruleAdherenceRate
 * @param {Object} input.currentPlan          — { pl, riskPerOperation, rrTarget, cycleStop }
 * @param {string[]} input.regression
 * @param {Object} input.behavioralCounts     — { tilt, tiltDaysCount, revenge, stopTampering, ... }
 * @param {Object} input.stopBreach           — { stopBreachIndex, tradesAfterStop, pnlPctOfStop, severity }
 * @param {number|null} input.snapshotPlEnd   — capital pós-ciclo (R$). Se null/undef, cai pra currentPlan.pl.
 * @param {number|null} input.cycleResultPct  — resultado do ciclo em % (negativo se loss)
 *
 * @returns {Object}
 *   {
 *     baseCapital,                  // capital usado pra calcular R do próximo ciclo
 *     newPl, newRiskPerOp, newRRTarget,
 *     newRiskRS,                    // R em R$ recalculado sobre baseCapital
 *     changed: bool,
 *     rationale: string,
 *     risks: string[],
 *     triggeredRule:
 *       'pause_restructure' | 'insufficient_sample' | 'scale_up' |
 *       'scale_down' | 'regression' | 'observe',
 *     notifyMentor: bool,
 *     source: 'heuristic_stub',
 *   }
 */
export function advisePlanAdjustment({
  kelly, cycleMetrics, maxDDPercent, ruleAdherenceRate,
  currentPlan, regression, behavioralCounts, stopBreach,
  snapshotPlEnd, cycleResultPct,
}) {
  const cur = currentPlan || {};
  const reg = Array.isArray(regression) ? regression : [];
  const noRegression = reg.length === 0;
  const counts = behavioralCounts || {};
  const breach = stopBreach || {};
  const sampleSize = kelly?.sampleSize ?? 0;
  const kellySafe = kelly?.kellySafe;
  const currentRisk = cur.riskPerOperation;
  const baseCapital = typeof snapshotPlEnd === 'number' && snapshotPlEnd > 0
    ? snapshotPlEnd
    : (typeof cur.pl === 'number' ? cur.pl : null);

  const newRiskRS = (riskPct) =>
    typeof baseCapital === 'number' && typeof riskPct === 'number'
      ? Math.round(baseCapital * (riskPct / 100))
      : null;

  const baseOutput = {
    baseCapital,
    newPl: cur.pl,
    newRiskPerOp: cur.riskPerOperation,
    newRRTarget: cur.rrTarget,
    newRiskRS: newRiskRS(cur.riskPerOperation),
    changed: false,
    notifyMentor: false,
    source: SOURCE,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 0 — PAUSA + REESTRUTURAÇÃO
  // Dispara primeiro porque, se houver sinal crítico, qualquer "manter" ou
  // "reduzir 25%" mascararia o risco real de blow-up no próximo ciclo.
  // ─────────────────────────────────────────────────────────────────────────
  const tradesAfterStop = typeof breach.tradesAfterStop === 'number' ? breach.tradesAfterStop : 0;
  const tiltDays = typeof counts.tiltDaysCount === 'number' ? counts.tiltDaysCount : 0;
  const revengeN = typeof counts.revenge === 'number' ? counts.revenge : 0;
  const stopTamperingN = typeof counts.stopTampering === 'number' ? counts.stopTampering : 0;
  const lossRatio = typeof breach.pnlPctOfStop === 'number' ? breach.pnlPctOfStop : null;

  // Primary triggers — cada um por si só justifica PAUSA.
  const primaryTriggers = [];
  if (tradesAfterStop >= PAUSE_TRADES_AFTER_STOP_MIN) {
    primaryTriggers.push(`continuou operando +${tradesAfterStop} trade(s) após hit do stop do ciclo`);
  }
  if (tiltDays >= PAUSE_TILT_DAYS_MIN) {
    primaryTriggers.push(`${tiltDays} dias com tilt detectado`);
  }
  if (revengeN >= PAUSE_REVENGE_MIN) {
    primaryTriggers.push(`${revengeN} instâncias de vingança`);
  }
  if (lossRatio != null && lossRatio >= PAUSE_LOSS_RATIO_OF_STOP) {
    primaryTriggers.push(`perda final ${lossRatio.toFixed(1)}× o cap planejado`);
  }

  // Supporting signals — só agregam à rationale quando PAUSA já disparou por
  // outro motivo. Stop tampering sozinho não justifica pausa (pode ser trail
  // legítimo); precisa de outro descarrilamento pra virar bandeira crítica.
  const supportingSignals = [];
  if (stopTamperingN >= PAUSE_STOP_TAMPERING_MIN) {
    supportingSignals.push(`${stopTamperingN}× stop deslocado durante trade`);
  }

  if (primaryTriggers.length > 0) {
    const pauseTriggers = [...primaryTriggers, ...supportingSignals];
    return {
      ...baseOutput,
      newRiskPerOp: 0,
      newRiskRS: 0,
      changed: true,
      notifyMentor: true,
      rationale:
        `🚨 PAUSAR antes de operar o próximo ciclo. Sinais detectados: ${pauseTriggers.slice(0, 3).join('; ')}. ` +
        `Continuar com size atual = risco real de blow-up. ` +
        `Sugerido: size = 0 até sessão com mentor reestruturar o plano (mentor notificado em inbox).`,
      risks: [
        'Reincidência do padrão autodestrutivo no próximo ciclo',
        'Perda de capital ainda maior que a do ciclo atual',
        'Erosão da confiança e início de espiral emocional',
      ],
      triggeredRule: 'pause_restructure',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 1 — sample insuficiente
  // ─────────────────────────────────────────────────────────────────────────
  if (sampleSize < SAMPLE_THRESHOLD_SCALE_UP) {
    const expectancy = kelly?.expectancy_R;
    const expSign = typeof expectancy === 'number' && expectancy > 0 ? '+' : '';
    return {
      ...baseOutput,
      rationale:
        `Manter parâmetros e observar. Sample ${sampleSize} < ${SAMPLE_THRESHOLD_SCALE_UP} trades — ` +
        `edge ainda sem confirmação estatística. ` +
        (typeof expectancy === 'number'
          ? `Expectancy atual ${expSign}${expectancy.toFixed(2)}R sinaliza tendência mas não justifica escalar size.`
          : 'Aguardar mais trades.'),
      risks: [`Sample ${sampleSize} insuficiente — esperar n ≥ ${SAMPLE_THRESHOLD_SCALE_UP} antes de escalar`],
      triggeredRule: 'insufficient_sample',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 2 — scale up (sem sinais comportamentais residuais)
  // ─────────────────────────────────────────────────────────────────────────
  const hasMinorBehavioralSignal =
    (counts.tiltDaysCount || 0) >= 2 ||
    (counts.revenge || 0) >= 1 ||
    (counts.stopTampering || 0) >= 1 ||
    tradesAfterStop >= 1;

  if (
    typeof kellySafe === 'number' && typeof currentRisk === 'number' &&
    kellySafe > KELLY_SCALE_UP_RATIO * (currentRisk / 100) &&
    noRegression && !hasMinorBehavioralSignal
  ) {
    const newRisk = Math.round((currentRisk * SCALE_UP_FACTOR) * 100) / 100;
    return {
      ...baseOutput,
      newRiskPerOp: newRisk,
      newRiskRS: newRiskRS(newRisk),
      changed: true,
      rationale:
        `Subir risco por operação de ${currentRisk}% para ${newRisk}% (+25%). ` +
        `Kelly Quarter sugere até ${(kellySafe * 100).toFixed(1)}% — margem clara pra escalar. ` +
        `Sem regressão de maturidade nem sinal comportamental residual.` +
        (baseCapital != null ? ` R recalculado: R$ ${baseCapital.toFixed(0)} × ${newRisk}% = R$ ${newRiskRS(newRisk)}.` : ''),
      risks: [
        'Aumento de size eleva variância do drawdown — observe DD do próximo ciclo',
        'Caso aderência caia, reverter rapidamente',
      ],
      triggeredRule: 'scale_up',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 3 — scale down (DD+adherence OU sinais menores)
  // ─────────────────────────────────────────────────────────────────────────
  const ddDanger =
    typeof maxDDPercent === 'number' &&
    typeof cur.cycleStop === 'number' &&
    cur.cycleStop > 0 &&
    Math.abs(maxDDPercent) > DD_RATIO_DANGER * (cur.cycleStop / 100);
  const adherenceDanger =
    typeof ruleAdherenceRate === 'number' && ruleAdherenceRate < RULE_ADHERENCE_DANGER;

  if ((ddDanger && adherenceDanger) || hasMinorBehavioralSignal) {
    const newRisk = Math.round((currentRisk * SCALE_DOWN_FACTOR) * 100) / 100;
    const reasonParts = [];
    if (ddDanger) reasonParts.push(`drawdown chegou a ${(Math.abs(maxDDPercent) * 100).toFixed(1)}%`);
    if (adherenceDanger) reasonParts.push(`aderência ${(ruleAdherenceRate * 100).toFixed(1)}% < 90%`);
    if (tradesAfterStop >= 1) reasonParts.push(`+${tradesAfterStop} trade(s) após stop do ciclo`);
    if ((counts.tiltDaysCount || 0) >= 2) reasonParts.push(`${counts.tiltDaysCount} dia(s) com tilt`);
    if ((counts.revenge || 0) >= 1) reasonParts.push(`${counts.revenge} instância(s) de vingança`);
    if ((counts.stopTampering || 0) >= 1) reasonParts.push(`stop deslocado ${counts.stopTampering}×`);

    return {
      ...baseOutput,
      newRiskPerOp: newRisk,
      newRiskRS: newRiskRS(newRisk),
      changed: true,
      rationale:
        `Reduzir risco de ${currentRisk}% para ${newRisk}% (−25%). ` +
        `Sinais: ${reasonParts.slice(0, 3).join('; ')}. ` +
        `Proteger até a disciplina firmar.` +
        (baseCapital != null ? ` R recalculado: R$ ${baseCapital.toFixed(0)} × ${newRisk}% = R$ ${newRiskRS(newRisk)}.` : ''),
      risks: [
        'Reduzir size diminui ganho potencial — trade-off intencional pra estabilizar',
      ],
      triggeredRule: 'scale_down',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 4 — regression (manter + foco no improve do Q4)
  // ─────────────────────────────────────────────────────────────────────────
  if (!noRegression) {
    return {
      ...baseOutput,
      rationale:
        `Manter parâmetros. Detectada regressão em: ${reg.join(', ')}. ` +
        `Próximo ciclo: foco no item improve do Q4 (AAR) antes de escalar.`,
      risks: [`Regressão em ${reg.join(', ')} sugere instabilidade — não escalar até estabilizar`],
      triggeredRule: 'regression',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGRA 5 — fallback (manter + observar)
  // ─────────────────────────────────────────────────────────────────────────
  return {
    ...baseOutput,
    rationale:
      `Manter parâmetros e observar. Edge confirmado e sem sinais de regressão, ` +
      `mas sem trigger pra mudança. Próximo ciclo: monitorar consistência.` +
      (baseCapital != null && cur.pl != null && baseCapital !== cur.pl
        ? ` Capital base do próximo ciclo: R$ ${baseCapital.toFixed(0)} (era R$ ${cur.pl.toFixed(0)} pré-ciclo).`
        : ''),
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
  PAUSE_TRADES_AFTER_STOP_MIN,
  PAUSE_TILT_DAYS_MIN,
  PAUSE_REVENGE_MIN,
  PAUSE_STOP_TAMPERING_MIN,
  PAUSE_LOSS_RATIO_OF_STOP,
});
