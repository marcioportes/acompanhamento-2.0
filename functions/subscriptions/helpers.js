/**
 * helpers.js — pure helpers para checkSubscriptions CF
 *
 * Extraídos para permitir testes unitários (vitest em functions/__tests__/).
 *
 * Issue: #266
 */

// ── Date helpers ─────────────────────────────────────────

/**
 * Retorna a "data de hoje" em BRT (UTC-3, fixo desde 2019) como instante
 * absoluto de BRT-midnight = UTC 03:00 do calendar day BRT.
 *
 * Bug histórico: `new Date(); setHours(0,0,0,0)` no servidor UTC dá UTC midnight,
 * que ao formatar em BRT volta 21:00 do dia anterior → email mostrava data errada
 * no subject (e.g. "10/05/2026" quando hoje era 11). Esta função usa Intl para
 * obter o calendar day em BRT e devolve um Date BRT-midnight estável.
 */
const getBrazilToday = (nowDate = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(nowDate);
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = parseInt(get('year'), 10);
  const m = parseInt(get('month'), 10);
  const d = parseInt(get('day'), 10);
  // BRT midnight = UTC 03:00 do calendar day BRT
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
};

/**
 * Calcula diferença assinada em dias entre `from` e `to`, usando o calendar day
 * em BRT (UTC-3 fixo). Robusto contra TZ do servidor (testes locais vs Cloud
 * Functions em UTC).
 *
 * Positivo = to no futuro BRT, negativo = to no passado BRT.
 */
const daysBetweenSigned = (from, to) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const brOffsetMs = 3 * 60 * 60 * 1000; // BRT = UTC-3
  const calendarDayMs = (d) => {
    const inst = d instanceof Date ? d : new Date(d);
    // Desloca o instante para "BRT clock" e pega o dia UTC dessa data deslocada.
    const brShifted = new Date(inst.getTime() - brOffsetMs);
    return Date.UTC(brShifted.getUTCFullYear(), brShifted.getUTCMonth(), brShifted.getUTCDate());
  };
  return Math.round((calendarDayMs(to) - calendarDayMs(from)) / msPerDay);
};

const formatBrDate = (date) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// ── Label do email ───────────────────────────────────────

/**
 * Formata label de data para o email de assinaturas.
 *
 * - Futuro: "vence em N dias (DD/MM/YYYY)" ou "vence amanhã (DD/MM/YYYY)"
 * - Hoje: "vence hoje (DD/MM/YYYY)"
 * - Passado: "venceu há N dias (DD/MM/YYYY)" ou "venceu ontem (DD/MM/YYYY)"
 *
 * Issue #266 — antes o label sempre dizia "venceu" para qualquer sub em
 * existingOverdue, mesmo quando a data era futura (bug do Math.abs).
 */
const formatDateLabel = (today, date) => {
  const dateStr = formatBrDate(date);
  const diff = daysBetweenSigned(today, date);
  if (diff < 0) {
    const n = Math.abs(diff);
    if (n === 1) return `venceu ontem (${dateStr})`;
    return `venceu há ${n} dias (${dateStr})`;
  }
  if (diff === 0) return `vence hoje (${dateStr})`;
  if (diff === 1) return `vence amanhã (${dateStr})`;
  return `vence em ${diff} dias (${dateStr})`;
};

// ── Auto-recovery de subs overdue ────────────────────────

/**
 * Decide o que fazer com uma sub com `status === 'overdue'` no CF.
 *
 * Issue #266 — bug raiz: CF lia literal `sub.status` e empurrava para
 * existingOverdue sem re-avaliar `renewalDate`. updateSubscription cego
 * permitia bump de renewalDate pro futuro com status preso em 'overdue'.
 *
 * @param {object} sub - { renewalDate: Date|null, gracePeriodDays?: number }
 * @param {Date} today - data do CF (00:00:00 BRT)
 * @returns {object} {
 *   action: 'recover' | 'keep_overdue',
 *   urgency: 'today' | 'soon' | 'silent' | null,
 *   daysToRenewal: number | null,
 * }
 *
 * action='recover' significa:
 *  - Firestore: batch update status: 'active'
 *  - Student: se loginBlockedReason === 'auto', desbloqueia
 *  - Email: rotear por urgency
 *
 * action='keep_overdue':
 *  - Firestore: sem update
 *  - Email: push em existingOverdue (comportamento original)
 */
const classifyOverdueSub = (sub, today) => {
  const renewalDate = sub.renewalDate;
  if (!renewalDate) {
    return { action: 'keep_overdue', urgency: null, daysToRenewal: null };
  }
  const daysToRenewal = daysBetweenSigned(today, renewalDate);
  const graceDays = sub.gracePeriodDays ?? 5;

  // Passado além do grace → mantém overdue
  if (daysToRenewal < -graceDays) {
    return { action: 'keep_overdue', urgency: null, daysToRenewal };
  }

  // Dentro do grace OU futuro → recupera
  let urgency;
  if (daysToRenewal < 0) {
    // dentro do grace (já vencida mas ainda dentro do prazo de tolerância)
    urgency = 'today';
  } else if (daysToRenewal === 0) {
    urgency = 'today';
  } else if (daysToRenewal <= 7) {
    urgency = 'soon';
  } else {
    urgency = 'silent';
  }

  return { action: 'recover', urgency, daysToRenewal };
};

module.exports = {
  getBrazilToday,
  daysBetweenSigned,
  formatBrDate,
  formatDateLabel,
  classifyOverdueSub,
};
