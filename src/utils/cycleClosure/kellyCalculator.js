/**
 * kellyCalculator.js — Kelly fraction real (substitui stub buildRetailConstraints)
 *
 * Pure function consumida pelo wizard etapa "Adjust" (Fase 6) para sugerir size.
 * Default Quarter-Kelly (cap 0.25) por convenção (Thorp). Configurável global por mentor.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Memória de cálculo:
 *   edge        = expectancy_R × R                    (ganho esperado por trade em R$)
 *   variance    = std(R-multiples)²                   (volatilidade dos retornos em R)
 *   kelly_full  = edge / (variance × R²)              (% do capital por trade — full Kelly)
 *   kelly_safe  = kelly_full × cap                    (cap default 0.25 = Quarter)
 *
 * Sample size guard: kelly_full requer mínimo viável de trades (default 10) para
 * variance ser estimável. Abaixo disso, retorna null com reason='insufficient_sample'.
 */

import { computeR, computeTradeRMultiple } from './cycleMetrics';

const DEFAULT_CAP = 0.25;
const DEFAULT_MIN_SAMPLE = 10;

/**
 * Variância amostral (n-1) — Bessel correction.
 */
function sampleVariance(values) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return sumSq / (n - 1);
}

/**
 * @param {Array} trades — trades fechados do ciclo (ou pool maior pra estimativa)
 * @param {Object} plan — plan.pl + plan.riskPerOperation
 * @param {Object} [options]
 * @param {number} [options.cap=0.25]       — multiplicador Kelly (Quarter=0.25, Half=0.5, Full=1)
 * @param {number} [options.minSample=10]   — mínimo de trades pra estimar variance
 * @returns {Object}
 *   {
 *     edge, variance, kellyFull, kellySafe, cap, sampleSize,
 *     R, expectancy_R,
 *     reason: null | 'no_plan' | 'no_trades' | 'insufficient_sample' | 'zero_variance',
 *   }
 */
export function computeKelly(trades, plan, options = {}) {
  const cap = typeof options.cap === 'number' && options.cap > 0 && options.cap <= 1
    ? options.cap
    : DEFAULT_CAP;
  const minSample = typeof options.minSample === 'number' && options.minSample >= 2
    ? options.minSample
    : DEFAULT_MIN_SAMPLE;

  const R = computeR(plan);
  if (R === null) {
    return {
      edge: null, variance: null, kellyFull: null, kellySafe: null,
      cap, sampleSize: 0, R: null, expectancy_R: null,
      reason: 'no_plan',
    };
  }

  const list = Array.isArray(trades) ? trades : [];
  const rMultiples = list
    .map((t) => computeTradeRMultiple(t, R))
    .filter((v) => v !== null);

  if (rMultiples.length === 0) {
    return {
      edge: null, variance: null, kellyFull: null, kellySafe: null,
      cap, sampleSize: 0, R, expectancy_R: null,
      reason: 'no_trades',
    };
  }

  if (rMultiples.length < minSample) {
    return {
      edge: null, variance: null, kellyFull: null, kellySafe: null,
      cap, sampleSize: rMultiples.length, R, expectancy_R: null,
      reason: 'insufficient_sample',
    };
  }

  const expectancy_R = rMultiples.reduce((s, v) => s + v, 0) / rMultiples.length;
  const variance = sampleVariance(rMultiples);

  if (variance === null || variance === 0) {
    return {
      edge: null, variance, kellyFull: null, kellySafe: null,
      cap, sampleSize: rMultiples.length, R, expectancy_R,
      reason: 'zero_variance',
    };
  }

  const edge = expectancy_R * R;
  const kellyFull = edge / (variance * R * R);
  const kellySafe = kellyFull * cap;

  return {
    edge,
    variance,
    kellyFull,
    kellySafe,
    cap,
    sampleSize: rMultiples.length,
    R,
    expectancy_R,
    reason: null,
  };
}
