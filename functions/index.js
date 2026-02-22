/**
 * Firebase Cloud Functions - Tchio-Alpha
 * @version 1.4.0
 * 
 * SEMANTIC VERSIONING (SemVer 2.0.0)
 * MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * CHANGELOG v1.4.0:
 *   - createStudent agora escreve na coleção /mail (Trigger Email Extension)
 *   - resendStudentInvite também escreve na coleção /mail
 *   - Adicionado helper sendWelcomeEmail() e getWelcomeEmailHtml()
 *   - Template HTML de boas-vindas com link de reset de senha
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ============================================
// VERSÃO (SemVer 2.0.0)
// ============================================

const VERSION = {
  major: 1,
  minor: 4,
  patch: 0,
  prerelease: null,
  build: '20260222',
  
  get full() {
    let v = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    if (this.build) v += `+${this.build}`;
    return v;
  },
  
  get short() {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  
  get display() {
    return `v${this.short}${this.prerelease ? ` ${this.prerelease.toUpperCase()}` : ''}`;
  },

  get semver() {
    let v = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    return v;
  }
};

// ============================================
// CONFIGURAÇÃO
// ============================================

const MENTOR_EMAILS = ['marcio.portes@me.com'];
const APP_NAME = 'Acompanhamento 2.0';
const APP_URL = 'https://acompanhamento-20.web.app'; // Ajuste se necessário

// ============================================
// CONSTANTES
// ============================================

const TRADE_STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const RED_FLAG_TYPES = {
  NO_PLAN: 'TRADE_SEM_PLANO',
  RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO',
  RR_BELOW_MINIMUM: 'RR_ABAIXO_MINIMO',
  DAILY_LOSS_EXCEEDED: 'LOSS_DIARIO_EXCEDIDO',
  BLOCKED_EMOTION: 'EMOCIONAL_BLOQUEADO'
};

// ============================================
// EMAIL HELPERS
// ============================================

/**
 * Escreve na coleção /mail para a extension "Trigger Email from Firestore" processar
 * @param {string} to - Email destinatário
 * @param {string} subject - Assunto
 * @param {string} html - Corpo HTML
 */
const sendEmail = async (to, subject, html) => {
  await db.collection('mail').add({
    to,
    message: {
      subject,
      html
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`[sendEmail] Email enfileirado para: ${to} | Assunto: ${subject}`);
};

/**
 * Gera HTML do email de boas-vindas com link de reset de senha
 */
const getWelcomeEmailHtml = (studentName, resetLink) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b; border-radius:12px; overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding:30px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700;">
                ${APP_NAME}
              </h1>
              <p style="color:rgba(255,255,255,0.8); margin:8px 0 0; font-size:14px;">
                Plataforma de Mentoria em Trading
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#f1f5f9; margin:0 0 16px; font-size:20px;">
                Olá, ${studentName}! 👋
              </h2>
              <p style="color:#94a3b8; font-size:15px; line-height:1.6; margin:0 0 24px;">
                Você foi convidado para participar do <strong style="color:#f1f5f9;">${APP_NAME}</strong>. 
                Para começar, configure sua senha clicando no botão abaixo:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetLink}" 
                       style="display:inline-block; background:linear-gradient(135deg, #3b82f6, #8b5cf6); 
                              color:#ffffff; text-decoration:none; padding:14px 40px; border-radius:8px; 
                              font-size:16px; font-weight:600;">
                      Configurar Minha Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color:#64748b; font-size:13px; line-height:1.5; margin:0 0 16px;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="color:#3b82f6; font-size:12px; word-break:break-all; margin:0 0 24px; 
                        background:#0f172a; padding:12px; border-radius:6px;">
                ${resetLink}
              </p>
              
              <hr style="border:none; border-top:1px solid #334155; margin:24px 0;">
              
              <p style="color:#64748b; font-size:13px; line-height:1.5; margin:0;">
                Após configurar sua senha, acesse a plataforma em:<br>
                <a href="${APP_URL}" style="color:#3b82f6; text-decoration:none;">${APP_URL}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a; padding:20px 40px; text-align:center;">
              <p style="color:#475569; font-size:12px; margin:0;">
                Este email foi enviado automaticamente. Não responda a esta mensagem.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ============================================
// HELPERS
// ============================================

const calculateRiskPercent = (trade, accountBalance) => {
  if (!accountBalance || accountBalance <= 0) return 0;
  const risk = Math.abs(trade.result < 0 ? trade.result : (trade.entry - trade.stopLoss) * trade.qty);
  return (risk / accountBalance) * 100;
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
  snapshot.forEach(doc => { 
    if (doc.data().result < 0) total += Math.abs(doc.data().result); 
  });
  return total;
};

const updateAccountBalance = async (accountId, resultDiff) => {
  if (!accountId || resultDiff === 0) return;
  const accountRef = db.collection('accounts').doc(accountId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(accountRef);
    if (!doc.exists) return;
    const current = doc.data().currentBalance ?? doc.data().initialBalance ?? 0;
    t.update(accountRef, { 
      currentBalance: current + resultDiff,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
};

/**
 * Atualiza PL atual do Plano via transaction
 * @param {string} planId - ID do plano
 * @param {number} resultDiff - Valor a somar (positivo ou negativo)
 */
const updatePlanPl = async (planId, resultDiff) => {
  if (!planId || resultDiff === 0) return;
  const planRef = db.collection('plans').doc(planId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(planRef);
    if (!doc.exists) return;
    const plan = doc.data();
    const currentPl = plan.currentPl ?? plan.pl ?? 0;
    t.update(planRef, {
      currentPl: currentPl + resultDiff,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
};

/**
 * Calcula compliance do trade contra o plano
 * Risco Operacional (RO) e Razão Risco-Retorno (RR)
 * @returns {{ riskPercent, rrRatio, compliance: { roStatus, rrStatus } }}
 */
const calculateTradeCompliance = (trade, plan) => {
  const result = { riskPercent: 0, rrRatio: null, compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' } };
  
  if (!plan || !trade) return result;
  
  const planPl = plan.currentPl ?? plan.pl ?? 0;
  if (planPl <= 0) return result;
  
  // Risco Operacional: |resultado negativo| / PL do plano * 100
  const riskAmount = trade.stopLoss 
    ? Math.abs((trade.entry - trade.stopLoss) * trade.qty * (trade.tickerRule?.tickValue || 1))
    : (trade.result < 0 ? Math.abs(trade.result) : 0);
  
  result.riskPercent = (riskAmount / planPl) * 100;
  
  if (plan.riskPerOperation && result.riskPercent > plan.riskPerOperation) {
    result.compliance.roStatus = 'FORA_DO_PLANO';
  }
  
  // Razão Risco-Retorno
  if (trade.stopLoss && trade.takeProfit && trade.entry) {
    const risk = Math.abs(trade.entry - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entry);
    if (risk > 0) {
      result.rrRatio = reward / risk;
      if (plan.rrTarget && result.rrRatio < plan.rrTarget) {
        result.compliance.rrStatus = 'NAO_CONFORME';
      }
    }
  }
  
  return result;
};

const isMentorEmail = (email) => {
  return MENTOR_EMAILS.includes(email?.toLowerCase());
};

// ============================================
// STUDENT MANAGEMENT
// ============================================

exports.createStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentores podem criar alunos');
  }

  const { email, name } = data;

  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
  }

  const emailLower = email.toLowerCase().trim();
  const studentName = name || emailLower.split('@')[0];

  try {
    // 1. Criar usuário no Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: emailLower,
      displayName: studentName,
      disabled: false
    });

    console.log(`[createStudent] Usuário criado no Auth: ${userRecord.uid}`);

    // 2. Criar documento em /students
    await db.collection('students').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: emailLower,
      name: studentName,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.token.email,
      firstLoginAt: null
    });

    console.log(`[createStudent] Doc /students/${userRecord.uid} criado`);

    // 3. Gerar link de reset de senha
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    console.log(`[createStudent] Reset link gerado para: ${emailLower}`);

    // 4. Escrever na coleção /mail → Trigger Email Extension envia automaticamente
    await sendEmail(
      emailLower,
      `Bem-vindo ao ${APP_NAME} - Configure sua senha`,
      getWelcomeEmailHtml(studentName, resetLink)
    );

    console.log(`[createStudent] Email enfileirado via /mail para: ${emailLower}`);

    return { 
      success: true, 
      uid: userRecord.uid,
      resetLink: resetLink,
      message: 'Aluno criado e email de configuração enviado!'
    };

  } catch (error) {
    console.error('[createStudent] Erro:', error);
    
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Este email já está cadastrado no sistema');
    }
    if (error.code === 'auth/invalid-email') {
      throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.deleteStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentores podem deletar alunos');
  }

  const { uid, email } = data;

  try {
    if (uid) {
      try { await admin.auth().deleteUser(uid); } catch (e) { console.log('Usuário não encontrado:', uid); }
    } else if (email) {
      try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(user.uid);
      } catch (e) { console.log('Usuário não encontrado:', email); }
    }

    if (uid) {
      await db.collection('students').doc(uid).delete();
    } else if (email) {
      const snapshot = await db.collection('students').where('email', '==', email.toLowerCase()).get();
      snapshot.forEach(doc => doc.ref.delete());
    }

    return { success: true, message: 'Aluno removido' };
  } catch (error) {
    console.error('Erro ao deletar aluno:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.resendStudentInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  if (!isMentorEmail(context.auth.token.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas mentores podem reenviar convites');
  }

  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email é obrigatório');
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Buscar nome do aluno
    const snapshot = await db.collection('students')
      .where('email', '==', emailLower)
      .limit(1)
      .get();
    
    const studentName = snapshot.empty 
      ? emailLower.split('@')[0] 
      : snapshot.docs[0].data().name || emailLower.split('@')[0];

    // Gerar novo link de reset
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    // Escrever na coleção /mail → Extension envia
    await sendEmail(
      emailLower,
      `${APP_NAME} - Reenvio do link de acesso`,
      getWelcomeEmailHtml(studentName, resetLink)
    );

    console.log(`[resendStudentInvite] Email reenviado para: ${emailLower}`);

    return { success: true, resetLink, message: 'Convite reenviado com sucesso!' };
  } catch (error) {
    console.error('[resendStudentInvite] Erro:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// FEEDBACK / STATUS MANAGEMENT
// ============================================

exports.addFeedbackComment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }

  const { tradeId, content, newStatus } = data;

  if (!tradeId || !content) {
    throw new functions.https.HttpsError('invalid-argument', 'Trade ID e conteúdo são obrigatórios');
  }

  try {
    const tradeRef = db.collection('trades').doc(tradeId);
    const tradeDoc = await tradeRef.get();

    if (!tradeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Trade não encontrado');
    }

    const trade = tradeDoc.data();
    const currentStatus = trade.status || 'OPEN';
    const userEmail = context.auth.token.email;
    const isMentor = isMentorEmail(userEmail);
    const authorRole = isMentor ? 'mentor' : 'student';

    let finalStatus = currentStatus;
    
    if (newStatus) {
      const validTransitions = {
        'OPEN': ['REVIEWED'],
        'REVIEWED': ['QUESTION', 'CLOSED'],
        'QUESTION': ['REVIEWED'],
        'CLOSED': []
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new functions.https.HttpsError('failed-precondition', `Transição inválida: ${currentStatus} → ${newStatus}`);
      }

      if (newStatus === 'REVIEWED' && !isMentor) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas mentor pode marcar como REVIEWED');
      }
      if (newStatus === 'QUESTION' && isMentor) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas aluno pode marcar QUESTION');
      }
      if (newStatus === 'CLOSED' && isMentor) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas aluno pode encerrar');
      }

      finalStatus = newStatus;
    } else {
      if (isMentor && (currentStatus === 'OPEN' || currentStatus === 'QUESTION')) {
        finalStatus = 'REVIEWED';
      }
    }

    const comment = {
      id: db.collection('_').doc().id,
      author: userEmail,
      authorName: context.auth.token.name || userEmail.split('@')[0],
      authorRole,
      content,
      status: finalStatus,
      createdAt: new Date().toISOString()
    };

    const updateData = {
      status: finalStatus,
      feedbackHistory: admin.firestore.FieldValue.arrayUnion(comment),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (finalStatus === 'CLOSED') {
      updateData.closedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.closedBy = userEmail;
    }

    if (isMentor) {
      updateData.mentorFeedback = content;
      updateData.feedbackDate = admin.firestore.FieldValue.serverTimestamp();
    }

    await tradeRef.update(updateData);

    await db.collection('notifications').add({
      type: isMentor ? 'FEEDBACK_RECEIVED' : 'QUESTION_RECEIVED',
      tradeId,
      targetUserId: isMentor ? trade.studentId : 'mentor',
      message: isMentor ? 'Feedback recebido' : 'Aluno tem dúvida',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, status: finalStatus, commentId: comment.id };

  } catch (error) {
    console.error('[addFeedbackComment] Erro:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.closeTrade = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }

  const { tradeId } = data;

  if (!tradeId) {
    throw new functions.https.HttpsError('invalid-argument', 'Trade ID obrigatório');
  }

  try {
    const tradeRef = db.collection('trades').doc(tradeId);
    const tradeDoc = await tradeRef.get();

    if (!tradeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Trade não encontrado');
    }

    const trade = tradeDoc.data();
    const currentStatus = trade.status || 'OPEN';
    
    if (trade.studentEmail !== context.auth.token.email) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas o dono pode encerrar');
    }

    if (currentStatus === 'CLOSED') {
      throw new functions.https.HttpsError('failed-precondition', 'Trade já encerrado');
    }

    if (currentStatus === 'OPEN') {
      throw new functions.https.HttpsError('failed-precondition', 'Trade precisa de feedback primeiro');
    }

    await tradeRef.update({
      status: 'CLOSED',
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      closedBy: context.auth.token.email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, status: 'CLOSED' };

  } catch (error) {
    console.error('[closeTrade] Erro:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// TRADE TRIGGERS
// ============================================

exports.onTradeCreated = functions.firestore
  .document('trades/{tradeId}')
  .onCreate(async (snap, context) => {
    const trade = snap.data();
    const tradeId = context.params.tradeId;
    const redFlags = [];
    
    let updates = {
      status: TRADE_STATUS.OPEN,
      feedbackHistory: [],
      redFlags: [],
      hasRedFlags: false,
      compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      // === 1. ATUALIZAR PL DO PLANO ===
      if (trade.planId && trade.result !== undefined) {
        await updatePlanPl(trade.planId, trade.result);
        console.log(`[onTradeCreated] PL plano ${trade.planId} atualizado: ${trade.result > 0 ? '+' : ''}${trade.result}`);
      }

      // === 2. COMPLIANCE E RED FLAGS ===
      if (!trade.planId) {
        redFlags.push({ type: RED_FLAG_TYPES.NO_PLAN, message: 'Trade sem plano', timestamp: new Date().toISOString() });
      } else {
        const planDoc = await db.collection('plans').doc(trade.planId).get();
        if (planDoc.exists) {
          const plan = planDoc.data();
          
          // Compliance calculado sobre PL do plano (não saldo da conta)
          const tradeCompliance = calculateTradeCompliance(trade, plan);
          updates.riskPercent = tradeCompliance.riskPercent;
          updates.rrRatio = tradeCompliance.rrRatio;
          updates.compliance = tradeCompliance.compliance;
          
          // Red flag: risco operacional
          if (tradeCompliance.compliance.roStatus === 'FORA_DO_PLANO') {
            redFlags.push({ 
              type: RED_FLAG_TYPES.RISK_EXCEEDED, 
              message: `Risco ${tradeCompliance.riskPercent.toFixed(1)}% excede máximo do plano (${plan.riskPerOperation}%)`, 
              timestamp: new Date().toISOString() 
            });
          }
          
          // Red flag: RR abaixo do mínimo
          if (tradeCompliance.compliance.rrStatus === 'NAO_CONFORME') {
            redFlags.push({ 
              type: RED_FLAG_TYPES.RR_BELOW_MINIMUM, 
              message: `R:R ${tradeCompliance.rrRatio?.toFixed(1)} abaixo do mínimo ${plan.rrTarget}`, 
              timestamp: new Date().toISOString() 
            });
          }
          
          // Red flag: loss diário (calculado sobre PL do plano)
          if (plan.periodStop && trade.accountId) {
            const planPl = plan.currentPl ?? plan.pl ?? 0;
            if (planPl > 0) {
              const dailyLoss = await getDailyLoss(trade.studentId, trade.accountId, trade.date);
              const dailyLossPercent = (dailyLoss / planPl) * 100;
              if (dailyLossPercent > plan.periodStop) {
                redFlags.push({ 
                  type: RED_FLAG_TYPES.DAILY_LOSS_EXCEEDED, 
                  message: `Loss diário ${dailyLossPercent.toFixed(1)}% excede stop do período (${plan.periodStop}%)`, 
                  timestamp: new Date().toISOString() 
                });
              }
            }
          }
          
          // Red flag: emoção bloqueada
          if (plan.blockedEmotions && plan.blockedEmotions.includes(trade.emotionEntry)) {
            redFlags.push({ type: RED_FLAG_TYPES.BLOCKED_EMOTION, message: `Emoção "${trade.emotionEntry}" bloqueada`, timestamp: new Date().toISOString() });
          }
        }
      }

      updates.redFlags = redFlags;
      updates.hasRedFlags = redFlags.length > 0;
      
      await snap.ref.update(updates);

      // === 3. NOTIFICAÇÕES ===
      if (redFlags.length > 0) {
        await db.collection('notifications').add({ 
          type: 'RED_FLAG', targetRole: 'mentor', studentId: trade.studentId, studentEmail: trade.studentEmail,
          tradeId, ticker: trade.ticker, redFlagsCount: redFlags.length,
          message: `Red Flags (${redFlags.length})`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() 
        });
      }
      
      await db.collection('notifications').add({ 
        type: 'NEW_TRADE', targetRole: 'mentor', studentId: trade.studentId, studentEmail: trade.studentEmail,
        tradeId, ticker: trade.ticker, message: `Novo trade: ${trade.ticker}`, read: false, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });

    } catch (e) { console.error('[onTradeCreated]', e); }
    
    return null;
  });

exports.onTradeUpdated = functions.firestore.document('trades/{tradeId}').onUpdate(async (change, context) => {
  const before = change.before.data();
  const after = change.after.data();
  
  try {
    const oldResult = before.result || 0;
    const newResult = after.result || 0;
    const planChanged = before.planId !== after.planId;
    const resultChanged = Math.abs(newResult - oldResult) > 0.01;
    
    if (planChanged) {
      // Trade movido para outro plano: reverter do antigo, aplicar no novo
      if (before.planId) await updatePlanPl(before.planId, -oldResult);
      if (after.planId) await updatePlanPl(after.planId, newResult);
      console.log(`[onTradeUpdated] Trade movido: plano ${before.planId} → ${after.planId}`);
    } else if (resultChanged && after.planId) {
      // Mesmo plano, resultado mudou: aplicar diferença
      await updatePlanPl(after.planId, newResult - oldResult);
      console.log(`[onTradeUpdated] PL plano ${after.planId} ajustado: ${(newResult - oldResult) > 0 ? '+' : ''}${(newResult - oldResult).toFixed(2)}`);
    }
    
    // Recalcular compliance se resultado ou plano mudou
    if (resultChanged || planChanged) {
      if (after.planId) {
        const planDoc = await db.collection('plans').doc(after.planId).get();
        if (planDoc.exists) {
          const compliance = calculateTradeCompliance(after, planDoc.data());
          await change.after.ref.update({
            riskPercent: compliance.riskPercent,
            rrRatio: compliance.rrRatio,
            compliance: compliance.compliance
          });
        }
      }
    }
  } catch (e) { console.error('[onTradeUpdated]', e); }
  
  return null;
});

exports.onTradeDeleted = functions.firestore.document('trades/{tradeId}').onDelete(async (snap, context) => {
  const trade = snap.data();
  
  try {
    // Reverter PL do plano
    if (trade.planId && trade.result) {
      await updatePlanPl(trade.planId, -(trade.result));
      console.log(`[onTradeDeleted] PL plano ${trade.planId} revertido: ${-trade.result}`);
    }
  } catch (e) { console.error('[onTradeDeleted]', e); }
  
  return null;
});

// ============================================
// MOVEMENT TRIGGERS
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
// UTILITIES
// ============================================

exports.seedInitialData = functions.https.onCall(async () => ({ success: true }));

exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok', 
    version: VERSION.semver,
    build: VERSION.build,
    display: VERSION.display,
    full: VERSION.full,
    features: ['feedback-flow', 'red-flags', 'student-cards', 'plan-centric-pl', 'trade-compliance', 'email-trigger'],
    timestamp: new Date().toISOString() 
  });
});

// ============================================
// CLEANUP
// ============================================

exports.cleanupOldNotifications = functions.pubsub
  .schedule('0 4 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    
    try {
      let totalDeleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        const old = await db.collection('notifications')
          .where('read', '==', true)
          .where('createdAt', '<', cutoff)
          .limit(500)
          .get();
        
        if (old.empty) { hasMore = false; break; }
        
        const batch = db.batch();
        old.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        totalDeleted += old.size;
        hasMore = old.size === 500;
      }
      
      console.log(`[cleanupOldNotifications] Deletados: ${totalDeleted}`);
    } catch (e) { console.error('[cleanupOldNotifications] Erro:', e); }
    
    return null;
  });
