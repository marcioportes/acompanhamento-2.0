/**
 * linkOrdersToCreatedTrade.js
 * @version 1.0.0 (v1.83.5 — issue #351)
 * @description Liga os docs de `orders` ao trade que o próprio Order Import acabou de criar.
 *
 * PROBLEMA (issue #351, achado do dry-run de backfill):
 *   No pipeline de importação, `correlateOrders` + `ingestBatch` rodam contra os trades que
 *   JÁ existem (`OrderImportPage.handleStagingConfirm`). Operações classificadas como `new`
 *   só viram trade depois, em `createTradesBatch` — e nada voltava para ligar as ordens ao
 *   trade recém-criado. Resultado: todo trade nascido do Order Import ficava com 100% das
 *   suas ordens órfãs (`correlatedTradeId: null`), invisíveis para o painel de ordens do
 *   trade, para o `ExecutionPatternsPanel` e para o sensor comportamental de execução.
 *   Medição em produção (18/08/2026): 194 de 198 órfãos corrigíveis vinham por este caminho.
 *
 * POR QUE SERVER-SIDE:
 *   `firestore.rules` tem `allow update: if false` em `/orders/{docId}` — o cliente pode criar
 *   mas não pode atualizar. Fazer a ligação no cliente exigiria relaxar a regra. Mesma escolha
 *   já feita para o destrave do lock comportamental em `onTradeUpdated`.
 *
 * CASAMENTO:
 *   `_partials` do trade → fingerprint `INSTRUMENT|SIDE|filledAt|qty` → doc de `orders` do
 *   mesmo `batchId`. É o mesmo fingerprint de `orderMatchFingerprint` (src/utils/
 *   conversationalIngest.js); `orders` não carrega `externalOrderId`, então o composto é o
 *   caminho disponível. O lado do trade deriva de `side` + `type` da parcial: num LONG,
 *   ENTRY = BUY e EXIT = SELL.
 *
 * CONSERVADOR: só toca docs com `correlatedTradeId` ausente/nulo. Nunca sobrescreve
 * correlação existente (que veio da correlação real no import, com confidence medida).
 */

const FIRESTORE_BATCH_SIZE = 400;

/** Fingerprint composto — espelha `orderMatchFingerprint` do front. */
const fingerprint = (instrument, side, filledAt, qty) =>
  `${(instrument || '').toUpperCase()}|${side || ''}|${filledAt || ''}|${qty ?? ''}`;

/** Fingerprint de um doc da collection `orders`. */
const orderDocFingerprint = (d) =>
  fingerprint(d.instrument, d.side, d.filledAt || '', d.filledQuantity ?? d.quantity ?? '');

/**
 * Fingerprints esperados das ordens de um trade, derivados das parciais.
 * @param {Object} trade — doc de `trades` (precisa de ticker, side, _partials)
 * @returns {Set<string>}
 */
const tradeOrderFingerprints = (trade) => {
  const fps = new Set();
  const isLong = trade.side === 'LONG';
  for (const p of (trade._partials || [])) {
    if (!p?.dateTime) continue;
    const orderSide = p.type === 'ENTRY'
      ? (isLong ? 'BUY' : 'SELL')
      : (isLong ? 'SELL' : 'BUY');
    fps.add(fingerprint(trade.ticker, orderSide, p.dateTime, p.qty));
  }
  return fps;
};

/**
 * Liga as ordens do batch de importação ao trade recém-criado.
 *
 * @param {Object} db — admin.firestore()
 * @param {Object} params
 * @param {string} params.tradeId
 * @param {Object} params.trade — doc do trade criado
 * @returns {Promise<{ skipped: boolean, reason?: string, linked: number }>}
 */
async function linkOrdersToCreatedTrade(db, { tradeId, trade }) {
  if (!trade || trade.source !== 'order_import' || !trade.importBatchId) {
    return { skipped: true, reason: 'trade não veio do Order Import', linked: 0 };
  }

  const fps = tradeOrderFingerprints(trade);
  if (fps.size === 0) {
    return { skipped: true, reason: 'trade sem parciais com horário', linked: 0 };
  }

  const snap = await db.collection('orders').where('batchId', '==', trade.importBatchId).get();
  if (snap.empty) {
    return { skipped: true, reason: 'batch sem orders ingeridas', linked: 0 };
  }

  const targets = snap.docs.filter((doc) => {
    const d = doc.data();
    if (d.correlatedTradeId) return false;
    return fps.has(orderDocFingerprint(d));
  });

  if (targets.length === 0) {
    return { skipped: true, reason: 'nenhuma order órfã casou com as parciais', linked: 0 };
  }

  let linked = 0;
  for (let i = 0; i < targets.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = targets.slice(i, i + FIRESTORE_BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, {
        correlatedTradeId: tradeId,
        correlationConfidence: 1,
        correlationSource: 'import_created',
      });
    }
    await batch.commit();
    linked += chunk.length;
  }

  return { skipped: false, linked };
}

module.exports = {
  linkOrdersToCreatedTrade,
  // exportados para teste
  tradeOrderFingerprints,
  orderDocFingerprint,
};
