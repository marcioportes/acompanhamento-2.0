/**
 * Firebase Cloud Functions - Tchio-Alpha
 * @version 1.10.0
 *
 * SEMANTIC VERSIONING (SemVer 2.0.0)
 * MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 *
 * CHANGELOG v1.10.0 (#52 Fase 2 — Prop Firm Drawdown Engine):
 *   - Engine de drawdown integrado em onTradeCreated/onTradeUpdated/onTradeDeleted
 *   - Novo helper recalculatePropFirmState com runTransaction (atomicidade peakBalance)
 *   - Subcollection accounts/{id}/drawdownHistory append-only (1 doc por trade prop)
 *   - Notificações PROP_FIRM_FLAG throttled 1× por flag-tipo por dia (idempotência via doc id)
 *   - Idempotente: contas não-PROP têm early return e zero overhead funcional
 *   - LIMITAÇÃO v1: trade editado/deletado usa delta incremental, NÃO reconstrói histórico
 *   - Engine duplicado em functions/propFirmEngine.js (DT-034 — unificar via build step)
 *
 * CHANGELOG v1.9.0 (alinhado com produto v1.19.2):
 *   - DEC-007: RR assumido integrado em calculateTradeCompliance para trades sem stop
 *     RR = result / (plan.pl × RO%). Usa plan.pl (capital base), não currentPl.
 *   - Guard C4 REMOVIDO — calculateTradeCompliance agora retorna RR para todos os trades.
 *     onTradeCreated, onTradeUpdated, recalculateCompliance gravam rrRatio + rrAssumed diretamente.
 *   - Cascata updatePlan → recalculateCompliance agora recalcula RR assumido corretamente.
 *
 * CHANGELOG v1.8.0 (alinhado com produto v1.19.1):
 *   - DEC-006: calculateTradeCompliance sem stop → risco retroativo (loss), N/A (win), 0 (breakeven)
 *   - C4: Guard rrAssumed (REMOVIDO em v1.9.0)
 *   - Red flags contextualizados: NO_STOP não afirma mais "risco ilimitado"
 *   - RISK_EXCEEDED só gerado quando riskPercent é numérico
 *
 * CHANGELOG v1.7.0:
 *   - Fix onTradeUpdated: recalcula compliance em qualquer mudança de entry/exit/stop/qty/side
 *   - Fix onTradeUpdated: reconstrói red flags por completo (remove+recria)
 *   - Fix onTradeUpdated: guard contra loop infinito
 *   - New recalculateCompliance callable: recalcula compliance de trades existentes por plano
 *
 * CHANGELOG v1.6.1:
 *   - Fix calculateTradeCompliance: tickSize na fórmula de riskAmount e RR
 *
 * CHANGELOG v1.6.0:
 *   - Red flag NO_STOP: trade sem stop loss gera red flag + notificação mentor
 *   - calculateTradeCompliance: sem stop → riskPercent=100%, RR via resultado efetivo
 *   - healthCheck atualizado com feature no-stop-detection
 * 
 * CHANGELOG v1.5.0:
 *   - Notificação emocional: alerta mentor quando aluno tem emoção CRITICAL
 *   - healthCheck atualizado com feature emotional-alerts
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

// === PROP FIRM ENGINE (Fase 2 #52) ===
// Engine puro testado em src/__tests__/utils/propFirmDrawdownEngine.test.js (58 testes)
// Espelhado em functions/propFirmEngine.js — DT-034: unificar via build step
const propFirmEngine = require('./propFirmEngine');

// ============================================
// VERSÃO (SemVer 2.0.0)
// ============================================

const VERSION = {
  major: 1,
  minor: 10,
  patch: 0,
  prerelease: null,
  build: '20260409',
  
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
const APP_NAME = 'Tchio-Alpha - Acompanhamento 2.0';
const APP_URL = 'https://marcioportes.com.br'; // Ajuste se necessário

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
  NO_STOP: 'TRADE_SEM_STOP',
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
const FROM_EMAIL = 'Tchio-Alpha <marcio.portes@me.com>';

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
  console.log(`[sendEmail] Email enfileirado para: ${to} | From: ${FROM_EMAIL} | Assunto: ${subject}`);
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

// ============================================
// PROP FIRM HELPERS (#52 Fase 2)
// ============================================

/**
 * Recalcula o estado runtime do prop firm da conta após um trade fechado.
 * Idempotente para contas não-PROP (early return).
 * Usa runTransaction para garantir atomicidade do peakBalance em escrita concorrente.
 *
 * Pré-condição: trade.result e trade.date precisam estar definidos.
 * Pós-condição: account.propFirm.{peakBalance, threshold, lockLevel, isDayPaused,
 *               tradingDays, dailyPnL, lastTradeDate, currentBalance, distanceToDD, flags}
 *               atualizados; updatedAt bump.
 *
 * @param {string} accountId
 * @param {Object} trade - documento do trade (precisa: result, date, accountId)
 * @param {string} tradeId
 * @returns {Promise<Object|null>} novo estado do engine ou null se não-PROP
 */
const recalculatePropFirmState = async (accountId, trade, tradeId) => {
  if (!accountId || trade.result == null || !trade.date) return null;

  const accountRef = db.collection('accounts').doc(accountId);

  // Pre-read fora da transaction para evitar overhead em contas comuns
  const preCheck = await accountRef.get();
  if (!preCheck.exists) return null;
  const accountData = preCheck.data();
  if (accountData.type !== 'PROP' || !accountData.propFirm?.templateId) return null;

  // Lê template (collection raiz)
  const templateDoc = await db.collection('propFirmTemplates')
    .doc(accountData.propFirm.templateId).get();
  if (!templateDoc.exists) {
    console.warn(`[propFirm] Template ${accountData.propFirm.templateId} não encontrado para conta ${accountId}`);
    return null;
  }
  const template = templateDoc.data();
  const accountSize = template.accountSize ?? accountData.initialBalance ?? 0;
  if (accountSize <= 0) return null;

  // Transaction: re-read propFirm dentro do tx (estado pode ter mudado entre pre-check e tx)
  const newState = await db.runTransaction(async (t) => {
    const fresh = await t.get(accountRef);
    if (!fresh.exists) return null;
    const propFirm = fresh.data().propFirm ?? {};
    const balanceBefore = propFirm.currentBalance ?? accountSize;

    const result = propFirmEngine.calculateDrawdownState({
      propFirm,
      template,
      accountSize,
      balanceBefore,
      tradeNet: trade.result,
      tradeDate: trade.date,
      phase: propFirm.phase
    });

    t.update(accountRef, {
      'propFirm.peakBalance': result.peakBalance,
      'propFirm.currentDrawdownThreshold': result.currentDrawdownThreshold,
      'propFirm.lockLevel': result.lockLevel,
      'propFirm.trailFrozen': result.trailFrozen,
      'propFirm.isDayPaused': result.isDayPaused,
      'propFirm.tradingDays': result.tradingDays,
      'propFirm.dailyPnL': result.dailyPnL,
      'propFirm.lastTradeDate': result.lastTradeDate,
      'propFirm.currentBalance': result.newBalance,
      'propFirm.distanceToDD': result.distanceToDD,
      'propFirm.flags': result.flags,
      'propFirm.lastUpdateTradeId': tradeId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return result;
  });

  return newState;
};

/**
 * Append snapshot em accounts/{accountId}/drawdownHistory após trade prop firm.
 * Doc id = tradeId (idempotente — re-execução do trigger não duplica).
 * Append-only audit log: trades deletados deixam snapshot orfão (intentional).
 */
const appendDrawdownHistory = async (accountId, docId, trade, state) => {
  if (!state) return;
  await db.collection('accounts').doc(accountId)
    .collection('drawdownHistory').doc(docId)
    .set({
      tradeId: trade.id ?? docId,
      date: trade.date,
      balance: state.newBalance,
      peakBalance: state.peakBalance,
      drawdownThreshold: state.currentDrawdownThreshold,
      distanceToDD: state.distanceToDD,
      dailyPnL: state.dailyPnL,
      flags: state.flags,
      lockLevel: state.lockLevel,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

/**
 * Cria notificação para mentor sobre flag prop firm crítica.
 * Throttled: cada (flag-tipo, accountId, dia) só notifica 1×.
 * Idempotência via doc id determinístico.
 */
const notifyPropFirmFlag = async (accountId, trade, state) => {
  if (!state || !state.flags || state.flags.length === 0) return;

  const criticalFlags = state.flags.filter(f =>
    f === 'ACCOUNT_BUST' || f === 'DAILY_LOSS_HIT' || f === 'DD_NEAR' || f === 'LOCK_ACTIVATED'
  );
  if (criticalFlags.length === 0) return;

  for (const flag of criticalFlags) {
    const notifId = `propfirm-${accountId}-${flag}-${trade.date}`;
    const notifRef = db.collection('notifications').doc(notifId);
    const exists = await notifRef.get();
    if (exists.exists) continue;

    await notifRef.set({
      type: 'PROP_FIRM_FLAG',
      flag,
      severity: flag === 'ACCOUNT_BUST' ? 'CRITICAL' : 'WARNING',
      targetRole: 'mentor',
      studentId: trade.studentId,
      studentEmail: trade.studentEmail,
      accountId,
      tradeId: trade.id ?? null,
      message: `Prop firm: ${flag} (${trade.studentEmail?.split('@')[0]})`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
};

/**
 * Calcula compliance do trade contra o plano
 * Risco Operacional (RO) e Razão Risco-Retorno (RR)
 * 
 * DEC-006 (v1.19.1): Sem stop → risco retroativo (loss), N/A (win), 0 (breakeven)
 * DEC-007 (v1.19.2): RR assumido para trades sem stop via plan.pl (capital base) × RO%
 * 
 * @returns {{ riskPercent: number|null, rrRatio: number|null, rrAssumed: boolean, compliance: { roStatus, rrStatus } }}
 */
const calculateTradeCompliance = (trade, plan) => {
  const result = { riskPercent: null, rrRatio: null, rrAssumed: false, compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' } };
  
  if (!plan || !trade) return result;
  
  // DEC-009 (v1.19.4): usa plan.pl (capital base), não currentPl
  const planPl = plan.pl ?? plan.currentPl ?? 0;
  if (planPl <= 0) return result;
  
  // === Risco Operacional — DEC-006 (v1.19.1) ===
  if (trade.stopLoss && trade.entry) {
    const tickSize = trade.tickerRule?.tickSize || 1;
    const tickValue = trade.tickerRule?.tickValue || 1;
    const distanceInPoints = Math.abs(trade.entry - trade.stopLoss);
    const riskAmount = (distanceInPoints / tickSize) * tickValue * (trade.qty ?? 1);
    result.riskPercent = (riskAmount / planPl) * 100;
  } else {
    const tradeResult = trade.result ?? 0;
    if (tradeResult < 0) {
      result.riskPercent = (Math.abs(tradeResult) / planPl) * 100;
    } else if (tradeResult === 0) {
      result.riskPercent = 0;
    } else {
      result.riskPercent = null;
    }
  }
  
  if (result.riskPercent != null && plan.riskPerOperation && result.riskPercent > plan.riskPerOperation) {
    result.compliance.roStatus = 'FORA_DO_PLANO';
  }
  
  // === Razão Risco-Retorno — DEC-007 (v1.19.2) ===
  if (trade.stopLoss && trade.entry) {
    const risk = Math.abs(trade.entry - trade.stopLoss);
    if (risk > 0) {
      if (trade.takeProfit) {
        const reward = Math.abs(trade.takeProfit - trade.entry);
        result.rrRatio = reward / risk;
      } else if (trade.result > 0) {
        const tickSize = trade.tickerRule?.tickSize || 1;
        const tickValue = trade.tickerRule?.tickValue || 1;
        const resultInPoints = (trade.result / (tickValue * (trade.qty ?? 1))) * tickSize;
        result.rrRatio = resultInPoints / risk;
      }
    }
  } else {
    // DEC-007: SEM stop — RR assumido via plan.pl (capital base) × RO%
    const basePl = Number(plan.pl) || 0;
    const roPercent = Number(plan.riskPerOperation) || 0;
    if (basePl > 0 && roPercent > 0) {
      const roAmount = basePl * (roPercent / 100);
      const tradeResult = trade.result ?? 0;
      result.rrRatio = Math.round((tradeResult / roAmount) * 100) / 100;
      result.rrAssumed = true;
    }
  }

  // RR compliance: skip realized losses without takeProfit (perder 1R é o risco planejado)
  const tradeResultForRR = trade.result ?? 0;
  const hasPlannedRR = !!(trade.takeProfit);
  const shouldEvaluateRR = hasPlannedRR || tradeResultForRR > 0;
  if (result.rrRatio != null && plan.rrTarget && shouldEvaluateRR && result.rrRatio < plan.rrTarget) {
    result.compliance.rrStatus = 'NAO_CONFORME';
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
      // DEC-006: Red flag NO_STOP contextualizada
      if (!trade.stopLoss) {
        const tradeResult = trade.result ?? 0;
        let noStopMsg = 'Trade sem stop loss definido';
        if (tradeResult < 0) {
          noStopMsg += ` — risco retroativo`;
        } else if (tradeResult > 0) {
          noStopMsg += ' — risco não mensurado (win sem stop)';
        }
        redFlags.push({ 
          type: RED_FLAG_TYPES.NO_STOP, 
          message: noStopMsg, 
          timestamp: new Date().toISOString() 
        });
      }

      if (!trade.planId) {
        redFlags.push({ type: RED_FLAG_TYPES.NO_PLAN, message: 'Trade sem plano', timestamp: new Date().toISOString() });
      } else {
        const planDoc = await db.collection('plans').doc(trade.planId).get();
        if (planDoc.exists) {
          const plan = planDoc.data();
          
          // Compliance calculado sobre PL do plano (não saldo da conta)
          const tradeCompliance = calculateTradeCompliance(trade, plan);
          updates.riskPercent = tradeCompliance.riskPercent;
          // DEC-007: calculateTradeCompliance agora calcula RR para todos os trades (com/sem stop)
          updates.rrRatio = tradeCompliance.rrRatio;
          updates.rrAssumed = tradeCompliance.rrAssumed;
          updates.compliance = tradeCompliance.compliance;
          
          // Red flag: risco operacional — só quando riskPercent é numérico (DEC-006)
          if (tradeCompliance.riskPercent != null && tradeCompliance.compliance.roStatus === 'FORA_DO_PLANO') {
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
          
          // Red flag: loss diário (calculado sobre capital base — DEC-009)
          if (plan.periodStop && trade.accountId) {
            const planPl = plan.pl ?? plan.currentPl ?? 0;
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

      // === 4. ALERTA EMOCIONAL (Fase 1.4.0) ===
      // Notifica mentor se emoção de entrada é CRITICAL (Revanche, FOMO, Ganância)
      if (trade.emotionEntry) {
        try {
          const emotionSnap = await db.collection('emotions')
            .where('name', '==', trade.emotionEntry)
            .limit(1)
            .get();
          
          if (!emotionSnap.empty) {
            const emotionData = emotionSnap.docs[0].data();
            if (emotionData.analysisCategory === 'CRITICAL' || emotionData.riskLevel === 'CRITICAL') {
              await db.collection('notifications').add({
                type: 'EMOTIONAL_ALERT',
                targetRole: 'mentor',
                studentId: trade.studentId,
                studentEmail: trade.studentEmail,
                tradeId,
                ticker: trade.ticker,
                emotion: trade.emotionEntry,
                emotionEmoji: emotionData.emoji || '',
                severity: 'CRITICAL',
                message: `⚠️ ${trade.studentEmail?.split('@')[0]} operou com "${trade.emotionEntry}" (${emotionData.emoji})`,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`[onTradeCreated] Alerta emocional CRITICAL: ${trade.emotionEntry} — aluno ${trade.studentEmail}`);
            }
          }
        } catch (emotionErr) {
          console.error('[onTradeCreated] Erro ao verificar emoção:', emotionErr);
        }
      }

      // === 5. PROP FIRM ENGINE (#52 Fase 2) ===
      // Idempotente: early return em recalculatePropFirmState se conta não é PROP.
      // Erro isolado em try/catch — não propaga para o pipeline existente.
      try {
        const propFirmState = await recalculatePropFirmState(trade.accountId, trade, tradeId);
        if (propFirmState) {
          await appendDrawdownHistory(trade.accountId, tradeId, { ...trade, id: tradeId }, propFirmState);
          await notifyPropFirmFlag(trade.accountId, { ...trade, id: tradeId }, propFirmState);
          console.log(`[onTradeCreated] PropFirm recalculado: balance=${propFirmState.newBalance}, threshold=${propFirmState.currentDrawdownThreshold}, flags=[${propFirmState.flags.join(',')}]`);
        }
      } catch (propErr) {
        console.error('[onTradeCreated] Erro PropFirm engine:', propErr);
      }

      // === 6. MATURITY ENGINE (#119 task 07) ===
      // Guard CLOSED interno em runMaturityRecompute — trade criado começa OPEN, então
      // skipa aqui no caminho comum. Mantém o wire por simetria com onTradeUpdated.
      // Isolamento total: try/catch em volta do require + call (INV-03).
      try {
        const { runMaturityRecompute } = require('./maturity/recomputeMaturity');
        const result = await runMaturityRecompute(db, { tradeId, trade });
        if (!result.skipped) {
          console.log(`[onTradeCreated] Maturity atualizado: studentId=${result.studentId}, stage=${result.currentStage}, windowSize=${result.windowSize}`);
        }
      } catch (matErr) {
        console.error('[onTradeCreated] Erro maturity engine:', matErr);
      }

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
    
    // Detectar mudanças em qualquer campo que afeta compliance
    const complianceFields = ['stopLoss', 'entry', 'exit', 'qty', 'side'];
    const complianceChanged = complianceFields.some(f => {
      const bv = before[f] ?? null;
      const av = after[f] ?? null;
      return bv !== av;
    });
    
    // Guard: se apenas riskPercent/rrRatio/compliance/redFlags mudaram, é loop da própria CF
    if (!resultChanged && !planChanged && !complianceChanged) {
      return null;
    }
    
    if (planChanged) {
      if (before.planId) await updatePlanPl(before.planId, -oldResult);
      if (after.planId) await updatePlanPl(after.planId, newResult);
      console.log(`[onTradeUpdated] Trade movido: plano ${before.planId} → ${after.planId}`);
    } else if (resultChanged && after.planId) {
      await updatePlanPl(after.planId, newResult - oldResult);
      console.log(`[onTradeUpdated] PL plano ${after.planId} ajustado: ${(newResult - oldResult) > 0 ? '+' : ''}${(newResult - oldResult).toFixed(2)}`);
    }
    
    // Recalcular compliance
    if ((resultChanged || planChanged || complianceChanged) && after.planId) {
      const planDoc = await db.collection('plans').doc(after.planId).get();
      if (planDoc.exists) {
        const plan = planDoc.data();
        const compliance = calculateTradeCompliance(after, plan);
        
        // Reconstruir red flags — remove os de compliance, recria conforme novo cálculo
        const existingFlags = Array.isArray(after.redFlags) ? after.redFlags : [];
        let newFlags = existingFlags.filter(f => {
          const type = typeof f === 'string' ? f : f.type;
          return type !== 'RISCO_ACIMA_PERMITIDO' && type !== 'RR_ABAIXO_MINIMO' && type !== 'TRADE_SEM_STOP';
        });
        
        if (!after.stopLoss) {
          const tradeResult = after.result ?? 0;
          let noStopMsg = 'Trade sem stop loss definido';
          if (tradeResult < 0) noStopMsg += ' — risco retroativo';
          else if (tradeResult > 0) noStopMsg += ' — risco não mensurado (win sem stop)';
          newFlags.push({ type: RED_FLAG_TYPES.NO_STOP, message: noStopMsg, timestamp: new Date().toISOString() });
        }
        if (compliance.riskPercent != null && compliance.compliance.roStatus === 'FORA_DO_PLANO') {
          newFlags.push({ type: RED_FLAG_TYPES.RISK_EXCEEDED, message: `Risco ${compliance.riskPercent.toFixed(1)}% excede máximo do plano (${plan.riskPerOperation}%)`, timestamp: new Date().toISOString() });
        }
        if (compliance.compliance.rrStatus === 'NAO_CONFORME' && compliance.rrRatio != null) {
          newFlags.push({ type: RED_FLAG_TYPES.RR_BELOW_MINIMUM, message: `RR ${compliance.rrRatio.toFixed(1)}x abaixo do mínimo (${plan.rrTarget}x)`, timestamp: new Date().toISOString() });
        }
        
        // DEC-007: calculateTradeCompliance agora calcula RR para todos os trades
        await change.after.ref.update({
          riskPercent: compliance.riskPercent,
          rrRatio: compliance.rrRatio,
          rrAssumed: compliance.rrAssumed,
          compliance: compliance.compliance,
          redFlags: newFlags,
          hasRedFlags: newFlags.length > 0
        });
        const roDisplay = compliance.riskPercent != null ? compliance.riskPercent.toFixed(2) + '%' : 'N/A';
        console.log(`[onTradeUpdated] Compliance recalculado: RO=${roDisplay}, RR=${compliance.rrRatio ?? 'N/A'}${compliance.rrAssumed ? ' (assumed)' : ''}, flags=${newFlags.length}`);
      }
    }

    // === PROP FIRM RECALC (#52 Fase 2) ===
    // LIMITAÇÃO v1: aplica delta incremental (newResult - oldResult), NÃO reconstrói histórico.
    // Trade editado muito antigo pode dessincronizar peakBalance. Aceito intencionalmente.
    if ((resultChanged || planChanged) && after.accountId) {
      try {
        const incrementalNet = newResult - oldResult;
        if (incrementalNet !== 0) {
          const tradeForEngine = { ...after, result: incrementalNet };
          const propFirmState = await recalculatePropFirmState(
            after.accountId,
            tradeForEngine,
            context.params.tradeId
          );
          if (propFirmState) {
            await appendDrawdownHistory(
              after.accountId,
              `${context.params.tradeId}-edit-${Date.now()}`,
              { ...after, id: context.params.tradeId },
              propFirmState
            );
            console.log(`[onTradeUpdated] PropFirm delta=${incrementalNet}, balance=${propFirmState.newBalance}, flags=[${propFirmState.flags.join(',')}]`);
          }
        }
      } catch (propErr) {
        console.error('[onTradeUpdated] Erro PropFirm engine:', propErr);
      }
    }

    // === MATURITY ENGINE (#119 task 07) ===
    // Recalcula sempre que o trade atualiza para CLOSED (ou já está CLOSED e foi editado).
    // Guard interno: status !== 'CLOSED' → skip. Isolamento total (INV-03).
    try {
      const { runMaturityRecompute } = require('./maturity/recomputeMaturity');
      const result = await runMaturityRecompute(db, { tradeId: context.params.tradeId, trade: after });
      if (!result.skipped) {
        console.log(`[onTradeUpdated] Maturity atualizado: studentId=${result.studentId}, stage=${result.currentStage}, windowSize=${result.windowSize}`);
      }
    } catch (matErr) {
      console.error('[onTradeUpdated] Erro maturity engine:', matErr);
    }

    // === B1 (v1.19.0): Re-check alerta emocional se emotionEntry mudou ===
    if (before.emotionEntry !== after.emotionEntry && after.emotionEntry) {
      try {
        const emotionSnap = await db.collection('emotions')
          .where('name', '==', after.emotionEntry)
          .limit(1)
          .get();
        
        if (!emotionSnap.empty) {
          const emotionData = emotionSnap.docs[0].data();
          if (emotionData.analysisCategory === 'CRITICAL' || emotionData.riskLevel === 'CRITICAL') {
            await db.collection('notifications').add({
              type: 'EMOTIONAL_ALERT',
              targetRole: 'mentor',
              studentId: after.studentId,
              studentEmail: after.studentEmail,
              tradeId: context.params.tradeId,
              ticker: after.ticker,
              emotion: after.emotionEntry,
              emotionEmoji: emotionData.emoji || '',
              severity: 'CRITICAL',
              message: `⚠️ ${after.studentEmail?.split('@')[0]} editou trade com "${after.emotionEntry}" (${emotionData.emoji})`,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[onTradeUpdated] Alerta emocional CRITICAL: ${after.emotionEntry}`);
          }
        }
      } catch (emotionErr) {
        console.error('[onTradeUpdated] Erro ao verificar emoção:', emotionErr);
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

    // === PROP FIRM RECALC (#52 Fase 2) ===
    // Aplica delta negativo (reverte o trade). drawdownHistory permanece append-only:
    // o snapshot original NÃO é removido. Análises Phase 3 devem filtrar por tradeId existente.
    if (trade.accountId && trade.result && trade.date) {
      try {
        const tradeForEngine = { ...trade, result: -trade.result };
        const propFirmState = await recalculatePropFirmState(
          trade.accountId,
          tradeForEngine,
          context.params.tradeId
        );
        if (propFirmState) {
          console.log(`[onTradeDeleted] PropFirm reverso aplicado: balance=${propFirmState.newBalance}, flags=[${propFirmState.flags.join(',')}]`);
        }
      } catch (propErr) {
        console.error('[onTradeDeleted] Erro PropFirm engine:', propErr);
      }
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
    features: ['feedback-flow', 'red-flags', 'student-cards', 'plan-centric-pl', 'trade-compliance', 'email-trigger', 'emotional-alerts', 'no-stop-detection'],
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

/**
 * Recalcula PL + compliance de todos os trades de um plano (ou de um trade específico).
 * Callable — invocado do frontend via httpsCallable.
 * v1.19.1: Inclui recálculo de PL (admin SDK, bypassa rules).
 * 
 * @param {string} planId - ID do plano (obrigatório)
 * @param {string} [tradeId] - ID de trade específico (opcional)
 * @param {boolean} [recalcPl] - Se true, recalcula currentPl do plano (default: true)
 */
exports.recalculateCompliance = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
  
  const { planId, tradeId, recalcPl = true } = data;
  if (!planId) throw new functions.https.HttpsError('invalid-argument', 'planId obrigatório');
  
  const planRef = db.collection('plans').doc(planId);
  const planDoc = await planRef.get();
  if (!planDoc.exists) throw new functions.https.HttpsError('not-found', 'Plano não encontrado');
  const plan = planDoc.data();
  
  // === Ida: Recálculo de PL (basePl + soma trades) ===
  let oldPl = plan.currentPl ?? plan.pl ?? 0;
  let newPl = oldPl;
  let plRecalculated = false;
  
  if (recalcPl && !tradeId) {
    const allTradesSnap = await db.collection('trades').where('planId', '==', planId).get();
    const basePl = Number(plan.pl) || 0;
    const totalResult = allTradesSnap.docs.reduce((sum, d) => sum + (Number(d.data().result) || 0), 0);
    newPl = Math.round((basePl + totalResult) * 100) / 100;
    
    if (Math.abs(oldPl - newPl) > 0.01) {
      await planRef.update({ currentPl: newPl, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      plRecalculated = true;
      console.log('[recalculateCompliance] PL recalculado: ' + oldPl + ' -> ' + newPl);
    }
    
    // Usar PL atualizado para compliance
    plan.currentPl = newPl;
  }
  
  // === Volta: Recálculo de compliance dos trades ===
  let tradeDocs;
  if (tradeId) {
    const tradeDoc = await db.collection('trades').doc(tradeId).get();
    if (!tradeDoc.exists) throw new functions.https.HttpsError('not-found', 'Trade não encontrado');
    tradeDocs = [tradeDoc];
  } else {
    const snap = await db.collection('trades').where('planId', '==', planId).get();
    tradeDocs = snap.docs;
  }
  
  let updated = 0;
  for (const doc of tradeDocs) {
    const trade = doc.data();
    const compliance = calculateTradeCompliance(trade, plan);
    
    const updateData = {
      riskPercent: compliance.riskPercent,
      rrRatio: compliance.rrRatio,
      rrAssumed: compliance.rrAssumed,
      compliance: compliance.compliance
    };
    
    // Recalcular red flags — remove os flags de compliance antigos e recria
    const existingFlags = Array.isArray(trade.redFlags) ? trade.redFlags : [];
    let newFlags = existingFlags.filter(f => {
      const type = typeof f === 'string' ? f : f.type;
      return type !== 'RISCO_ACIMA_PERMITIDO' && type !== 'RR_ABAIXO_MINIMO' && type !== 'TRADE_SEM_STOP';
    });
    
    if (!trade.stopLoss) {
      const tradeResult = trade.result ?? 0;
      let noStopMsg = 'Trade sem stop loss definido';
      if (tradeResult < 0) noStopMsg += ' — risco retroativo';
      else if (tradeResult > 0) noStopMsg += ' — risco não mensurado (win sem stop)';
      newFlags.push({ type: RED_FLAG_TYPES.NO_STOP, message: noStopMsg, timestamp: new Date().toISOString() });
    }
    if (compliance.riskPercent != null && compliance.compliance.roStatus === 'FORA_DO_PLANO') {
      newFlags.push({ type: RED_FLAG_TYPES.RISK_EXCEEDED, message: 'Risco ' + compliance.riskPercent.toFixed(1) + '% excede maximo (' + plan.riskPerOperation + '%)', timestamp: new Date().toISOString() });
    }
    if (compliance.compliance.rrStatus === 'NAO_CONFORME' && compliance.rrRatio != null) {
      newFlags.push({ type: RED_FLAG_TYPES.RR_BELOW_MINIMUM, message: 'RR ' + compliance.rrRatio.toFixed(1) + 'x abaixo do minimo (' + plan.rrTarget + 'x)', timestamp: new Date().toISOString() });
    }
    
    updateData.redFlags = newFlags;
    updateData.hasRedFlags = newFlags.length > 0;
    
    await doc.ref.update(updateData);
    updated++;
  }
  
  console.log('[recalculateCompliance] Plan ' + planId + ': ' + updated + ' trades recalculados' + (plRecalculated ? ', PL: ' + oldPl + ' -> ' + newPl : ''));
  return { success: true, updated, planId, oldPl, newPl, plRecalculated };
});


// ============================================
// ASSESSMENT — Student Onboarding (CHUNK-09)
// ============================================
exports.classifyOpenResponse = require("./assessment/classifyOpenResponse");
exports.generateProbingQuestions = require("./assessment/generateProbingQuestions");
exports.analyzeProbingResponse = require("./assessment/analyzeProbingResponse");
exports.generateAssessmentReport = require("./assessment/generateAssessmentReport");
exports.classifyMaturityProgression = require("./assessment/classifyMaturityProgression");

// ============================================
// MATURITY — Recompute single-point (CHUNK-09, issue #119 task 20)
// ============================================
exports.recomputeStudentMaturity = require("./maturity/recomputeStudentMaturity");

// ============================================
// SUBSCRIPTIONS — Controle de Assinaturas (CHUNK-16, issue #094)
// ============================================
exports.checkSubscriptions = require("./subscriptions/checkSubscriptions");

// ============================================
// SHADOW BEHAVIOR — Padrões comportamentais (CHUNK-04, issue #129)
// ============================================
exports.analyzeShadowBehavior = require("./analyzeShadowBehavior");

// ============================================
// PROP FIRM — AI Approach Plan (CHUNK-17, issue #133)
// ============================================
exports.generatePropFirmApproachPlan = require("./propFirm/generatePropFirmApproachPlan");

// ============================================
// REVISÃO SEMANAL — snapshot + SWOT IA (CHUNK-16, issue #102)
// ============================================
exports.createWeeklyReview = require("./reviews/createWeeklyReview");
exports.generateWeeklySwot = require("./reviews/generateWeeklySwot");
