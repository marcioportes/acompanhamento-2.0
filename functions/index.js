/**
 * Firebase Cloud Functions
 * @version 1.0.0
 * @description Cloud Functions com monitor de status de email
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const APP_NAME = 'Tchio-Alpha';
const FROM_EMAIL = 'Tchio-Alpha <portes.marcio@gmail.com>';

const TRADE_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVIEWED: 'REVIEWED',
  IN_REVISION: 'IN_REVISION'
};

// ============================================
// HELPERS
// ============================================

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

const sendEmail = async (to, subject, html) => {
  await db.collection('mail').add({
    to,
    from: FROM_EMAIL,
    message: { subject, html },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

const getWelcomeEmailHtml = (name, resetLink) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
<table width="100%" style="background:#0f172a;padding:40px 20px;"><tr><td align="center">
<table style="max-width:500px;background:#1e293b;border-radius:16px;">
<tr><td style="padding:32px;text-align:center;background:linear-gradient(135deg,#3b82f6,#8b5cf6);">
<h1 style="margin:0;color:#fff;font-size:28px;">${APP_NAME}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Trading Journal</p>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#fff;font-size:20px;">Olá${name ? ', ' + name : ''}! 👋</h2>
<p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
Você foi cadastrado no sistema de acompanhamento de trades. Configure sua senha:</p>
<table width="100%"><tr><td align="center" style="padding:8px 0 24px;">
<a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">
Configurar Minha Senha</a>
</td></tr></table>
<p style="margin:0;color:#64748b;font-size:13px;">Link expira em 24h. Se não solicitou, ignore.</p>
</td></tr>
<tr><td style="padding:24px;background:#0f172a;text-align:center;border-top:1px solid #334155;">
<p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
</td></tr>
</table></td></tr></table></body></html>`;

const getResendEmailHtml = (name, resetLink) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
<table width="100%" style="background:#0f172a;padding:40px 20px;"><tr><td align="center">
<table style="max-width:500px;background:#1e293b;border-radius:16px;">
<tr><td style="padding:32px;text-align:center;background:linear-gradient(135deg,#f59e0b,#ef4444);">
<h1 style="margin:0;color:#fff;font-size:28px;">${APP_NAME}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Lembrete de Acesso</p>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#fff;font-size:20px;">Olá${name ? ', ' + name : ''}! 🔑</h2>
<p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
Reenviamos o link para configurar sua senha:</p>
<table width="100%"><tr><td align="center" style="padding:8px 0 24px;">
<a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">
Configurar Minha Senha</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:24px;background:#0f172a;text-align:center;border-top:1px solid #334155;">
<p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
</td></tr>
</table></td></tr></table></body></html>`;

// ============================================
// EMAIL STATUS MONITOR
// ============================================

/**
 * Monitora a collection /mail e atualiza /students com status do email
 * 
 * A Extension "Trigger Email from Firestore" atualiza o campo delivery:
 * - delivery.state: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR'
 * - delivery.error: mensagem de erro (quando state === 'ERROR')
 * 
 * Este trigger captura mudanças de estado e atualiza o documento do aluno
 */
exports.onMailStatusChange = functions.firestore
  .document('mail/{mailId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Só processa se o estado mudou
    const beforeState = before.delivery?.state;
    const afterState = after.delivery?.state;
    
    if (beforeState === afterState) {
      return null;
    }

    const email = after.to;
    if (!email) {
      console.log('[onMailStatusChange] Email não encontrado no documento');
      return null;
    }

    console.log(`[onMailStatusChange] Email: ${email}, Estado: ${beforeState} -> ${afterState}`);

    try {
      // Busca o aluno pelo email
      const snapshot = await db.collection('students').where('email', '==', email).get();
      
      if (snapshot.empty) {
        console.log(`[onMailStatusChange] Aluno não encontrado: ${email}`);
        return null;
      }

      const studentRef = snapshot.docs[0].ref;

      if (afterState === 'ERROR') {
        // Marca erro no documento do aluno
        const errorMessage = after.delivery?.error || 'Erro desconhecido no envio';
        await studentRef.update({
          emailError: errorMessage,
          emailErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[onMailStatusChange] Erro registrado para: ${email} - ${errorMessage}`);
      } else if (afterState === 'SUCCESS') {
        // Remove campo de erro e marca sucesso
        await studentRef.update({
          emailError: admin.firestore.FieldValue.delete(),
          emailErrorAt: admin.firestore.FieldValue.delete(),
          emailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[onMailStatusChange] Sucesso para: ${email}`);
      }

      return null;
    } catch (error) {
      console.error('[onMailStatusChange] Erro:', error);
      return null;
    }
  });

// ============================================
// STUDENT MANAGEMENT
// ============================================

exports.createStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }

  const { email, name } = data;

  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
  }

  const emailLower = email.toLowerCase().trim();
  const studentName = name?.trim() || emailLower.split('@')[0];

  try {
    // Cria usuário no Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: emailLower,
      displayName: studentName,
      disabled: false
    });

    // Cria documento na collection students
    await db.collection('students').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: emailLower,
      name: studentName,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.token.email,
      firstLoginAt: null
    });

    // Gera link de reset de senha
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    // Envia email via Extension
    await sendEmail(
      emailLower,
      `Bem-vindo ao ${APP_NAME} - Configure sua senha`,
      getWelcomeEmailHtml(studentName, resetLink)
    );

    console.log(`[createStudent] Criado: ${emailLower}`);

    return { 
      success: true, 
      uid: userRecord.uid,
      message: 'Aluno criado e email enviado!'
    };

  } catch (error) {
    console.error('[createStudent] Erro:', error);
    
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Este email já está cadastrado');
    }
    if (error.code === 'auth/invalid-email') {
      throw new functions.https.HttpsError('invalid-argument', 'Email inválido');
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.deleteStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }

  const { uid, email } = data;

  try {
    let userUid = uid;

    // Se não tem UID, tenta buscar pelo email
    if (!userUid && email) {
      try {
        const user = await admin.auth().getUserByEmail(email.toLowerCase());
        userUid = user.uid;
      } catch (e) {
        console.log('[deleteStudent] Usuário não encontrado no Auth:', email);
      }
    }

    // Remove do Auth
    if (userUid) {
      try {
        await admin.auth().deleteUser(userUid);
        console.log('[deleteStudent] Removido do Auth:', userUid);
      } catch (e) {
        console.log('[deleteStudent] Usuário não encontrado no Auth:', userUid);
      }
      
      // Remove documento
      await db.collection('students').doc(userUid).delete();
    }

    // Também remove por email (caso documento esteja com ID diferente)
    if (email) {
      const snapshot = await db.collection('students').where('email', '==', email.toLowerCase()).get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    console.log(`[deleteStudent] Removido: ${email || uid}`);

    return { success: true, message: 'Aluno removido com sucesso' };

  } catch (error) {
    console.error('[deleteStudent] Erro:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.resendStudentInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
  }

  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email obrigatório');
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Busca nome do aluno
    const snapshot = await db.collection('students').where('email', '==', emailLower).get();
    const studentName = snapshot.empty ? '' : snapshot.docs[0].data().name;

    // Gera novo link
    const resetLink = await admin.auth().generatePasswordResetLink(emailLower);

    // Envia email
    await sendEmail(
      emailLower,
      `${APP_NAME} - Link para configurar senha`,
      getResendEmailHtml(studentName, resetLink)
    );

    // Limpa erro anterior (se houver)
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        emailError: admin.firestore.FieldValue.delete(),
        emailErrorAt: admin.firestore.FieldValue.delete()
      });
    }

    console.log(`[resendStudentInvite] Reenviado para: ${emailLower}`);

    return { success: true, message: 'Email reenviado!' };

  } catch (error) {
    console.error('[resendStudentInvite] Erro:', error);
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
    
    try {
      // Atualiza status
      await snap.ref.update({
        status: TRADE_STATUS.PENDING_REVIEW,
        redFlags: [],
        hasRedFlags: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notifica mentor
      await db.collection('notifications').add({ 
        type: 'NEW_TRADE', 
        targetRole: 'mentor', 
        studentId: trade.studentId, 
        tradeId, 
        message: `Novo trade: ${trade.ticker}`, 
        read: false, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    } catch (e) { 
      console.error('[onTradeCreated]', e); 
    }
    
    return null;
  });

exports.onTradeUpdated = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async () => null);

exports.onTradeDeleted = functions.firestore
  .document('trades/{tradeId}')
  .onDelete(async () => null);

// ============================================
// MOVEMENT TRIGGERS
// ============================================

exports.onMovementCreated = functions.firestore
  .document('movements/{movementId}')
  .onCreate(async (snap) => {
    const mov = snap.data();
    let amount = mov.amount;
    if (mov.type === 'WITHDRAWAL') amount = -Math.abs(amount);
    else if (mov.type === 'DEPOSIT' || mov.type === 'INITIAL_BALANCE') amount = Math.abs(amount);
    await updateAccountBalance(mov.accountId, amount);
    return null;
  });

exports.onMovementDeleted = functions.firestore
  .document('movements/{movementId}')
  .onDelete(async (snap) => {
    const mov = snap.data();
    if (mov.type === 'INITIAL_BALANCE') return null;
    let amount = mov.amount;
    if (mov.type === 'WITHDRAWAL') amount = -Math.abs(amount);
    else if (mov.type === 'DEPOSIT') amount = Math.abs(amount);
    await updateAccountBalance(mov.accountId, -amount);
    return null;
  });

// ============================================
// FEEDBACK
// ============================================

exports.onFeedbackAdded = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (!before.mentorFeedback && after.mentorFeedback) {
      await change.after.ref.update({ 
        status: TRADE_STATUS.REVIEWED, 
        feedbackDate: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      await db.collection('notifications').add({ 
        type: 'FEEDBACK_RECEIVED', 
        targetUserId: after.studentId, 
        tradeId: context.params.tradeId, 
        message: 'Feedback recebido', 
        read: false, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    }
    return null;
  });

// ============================================
// UTILITIES
// ============================================

exports.seedInitialData = functions.https.onCall(async () => ({ success: true }));

exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    app: APP_NAME,
    timestamp: new Date().toISOString()
  });
});
