/**
 * checkSubscriptions — Cloud Function (onSchedule)
 * @description Verifica assinaturas diariamente às 8h BRT.
 *   1. Detecta assinaturas vencendo em 7 dias
 *   2. Detecta e marca inadimplentes (renewalDate + gracePeriod ultrapassados)
 *   3. Envia email consolidado ao mentor se houver ocorrências
 *
 * Issue: #094
 * Collection: subscriptions
 * Email: via collection `mail` (firebase/firestore-send-email extension)
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Garante que o admin está inicializado (index.js já faz, mas seguro para testes)
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MENTOR_EMAIL = 'marcio.portes@me.com';
const FROM_EMAIL = 'Tchio-Alpha <marcio.portes@me.com>';

/**
 * Formata data no padrão BR (DD/MM/YYYY)
 */
const formatBrDate = (date) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Formata moeda
 */
const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
};

/**
 * Calcula dias entre duas datas (positivo = futuro, negativo = passado)
 */
const daysBetween = (from, to) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const f = new Date(from); f.setHours(0, 0, 0, 0);
  const t = new Date(to); t.setHours(0, 0, 0, 0);
  return Math.ceil((t - f) / msPerDay);
};

/**
 * Gera HTML do email de report
 */
const buildReportHtml = (today, expiringToday, expiringSoon, newOverdue, existingOverdue, summary) => {
  const dateStr = formatBrDate(today);

  const renderList = (items, isOverdue = false) => {
    if (items.length === 0) return '<p style="color:#64748b;font-size:14px;margin:8px 0;">Nenhum</p>';
    return items.map(s => {
      const renewalDate = s.renewalDate?.toDate ? s.renewalDate.toDate() : new Date(s.renewalDate);
      const days = Math.abs(daysBetween(today, renewalDate));
      const dateLabel = isOverdue
        ? `venceu ${formatBrDate(renewalDate)} (${days} dias)`
        : `vence ${formatBrDate(renewalDate)}`;
      return `<p style="color:#e2e8f0;font-size:14px;margin:4px 0;">
        &bull; <strong>${s.studentName}</strong> &mdash; ${dateLabel} &mdash; ${formatCurrency(s.amount, s.currency)}
      </p>`;
    }).join('');
  };

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;">
    <h1 style="color:#fff;font-size:20px;margin:0;">Report de Assinaturas</h1>
    <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:4px 0 0;">${dateStr}</p>
  </td></tr>

  <!-- Vencendo Hoje -->
  ${expiringToday.length > 0 ? `
  <tr><td style="padding:24px 32px 0;">
    <h3 style="color:#f59e0b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid #334155;padding-bottom:8px;">Vencendo Hoje</h3>
    ${renderList(expiringToday)}
  </td></tr>` : ''}

  <!-- Vencendo em 7 dias -->
  ${expiringSoon.length > 0 ? `
  <tr><td style="padding:24px 32px 0;">
    <h3 style="color:#f59e0b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid #334155;padding-bottom:8px;">Vencendo em 7 Dias</h3>
    ${renderList(expiringSoon)}
  </td></tr>` : ''}

  <!-- Novos inadimplentes -->
  ${newOverdue.length > 0 ? `
  <tr><td style="padding:24px 32px 0;">
    <h3 style="color:#ef4444;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid #334155;padding-bottom:8px;">Novos Inadimplentes</h3>
    ${renderList(newOverdue, true)}
  </td></tr>` : ''}

  <!-- Inadimplentes existentes -->
  ${existingOverdue.length > 0 ? `
  <tr><td style="padding:24px 32px 0;">
    <h3 style="color:#ef4444;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid #334155;padding-bottom:8px;">Inadimplentes em Aberto</h3>
    ${renderList(existingOverdue, true)}
  </td></tr>` : ''}

  <!-- Totais -->
  <tr><td style="padding:24px 32px;">
    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-top:8px;">
      <p style="color:#94a3b8;font-size:14px;margin:0;">
        <strong style="color:#e2e8f0;">${summary.active}</strong> ativas &middot;
        <strong style="color:#ef4444;">${summary.overdue}</strong> inadimplentes &middot;
        <strong style="color:#e2e8f0;">${formatCurrency(summary.monthlyRevenue)}</strong>/mes projetado
      </p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

// ── Scheduled Function ───────────────────────────────────

module.exports = functions.pubsub
  .schedule('0 11 * * *') // 11:00 UTC = 08:00 BRT
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Busca todas as assinaturas ativas
      const activeSnap = await db.collection('subscriptions')
        .where('status', '==', 'active')
        .get();

      // Busca inadimplentes existentes
      const overdueSnap = await db.collection('subscriptions')
        .where('status', '==', 'overdue')
        .get();

      const expiringToday = [];
      const expiringSoon = [];
      const newOverdue = [];
      const batch = db.batch();
      let batchCount = 0;

      // Processa assinaturas ativas
      for (const docSnap of activeSnap.docs) {
        const sub = docSnap.data();
        const renewalDate = sub.renewalDate?.toDate ? sub.renewalDate.toDate() : new Date(sub.renewalDate);
        renewalDate.setHours(0, 0, 0, 0);

        const daysToRenewal = daysBetween(today, renewalDate);
        const graceDays = sub.gracePeriodDays ?? 5;

        if (daysToRenewal < -graceDays) {
          // Ultrapassou grace period → marcar overdue
          batch.update(docSnap.ref, {
            status: 'overdue',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          batchCount++;
          newOverdue.push({ ...sub, id: docSnap.id });
        } else if (daysToRenewal === 0) {
          expiringToday.push({ ...sub, id: docSnap.id });
        } else if (daysToRenewal > 0 && daysToRenewal <= 7) {
          expiringSoon.push({ ...sub, id: docSnap.id });
        }
      }

      // Commit batch de status updates
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[checkSubscriptions] ${batchCount} assinaturas marcadas como overdue`);
      }

      // Inadimplentes existentes (já eram overdue antes desta execução)
      const existingOverdue = overdueSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      // Soma totais
      const totalActive = activeSnap.size - newOverdue.length;
      const totalOverdue = existingOverdue.length + newOverdue.length;
      const monthlyRevenue = activeSnap.docs
        .filter(d => !newOverdue.find(o => o.id === d.id))
        .reduce((sum, d) => sum + (d.data().amount ?? 0), 0);

      const summaryData = { active: totalActive, overdue: totalOverdue, monthlyRevenue };

      // Envia email apenas se houver ocorrências
      const hasOccurrences = expiringToday.length > 0 || expiringSoon.length > 0 ||
                             newOverdue.length > 0 || existingOverdue.length > 0;

      if (hasOccurrences) {
        const html = buildReportHtml(today, expiringToday, expiringSoon, newOverdue, existingOverdue, summaryData);
        const dateStr = formatBrDate(today);

        await db.collection('mail').add({
          to: MENTOR_EMAIL,
          from: FROM_EMAIL,
          message: {
            subject: `[Acompanhamento] Report de Assinaturas — ${dateStr}`,
            html,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[checkSubscriptions] Email enviado. Vencendo hoje: ${expiringToday.length}, em 7 dias: ${expiringSoon.length}, novos inadimplentes: ${newOverdue.length}, inadimplentes: ${existingOverdue.length}`);
      } else {
        console.log('[checkSubscriptions] Sem ocorrências — email não enviado');
      }
    } catch (err) {
      console.error('[checkSubscriptions] Erro:', err);
    }

    return null;
  });
