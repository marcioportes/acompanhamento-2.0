/**
 * openConversations.js — trades do ciclo com conversa de feedback em aberto (#497).
 *
 * "Em aberto" = o mentor já revisou e a conversa não terminou:
 *  - REVIEWED: falta o aluno encerrar (ou mandar dúvida);
 *  - QUESTION: o aluno perguntou, falta o mentor responder.
 * OPEN (mentor ainda não revisou), CLOSED e DISCUSSED não entram.
 *
 * Só avisa no fechamento — não bloqueia o selo. Depois do selo a conversa
 * continua liberada (exceção #497 em firestore.rules).
 */

export const OPEN_CONVERSATION_STATUSES = Object.freeze(['REVIEWED', 'QUESTION']);

const inRange = (date, start, end) => date >= start && date <= end;

/**
 * @param {Array<object>} trades
 * @param {{planId: string, cycleStart: string, cycleEnd: string}} scope  datas YYYY-MM-DD
 * @returns {Array<object>} trades em aberto, do mais recente para o mais antigo
 */
export function listOpenConversations(trades, { planId, cycleStart, cycleEnd } = {}) {
  if (!Array.isArray(trades) || !planId || !cycleStart || !cycleEnd) return [];
  return trades
    .filter((t) =>
      t &&
      t.planId === planId &&
      typeof t.date === 'string' &&
      inRange(t.date, cycleStart, cycleEnd) &&
      OPEN_CONVERSATION_STATUSES.includes(t.status))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 'YYYY-MM-DD' → 'DD/MM' (INV-06). */
export function fmtDayMonth(date) {
  if (typeof date !== 'string' || date.length < 10) return '—';
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
