/**
 * Cloud Function: analyzeShadowBehavior
 *
 * CF callable que analisa shadow behavior para trades de um aluno em um período.
 * Disparo: mentor via UI.
 * Layer 1: todos os trades (parciais + contexto inter-trade).
 * Layer 2: trades com ordens correlacionadas (enriquecimento).
 *
 * @see Issue #129 — Shadow Trade + Padrões Comportamentais
 *
 * Export em functions/index.js:
 *   exports.analyzeShadowBehavior = require("./analyzeShadowBehavior");
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { analyzeShadowForTradeCF, sortChronologically, SHADOW_VERSION } = require('./shadow/shadowDetectors');
const { recomputeBehaviorProfiles } = require('./behavior/recomputeBehaviorProfiles');

// ============================================
// CF callable
// ============================================

module.exports = onCall({ maxInstances: 10 }, async (request) => {
  const { studentId, dateFrom, dateTo } = request.data || {};

  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId é obrigatório');
  }

  const db = getFirestore();

  // Fetch trades for student in period
  // Query single-field por studentId (nao requer indice composto novo).
  // Filtro por periodo aplicado client-side — sem orderBy na query para evitar
  // dependencia de indice ASC especifico (o existente `studentId + date DESC`
  // nao serve para range query sem orderBy correspondente).
  const tradesSnap = await db.collection('trades').where('studentId', '==', studentId).get();
  if (tradesSnap.empty) {
    return { analyzed: 0, total: 0, ordersFound: 0, message: 'Nenhum trade encontrado para o aluno.' };
  }

  const allStudentTrades = tradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const trades = allStudentTrades.filter(t => {
    if (dateFrom && (t.date || '') < dateFrom) return false;
    if (dateTo && (t.date || '') > dateTo) return false;
    return true;
  });

  if (trades.length === 0) {
    return { analyzed: 0, total: 0, ordersFound: 0, message: 'Nenhum trade encontrado no período.' };
  }

  const sorted = sortChronologically(trades);

  // Enrich trades with planRoPct (for UNDERSIZED_TRADE detector)
  const planIds = [...new Set(sorted.map(t => t.planId).filter(Boolean))];
  const plansById = {};
  await Promise.all(planIds.map(async (pid) => {
    const planDoc = await db.collection('plans').doc(pid).get();
    if (planDoc.exists) {
      plansById[pid] = planDoc.data();
    }
  }));
  for (const trade of sorted) {
    if (trade.planId && plansById[trade.planId]) {
      const plan = plansById[trade.planId];
      trade.planRoPct = plan.riskPerOperation ?? null;
      trade.planPl = plan.pl ?? plan.currentPl ?? null;
      trade.planRrTarget = plan.rrTarget ?? 2;
    }
  }

  // Fetch orders by studentId (single-field, nao requer indice composto).
  // orders docs nao tem campo `date` canonico — so submittedAt/filledAt/importedAt.
  // Amarramos ao periodo via correlatedTradeId x trades do periodo.
  const ordersSnap = await db.collection('orders').where('studentId', '==', studentId).get();
  const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Fase 2 #301: emoções p/ o sinal tilt/revenge do motor no backfill (getEmotionConfig).
  let emotions = [];
  try {
    const emSnap = await db.collection('emotions').get();
    emotions = emSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) { /* fallback neutro */ }

  const tradeIdsInPeriod = new Set(trades.map(t => t.id));
  const ordersByTradeId = {};
  for (const order of allOrders) {
    const tradeId = order.correlatedTradeId;
    if (tradeId && tradeIdsInPeriod.has(tradeId)) {
      if (!ordersByTradeId[tradeId]) ordersByTradeId[tradeId] = [];
      ordersByTradeId[tradeId].push(order);
    }
  }

  // Analyze each trade
  const batch = db.batch();
  let analyzed = 0;

  for (const trade of sorted) {
    const adjacent = sorted.filter(t =>
      t.id !== trade.id && t.studentId === trade.studentId && t.date === trade.date
    );
    const orders = ordersByTradeId[trade.id] || null;
    const shadow = analyzeShadowForTradeCF(trade, adjacent, orders);

    if (shadow) {
      const tradeRef = db.collection('trades').doc(trade.id);
      batch.update(tradeRef, { shadowBehavior: shadow, updatedAt: FieldValue.serverTimestamp() });
      analyzed++;
    }
  }

  if (analyzed > 0) {
    await batch.commit();
  }

  // Fase 2 #301: (re)computa e SOBRESCREVE behaviorProfile dos mesmos trades (inclui legados
  // sem profile). Reusa o wrapper puro; adminShim só precisa de FieldValue.serverTimestamp.
  const plansArr = Object.entries(plansById).map(([id, planData]) => ({ id, ...planData }));
  let behaviorWritten = 0;
  try {
    const r = await recomputeBehaviorProfiles(db, { firestore: { FieldValue } }, {
      trades: sorted, plans: plansArr, orders: allOrders, emotions, computedBy: 'backfill',
    });
    behaviorWritten = r.written;
  } catch (e) {
    console.warn('[analyzeShadowBehavior] behaviorProfile backfill failed:', e.message);
  }

  console.log(`[analyzeShadowBehavior] ${analyzed}/${trades.length} shadow + ${behaviorWritten} behaviorProfile para ${studentId} (${dateFrom || '*'} a ${dateTo || '*'})`);

  return {
    analyzed,
    total: trades.length,
    ordersFound: allOrders.length,
    behaviorWritten,
    message: `${analyzed} trades (shadow) · ${behaviorWritten} perfis comportamentais atualizados.`
  };
});
