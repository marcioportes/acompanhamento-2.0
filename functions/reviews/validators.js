/**
 * validators.js — helpers puros reutilizáveis pelas CFs de reviews.
 * Sem dependências de firebase-*, para serem testáveis via Vitest.
 */

const MENTOR_EMAILS = ['marcio.portes@me.com'];

const isMentor = (email) => MENTOR_EMAILS.includes(email?.toLowerCase());

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isPeriodKey = (s) => typeof s === 'string' && (/^\d{4}-W\d{2}$/.test(s) || /^CUSTOM-\d+$/.test(s));

/**
 * Valida shape do frozenSnapshot. Lança string com razão se inválido.
 * Retorna true se OK (facilita uso em testes).
 */
const validateSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('snapshot é obrigatório');
  }
  if (!snapshot.planContext?.planId) {
    throw new Error('snapshot.planContext.planId é obrigatório');
  }
  if (!snapshot.kpis || typeof snapshot.kpis !== 'object') {
    throw new Error('snapshot.kpis é obrigatório');
  }
  const required = ['pl', 'trades', 'wr', 'avgRR', 'maxDD', 'compliance', 'emotional'];
  for (const f of required) {
    if (snapshot.kpis[f] === undefined) {
      throw new Error(`snapshot.kpis.${f} é obrigatório`);
    }
  }
  if (!Array.isArray(snapshot.topTrades) || !Array.isArray(snapshot.bottomTrades)) {
    throw new Error('snapshot.topTrades/bottomTrades devem ser arrays');
  }
  return true;
};

/**
 * Valida transição de status. Lança se inválida.
 * A4: DRAFT → CLOSED → ARCHIVED. ARCHIVED é terminal.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  DRAFT: new Set(['DRAFT', 'CLOSED']),
  CLOSED: new Set(['CLOSED', 'ARCHIVED']),
  ARCHIVED: new Set(['ARCHIVED']),
};

const validateStatusTransition = (from, to) => {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  if (!allowed) throw new Error(`status de origem inválido: ${from}`);
  if (!allowed.has(to)) throw new Error(`transição inválida: ${from} → ${to}`);
  return true;
};

/**
 * Próximo sequenceNumber por aluno (#269 — atribuído no publishReview).
 * Recebe os sequenceNumber das reviews CLOSED/ARCHIVED do aluno (números ou null)
 * e retorna max + 1. Sem reviews fechadas → 1. Ignora null/não-numéricos (docs
 * antigos sem o campo; migration retroativa preenche os legados).
 *
 * @param {Array<number|null|undefined>} sequenceNumbers
 * @returns {number}
 */
const nextSequenceNumber = (sequenceNumbers) => {
  const nums = (sequenceNumbers || []).filter((n) => typeof n === 'number' && Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return max + 1;
};

/**
 * Período do rascunho a partir dos entryTime dos trades empenhados (#269 §5.2).
 * periodStart = menor data; periodEnd = maior data, mas estendida para `todayISO`
 * quando o último trade é anterior a hoje (a janela de revisão alcança o presente).
 * Sem trades → { null, null } (rascunho vazio; mentor pode adicionar depois).
 *
 * Puro: `todayISO` é injetado (sem Date.now interno) para testabilidade.
 *
 * @param {Array<string|null>} entryTimes — ISO timestamps
 * @param {string} todayISO — 'YYYY-MM-DD'
 * @returns {{periodStart: string|null, periodEnd: string|null}}
 */
const computePeriodBounds = (entryTimes, todayISO) => {
  const dates = (entryTimes || [])
    .filter(Boolean)
    .map((t) => String(t).slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return { periodStart: null, periodEnd: null };
  const periodStart = dates[0];
  const maxDate = dates[dates.length - 1];
  const periodEnd = (isISODate(todayISO) && maxDate < todayISO) ? todayISO : maxDate;
  return { periodStart, periodEnd };
};

module.exports = {
  MENTOR_EMAILS,
  isMentor,
  isNonEmptyString,
  isISODate,
  isPeriodKey,
  validateSnapshot,
  validateStatusTransition,
  ALLOWED_STATUS_TRANSITIONS,
  nextSequenceNumber,
  computePeriodBounds,
};
