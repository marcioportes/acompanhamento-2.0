/**
 * tradeReport.js — seleção e agregação do Relatório do Mês (#414)
 * @see version.js para versão do produto
 *
 * @description Funções puras que alimentam a `TradeReportPage`. Ficam fora do
 * componente porque são a regra do relatório — o que entra, de que mês, e como
 * se soma — e regra sem teste é adivinhação (INV-05).
 *
 * CHANGELOG (produto):
 * - 1.86.0: criação — relatório do mês substitui o Diário
 */

import { aggregateTradesByCurrency } from './currency';

/**
 * Mensagens do mentor de um trade, em ordem cronológica.
 *
 * O `mentorFeedback` legado convive com o `feedbackHistory`: trades antigos têm
 * só o campo, os novos têm os dois (e o campo repete a primeira mensagem). Ler
 * um só esconde metade da base — e somar os dois duplica. Mesma conciliação do
 * `FeedbackThread.jsx:54-86`, que é quem exibe a conversa completa.
 *
 * @param {object} trade
 * @returns {Array<{id, authorRole, content, createdAt}>}
 */
export const mentorMessages = (trade) => {
  if (!trade) return [];
  const history = Array.isArray(trade.feedbackHistory) ? trade.feedbackHistory : [];
  const legacy = typeof trade.mentorFeedback === 'string' ? trade.mentorFeedback.trim() : '';
  const msgs = [];

  const legacyInHistory = history.some(
    (m) => m?.authorRole === 'mentor' && (m?.content || '').trim() === legacy
  );
  if (legacy && !legacyInHistory) {
    msgs.push({
      id: 'legacy',
      authorRole: 'mentor',
      content: legacy,
      createdAt: trade.feedbackDate || trade.updatedAt || null,
    });
  }

  history
    .filter((m) => m?.authorRole === 'mentor' && (m?.content || '').trim())
    .forEach((m) => msgs.push(m));

  return msgs.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

/** Timestamp Firestore, ISO string ou Date → ms. Ausente vai pro fim da fila (0). */
const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * O trade tem feedback do mentor? Único critério de entrada no relatório.
 * Trade sem feedback não é assunto: ou não foi revisado, ou não gerou conversa.
 */
export const hasMentorFeedback = (trade) => mentorMessages(trade).length > 0;

/** `'2026-08'` do mês corrente, em horário local. */
export const currentMonthKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

/**
 * Anda `delta` meses a partir de `'YYYY-MM'`. Aritmética na string, sem `Date`:
 * `new Date('2026-08-01')` é UTC e vira julho no fuso de Brasília.
 */
export const shiftMonth = (monthKey, delta) => {
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m) return monthKey;
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** `'2026-08'` → `'agosto / 2026'`. */
export const monthLabel = (monthKey) => {
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return String(monthKey);
  return `${MONTH_NAMES[m - 1]} / ${y}`;
};

/**
 * Relatório de um mês: os trades com feedback, do mais recente pro mais antigo,
 * e o resultado agregado POR MOEDA.
 *
 * O recorte é `trade.date` (`YYYY-MM-DD`, string, 100% preenchida), não
 * `feedbackDate`: o mês é o do trade, não o da resposta do mentor. Comparação de
 * prefixo, sem `Date` e sem fuso — aqui o recorte É o dia, não o instante.
 *
 * Nunca existe um total único: BRL e USD no mesmo mês somam duas linhas, não uma
 * (mesma regra do #289/#408).
 *
 * @param {Array} trades
 * @param {string} monthKey — `'YYYY-MM'`
 * @returns {{ trades: Array, totals: Array<{currency, totalPL, count}>, count: number }}
 */
export const buildMonthReport = (trades, monthKey) => {
  const list = (Array.isArray(trades) ? trades : [])
    .filter((t) => typeof t?.date === 'string' && t.date.startsWith(`${monthKey}-`))
    .filter(hasMentorFeedback)
    .sort((a, b) => {
      const byDate = (b.date || '').localeCompare(a.date || '');
      if (byDate !== 0) return byDate;
      return (b.entryTime || '').localeCompare(a.entryTime || '');
    });

  return {
    trades: list,
    totals: Array.from(aggregateTradesByCurrency(list).values()),
    count: list.length,
  };
};

/**
 * Meses que têm ao menos um trade com feedback, do mais recente pro mais antigo.
 * Alimenta o atalho quando o mês corrente está vazio — sem isso o aluno que não
 * operou em agosto vê uma tela vazia sem saber que setas resolvem.
 */
export const monthsWithFeedback = (trades) => {
  const keys = new Set();
  (Array.isArray(trades) ? trades : [])
    .filter((t) => typeof t?.date === 'string' && t.date.length >= 7)
    .filter(hasMentorFeedback)
    .forEach((t) => keys.add(t.date.slice(0, 7)));
  return Array.from(keys).sort((a, b) => b.localeCompare(a));
};

export default {
  mentorMessages,
  hasMentorFeedback,
  currentMonthKey,
  shiftMonth,
  monthLabel,
  buildMonthReport,
  monthsWithFeedback,
};
