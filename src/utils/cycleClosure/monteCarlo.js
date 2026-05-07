/**
 * monteCarlo.js — Monte Carlo bootstrap pra projeção do próximo ciclo
 *
 * Pure function consumida pelo wizard etapa "Adjust" (Fase 6).
 * Sample pool conforme regra Q8 (decisão fechada 2026-05-06):
 *   - ciclo anterior se ≥30 trades
 *   - senão últimos 100 trades do aluno
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

const DEFAULT_N_SIMS = 1000;
const PRIOR_CYCLE_MIN_TRADES = 30;
const FALLBACK_POOL_SIZE = 100;

/**
 * Seleciona pool conforme regra Q8.
 *
 * @param {Array} priorCycleTrades — trades do ciclo imediatamente anterior
 * @param {Array} allTrades — todos os trades do aluno (ordenados desc por date) — last100 fallback
 * @returns {{ pool: Array, source: 'priorCycle'|'last100'|'empty' }}
 */
export function selectSamplePool(priorCycleTrades, allTrades) {
  const prior = Array.isArray(priorCycleTrades) ? priorCycleTrades : [];
  if (prior.length >= PRIOR_CYCLE_MIN_TRADES) {
    return { pool: prior, source: 'priorCycle' };
  }
  const all = Array.isArray(allTrades) ? allTrades : [];
  if (all.length === 0) {
    return { pool: [], source: 'empty' };
  }
  return { pool: all.slice(0, FALLBACK_POOL_SIZE), source: 'last100' };
}

/**
 * Bootstrap simulator: sorteia com reposição N_per_sim trades do pool, soma os results,
 * repete N_sims vezes. Calcula percentis das somas.
 *
 * @param {Array} pool — array de trades com `result` numérico
 * @param {number} nPerSim — tamanho de cada simulação (default = ciclo a ser projetado)
 * @param {Object} [options]
 * @param {number} [options.nSims=1000]
 * @param {() => number} [options.rng=Math.random] — seedable em testes
 * @returns {Object|null}
 *   {
 *     samplePoolSize, nSims, nPerSim,
 *     p10, p25, p50, p75, p90,
 *     min, max, mean,
 *     reason: null | 'empty_pool' | 'invalid_n_per_sim',
 *   }
 */
export function runMonteCarloBootstrap(pool, nPerSim, options = {}) {
  const nSims = Number.isInteger(options.nSims) && options.nSims > 0 ? options.nSims : DEFAULT_N_SIMS;
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  const list = Array.isArray(pool) ? pool : [];
  if (list.length === 0) {
    return { samplePoolSize: 0, nSims, nPerSim, p10: null, p25: null, p50: null, p75: null, p90: null, min: null, max: null, mean: null, reason: 'empty_pool' };
  }
  if (!Number.isInteger(nPerSim) || nPerSim <= 0) {
    return { samplePoolSize: list.length, nSims, nPerSim, p10: null, p25: null, p50: null, p75: null, p90: null, min: null, max: null, mean: null, reason: 'invalid_n_per_sim' };
  }

  const outcomes = new Array(nSims);
  for (let s = 0; s < nSims; s++) {
    let sum = 0;
    for (let i = 0; i < nPerSim; i++) {
      const idx = Math.floor(rng() * list.length);
      const result = list[idx]?.result;
      sum += typeof result === 'number' ? result : 0;
    }
    outcomes[s] = sum;
  }

  outcomes.sort((a, b) => a - b);
  const percentile = (p) => {
    const idx = Math.min(outcomes.length - 1, Math.max(0, Math.floor(p * outcomes.length)));
    return outcomes[idx];
  };
  const sum = outcomes.reduce((s, v) => s + v, 0);

  return {
    samplePoolSize: list.length,
    nSims,
    nPerSim,
    p10: percentile(0.10),
    p25: percentile(0.25),
    p50: percentile(0.50),
    p75: percentile(0.75),
    p90: percentile(0.90),
    min: outcomes[0],
    max: outcomes[outcomes.length - 1],
    mean: sum / outcomes.length,
    reason: null,
  };
}

/**
 * Conveniência: combina selectSamplePool + runMonteCarloBootstrap.
 */
export function projectNextCycle({ priorCycleTrades, allTrades, nPerSim, options = {} }) {
  const { pool, source } = selectSamplePool(priorCycleTrades, allTrades);
  const result = runMonteCarloBootstrap(pool, nPerSim, options);
  return { ...result, samplePool: source };
}
