/**
 * computeExcursionFromBars.js — issue #187 Fase 4
 *
 * Função pura: dado um array de bars OHLC (ou só high/low) + side, retorna
 * mepPrice/menPrice. Discard das bars depois (compute&discard, DEC-AUTO-187-02).
 *
 * Convenção:
 *   LONG  → mepPrice = max(highs)  menPrice = min(lows)
 *   SHORT → mepPrice = min(lows)   menPrice = max(highs)
 *
 * (Para SHORT, "favorável" = preço mais baixo durante o trade; "adverso" = mais alto.)
 */

/**
 * @param {Object} input
 * @param {Array<{h: number, l: number}>} input.bars
 * @param {'LONG'|'SHORT'} input.side
 * @returns {{mepPrice: number|null, menPrice: number|null}}
 */
function computeExcursionFromBars({ bars, side }) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { mepPrice: null, menPrice: null };
  }
  if (side !== 'LONG' && side !== 'SHORT') {
    return { mepPrice: null, menPrice: null };
  }

  let high = -Infinity;
  let low = Infinity;
  let any = false;
  for (const b of bars) {
    // Number(null) = 0 — guard explícito antes de cair em finite check
    const h = (b?.h == null) ? NaN : Number(b.h);
    const l = (b?.l == null) ? NaN : Number(b.l);
    if (Number.isFinite(h) && Number.isFinite(l)) {
      if (h > high) high = h;
      if (l < low) low = l;
      any = true;
    }
  }
  if (!any) return { mepPrice: null, menPrice: null };

  if (side === 'LONG') {
    return { mepPrice: round(high), menPrice: round(low) };
  }
  return { mepPrice: round(low), menPrice: round(high) };
}

function round(n) {
  return Math.round(n * 100000) / 100000;
}

module.exports = { computeExcursionFromBars };
