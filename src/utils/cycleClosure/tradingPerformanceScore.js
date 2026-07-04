/**
 * tradingPerformanceScore.js — TPS composite 0-100 (baseline JournalPlus + Espelho)
 *
 * Pure function consumida pelo wizard etapa 1 (Read).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Memória de cálculo (Q12 fechada 2026-05-06):
 *   TPS = clamp(profitFactor / 3, 0, 1) × 0.20
 *       + (1 - maxDDPercent / 0.05) × 0.25       # maxAcceptableDD = cap fixo 5% (Q3)
 *       + clamp(expectancy_R / 0.5, 0, 1) × 0.20
 *       + consistency               × 0.15        # #337: CV normalizado (cvToConsistencyNorm)
 *       + ruleAdherenceRate         × 0.20        # peso ↑ Mark Douglas
 *       × 100
 *
 * #337 — o fator consistência passou a vir do CV normalizado do ciclo (SSoT useCycleConsistency)
 * via cvToConsistencyNorm, substituindo o placeholder fixo 0.7. Quando um fator não-crítico não
 * tem dado, os PESOS são renormalizados sobre os presentes (não há mais crédito 0 fantasma) —
 * ver computeTPS. PF e ruleAdherenceRate seguem obrigatórios.
 */

const WEIGHTS = Object.freeze({
  profitFactor: 0.20,
  drawdown:     0.25,
  expectancy:   0.20,
  consistency:  0.15,
  rule:         0.20,
});

const MAX_ACCEPTABLE_DD = 0.05;   // 5% — cap fixo (Q3)

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const CV_ON_PLAN_TOP = 1.0;       // ≤ isto = consistência total (no plano ou mais suave)
const CV_ERRATIC_CEILING = 2.0;   // "muito errático" (bandas cvTheme) = consistência zero

/**
 * cvToConsistencyNorm — mapeia o CV normalizado do ciclo (SSoT `useCycleConsistency`,
 * centrado em ~1,0 = "no plano") para o score 0..1 do fator Consistência do TPS.
 *
 * O CV é `cvObservado / cvEsperado`: 1,0 = exatamente o esperado; quanto maior, mais errático.
 * Mapa: `clamp01((2 - value) / 1)` — value ≤ 1 (no plano ou mais suave) → 1,0 (crédito total;
 * "<0,5 suspeito" é flag de qualidade de dado, não punição de nota); 1,5 → 0,5; ≥ 2,0 → 0.
 * O 2,0 é a fronteira "muito errático" já usada nas bandas de `cvTheme` (cycleMetricTiles) —
 * sem constante mágica nova. `null`/inválido → `null` (fator vira missing → TPS renormaliza).
 *
 * @param {number|null} cvValue — `cvNormalized.value` (ou null quando insuficiente)
 * @returns {number|null} 0..1 ou null
 * @issue #337 — substitui o placeholder `winRateConsistency: 0.7`.
 */
export function cvToConsistencyNorm(cvValue) {
  if (typeof cvValue !== 'number' || !Number.isFinite(cvValue)) return null;
  return clamp01((CV_ERRATIC_CEILING - cvValue) / (CV_ERRATIC_CEILING - CV_ON_PLAN_TOP));
}

/**
 * @param {Object} input
 * @param {number|null} input.profitFactor             — Σwins / |Σlosses|; null se undefined
 * @param {number|null} input.maxDDPercent             — drawdown máx em decimal (ex: 0.028 = 2.8%)
 * @param {number|null} input.expectancy_R             — Van Tharp expectancy em R-multiples
 * @param {number|null} input.winRateConsistency       — variância de winrate entre buckets, 0..1 (1 = consistente)
 * @param {number|null} input.ruleAdherenceRate        — 0..1, frações de trades em conformidade
 * @returns {Object}
 *   {
 *     score,            // 0..100, null se inputs insuficientes
 *     breakdown: { pf, dd, exp, consistency, rule },   // contribuição de cada fator (já ponderada)
 *     missing: ['profitFactor', 'maxDDPercent', ...]   // campos null/inválidos
 *   }
 */
export function computeTPS({ profitFactor, maxDDPercent, expectancy_R, winRateConsistency, ruleAdherenceRate }) {
  const missing = [];

  // PF — null vira 0 contribuição (prudente: sem dado = sem crédito)
  let pfNorm = null;
  if (typeof profitFactor === 'number' && Number.isFinite(profitFactor) && profitFactor >= 0) {
    pfNorm = clamp01(profitFactor / 3);
  } else {
    missing.push('profitFactor');
  }

  // DD — invertido (DD baixo = score alto). Cap em 0% (sem DD = score 1).
  let ddNorm = null;
  if (typeof maxDDPercent === 'number' && Number.isFinite(maxDDPercent)) {
    const ddAbs = Math.abs(maxDDPercent);
    ddNorm = clamp01(1 - ddAbs / MAX_ACCEPTABLE_DD);
  } else {
    missing.push('maxDDPercent');
  }

  // Expectancy
  let expNorm = null;
  if (typeof expectancy_R === 'number' && Number.isFinite(expectancy_R)) {
    expNorm = clamp01(expectancy_R / 0.5);
  } else {
    missing.push('expectancy_R');
  }

  let consistencyNorm = null;
  if (typeof winRateConsistency === 'number' && Number.isFinite(winRateConsistency)) {
    consistencyNorm = clamp01(winRateConsistency);
  } else {
    missing.push('winRateConsistency');
  }

  let ruleNorm = null;
  if (typeof ruleAdherenceRate === 'number' && Number.isFinite(ruleAdherenceRate)) {
    ruleNorm = clamp01(ruleAdherenceRate);
  } else {
    missing.push('ruleAdherenceRate');
  }

  // Score só se tiver pelo menos PF e Rule (os 2 mais críticos do framework Mark Douglas)
  if (pfNorm === null || ruleNorm === null) {
    return { score: null, breakdown: null, weights: null, missing };
  }

  // #337 — pesos EFETIVOS: quando um fator não tem dado (ex.: CV null em ciclo curto), seu peso
  // não vira crédito fantasma (placeholder) nem zero injusto — é redistribuído proporcionalmente
  // sobre os fatores presentes (soma dos pesos efetivos = 1). Caso completo mantém o peso NOMINAL
  // bit-a-bit (sem divisão), preservando compat exata do score histórico.
  const norms = { pf: pfNorm, dd: ddNorm, exp: expNorm, consistency: consistencyNorm, rule: ruleNorm };
  const WKEY = { pf: 'profitFactor', dd: 'drawdown', exp: 'expectancy', consistency: 'consistency', rule: 'rule' };
  const keys = Object.keys(norms);
  const presentKeys = keys.filter((k) => norms[k] !== null);
  const allPresent = presentKeys.length === keys.length;
  const presentWeightSum = presentKeys.reduce((s, k) => s + WEIGHTS[WKEY[k]], 0);

  const weights = {};
  const breakdown = {};
  for (const k of keys) {
    if (norms[k] === null) {
      weights[k] = 0;
      breakdown[k] = 0;
    } else {
      weights[k] = allPresent ? WEIGHTS[WKEY[k]] : WEIGHTS[WKEY[k]] / presentWeightSum;
      breakdown[k] = norms[k] * weights[k];
    }
  }

  const score =
    100 *
    (breakdown.pf + breakdown.dd + breakdown.exp + breakdown.consistency + breakdown.rule);

  return { score, breakdown, weights, missing };
}

/**
 * winRateConsistency: variabilidade de winrate entre buckets temporais.
 *
 * Implementação simples (1 - stddev(winrates) clamped to [0,1]).
 * Ciclos com <5 buckets viáveis → buckets diários; ≥5 semanas → buckets semanais.
 *
 * @param {Array<{wins:number, total:number}>} buckets — janelas com contagem de trades
 * @returns {number|null} 0..1 ou null se sample insuficiente
 */
export function computeWinRateConsistency(buckets) {
  const list = Array.isArray(buckets) ? buckets.filter((b) => b && b.total > 0) : [];
  if (list.length < 2) return null;
  const winRates = list.map((b) => b.wins / b.total);
  const mean = winRates.reduce((s, v) => s + v, 0) / winRates.length;
  const variance = winRates.reduce((s, v) => s + (v - mean) ** 2, 0) / winRates.length;
  const stddev = Math.sqrt(variance);
  // Empiricamente: stddev > 0.5 (50pp) é máximo razoável; consistência = 1 - stddev/0.5.
  return clamp01(1 - stddev / 0.5);
}

export const TPS_WEIGHTS = WEIGHTS;
export const TPS_MAX_ACCEPTABLE_DD = MAX_ACCEPTABLE_DD;
