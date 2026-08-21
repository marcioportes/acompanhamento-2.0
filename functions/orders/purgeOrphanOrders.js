/**
 * purgeOrphanOrders.js
 * @version 1.0.0 (v1.83.16)
 * @description Apaga toda ordem que não esteja atrelada a um trade vivo.
 *
 * REGRA DE PRODUTO (Marcio, 20/08/2026):
 *   **Ordem só existe atrelada a trade vivo.** Sem trade, a ordem não é registro de nada —
 *   é resíduo de importação. No import, o que casa com trade ou cria trade fica; o resto
 *   morre. Não existe ordem sem trade no banco.
 *
 * POR QUE SERVER-SIDE:
 *   `firestore.rules` tem `allow delete: if false` em `/orders` — o cliente nunca pôde
 *   limpar o que ele mesmo gravava. Foi assim que 519 ordens de importações abandonadas
 *   ficaram presas em produção, invisíveis para o painel de ordens do trade e para o
 *   sensor de execução, que agrupam por `correlatedTradeId`.
 *
 * DOIS MODOS:
 *   - varredura (sem `batchId`): respeita CARÊNCIA, porque a correlação de uma ordem
 *     recém-ingerida acontece em `onTradeCreated`, que é assíncrona. Sem a carência a
 *     varredura apagaria ordens de um import que está funcionando, no intervalo entre a
 *     ingestão e a criação do trade.
 *   - por lote (`batchId`): sem carência. Quem chama é o próprio import, no fim, depois
 *     de criar os trades — o que ficou órfão ali ficou órfão de verdade.
 *
 * @see functions/trades/cascadeDeleteTradeRefs.js — a outra ponta: apagar o trade apaga
 *      suas ordens. Juntas, as duas mantêm a invariante nos dois sentidos.
 */

const { deleteDocsInBatches } = require('../_shared/batchDelete');

/**
 * Espelho CJS de `makeOrderKey` (src/utils/orderKey.js, SSoT do #93). O cliente conhece
 * o vínculo ordem→trade por essa chave; o servidor precisa recalculá-la a partir do doc
 * para casar. Drift entre as duas cópias faz ordem sumir — mantenha idênticas.
 */
function makeOrderKey(order) {
  if (order.externalOrderId) return `eid:${order.externalOrderId}`;
  return `comp:${order.instrument}|${order.side}|${order.submittedAt || ''}|${order.quantity ?? ''}|${order.filledAt || ''}`;
}

/** Janela de proteção da varredura: import em curso não é lixo. */
const CARENCIA_MS = 15 * 60 * 1000;

const paraData = (valor) => {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * A ordem é órfã?
 *
 * @param {Object} order — doc de `orders`
 * @param {Set<string>} tradesVivos — ids de trades existentes
 * @param {Date} now
 * @param {boolean} [ignorarCarencia] — true quando o escopo é um lote recém-importado
 * @returns {boolean}
 */
function isOrphan(order, tradesVivos, now, ignorarCarencia = false) {
  if (order.correlatedTradeId && tradesVivos.has(order.correlatedTradeId)) return false;

  if (!ignorarCarencia) {
    const importada = paraData(order.importedAt);
    // Sem `importedAt` a ordem é antiga (o campo existe desde o início do CHUNK-10):
    // tratá-la como recente a tornaria imortal.
    if (importada && now.getTime() - importada.getTime() < CARENCIA_MS) return false;
  }

  return true;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} [opts]
 * @param {string} [opts.batchId] — escopa a um lote de importação (sem carência)
 * @param {string} [opts.studentId] — escopa a um aluno
 * @param {Object<string,string>} [opts.links] — { orderKey: tradeId } decidido pelo
 *   cliente. Gravado ANTES de decidir quem é órfã. É o que salva a ordem CANCELADA:
 *   `linkOrdersToCreatedTrade` casa por fingerprint com `filledAt`, que ordem cancelada
 *   não tem — sem isto, todo stop não executado seria classificado como órfão e apagado,
 *   levando junto a evidência de stop tampering e hesitação.
 * @param {Date} [opts.now]
 * @param {boolean} [opts.dryRun]
 * @returns {Promise<{deleted: number, kept: number, linked: number, dryRun: boolean, ids: string[]}>}
 */
async function purgeOrphanOrders(db, opts = {}) {
  const { batchId = null, studentId = null, links = null, dryRun = false } = opts;
  const now = opts.now || new Date();

  // Guarda de credencial: `trades` vazia faria TODA ordem parecer órfã e o banco inteiro
  // seria apagado. Mesmo cuidado do script do #363.
  const tradesSnap = await db.collection('trades').get();
  if (tradesSnap.empty) {
    throw new Error('purgeOrphanOrders abortado: collection `trades` veio vazia');
  }
  const tradesVivos = new Set(tradesSnap.docs.map((d) => d.id));

  let ordersSnap;
  if (batchId) ordersSnap = await db.collection('orders').where('batchId', '==', batchId).get();
  else if (studentId) ordersSnap = await db.collection('orders').where('studentId', '==', studentId).get();
  else ordersSnap = await db.collection('orders').get();

  // 1. Gravar os vínculos que o cliente decidiu, para que a ordem sem execução (stop
  //    cancelado, ordem expirada) também tenha trade e sobreviva à regra.
  const paraLigar = [];
  if (links && Object.keys(links).length > 0) {
    for (const doc of ordersSnap.docs) {
      const d = doc.data();
      if (d.correlatedTradeId && tradesVivos.has(d.correlatedTradeId)) continue;
      const tradeId = links[makeOrderKey(d)];
      if (tradeId && tradesVivos.has(tradeId)) paraLigar.push({ ref: doc.ref, tradeId, doc });
    }
  }
  if (!dryRun && paraLigar.length > 0) {
    for (let i = 0; i < paraLigar.length; i += 400) {
      const batch = db.batch();
      for (const { ref, tradeId } of paraLigar.slice(i, i + 400)) {
        batch.update(ref, {
          correlatedTradeId: tradeId,
          correlationConfidence: 1,
          correlationSource: 'import_decision',
        });
      }
      await batch.commit();
    }
  }
  const ligadas = new Set(paraLigar.map((x) => x.ref.id));

  // 2. Decidir quem morre.
  const orfas = [];
  let kept = 0;
  for (const doc of ordersSnap.docs) {
    if (ligadas.has(doc.ref.id)) { kept += 1; continue; }
    if (isOrphan(doc.data(), tradesVivos, now, !!batchId)) orfas.push(doc.ref);
    else kept += 1;
  }

  if (!dryRun && orfas.length > 0) {
    try {
      await deleteDocsInBatches(db, orfas);
    } catch (err) {
      console.error(`[purgeOrphanOrders] falha após ${err.deleted ?? 0} exclusões:`, err.message);
      throw err;
    }
  }

  const escopo = batchId ? `batch ${batchId}` : (studentId ? `aluno ${studentId}` : 'tudo');
  console.log(`[purgeOrphanOrders] ${escopo}: ${paraLigar.length} ligadas, ${orfas.length} órfãs${dryRun ? ' (dry-run)' : ' apagadas'}, ${kept} preservadas`);

  return { deleted: orfas.length, kept, linked: paraLigar.length, dryRun, ids: orfas.map((r) => r.id) };
}

module.exports = { purgeOrphanOrders, isOrphan, makeOrderKey, CARENCIA_MS };
