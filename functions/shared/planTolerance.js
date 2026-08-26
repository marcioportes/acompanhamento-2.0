/**
 * functions/shared/planTolerance.js
 * @version 1.0.0 (v1.83.32 — issue #402)
 * @description Espelho CJS de `src/utils/planTolerance.js` — margem de manejo.
 *
 * Plano de trade não é contrato de precisão de centavo: slippage, granularidade
 * de tick e ajuste de posição são parte da execução. Passar 2% do limite não é
 * indisciplina — e não pode virar barreira.
 *
 * A margem NÃO muda o número exibido; governa apenas se ele vira VIOLAÇÃO.
 *
 * MANTER EM SINCRONIA com `src/utils/planTolerance.js`.
 */

const MANAGEMENT_TOLERANCE = 0.02;

// A borda EXATA conta como dentro: "2% não é violação" inclui 2%. Sem o epsilon,
// |2,94 − 3| / 3 devolve 0.020000000000000018 em ponto flutuante e a regra vira
// "1,999...% não é violação" — um limite que oscila com ruído binário.
const EPS = 1e-9;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Estourou um limite MÁXIMO a ponto de virar violação? */
function exceedsLimit(value, limit, tolerance) {
  const tol = tolerance === undefined ? MANAGEMENT_TOLERANCE : tolerance;
  const v = num(value);
  const l = num(limit);
  if (v == null || l == null || l <= 0) return false;
  return v > l * (1 + tol);
}

/** Ficou aquém de um MÍNIMO exigido a ponto de virar impedimento? */
function fallsShortOf(value, required, tolerance) {
  const tol = tolerance === undefined ? MANAGEMENT_TOLERANCE : tolerance;
  const v = num(value);
  const r = num(required);
  if (v == null || r == null || r <= 0) return false;
  return v < r * (1 - tol);
}

/** Está dentro da margem em torno de `target`, para cima ou para baixo? */
function withinTolerance(value, target, tolerance) {
  const tol = tolerance === undefined ? MANAGEMENT_TOLERANCE : tolerance;
  const v = num(value);
  const t = num(target);
  if (v == null || t == null || t === 0) return false;
  return Math.abs(v - t) / Math.abs(t) <= tol + EPS;
}


/** Quantas operações o período comporta, já com a margem (1,99 é 2). */
function authorizedCount(stopValue, roValue, tolerance) {
  const tol = tolerance === undefined ? MANAGEMENT_TOLERANCE : tolerance;
  const s = num(stopValue);
  const r = num(roValue);
  if (s == null || r == null || r <= 0) return null;
  const n = s / r;
  const arredondado = Math.round(n);
  if (arredondado >= 1 && withinTolerance(n, arredondado, tol)) return arredondado;
  return Math.floor(n);
}

module.exports = { MANAGEMENT_TOLERANCE, exceedsLimit, fallsShortOf, withinTolerance, authorizedCount };
