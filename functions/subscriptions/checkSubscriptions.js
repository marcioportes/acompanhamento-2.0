/**
 * checkSubscriptions — Cloud Function (onSchedule)
 * @description Verifica assinaturas diariamente às 8h BRT.
 *   1. Detecta assinaturas vencendo em 7 dias (paid) e trials expirando
 *   2. Detecta e marca inadimplentes (renewalDate + gracePeriod ultrapassados)
 *   3. Expira trials automaticamente quando trialEndsAt < hoje
 *   4. Sincroniza accessTier no documento do student
 *   5. Envia email consolidado ao mentor se houver ocorrências
 *
 * DEC-055: Subscriptions como subcollection de students
 * DEC-056: type trial/paid + trialEndsAt + accessTier
 *
 * Issue: #094
 * Path: students/{studentId}/subscriptions/{subId}
 * Email: via collection `mail` (firebase/firestore-send-email extension)
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MENTOR_EMAIL = 'marcio.portes@me.com';
const FROM_EMAIL = 'Tchio-Alpha <marcio.portes@me.com>';

// ── Helpers ──────────────────────────────────────────────

const formatBrDate = (date) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
};

const daysBetween = (from, to) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const f = new Date(from); f.setHours(0, 0, 0, 0);
  const t = new Date(to); t.setHours(0, 0, 0, 0);
  return Math.ceil((t - f) / msPerDay);
};

const toDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
};

/**
 * Determina o accessTier correto baseado na subscription ativa.
 * Sem subscription ativa → 'none'
 */
const resolveAccessTier = (sub) => {
  if (!sub || sub.status === 'cancelled' || sub.status === 'expired') return 'none';
  if (sub.status === 'active' || sub.status === 'pending' || sub.status === 'paused') return sub.plan ?? 'none';
  if (sub.status === 'overdue') return sub.plan ?? 'none'; // mantém acesso durante grace
  return 'none';
};

// ── Email HTML builder ───────────────────────────────────

const buildReportHtml = (today, sections, summaryData) => {
  const dateStr = formatBrDate(today);

  const renderSection = (title, items, color, isOverdue = false) => {
    if (items.length === 0) return '';
    const rows = items.map(s => {
      const date = isOverdue
        ? toDate(s.type === 'trial' ? s.trialEndsAt : s.renewalDate)
        : toDate(s.type === 'trial' ? s.trialEndsAt : s.renewalDate);
      const days = Math.abs(daysBetween(today, date));
      const typeLabel = s.type === 'trial' ? ' [Trial]' : '';
      const dateLabel = isOverdue
        ? `venceu ${formatBrDate(date)} (${days} dias)`
        : `vence ${formatBrDate(date)}`;
      const valueLabel = s.type === 'paid' ? ` — ${formatCurrency(s.amount, s.currency)}` : '';
      return `<p style="color:#e2e8f0;font-size:14px;margin:4px 0;">&bull; <strong>${s._studentName}${typeLabel}</strong> — ${dateLabel}${valueLabel}</p>`;
    }).join('');

    return `<tr><td style="padding:24px 32px 0;"><h3 style="color:${color};font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid #334155;padding-bottom:8px;">${title}</h3>${rows}</td></tr>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;"><h1 style="color:#fff;font-size:20px;margin:0;">Report de Assinaturas</h1><p style="color:rgba(255,255,255,0.8);font-size:14px;margin:4px 0 0;">${dateStr}</p></td></tr>
${renderSection('Vencendo Hoje', sections.expiringToday, '#f59e0b')}
${renderSection('Vencendo em 7 Dias', sections.expiringSoon, '#f59e0b')}
${renderSection('Trials Expirando', sections.trialsExpiring, '#a78bfa')}
${renderSection('Novos Inadimplentes', sections.newOverdue, '#ef4444', true)}
${renderSection('Inadimplentes em Aberto', sections.existingOverdue, '#ef4444', true)}
<tr><td style="padding:24px 32px;"><div style="background:#0f172a;border-radius:8px;padding:16px;margin-top:8px;"><p style="color:#94a3b8;font-size:14px;margin:0;">
<strong style="color:#e2e8f0;">${summaryData.active}</strong> ativas &middot;
<strong style="color:#ef4444;">${summaryData.overdue}</strong> inadimplentes &middot;
<strong style="color:#e2e8f0;">${formatCurrency(summaryData.monthlyRevenue)}</strong>/mes projetado
</p></div></td></tr>
</table></td></tr></table></body></html>`;
};

// ── Scheduled Function ───────────────────────────────────

module.exports = functions.pubsub
  .schedule('0 11 * * *') // 11:00 UTC = 08:00 BRT
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Busca todos os students
      const studentsSnap = await db.collection('students').get();
      const batch = db.batch();
      let batchCount = 0;

      const sections = {
        expiringToday: [],
        expiringSoon: [],
        trialsExpiring: [],
        newOverdue: [],
        existingOverdue: [],
      };

      let totalActive = 0;
      let totalOverdue = 0;
      let monthlyRevenue = 0;

      // Itera por cada student
      for (const studentDoc of studentsSnap.docs) {
        const student = studentDoc.data();
        const studentName = student.name ?? student.email ?? studentDoc.id;

        const subsSnap = await db.collection('students').doc(studentDoc.id).collection('subscriptions').get();
        if (subsSnap.empty) continue;

        let bestTier = 'none';

        for (const subDoc of subsSnap.docs) {
          const sub = subDoc.data();
          const subWithMeta = { ...sub, _studentName: studentName, id: subDoc.id };

          // ── Trial expiration ──
          if (sub.type === 'trial' && sub.status === 'active') {
            const trialEnd = toDate(sub.trialEndsAt);
            if (trialEnd) {
              const daysLeft = daysBetween(today, trialEnd);
              if (daysLeft < 0) {
                // Trial expirou → marcar expired
                batch.update(subDoc.ref, {
                  status: 'expired',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                batchCount++;
                sections.trialsExpiring.push(subWithMeta);
              } else if (daysLeft === 0) {
                sections.expiringToday.push(subWithMeta);
                totalActive++;
                bestTier = resolveAccessTier(sub);
              } else if (daysLeft <= 7) {
                sections.trialsExpiring.push(subWithMeta);
                totalActive++;
                bestTier = resolveAccessTier(sub);
              } else {
                totalActive++;
                bestTier = resolveAccessTier(sub);
              }
            }
            continue;
          }

          // ── Paid: active subscriptions ──
          if (sub.type !== 'trial' && sub.status === 'active') {
            const renewalDate = toDate(sub.renewalDate);
            if (renewalDate) {
              const daysToRenewal = daysBetween(today, renewalDate);
              const graceDays = sub.gracePeriodDays ?? 5;

              if (daysToRenewal < -graceDays) {
                // Ultrapassou grace → overdue
                batch.update(subDoc.ref, {
                  status: 'overdue',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                batchCount++;
                sections.newOverdue.push(subWithMeta);
                totalOverdue++;
              } else if (daysToRenewal === 0) {
                sections.expiringToday.push(subWithMeta);
                totalActive++;
                monthlyRevenue += sub.amount ?? 0;
              } else if (daysToRenewal > 0 && daysToRenewal <= 7) {
                sections.expiringSoon.push(subWithMeta);
                totalActive++;
                monthlyRevenue += sub.amount ?? 0;
              } else {
                totalActive++;
                monthlyRevenue += sub.amount ?? 0;
              }
            }
            const tier = resolveAccessTier(sub);
            if (tier !== 'none') bestTier = tier;
            continue;
          }

          // ── Paid: overdue (já existente) ──
          if (sub.status === 'overdue') {
            sections.existingOverdue.push(subWithMeta);
            totalOverdue++;
            const tier = resolveAccessTier(sub);
            if (tier !== 'none') bestTier = tier;
            continue;
          }

          // Outros status (pending, paused, cancelled, expired) — resolve tier
          const tier = resolveAccessTier(sub);
          if (tier !== 'none') bestTier = tier;
        }

        // Sincroniza accessTier no student
        const currentTier = student.accessTier ?? 'none';
        if (currentTier !== bestTier) {
          batch.update(studentDoc.ref, {
            accessTier: bestTier,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          batchCount++;
        }
      }

      // Commit batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[checkSubscriptions] Batch: ${batchCount} operacoes`);
      }

      // Envia email se houver ocorrências
      const hasOccurrences = Object.values(sections).some(arr => arr.length > 0);

      if (hasOccurrences) {
        const summaryData = { active: totalActive, overdue: totalOverdue, monthlyRevenue };
        const html = buildReportHtml(today, sections, summaryData);

        await db.collection('mail').add({
          to: MENTOR_EMAIL,
          from: FROM_EMAIL,
          message: {
            subject: `[Acompanhamento] Report de Assinaturas — ${formatBrDate(today)}`,
            html,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[checkSubscriptions] Email enviado. Hoje: ${sections.expiringToday.length}, 7d: ${sections.expiringSoon.length}, trials: ${sections.trialsExpiring.length}, novos overdue: ${sections.newOverdue.length}, overdue: ${sections.existingOverdue.length}`);
      } else {
        console.log('[checkSubscriptions] Sem ocorrencias — email nao enviado');
      }
    } catch (err) {
      console.error('[checkSubscriptions] Erro:', err);
    }

    return null;
  });
