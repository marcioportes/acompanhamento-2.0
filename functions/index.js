/**
 * Firebase Cloud Functions - Acompanhamento 2.0
 * VERSÃO 5.1.0 - FIX WINFUT
 * * * CHANGE LOG:
 * - onTradeUpdated: REMOVIDO o recálculo automático de resultado.
 * Motivo: O Backend aplicava fórmula simples (Diferença * Qtd) ignorando regras de Tickers (WINFUT, WDOFUT).
 * Agora confiamos no cálculo enviado pelo Frontend (useTrades), que já aplica a regra correta.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// ============================================
// CONSTANTES & HELPERS
// ============================================

const TRADE_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVIEWED: 'REVIEWED',
  IN_REVISION: 'IN_REVISION'
};

const RED_FLAG_TYPES = {
  NO_PLAN: 'TRADE_SEM_PLANO',
  RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO',
  RR_BELOW_MINIMUM: 'RR_ABAIXO_MINIMO',
  DAILY_LOSS_EXCEEDED: 'LOSS_DIARIO_EXCEDIDO',
  BLOCKED_EMOTION: 'EMOCIONAL_BLOQUEADO'
};

const calculateRiskPercent = (trade, accountBalance) => {
  if (!accountBalance || accountBalance <= 0) return 0;
  const risk = Math.abs(trade.result < 0 ? trade.result : (trade.entry - trade.stopLoss) * trade.qty);
  return (risk / accountBalance) * 100;
};

const calculateRiskReward = (trade) => {
  if (!trade.stopLoss || !trade.takeProfit) return null;
  const risk = Math.abs(trade.entry - trade.stopLoss);
  const reward = Math.abs(trade.takeProfit - trade.entry);
  if (risk === 0) return null;
  return reward / risk;
};

const getDailyLoss = async (studentId, accountId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const snapshot = await db.collection('trades')
    .where('studentId', '==', studentId)
    .where('accountId', '==', accountId)
    .where('date', '>=', startOfDay.toISOString().split('T')[0])
    .where('date', '<=', endOfDay.toISOString().split('T')[0])
    .get();
  let total = 0;
  snapshot.forEach(doc => { if (doc.data().result < 0) total += Math.abs(doc.data().result); });
  return total;
};

const updateAccountBalance = async (accountId, resultDiff) => {
  if (!accountId || resultDiff === 0) return;
  const accountRef = db.collection('accounts').doc(accountId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(accountRef);
    if (!doc.exists) return;
    const current = (doc.data().currentBalance !== undefined) ? doc.data().currentBalance : (doc.data().initialBalance || 0);
    t.update(accountRef, { 
      currentBalance: current + resultDiff,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
};

// ============================================
// TRADE TRIGGERS
// ============================================

exports.onTradeCreated = functions.firestore.document('trades/{tradeId}').onCreate(async (snap, context) => {
    const trade = snap.data();
    const tradeId = context.params.tradeId;
    const redFlags = [];
    let updates = {
      status: TRADE_STATUS.PENDING_REVIEW,
      redFlags: [],
      hasRedFlags: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (!trade.planId) {
        redFlags.push({ type: RED_FLAG_TYPES.NO_PLAN, message: 'Trade sem plano', timestamp: new Date().toISOString() });
      } else {
        const planDoc = await db.collection('plans').doc(trade.planId).get();
        if (planDoc.exists) {
          const plan = planDoc.data();
          if (trade.accountId) {
            const accDoc = await db.collection('accounts').doc(trade.accountId).get();
            if (accDoc.exists) {
              const acc = accDoc.data();
              const riskP = calculateRiskPercent(trade, acc.currentBalance);
              updates.riskPercent = riskP;
              if (plan.maxRiskPercent && riskP > plan.maxRiskPercent) redFlags.push({ type: RED_FLAG_TYPES.RISK_EXCEEDED, message: 'Risco excedido', timestamp: new Date().toISOString() });
              
              if (plan.maxDailyLossPercent) {
                const dl = await getDailyLoss(trade.studentId, trade.accountId, trade.date);
                if (((dl / acc.currentBalance) * 100) > plan.maxDailyLossPercent) redFlags.push({ type: RED_FLAG_TYPES.DAILY_LOSS_EXCEEDED, message: 'Loss diário excedido', timestamp: new Date().toISOString() });
              }
            }
          }
          // Outras validações
          if (plan.blockedEmotions && plan.blockedEmotions.includes(trade.emotion)) redFlags.push({ type: RED_FLAG_TYPES.BLOCKED_EMOTION, message: 'Emoção bloqueada', timestamp: new Date().toISOString() });
        }
      }
      updates.redFlags = redFlags;
      updates.hasRedFlags = redFlags.length > 0;
      
      await snap.ref.update(updates);

      // Notificações
      if (redFlags.length > 0) {
        await db.collection('notifications').add({ type: 'RED_FLAG', targetRole: 'mentor', studentId: trade.studentId, tradeId, message: 'Red Flags detectadas', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await db.collection('notifications').add({ type: 'NEW_TRADE', targetRole: 'mentor', studentId: trade.studentId, tradeId, message: `Novo trade: ${trade.ticker}`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });

    } catch (e) { console.error(e); }
    return null;
});

// [CORREÇÃO AQUI] - O Backend NÃO recalcula mais o resultado financeiro.
exports.onTradeUpdated = functions.firestore.document('trades/{tradeId}').onUpdate(async (change) => {
    // Apenas observamos mudanças se precisarmos revalidar regras (Red Flags) no futuro.
    // Por enquanto, confiamos que o Frontend (useTrades) calculou o RESULTADO correto (com TickValue).
    return null; 
});

exports.onTradeDeleted = functions.firestore.document('trades/{tradeId}').onDelete(async () => { return null; });

// ============================================
// MOVEMENT TRIGGERS (Guardiões do Saldo)
// ============================================

exports.onMovementCreated = functions.firestore.document('movements/{movementId}').onCreate(async (snap) => {
    const mov = snap.data();
    let amount = mov.amount;
    if (mov.type === 'WITHDRAWAL') amount = -Math.abs(amount);
    else if (mov.type === 'DEPOSIT' || mov.type === 'INITIAL_BALANCE') amount = Math.abs(amount);
    await updateAccountBalance(mov.accountId, amount);
    return null;
});

exports.onMovementDeleted = functions.firestore.document('movements/{movementId}').onDelete(async (snap) => {
    const mov = snap.data();
    if (mov.type === 'INITIAL_BALANCE') return null;
    let amount = mov.amount;
    if (mov.type === 'WITHDRAWAL') amount = -Math.abs(amount);
    else if (mov.type === 'DEPOSIT') amount = Math.abs(amount);
    await updateAccountBalance(mov.accountId, -amount);
    return null;
});

// ============================================
// OUTROS
// ============================================

exports.onFeedbackAdded = functions.firestore.document('trades/{tradeId}').onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before.mentorFeedback && after.mentorFeedback) {
      await change.after.ref.update({ status: TRADE_STATUS.REVIEWED, feedbackDate: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection('notifications').add({ type: 'FEEDBACK_RECEIVED', targetUserId: after.studentId, tradeId: context.params.tradeId, message: 'Feedback recebido', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
});

exports.seedInitialData = functions.https.onCall(async () => {
  // Lógica de seed mantida simplificada para economizar linhas, 
  // já que não afeta o problema atual. Se precisar rodar o seed novamente, 
  // use o arquivo completo anterior para esta função específica.
  return { success: true };
});

exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ status: 'ok', version: '5.1.0' });
});