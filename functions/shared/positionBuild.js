/**
 * functions/shared/positionBuild.js
 * @version 1.0.0 (issue #477)
 * @description Montagem de posição a partir das ordens do trade — FATO, sem emoção.
 *
 * Espelho CJS de `src/utils/positionBuild.js` — manter o CORPO IDÊNTICO (paridade testada
 * em `src/__tests__/functions/shared/issue477Mirror.test.js`). A definição de perna e de
 * proteção NÃO mora aqui: vem de `orderProtection` (`legsOf`, `legRejectionOf`,
 * `isPositionProtection`).
 */
const { orderInstantMs } = require('./orderInstant');
const { legsOf, legRejectionOf, isPositionProtection } = require('./orderProtection');

/** ---- corpo espelhado (#477) ---- */

/**
 * Entradas separadas por menos que isto são a MESMA leva — entrada escalonada, não
 * montagem (#392: no 21/08 as duas pernas saíram com 3 s de diferença).
 */
const SAME_BATCH_MS = 60 * 1000;

const POSITION_BUILD_DIRECTION = Object.freeze({
  AGAINST: 'AGAINST', // adição contra a posição — preço médio para trás
  FAVOR: 'FAVOR',     // adição a favor da posição — preço médio para frente
});

const tsOf = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * A posição do trade no formato de `orderProtection`: entradas = ordens do lado da entrada
 * executadas DENTRO da vida da posição (entrada − 60 s, saída + 60 s). Blinda contra ordem
 * correlacionada ao trade errado (18/05: execução das 12:26 amarrada a trade fechado 11:31).
 */
function positionOfTrade(trade, orders) {
  const lado = trade && trade.side === 'LONG' ? 'BUY' : trade && trade.side === 'SHORT' ? 'SELL' : null;
  if (!lado) return null;
  const instant = (v) => orderInstantMs(trade, v);
  const abre = tsOf(trade.entryTime);
  const fecha = tsOf(trade.exitTime);
  const entryOrders = (orders || []).filter((o) => {
    if (!o || o.isStopOrder || o.side !== lado) return false;
    if (o.status !== 'FILLED' && o.status !== 'PARTIALLY_FILLED') return false;
    if (abre == null || fecha == null) return true;
    const ts = instant(o.filledAt || o.submittedAt);
    return ts == null || (ts >= abre - SAME_BATCH_MS && ts <= fecha + SAME_BATCH_MS);
  });
  return {
    side: trade.side,
    ticker: trade.ticker || null,
    instrument: trade.ticker || trade.instrument || null,
    entry: trade.entry,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    entryOrders,
  };
}

/**
 * Leitura da montagem: levas de entrada (pernas a menos de 60 s viram uma), a direção de
 * cada adição em relação ao preço médio do que já estava aberto, e se cada leva nasceu
 * com proteção própria (ordem de proteção enviada junto com a perna, pela definição de
 * `orderProtection`).
 *
 * @returns {{levas:Array<{ts:number, price:number, qty:number, protected:boolean, direction:string|null}>,
 *            against:number, favor:number, allProtected:boolean}|null}
 */
function positionBuildOf(trade, orders) {
  const position = positionOfTrade(trade, orders);
  if (!position || !position.entryOrders.length) return null;
  const ctx = { instant: (v) => orderInstantMs(trade, v) };
  const legs = legsOf(position, ctx);
  if (!legs.length) return null;
  const protCtx = { instant: ctx.instant, legs };

  const legProtected = (leg) => (orders || []).some((o) => o
    && !legRejectionOf(o, leg, position, ctx)
    && isPositionProtection(o, position, protCtx));

  const levas = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const ultima = levas[levas.length - 1];
    const prot = legProtected(leg);
    if (ultima && leg.ts - ultima.ts < SAME_BATCH_MS) {
      const qty = ultima.qty + leg.qty;
      ultima.price = Math.round(((ultima.price * ultima.qty + leg.price * leg.qty) / qty) * 1e6) / 1e6;
      ultima.qty = qty;
      ultima.protected = ultima.protected && prot;
    } else {
      levas.push({ ts: leg.ts, price: leg.price, qty: leg.qty, protected: prot, direction: null });
    }
  }

  let against = 0;
  let favor = 0;
  let somaPxQ = levas.length ? levas[0].price * levas[0].qty : 0;
  let somaQ = levas.length ? levas[0].qty : 0;
  for (let i = 1; i < levas.length; i++) {
    const l = levas[i];
    const medio = somaPxQ / somaQ;
    // SHORT vendendo mais caro / LONG comprando mais barato = o mercado foi contra.
    const contra = position.side === 'SHORT' ? l.price > medio : l.price < medio;
    const aFavor = position.side === 'SHORT' ? l.price < medio : l.price > medio;
    if (contra) { l.direction = POSITION_BUILD_DIRECTION.AGAINST; against += 1; }
    else if (aFavor) { l.direction = POSITION_BUILD_DIRECTION.FAVOR; favor += 1; }
    somaPxQ += l.price * l.qty;
    somaQ += l.qty;
  }
  return {
    levas,
    against,
    favor,
    allProtected: levas.every((l) => l.protected),
  };
}

/** ---- fim do corpo espelhado ---- */

module.exports = {
  SAME_BATCH_MS,
  POSITION_BUILD_DIRECTION,
  positionOfTrade,
  positionBuildOf,
};
