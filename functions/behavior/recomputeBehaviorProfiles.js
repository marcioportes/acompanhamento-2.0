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
 * @param {Set<string>|string[]} [params.writeScope] — quando presente, LIMITA a gravação a
 *   estes trades. O CÁLCULO continua usando `trades` inteiro.
 *
 *   #389 — separar "com que dados calcular" de "o que regravar" é o que torna o perfil
 *   determinístico. Antes, quem chamava com um recorte de período calculava COM esse
 *   recorte: os padrões que dependem da janela (cluster de vingança, overtrading, cluster
 *   impulsivo, assimetria de tempo) mudavam conforme o gatilho. O botão do mentor passava
 *   um dia; o trigger passava o histórico inteiro. Mesmo trade, duas respostas, e a última
 *   escrita vencia — foi assim que um trade revisado limpo chegou ao aluno com Hesitação.
 *
 * @returns {Promise<{written:number, scanned:number}>}
 */
async function recomputeBehaviorProfiles(db, admin, {
  trades = [], plans = [], orders = [], emotions = [], computedBy = 'auto', writeScope = null,
} = {}) {
  if (!Array.isArray(trades) || trades.length === 0) return { written: 0, scanned: 0 };

  const getEmotionConfig = buildGetEmotionConfig(emotions);
  const profiles = buildBehaviorProfiles({ trades, orders, plans, getEmotionConfig });

  // Só grava onde o fingerprint mudou vs. o que já está no doc.
  const existingByTrade = new Map(trades.map((t) => [t.id, t && t.behaviorProfile]));
  const escopo = writeScope == null
    ? null
    : (writeScope instanceof Set ? writeScope : new Set(writeScope));
  const toWrite = [];
  for (const [tradeId, profile] of profiles) {
    if (escopo && !escopo.has(tradeId)) continue;   // #389 — calcula com tudo, grava o recorte
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

/**
 * Variante que CARREGA os dados do aluno e recomputa (p/ callers que não os têm em mão,
 * ex.: on-plan-change em recalculateCompliance). Mesmas 4 coleções de recomputeForStudent.
 *
 * @param {Object} db, @param {Object} admin, @param {string} studentId
 * @param {Object} [opts] — { computedBy }
 */
async function recomputeBehaviorForStudent(db, admin, studentId, { computedBy = 'auto' } = {}) {
  if (!studentId) return { written: 0, scanned: 0 };

  const [tradesSnap, plansSnap] = await Promise.all([
    db.collection('trades').where('studentId', '==', studentId).get(),
    db.collection('plans').where('studentId', '==', studentId).get(),
  ]);
  const trades = tradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const plans = plansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let orders = [];
  try {
    const s = await db.collection('orders').where('studentId', '==', studentId).get();
    orders = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { /* orders opcional — executionEvents=[] */ }

  let emotions = [];
  try {
    const s = await db.collection('emotions').get();
    emotions = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { /* fallback neutro */ }

  return recomputeBehaviorProfiles(db, admin, { trades, plans, orders, emotions, computedBy });
}

module.exports = { recomputeBehaviorProfiles, recomputeBehaviorForStudent };
