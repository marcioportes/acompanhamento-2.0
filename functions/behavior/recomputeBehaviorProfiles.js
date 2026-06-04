/**
 * recomputeBehaviorProfiles — camada de persistência do motor comportamental (Fase 2 #301).
 *
 * Recebe os dados JÁ carregados (trades/plans/orders/emotions) por quem chama
 * (recomputeForStudent / backfill), roda `buildBehaviorProfiles` (puro) e grava
 * `trade.behaviorProfile` SÓ nos trades cujo `fingerprint` mudou (idempotência →
 * anti-loop + custo). Escreve apenas o campo `behaviorProfile`: como ele está fora
 * do guard de `onTradeUpdated` (index.js:1446), o write não re-dispara recompute.
 *
 * Isolado (INV-03): o caller envolve em try/catch — falha aqui não afeta maturidade.
 */

const { buildBehaviorProfiles } = require('./buildBehaviorProfile');
const { buildGetEmotionConfig } = require('../maturity/emotionalAnalysisMirror');

const BATCH_LIMIT = 450; // Firestore: 500 ops/batch; margem de segurança.

/**
 * @param {Object} db                — Firestore (admin)
 * @param {Object} admin             — firebase-admin (p/ FieldValue.serverTimestamp)
 * @param {Object} params
 * @param {Object[]} params.trades   — trades do aluno (com `behaviorProfile` atual, se houver)
 * @param {Object[]} [params.plans]
 * @param {Object[]} [params.orders]
 * @param {Object[]} [params.emotions]
 * @param {'auto'|'backfill'|'mentor'} [params.computedBy='auto']
 * @returns {Promise<{written:number, scanned:number}>}
 */
async function recomputeBehaviorProfiles(db, admin, {
  trades = [], plans = [], orders = [], emotions = [], computedBy = 'auto',
} = {}) {
  if (!Array.isArray(trades) || trades.length === 0) return { written: 0, scanned: 0 };

  const getEmotionConfig = buildGetEmotionConfig(emotions);
  const profiles = buildBehaviorProfiles({ trades, orders, plans, getEmotionConfig });

  // Só grava onde o fingerprint mudou vs. o que já está no doc.
  const existingByTrade = new Map(trades.map((t) => [t.id, t && t.behaviorProfile]));
  const toWrite = [];
  for (const [tradeId, profile] of profiles) {
    const existing = existingByTrade.get(tradeId);
    if (existing && existing.fingerprint === profile.fingerprint) continue;
    toWrite.push([tradeId, profile]);
  }
  if (toWrite.length === 0) return { written: 0, scanned: profiles.size };

  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  let written = 0;
  for (let i = 0; i < toWrite.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const [tradeId, profile] of toWrite.slice(i, i + BATCH_LIMIT)) {
      const ref = db.collection('trades').doc(tradeId);
      // SÓ behaviorProfile: fora do guard de onTradeUpdated → não re-dispara.
      batch.update(ref, { behaviorProfile: { ...profile, computedAt: serverTimestamp, computedBy } });
      written += 1;
    }
    await batch.commit();
  }
  return { written, scanned: profiles.size };
}

module.exports = { recomputeBehaviorProfiles };
