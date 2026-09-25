/**
 * orderInstant.js — issue #464 (épico #462 F1)
 *
 * SSoT do instante de uma ordem, lado cliente. Espelho ESM de
 * `functions/shared/orderInstant.js` (#388) — o CORPO é idêntico, só muda o export
 * (paridade testada em `src/__tests__/functions/shared/orderInstantMirror.test.js`).
 *
 * POR QUE EXISTE: o mesmo defeito — ordem ingênua lida no fuso do processo contra trade
 * com offset — foi corrigido quatro vezes em quatro cópias (#296, #375, #388, #449).
 * Quem resolve instante de ordem passa por aqui; não reimplemente o parse.
 *
 * Desde o #464 `orders` é gravada com offset; o leitor aceita as duas formas.
 */

/** Sufixo de fuso num ISO: 'Z' ou '+HH:MM' / '-HHMM'. */
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/** Relógio de parede de um ISO: data + hora (sem fração), descartando o fuso. */
const WALL_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/;

/**
 * Offset de um ISO, normalizado para '+HH:MM' / '-HH:MM' ('Z' → '+00:00').
 * @returns {string|null} null quando o valor não carrega fuso (ingênuo) ou não é string
 */
function offsetOf(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(OFFSET_RE);
  if (!m) return null;
  if (m[1] === 'Z') return '+00:00';
  return m[1].indexOf(':') === -1 ? `${m[1].slice(0, 3)}:${m[1].slice(3)}` : m[1];
}

/** Offset gravado no trade (#285/#292 — entryTime/exitTime são ISO+offset). */
function tradeOffsetOf(trade) {
  const cands = [trade && trade.entryTime, trade && trade.exitTime];
  for (let i = 0; i < cands.length; i++) {
    const off = offsetOf(cands[i]);
    if (off) return off;
  }
  return null;
}

/**
 * Instante resolvido contra um offset EXPLÍCITO — o núcleo do módulo. Valor com offset
 * próprio usa o dele; ingênuo recebe `offset`; sem offset nenhum, cai no `new Date()` do
 * processo (legado: só é seguro para comparar ordem com ordem da mesma forma).
 *
 * @param {*} value — string ISO (ingênua ou com offset), Timestamp, Date ou ms
 * @param {string|null} offset — ex.: '-03:00'
 * @returns {number|null} ms, ou null quando não há instante
 */
function instantAtOffsetMs(value, offset) {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const raw = (typeof value === 'string' && offset && !OFFSET_RE.test(value))
    ? `${value}${offset}`
    : value;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Instante da ordem NO FUSO DO TRADE dono dela (#375/#388).
 * @param {Object} trade — dono da ordem (fonte do fuso)
 * @param {*} value — instante da ordem (string ISO, Timestamp ou Date)
 * @returns {number|null} milissegundos, ou null quando não há instante
 */
function orderInstantMs(trade, value) {
  return instantAtOffsetMs(value, tradeOffsetOf(trade));
}

/**
 * Relógio de parede em ms, offset-neutro (#296): `YYYY-MM-DDTHH:MM:SS` lido como se fosse
 * UTC, descartando o fuso que a string traga.
 *
 * Serve à JUNÇÃO entre ordem e trade da mesma corretora, exibidos no mesmo fuso de
 * parede — é o que o correlator do import usa desde o #296 (trade gravado em ET contra
 * ordem ingênua). É também a comparação ordem×ordem que não muda quando o conjunto
 * mistura ordem legada (ingênua) com ordem gravada com offset (#464).
 * NÃO é instante absoluto: não compare com `Date.now()` nem com trade de outro fuso.
 * Sem componente de hora (Timestamp, Date, data pura) → `instantAtOffsetMs(value, null)`.
 *
 * @returns {number|null}
 */
function wallClockMs(value) {
  if (typeof value === 'string') {
    const m = value.match(WALL_RE);
    if (m) {
      const t = new Date(`${m[1]}T${m[2]}Z`).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return instantAtOffsetMs(value, null);
}

/**
 * O instante como CHAVE: tira o offset numérico que o #464 passou a gravar em `orders`.
 * `'2026-09-09T11:22:02-03:00'` → `'2026-09-09T11:22:02'`; ingênuo passa igual.
 *
 * Chave composta de ordem (`orderKey`, `orderDedup`, `purgeOrphanOrders`) e fingerprint
 * ordem↔parcial (`linkOrdersToCreatedTrade`, `orderMatchFingerprint`) nasceram com o
 * instante do arquivo. Gravando `orders` com offset, a mesma ordem produziria duas chaves
 * — duplicata na reimportação (#362/#366) e ordem sem vínculo com o trade (#351).
 *
 * `Z` NÃO é removido: o gravador (`naiveIsoToOffset`) nunca produz `Z` — string em `Z`
 * veio assim do próprio arquivo e já está nas chaves/ids gravados. Assim nenhuma chave
 * existente muda.
 */
function stripBatchOffset(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[+-]\d{2}:?\d{2}$/, '');
}

export {
  OFFSET_RE,
  offsetOf,
  tradeOffsetOf,
  instantAtOffsetMs,
  orderInstantMs,
  wallClockMs,
  stripBatchOffset,
};
