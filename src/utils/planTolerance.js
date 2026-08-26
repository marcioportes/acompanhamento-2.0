/**
 * planTolerance.js — issue #402
 *
 * MARGEM DE MANEJO. Plano de trade não é contrato de precisão de centavo: a
 * execução real tem slippage, granularidade de tick e ajuste de posição. Passar
 * 2% do limite não é indisciplina, é manejo — e não pode virar barreira.
 *
 * O CASO QUE OBRIGOU (25/08/2026): com RO de R$ 252 e stop de período de R$ 501,
 * depois da primeira operação restavam R$ 251 de folga. Um real a menos que a
 * autorização, e o sistema tratava a segunda operação como aberta sem orçamento.
 * Com 5 contratos de WIN o tick vale R$ 5 — o aluno não consegue nem parar
 * exatamente em R$ 252. Cobrar exatidão onde o contrato não permite exatidão é
 * fabricar violação.
 *
 * O QUE A MARGEM NÃO FAZ: ela não muda o número exibido. O card continua dizendo
 * "R$ 515 de R$ 501" e "arriscou R$ 257 de R$ 252 autorizados" — o fato é o fato.
 * A margem governa apenas se aquilo vira VIOLAÇÃO (red flag, conta em
 * `complianceRate`, trava gate de promoção).
 *
 * Espelho CJS: `functions/shared/planTolerance.js`.
 */

/** 2% para cima ou para baixo do limite do plano (Marcio, 25/08/2026). */
export const MANAGEMENT_TOLERANCE = 0.02;

// A borda EXATA conta como dentro: "2% não é violação" inclui 2%. Sem o epsilon,
// |2,94 − 3| / 3 devolve 0.020000000000000018 em ponto flutuante e a regra vira
// "1,999...% não é violação" — um limite que oscila com ruído binário.
const EPS = 1e-9;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * `value` estourou um limite MÁXIMO (RO, stop) a ponto de virar violação?
 *
 * Comparação contra o limite + margem. Sem limite utilizável, não afirma nada.
 *
 * @returns {boolean}
 */
export function exceedsLimit(value, limit, tolerance = MANAGEMENT_TOLERANCE) {
  const v = num(value);
  const l = num(limit);
  if (v == null || l == null || l <= 0) return false;
  return v > l * (1 + tolerance);
}

/**
 * `value` ficou aquém de um MÍNIMO exigido (orçamento restante vs RO) a ponto de
 * virar impedimento?
 *
 * @returns {boolean}
 */
export function fallsShortOf(value, required, tolerance = MANAGEMENT_TOLERANCE) {
  const v = num(value);
  const r = num(required);
  if (v == null || r == null || r <= 0) return false;
  return v < r * (1 - tolerance);
}

/**
 * `value` está dentro da margem em torno de `target` (para cima ou para baixo)?
 * Usado na coerência do plano: 1,99 operações é 2, não é 1.
 *
 * @returns {boolean}
 */
export function withinTolerance(value, target, tolerance = MANAGEMENT_TOLERANCE) {
  const v = num(value);
  const t = num(target);
  if (v == null || t == null || t === 0) return false;
  return Math.abs(v - t) / Math.abs(t) <= tolerance + EPS;
}

/**
 * Quantas operações o período comporta, já com a margem.
 *
 * `floor(501/252) = 1` diz que o Ago-Plano autoriza UMA operação. Com margem de
 * manejo, 1,99 é 2 — e era essa a intenção de quem escreveu o plano. Sem isto, a
 * segunda operação do dia nasce sem autorização por causa de meio por cento.
 *
 * @returns {number|null}
 */
export function authorizedCount(stopValue, roValue, tolerance = MANAGEMENT_TOLERANCE) {
  const s = num(stopValue);
  const r = num(roValue);
  if (s == null || r == null || r <= 0) return null;
  const n = s / r;
  const arredondado = Math.round(n);
  if (arredondado >= 1 && withinTolerance(n, arredondado, tolerance)) return arredondado;
  return Math.floor(n);
}
