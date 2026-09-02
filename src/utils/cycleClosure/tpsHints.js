/**
 * tpsHints.js — hints dos 5 cards de composição do TPS (Step1Read).
 *
 * Issue #416 (A3). Antes, o card exibia uma string fixa por fator sempre que a
 * fração de pontos caía abaixo de 0,5 (`hint && filled < 0.5`). O gatilho era a
 * NOTA, não o dado: PF 1,18 com payoff 1,18 disparava "ganhos médios menores que
 * perdas" (o oposto do que a tela anterior mostrava) e DD de 3,9% disparava
 * "ficou perto/passou do stop" comparando com o cap de normalização de 5%
 * (`MAX_ACCEPTABLE_DD`), que não tem relação com `plan.cycleStop`.
 *
 * Aqui cada hint tem um predicado sobre o dado. Predicado falso → `null` → o card
 * não afirma nada. Fator com pontuação baixa e predicado falso fica sem hint.
 *
 * Helper puro e testável por decisão (DEC-AUTO-416-06): predicado inline no JSX
 * não é testável, e foi exatamente assim que os cinco hints viraram proxy da nota.
 *
 * NÃO mexe em `computeTPS`, pesos ou normalização — muda o que o card DIZ, não a nota.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Fração do stop do ciclo a partir da qual o drawdown "chegou perto".
const DD_NEAR_STOP_RATIO = 0.8;

// Fronteira "errático" das bandas de `cvTheme` (cycleMetricTiles) — SSoT visual
// da banda, sem constante nova (DEC-AUTO-416-07). `< 0.5` é a banda "Suspeito",
// flag de qualidade de dado, e não gera hint (DEC-AUTO-416-08).
const CV_ERRATIC_FLOOR = 1.5;

export const TPS_HINT_TEXTS = Object.freeze({
  pf: 'ganhos médios menores que perdas — alvo escalonado ou alvo maior',
  dd: 'ficou perto/passou do stop — reduzir size ou parar antes',
  exp: 'expectância zerada ou negativa — na média, o trade não paga o risco assumido',
  consistency: 'retornos oscilando além do plano — buscar regime mais estável',
  rule: 'violações declaradas no ciclo — gate na entrada antes do envio',
});

/**
 * buildTpsHints — resolve os hints dos cards de composição do TPS.
 *
 * @param {Object} input
 * @param {number|null} input.avgWinR          — R-multiple médio dos vencedores (`metrics.avgWinR`)
 * @param {number|null} input.avgLossR         — R-multiple médio dos perdedores, NEGATIVO (`metrics.avgLossR`)
 * @param {number|null} input.maxDDPercent     — drawdown máx em FRAÇÃO decimal (`maxDD.percent`, ex.: -0.039)
 * @param {number|null} input.cycleStopPercent — stop do ciclo em PERCENTUAL (`plan.cycleStop`, ex.: 8.5)
 * @param {number|null} input.expectancy_R     — expectância Van Tharp em R (`metrics.expectancy_R`)
 * @param {number|null} input.cvNormalized     — CV normalizado do ciclo (`consistency.cvNormalized.value`)
 * @param {number|null} input.violationsCount  — total de violações declaradas (soma de `topErrors().count`)
 * @returns {{pf: string|null, dd: string|null, exp: string|null, consistency: string|null, rule: string|null}}
 */
export function buildTpsHints(input = {}) {
  const {
    avgWinR = null,
    avgLossR = null,
    maxDDPercent = null,
    cycleStopPercent = null,
    expectancy_R = null,
    cvNormalized = null,
    violationsCount = null,
  } = input || {};

  return {
    pf: hasPayoffBelowOne(avgWinR, avgLossR) ? TPS_HINT_TEXTS.pf : null,
    dd: isDrawdownNearStop(maxDDPercent, cycleStopPercent) ? TPS_HINT_TEXTS.dd : null,
    exp: isNum(expectancy_R) && expectancy_R <= 0 ? TPS_HINT_TEXTS.exp : null,
    consistency: isNum(cvNormalized) && cvNormalized > CV_ERRATIC_FLOOR ? TPS_HINT_TEXTS.consistency : null,
    rule: isNum(violationsCount) && violationsCount > 0 ? TPS_HINT_TEXTS.rule : null,
  };
}

// Payoff REALIZADO (|ganho médio| / |perda média|) < 1 — não a fração de pontos do PF.
// Sem perdedor (`avgLossR === 0`) não há payoff a julgar: ciclo sem perda não é defeito.
function hasPayoffBelowOne(avgWinR, avgLossR) {
  if (!isNum(avgWinR) || !isNum(avgLossR)) return false;
  if (avgLossR === 0) return false;
  return Math.abs(avgWinR) / Math.abs(avgLossR) < 1;
}

// O drawdown só "chegou perto do stop" contra o stop DO PLANO, nunca contra o cap de
// normalização do TPS. Unidades divergentes: `maxDDPercent` é fração, `cycleStopPercent`
// é percentual. Sem stop declarado não há referência — e sem referência não há afirmação.
function isDrawdownNearStop(maxDDPercent, cycleStopPercent) {
  if (!isNum(maxDDPercent) || !isNum(cycleStopPercent) || cycleStopPercent <= 0) return false;
  return Math.abs(maxDDPercent) * 100 >= cycleStopPercent * DD_NEAR_STOP_RATIO;
}
