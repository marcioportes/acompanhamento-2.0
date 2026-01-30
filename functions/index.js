/**
 * Firebase Cloud Functions - Acompanhamento 2.0
 * 
 * Triggers automáticos para:
 * - Validação de trades contra plano
 * - Engine de Red Flags
 * - Atualização de saldo da conta
 * - Notificações
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// ============================================
// CONSTANTES
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

// ============================================
// HELPERS
// ============================================

/**
 * Calcula o risco percentual do trade
 */
const calculateRiskPercent = (trade, accountBalance) => {
  if (!accountBalance || accountBalance <= 0) return 0;
  const risk = Math.abs(trade.result < 0 ? trade.result : (trade.entry - trade.stopLoss) * trade.qty);
  return (risk / accountBalance) * 100;
};

/**
 * Calcula o Risk:Reward do trade
 */
const calculateRiskReward = (trade) => {
  if (!trade.stopLoss || !trade.takeProfit) return null;
  const risk = Math.abs(trade.entry - trade.stopLoss);
  const reward = Math.abs(trade.takeProfit - trade.entry);
  if (risk === 0) return null;
  return reward / risk;
};

/**
 * Busca o loss diário acumulado
 */
const getDailyLoss = async (studentId, accountId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const tradesSnapshot = await db.collection('trades')
    .where('studentId', '==', studentId)
    .where('accountId', '==', accountId)
    .where('date', '>=', startOfDay.toISOString().split('T')[0])
    .where('date', '<=', endOfDay.toISOString().split('T')[0])
    .get();

  let totalLoss = 0;
  tradesSnapshot.forEach(doc => {
    const trade = doc.data();
    if (trade.result < 0) {
      totalLoss += Math.abs(trade.result);
    }
  });

  return totalLoss;
};

// ============================================
// TRADE CREATED - Validação inicial
// ============================================

exports.onTradeCreated = functions.firestore
  .document('trades/{tradeId}')
  .onCreate(async (snap, context) => {
    const trade = snap.data();
    const tradeId = context.params.tradeId;
    
    console.log(`[onTradeCreated] Trade ${tradeId} criado por ${trade.studentId}`);

    const redFlags = [];
    let updates = {
      status: TRADE_STATUS.PENDING_REVIEW,
      redFlags: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      // 1. Verificar se tem plano associado
      if (!trade.planId) {
        redFlags.push({
          type: RED_FLAG_TYPES.NO_PLAN,
          message: 'Trade sem plano associado',
          timestamp: new Date().toISOString()
        });
      } else {
        // 2. Buscar plano e validar regras
        const planDoc = await db.collection('plans').doc(trade.planId).get();
        
        if (planDoc.exists) {
          const plan = planDoc.data();

          // 3. Buscar conta para calcular risco %
          if (trade.accountId) {
            const accountDoc = await db.collection('accounts').doc(trade.accountId).get();
            
            if (accountDoc.exists) {
              const account = accountDoc.data();
              
              // Calcular risco percentual
              const riskPercent = calculateRiskPercent(trade, account.currentBalance);
              updates.riskPercent = riskPercent;

              // Validar risco máximo
              if (plan.maxRiskPercent && riskPercent > plan.maxRiskPercent) {
                redFlags.push({
                  type: RED_FLAG_TYPES.RISK_EXCEEDED,
                  message: `Risco ${riskPercent.toFixed(2)}% excede máximo permitido de ${plan.maxRiskPercent}%`,
                  timestamp: new Date().toISOString()
                });
              }

              // Validar loss diário
              if (plan.maxDailyLossPercent) {
                const dailyLoss = await getDailyLoss(trade.studentId, trade.accountId, trade.date);
                const dailyLossPercent = (dailyLoss / account.currentBalance) * 100;
                
                if (dailyLossPercent > plan.maxDailyLossPercent) {
                  redFlags.push({
                    type: RED_FLAG_TYPES.DAILY_LOSS_EXCEEDED,
                    message: `Loss diário ${dailyLossPercent.toFixed(2)}% excede máximo de ${plan.maxDailyLossPercent}%`,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          }

          // Validar Risk:Reward
          const riskReward = calculateRiskReward(trade);
          if (riskReward !== null) {
            updates.riskReward = riskReward;
            
            if (plan.minRiskReward && riskReward < plan.minRiskReward) {
              redFlags.push({
                type: RED_FLAG_TYPES.RR_BELOW_MINIMUM,
                message: `R:R ${riskReward.toFixed(2)} abaixo do mínimo ${plan.minRiskReward}`,
                timestamp: new Date().toISOString()
              });
            }
          }

          // Validar emoção bloqueada
          if (plan.blockedEmotions && plan.blockedEmotions.includes(trade.emotion)) {
            redFlags.push({
              type: RED_FLAG_TYPES.BLOCKED_EMOTION,
              message: `Estado emocional "${trade.emotion}" bloqueado no plano`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Atualizar trade com red flags
      updates.redFlags = redFlags;
      updates.hasRedFlags = redFlags.length > 0;

      await snap.ref.update(updates);

      // 4. Criar notificação para mentor se houver red flags
      if (redFlags.length > 0) {
        await db.collection('notifications').add({
          type: 'RED_FLAG',
          targetRole: 'mentor',
          studentId: trade.studentId,
          studentName: trade.studentName,
          tradeId: tradeId,
          message: `${trade.studentName} tem ${redFlags.length} red flag(s) no trade`,
          redFlags: redFlags.map(rf => rf.type),
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 5. Notificar mentor sobre novo trade
      await db.collection('notifications').add({
        type: 'NEW_TRADE',
        targetRole: 'mentor',
        studentId: trade.studentId,
        studentName: trade.studentName,
        tradeId: tradeId,
        message: `${trade.studentName} registrou novo trade: ${trade.ticker}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[onTradeCreated] Trade ${tradeId} processado. Red flags: ${redFlags.length}`);

    } catch (error) {
      console.error(`[onTradeCreated] Erro ao processar trade ${tradeId}:`, error);
    }

    return null;
  });

// ============================================
// TRADE UPDATED - Recalcular quando editado
// ============================================

exports.onTradeUpdated = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tradeId = context.params.tradeId;

    // Evitar loops infinitos - só processa se campos relevantes mudaram
    const relevantFields = ['entry', 'exit', 'qty', 'stopLoss', 'takeProfit', 'planId', 'emotion'];
    const hasRelevantChanges = relevantFields.some(field => before[field] !== after[field]);

    if (!hasRelevantChanges) {
      return null;
    }

    console.log(`[onTradeUpdated] Trade ${tradeId} atualizado`);

    // Recalcular resultado
    const result = (after.side === 'LONG')
      ? (after.exit - after.entry) * after.qty
      : (after.entry - after.exit) * after.qty;

    const resultPercent = after.entry > 0 
      ? ((after.exit - after.entry) / after.entry) * 100 * (after.side === 'LONG' ? 1 : -1)
      : 0;

    await change.after.ref.update({
      result,
      resultPercent,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return null;
  });

// ============================================
// FEEDBACK ADDED - Atualizar status do trade
// ============================================

exports.onFeedbackAdded = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tradeId = context.params.tradeId;

    // Verificar se feedback foi adicionado
    if (!before.mentorFeedback && after.mentorFeedback) {
      console.log(`[onFeedbackAdded] Feedback adicionado ao trade ${tradeId}`);

      // Atualizar status para REVIEWED
      await change.after.ref.update({
        status: TRADE_STATUS.REVIEWED,
        feedbackDate: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notificar aluno
      await db.collection('notifications').add({
        type: 'FEEDBACK_RECEIVED',
        targetUserId: after.studentId,
        tradeId: tradeId,
        ticker: after.ticker,
        message: `Seu trade ${after.ticker} recebeu feedback do mentor`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return null;
  });

// ============================================
// MOVEMENT CREATED - Atualizar saldo da conta
// ============================================

exports.onMovementCreated = functions.firestore
  .document('movements/{movementId}')
  .onCreate(async (snap, context) => {
    const movement = snap.data();
    const movementId = context.params.movementId;

    console.log(`[onMovementCreated] Movimento ${movementId} criado na conta ${movement.accountId}`);

    try {
      const accountRef = db.collection('accounts').doc(movement.accountId);
      const accountDoc = await accountRef.get();

      if (accountDoc.exists) {
        const account = accountDoc.data();
        let newBalance = account.currentBalance || account.initialBalance || 0;

        if (movement.type === 'DEPOSIT') {
          newBalance += movement.amount;
        } else if (movement.type === 'WITHDRAWAL') {
          newBalance -= movement.amount;
        }

        await accountRef.update({
          currentBalance: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[onMovementCreated] Saldo atualizado: ${newBalance}`);
      }
    } catch (error) {
      console.error(`[onMovementCreated] Erro:`, error);
    }

    return null;
  });

// ============================================
// TRADE RESULT - Atualizar saldo da conta
// ============================================

exports.onTradeResultUpdated = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Só atualiza saldo se resultado mudou e tem conta associada
    if (before.result === after.result || !after.accountId) {
      return null;
    }

    const tradeId = context.params.tradeId;
    console.log(`[onTradeResultUpdated] Resultado do trade ${tradeId} mudou`);

    try {
      const accountRef = db.collection('accounts').doc(after.accountId);
      const accountDoc = await accountRef.get();

      if (accountDoc.exists) {
        const account = accountDoc.data();
        
        // Reverter resultado anterior e aplicar novo
        const oldResult = before.result || 0;
        const newResult = after.result || 0;
        const diff = newResult - oldResult;

        const newBalance = (account.currentBalance || account.initialBalance || 0) + diff;

        await accountRef.update({
          currentBalance: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[onTradeResultUpdated] Saldo ajustado em ${diff}: ${newBalance}`);
      }
    } catch (error) {
      console.error(`[onTradeResultUpdated] Erro:`, error);
    }

    return null;
  });

// ============================================
// CALLABLE: Seed initial data
// ============================================

exports.seedInitialData = functions.https.onCall(async (data, context) => {
  // Verificar se é admin/mentor
  // Em produção, adicionar verificação de autenticação

  console.log('[seedInitialData] Iniciando seed de dados...');

  try {
    // Moedas
    const currencies = [
      { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$', active: true },
      { code: 'USD', name: 'Dólar Americano', symbol: '$', active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', active: true }
    ];

    for (const currency of currencies) {
      await db.collection('currencies').doc(currency.code).set(currency);
    }

    // Corretoras
    const brokers = [
      { name: 'XP Investimentos', country: 'BR', active: true },
      { name: 'Clear Corretora', country: 'BR', active: true },
      { name: 'Rico Investimentos', country: 'BR', active: true },
      { name: 'BTG Pactual', country: 'BR', active: true },
      { name: 'Interactive Brokers', country: 'US', active: true },
      { name: 'TD Ameritrade', country: 'US', active: true },
      { name: 'Apex Trader Funding', country: 'US', active: true },
      { name: 'Topstep', country: 'US', active: true },
      { name: 'FTMO', country: 'EU', active: true }
    ];

    for (const broker of brokers) {
      const docRef = await db.collection('brokers').add(broker);
      console.log(`Broker ${broker.name} criado: ${docRef.id}`);
    }

    // Tickers com especificações
    const tickers = [
      // CME Futures
      { symbol: 'ES', name: 'E-mini S&P 500', exchange: 'CME', tickSize: 0.25, tickValue: 12.50, currency: 'USD', active: true },
      { symbol: 'NQ', name: 'E-mini NASDAQ 100', exchange: 'CME', tickSize: 0.25, tickValue: 5.00, currency: 'USD', active: true },
      { symbol: 'YM', name: 'E-mini Dow Jones', exchange: 'CME', tickSize: 1, tickValue: 5.00, currency: 'USD', active: true },
      { symbol: 'RTY', name: 'E-mini Russell 2000', exchange: 'CME', tickSize: 0.1, tickValue: 5.00, currency: 'USD', active: true },
      { symbol: 'CL', name: 'Crude Oil', exchange: 'CME', tickSize: 0.01, tickValue: 10.00, currency: 'USD', active: true },
      { symbol: 'GC', name: 'Gold', exchange: 'CME', tickSize: 0.1, tickValue: 10.00, currency: 'USD', active: true },
      // Micro Futures
      { symbol: 'MES', name: 'Micro E-mini S&P 500', exchange: 'CME', tickSize: 0.25, tickValue: 1.25, currency: 'USD', active: true },
      { symbol: 'MNQ', name: 'Micro E-mini NASDAQ', exchange: 'CME', tickSize: 0.25, tickValue: 0.50, currency: 'USD', active: true },
      // B3
      { symbol: 'WINFUT', name: 'Mini Índice Bovespa', exchange: 'B3', tickSize: 5, tickValue: 0.20, currency: 'BRL', active: true },
      { symbol: 'WDOFUT', name: 'Mini Dólar', exchange: 'B3', tickSize: 0.5, tickValue: 5.00, currency: 'BRL', active: true },
      { symbol: 'INDFUT', name: 'Índice Bovespa Cheio', exchange: 'B3', tickSize: 5, tickValue: 1.00, currency: 'BRL', active: true },
      { symbol: 'DOLFUT', name: 'Dólar Cheio', exchange: 'B3', tickSize: 0.5, tickValue: 25.00, currency: 'BRL', active: true }
    ];

    for (const ticker of tickers) {
      await db.collection('tickers').doc(ticker.symbol).set(ticker);
    }

    // Setups globais
    const setups = [
      { name: 'Fractal TTrades', description: 'Setup baseado em fractais do TTrades', isGlobal: true, active: true },
      { name: 'Rompimento', description: 'Trade de rompimento de níveis importantes', isGlobal: true, active: true },
      { name: 'Pullback', description: 'Entrada em pullback após movimento forte', isGlobal: true, active: true },
      { name: 'Reversão', description: 'Trade de reversão em níveis de suporte/resistência', isGlobal: true, active: true },
      { name: 'Tendência', description: 'Trade a favor da tendência', isGlobal: true, active: true },
      { name: 'VWAP', description: 'Trade baseado em VWAP', isGlobal: true, active: true },
      { name: 'Gap', description: 'Trade de gap de abertura', isGlobal: true, active: true },
      { name: 'Scalp', description: 'Operação rápida de scalping', isGlobal: true, active: true },
      { name: 'Swing', description: 'Operação de swing trade', isGlobal: true, active: true }
    ];

    for (const setup of setups) {
      const docRef = await db.collection('setups').add({
        ...setup,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Setup ${setup.name} criado: ${docRef.id}`);
    }

    // Estados emocionais
    const emotions = [
      { name: 'Disciplinado', category: 'positive', description: 'Seguiu o plano com disciplina', active: true },
      { name: 'Confiante', category: 'positive', description: 'Confiante na análise', active: true },
      { name: 'Neutro', category: 'neutral', description: 'Estado emocional neutro', active: true },
      { name: 'Ansioso', category: 'negative', description: 'Ansiedade antes/durante o trade', active: true },
      { name: 'FOMO', category: 'negative', description: 'Medo de perder oportunidade', active: true },
      { name: 'Hesitante', category: 'negative', description: 'Hesitação na entrada/saída', active: true },
      { name: 'Eufórico', category: 'negative', description: 'Euforia após ganhos', active: true },
      { name: 'Frustrado', category: 'negative', description: 'Frustração após perdas', active: true },
      { name: 'Revenge', category: 'negative', description: 'Tentando recuperar perda', active: true },
      { name: 'Overtrading', category: 'negative', description: 'Operando em excesso', active: true }
    ];

    for (const emotion of emotions) {
      const docRef = await db.collection('emotions').add(emotion);
      console.log(`Emotion ${emotion.name} criado: ${docRef.id}`);
    }

    // Bolsas/Exchanges
    const exchanges = [
      { code: 'B3', name: 'B3 - Brasil Bolsa Balcão', country: 'BR', timezone: 'America/Sao_Paulo', active: true },
      { code: 'CME', name: 'Chicago Mercantile Exchange', country: 'US', timezone: 'America/Chicago', active: true },
      { code: 'NYSE', name: 'New York Stock Exchange', country: 'US', timezone: 'America/New_York', active: true },
      { code: 'NASDAQ', name: 'NASDAQ Stock Market', country: 'US', timezone: 'America/New_York', active: true },
      { code: 'CRYPTO', name: 'Crypto Markets', country: 'GLOBAL', timezone: 'UTC', active: true }
    ];

    for (const exchange of exchanges) {
      await db.collection('exchanges').doc(exchange.code).set(exchange);
    }

    console.log('[seedInitialData] Seed concluído com sucesso!');

    return { success: true, message: 'Dados iniciais criados com sucesso!' };

  } catch (error) {
    console.error('[seedInitialData] Erro:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// HTTP: Health check
// ============================================

exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});
