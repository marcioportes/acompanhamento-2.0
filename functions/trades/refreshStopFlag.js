/**
 * refreshStopFlag.js — aviso de stop do trade a partir das ordens ligadas a ele (#475).
 *
 * `TRADE_SEM_STOP` (violação) × `STOP_INICIAL_A_INFORMAR` (pendência) depende de as ordens
 * do trade mostrarem proteção — regra em `functions/shared/stopFlag.js`, leitura de
 * proteção em `positionWasProtected` (a mesma do painel de ordens).
 *
 * POR QUE HÁ UM SEGUNDO PONTO ALÉM DOS GATILHOS: no trade criado pelo import, as ordens
 * chegam DEPOIS do trade. `onTradeCreated` liga só as executadas (`linkOrdersToCreatedTrade`,
 * por fingerprint de `filledAt`), e o stop que nunca executou — justamente a prova de
 * proteção no 24/09/2026 — só é ligado no fechamento do lote (`finalizeOrderImport` →
 * `purgeOrphanOrders` com os `links` do cliente). Quando o compliance de criação roda, a
 * proteção ainda não está visível; o fechamento do lote reavalia o aviso de cada trade do
 * lote com as ordens já ligadas. Gravar isso na criação exigiria campo novo (INV-15).
 *
 * Só o aviso de stop muda: os outros itens de `redFlags`, risco e R:R ficam como estão.
 * Trade discutido é intocado (INV-30): pulado antes de ler as ordens e barrado no helper.
 * A escrita em `redFlags`/`hasRedFlags` não reabre `onTradeUpdated` (guard de loop).
 */

const { isTradeImmutable, updateIfMutable } = require('../_shared/tradeImmutability');
const { stopFlagOf, withStopFlag, violationCountOf, isStopFlag } = require('../shared/stopFlag');
const { positionWasProtected } = require('../maturity/executionBehaviorMirror');

/** Ordens ligadas ao trade (`correlatedTradeId`, igualdade simples — índice automático). */
async function ordersOfTrade(db, tradeId) {
  const snap = await db.collection('orders').where('correlatedTradeId', '==', tradeId).get();
  return snap.docs.map((d) => d.data());
}

/**
 * Aviso de stop do trade. Só consulta `orders` quando o trade ficaria com aviso (sem stop
 * que proteja e sem loss) — trade com stop ou em loss não paga leitura.
 *
 * @param {Object} db
 * @param {string} tradeId
 * @param {Object} trade — dados do trade
 * @param {Object} [opts] — { timestamp?, orders? (já lidas; evita a consulta) }
 * @returns {Promise<{type:string, message:string, timestamp:string}|null>}
 */
async function stopFlagForTrade(db, tradeId, trade, opts = {}) {
  const semProtecao = stopFlagOf(trade, false, opts.timestamp);
  if (!semProtecao) return null;
  let orders = opts.orders;
  if (!orders) {
    try {
      orders = await ordersOfTrade(db, tradeId);
    } catch (err) {
      // Sem conseguir ler as ordens, vale o comportamento anterior ao #475 (violação).
      console.warn(`[stopFlagForTrade] ordens do trade ${tradeId} indisponíveis:`, err.message);
      return semProtecao;
    }
  }
  return stopFlagOf(trade, positionWasProtected({ ...trade, id: tradeId }, orders), opts.timestamp);
}

const tipoDe = (f) => (typeof f === 'string' ? f : (f && f.type));

/** Tipos de aviso de stop presentes em `redFlags`, ordenados — base da comparação. */
const stopTypesOf = (flags) => (Array.isArray(flags) ? flags : [])
  .filter(isStopFlag).map(tipoDe).sort().join(',') || null;

/**
 * Reavalia o aviso de stop de um trade e grava se mudou.
 *
 * @param {Object} db
 * @param {string} tradeId
 * @param {Object} [opts] — { dryRun?: boolean }
 * @returns {Promise<{tradeId:string, status:string, antes?:string|null, depois?:string|null}>}
 *   status: NAO_EXISTE | PRESERVADO (discutido) | INALTERADO | MUDARIA (dry-run) | ATUALIZADO
 */
async function refreshStopFlag(db, tradeId, opts = {}) {
  const ref = db.collection('trades').doc(tradeId);
  const snap = await ref.get();
  if (!snap.exists) return { tradeId, status: 'NAO_EXISTE' };
  const trade = snap.data();
  if (isTradeImmutable(trade)) return { tradeId, status: 'PRESERVADO' };

  const flag = await stopFlagForTrade(db, tradeId, trade);
  const antes = stopTypesOf(trade.redFlags);
  const depois = flag ? flag.type : null;
  if (antes === depois) return { tradeId, status: 'INALTERADO', antes, depois };
  if (opts.dryRun) return { tradeId, status: 'MUDARIA', antes, depois };

  const redFlags = withStopFlag(trade.redFlags, flag);
  const w = await updateIfMutable(ref, snap, {
    redFlags,
    hasRedFlags: violationCountOf(redFlags) > 0,
  }, 'refreshStopFlag');
  return { tradeId, status: w.written ? 'ATUALIZADO' : 'PRESERVADO', antes, depois };
}

module.exports = { refreshStopFlag, stopFlagForTrade, ordersOfTrade };
