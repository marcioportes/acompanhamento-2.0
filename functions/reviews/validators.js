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

module.exports = {
  MENTOR_EMAILS,
  isMentor,
  isNonEmptyString,
  isISODate,
  isPeriodKey,
  validateSnapshot,
  validateStatusTransition,
  ALLOWED_STATUS_TRANSITIONS,
};
