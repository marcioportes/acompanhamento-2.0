/**
 * Firebase Cloud Functions - Acompanhamento 2.0
 * VERSÃO 5.3.1 - Integração Email via Trigger Email Extension
 * Modificação by mportes - inclusão da ativação do aluno depois do login
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// ============================================
// CONFIGURAÇÃO
// ============================================

const APP_URL = 'https://acompanhamento-2-0.vercel.app/'; // Ajuste para sua URL 
const APP_NAME = 'Tchio-Alpha Trading Journal';
const FROM_EMAIL = 'Titchio Marcio Portes <marcio.portes@me.com>';

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
// EMAIL HELPER
// ============================================

const sendEmail = async (to, subject, html) => {
  await db.collection('mail').add({
    to,
    from: FROM_EMAIL,
    message: {
      subject,
      html
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

const getWelcomeEmailHtml = (name, resetLink) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background-color:#1e293b;border-radius:16px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">${APP_NAME}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Trading Journal</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Olá${name ? ', ' + name : ''}! 👋
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Você foi cadastrado no sistema de acompanhamento de trades. Para acessar, configure sua senha clicando no botão abaixo:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">
                      Configurar Minha Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;">
                Este link expira em 24 horas. Se você não solicitou este cadastro, ignore este email.
              </p>
              
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${resetLink}" style="color:#3b82f6;word-break:break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#0f172a;text-align:center;border-top:1px solid #334155;">
              <p style="margin:0;color:#475569;font-size:12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos os direitos reservados.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const getResendEmailHtml = (name, resetLink) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background-color:#1e293b;border-radius:16px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">${APP_NAME}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Lembrete de Acesso</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Olá${name ? ', ' + name : ''}! 🔑
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Reenviamos o link para você configurar sua senha e acessar o sistema:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">
                      Configurar Minha Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                Este link expira em 24 horas.<br><br>
                <a href="${resetLink}" style="color:#3b82f6;word-break:break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#0f172a;text-align:center;border-top:1px solid #334155;">
              <p style="margin:0;color:#475569;font-size:12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos os direitos reservados.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ============================================
// STUDENT MANAGEMENT
// ============================================

/**
 * createStudent - Cria aluno no Auth, Firestore e envia email de boas-vindas
 */
exports.createStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { email, name } = data;

  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
  }

  const emailLower = email.toLowerCase().trim();
  const studentName = name?.trim() || emailLower.split('@')[0];

  try {
    // 1. Criar usuário no Firebase Auth (desabilitado até configurar senha)
    const userRecord = await admin.auth().createUser({
      email: emailLower,
      displayName: studentName,
      disabled: false
    });

    // 2. Criar documento na coleção students
    await db.collection('students').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: emailLower,
      name: studentName,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.token.email,
      firstLoginAt: null
    });

    // 3. Gerar link de redefinição de senha
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    // 4. Enviar email de boas-vindas
    await sendEmail(
      emailLower,
      `Bem-vindo ao ${APP_NAME} - Configure sua senha`,
      getWelcomeEmailHtml(studentName, resetLink)
    );

    return { 
      success: true, 
      uid: userRecord.uid,
      message: 'Aluno criado e email enviado com sucesso!'
    };

  } catch (error) {
    console.error('Erro ao criar aluno:', error);
    
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Este email já está cadastrado no sistema');
    }
    if (error.code === 'auth/invalid-email') {
      throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * deleteStudent - Remove aluno do Auth e Firestore
 */
exports.deleteStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { uid, email } = data;

  try {
    let userUid = uid;

    // Buscar uid pelo email se não fornecido
    if (!userUid && email) {
      try {
        const user = await admin.auth().getUserByEmail(email.toLowerCase());
        userUid = user.uid;
      } catch (e) {
        console.log('Usuário não encontrado no Auth por email:', email);
      }
    }

    // Deletar do Auth
    if (userUid) {
      try {
        await admin.auth().deleteUser(userUid);
      } catch (e) {
        console.log('Usuário não encontrado no Auth:', userUid);
      }
      // Deletar documento da coleção students
      await db.collection('students').doc(userUid).delete();
    }

    // Fallback: deletar por email se ainda existir
    if (email) {
      const snapshot = await db.collection('students').where('email', '==', email.toLowerCase()).get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    return { success: true, message: 'Aluno removido com sucesso' };

  } catch (error) {
    console.error('Erro ao deletar aluno:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * resendStudentInvite - Reenvia email de configuração de senha
 */
exports.resendStudentInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email é obrigatório');
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Buscar nome do aluno
    const snapshot = await db.collection('students').where('email', '==', emailLower).get();
    const studentName = snapshot.empty ? '' : snapshot.docs[0].data().name;

    // Gerar novo link
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    // Enviar email
    await sendEmail(
      emailLower,
      `${APP_NAME} - Link para configurar senha`,
      getResendEmailHtml(studentName, resetLink)
    );

    return { success: true, message: 'Email reenviado com sucesso!' };

  } catch (error) {
    console.error('Erro ao reenviar convite:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * activateStudent - Ativa o aluno no primeiro login
 * Chamada pelo Frontend (AuthContext) quando o status é 'pending'
 */
exports.activateStudent = functions.https.onCall(async (data, context) => {
  // 1. Segurança: Garante que o usuário está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const uid = context.auth.uid;

  try {
    const studentRef = db.collection('students').doc(uid);
    const doc = await studentRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Perfil de aluno não encontrado');
    }

    // Apenas atualiza se ainda não estiver ativo para economizar escritas
    if (doc.data().status === 'active') {
      return { success: true, message: 'Aluno já ativo' };
    }

    // 2. Atualiza o status via Admin SDK (Bypassa regras de segurança)
    await studentRef.update({
      status: 'active',
      firstLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Aluno ${uid} ativado com sucesso.`);
    return { success: true, message: 'Aluno ativado com sucesso' };

  } catch (error) {
    console.error('Erro ao ativar aluno:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao processar ativação');
  }
});

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
          if (plan.blockedEmotions && plan.blockedEmotions.includes(trade.emotion)) redFlags.push({ type: RED_FLAG_TYPES.BLOCKED_EMOTION, message: 'Emoção bloqueada', timestamp: new Date().toISOString() });
        }
      }
      updates.redFlags = redFlags;
      updates.hasRedFlags = redFlags.length > 0;
      
      await snap.ref.update(updates);

      if (redFlags.length > 0) {
        await db.collection('notifications').add({ type: 'RED_FLAG', targetRole: 'mentor', studentId: trade.studentId, tradeId, message: 'Red Flags detectadas', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await db.collection('notifications').add({ type: 'NEW_TRADE', targetRole: 'mentor', studentId: trade.studentId, tradeId, message: `Novo trade: ${trade.ticker}`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });

    } catch (e) { console.error(e); }
    return null;
});

exports.onTradeUpdated = functions.firestore.document('trades/{tradeId}').onUpdate(async () => { return null; });

exports.onTradeDeleted = functions.firestore.document('trades/{tradeId}').onDelete(async () => { return null; });

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
  return { success: true };
});

exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ status: 'ok', version: '5.3.0' });
});
