/**
 * validators.js — helpers puros reutilizáveis pelas CFs de cycleClosure.
 * Sem dependências de firebase-*, para serem testáveis via Vitest.
 *
 * Issue #259 (1A — Ritual de Fechamento de Ciclo).
 */

const MENTOR_EMAILS = ['marcio.portes@me.com'];

const isMentor = (email) => MENTOR_EMAILS.includes(String(email || '').toLowerCase());

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** cycleKey: 'YYYY-MM' (Mensal) | 'YYYY-QN' (Trimestral) | 'YYYY-S{1|2}' (Semestral) | 'YYYY' (Anual) */
const isCycleKey = (s) =>
  typeof s === 'string' &&
  (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ||      // Mensal: 2026-04
    /^\d{4}-Q[1-4]$/.test(s) ||                // Trimestral: 2026-Q2
    /^\d{4}-S[12]$/.test(s) ||                 // Semestral: 2026-S1
    /^\d{4}$/.test(s)                          // Anual: 2026
  );

const CLOSE_ROLES = ['student', 'mentor'];
const isCloseRole = (v) => CLOSE_ROLES.includes(v);

const CLOSE_MODES = ['self', 'demonstrated', 'co_edited'];
const isCloseMode = (v) => CLOSE_MODES.includes(v);

/**
 * @deprecated Servidor agora decide closeMode em closeCycle.js a partir do role
 * autenticado, então este gate não é mais invocado em produção. Mantido como
 * utilitário pra eventuais testes futuros ou re-introdução.
 *
 * Regra: closeMode coerente com role.
 *  - student → 'self'
 *  - mentor  → 'demonstrated' | 'co_edited'
 */
const validateRoleCloseMode = (role, closeMode) => {
  if (role === 'student' && closeMode !== 'self') {
    throw new Error(`closeMode='${closeMode}' incompatível com role=student (deve ser 'self')`);
  }
  if (role === 'mentor' && !(closeMode === 'demonstrated' || closeMode === 'co_edited')) {
    throw new Error(`closeMode='${closeMode}' incompatível com role=mentor (deve ser 'demonstrated' ou 'co_edited')`);
  }
  return true;
};

/**
 * Valida shape estrutural mínimo do payload de closeCycle.
 * Validação semântica profunda (campos por seção A-J) fica para utilities específicas
 * em A3+ (kelly, monteCarlo, TPS, etc.). Aqui só estrutura + identidade.
 *
 * Lança Error com razão se inválido. Retorna true se OK.
 */
const validateClosurePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload é obrigatório');
  }

  // Identidade
  if (!isNonEmptyString(payload.planId)) throw new Error('planId é obrigatório');
  if (!isNonEmptyString(payload.studentId)) throw new Error('studentId é obrigatório');
  if (!isCycleKey(payload.cycleKey)) throw new Error(`cycleKey inválido: '${payload.cycleKey}'`);
  if (!isISODate(payload.cycleStart)) throw new Error('cycleStart deve estar em YYYY-MM-DD');
  if (!isISODate(payload.cycleEnd)) throw new Error('cycleEnd deve estar em YYYY-MM-DD');
  if (typeof payload.cycleNumber !== 'number' || payload.cycleNumber < 1) {
    throw new Error('cycleNumber deve ser número >= 1');
  }

  // Seções obrigatórias (presença, não conteúdo)
  const sections = ['snapshot', 'metrics', 'patterns', 'aar', 'maturity', 'swot', 'mentor', 'forward'];
  for (const s of sections) {
    if (!payload[s] || typeof payload[s] !== 'object') {
      throw new Error(`seção '${s}' é obrigatória`);
    }
  }

  // closeMode NÃO é validado aqui — servidor decide o valor em closeCycle.js
  // a partir do role autenticado, ignorando/sobrescrevendo o que o cliente mandou.

  return true;
};

/**
 * Constrói closureId determinístico = `${planId}_${cycleKey}`.
 * Usado pra idempotência (mesmo plano + ciclo = mesmo doc, evita duplicação).
 */
const buildClosureId = (planId, cycleKey) => {
  if (!isNonEmptyString(planId)) throw new Error('planId é obrigatório');
  if (!isCycleKey(cycleKey)) throw new Error('cycleKey inválido');
  return `${planId}_${cycleKey}`;
};

module.exports = {
  MENTOR_EMAILS,
  CLOSE_ROLES,
  CLOSE_MODES,
  isMentor,
  isNonEmptyString,
  isISODate,
  isCycleKey,
  isCloseRole,
  isCloseMode,
  validateRoleCloseMode,
  validateClosurePayload,
  buildClosureId,
};
