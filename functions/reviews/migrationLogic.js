/**
 * migrationLogic.js — núcleo puro da migration retroativa (#269 v2).
 *
 * Sem dependências de firebase-*: recebe POJOs (reviews e trades já lidos) e devolve
 * o estado-alvo + diffs. A callable migrateReviewStateBackfill faz só o I/O.
 *
 * Modelo v2: FK única `trade.reviewId` + ciclo único `trade.status` (terminal DISCUSSED).
 * Estado-alvo por trade (ordem de prioridade):
 *   1. em review CLOSED/ARCHIVED → reviewId = aquela review + status='DISCUSSED' (imortal)
 *      Conflito (trade em N reviews fechadas) → vence a MAIS RECENTE.
 *   2. em review DRAFT           → reviewId = o draft, status NÃO é tocado (ainda não discutido)
 *   3. COM feedback, fora de review → ancora no rascunho VIGENTE do plano (sinalizado por
 *      `anchorToPlanDraft:true`; a callable provisiona/resolve o reviewId). Mantém o invariante
 *      "rascunho aberto = trades com feedback ∧ status≠DISCUSSED" também para o legado, pra que
 *      nada escape da próxima reunião. status NÃO é tocado.
 *   4. caso contrário (sem feedback) → reviewId = null (backlog), status NÃO é tocado
 */

const CLOSED_STATUSES = new Set(['CLOSED', 'ARCHIVED']);

// "Tem feedback" = já passou por OPEN→REVIEWED (mentor comentou ao menos uma vez). Cobre o fio
// REVIEWED ⇄ QUESTION → CLOSED. OPEN = sem feedback (backlog); DISCUSSED = terminal (tratado no ramo 1).
const FEEDBACK_STATUSES = new Set(['REVIEWED', 'QUESTION', 'CLOSED']);

/** Trade legado já recebeu feedback do mentor? (status fora de OPEN/DISCUSSED) */
const tradeHasFeedback = (trade) => FEEDBACK_STATUSES.has(trade?.status);

/**
 * IDs de trades de uma review = união de
 * frozenSnapshot.periodTrades[].tradeId ∪ topTrades ∪ bottomTrades ∪ includedTradeIds.
 * (includedTradeIds é legado: o v2 não escreve mais esse array, mas reviews antigas têm.)
 */
const collectDiscussedTradeIds = (review) => {
  const ids = [];
  const snap = review?.frozenSnapshot || {};
  for (const key of ['periodTrades', 'topTrades', 'bottomTrades']) {
    const arr = snap[key];
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t && typeof t.tradeId === 'string' && t.tradeId) ids.push(t.tradeId);
      }
    }
  }
  if (Array.isArray(review?.includedTradeIds)) {
    for (const id of review.includedTradeIds) {
      if (typeof id === 'string' && id) ids.push(id);
    }
  }
  // Dedupe: top/bottomTrades são subconjuntos de periodTrades e includedTradeIds repete —
  // duplicata intra-review não é conflito (senão o mesmo trade "conflita" consigo mesmo).
  return [...new Set(ids)];
};

/** Chave cronológica de uma review: closedAt → periodStart → weekStart → ''. */
const chronoKey = (review) => {
  const ts = review?.closedAt;
  if (ts && typeof ts.toMillis === 'function') return String(ts.toMillis()).padStart(16, '0');
  if (typeof ts === 'string') return ts;
  return review?.periodStart || review?.weekStart || '';
};

/**
 * A partir das reviews de UM aluno, monta os mapas de decisão.
 *
 * @param {Array<{id:string, ...reviewData}>} reviews
 * @returns {{
 *   discussedByTradeId: Map<string,string>,  // tradeId → reviewId (CLOSED/ARCHIVED, mais recente)
 *   draftByTradeId: Map<string,string>,      // tradeId → reviewId (DRAFT, se não discutido)
 *   planPointers: Map<string,string>,        // planId → reviewId DRAFT ativo
 *   conflicts: Array<{tradeId?:string, planId?:string, kept:string, dropped:string}>
 * }}
 */
const buildReviewMaps = (reviews) => {
  const discussedByTradeId = new Map();
  const draftByTradeId = new Map();
  const planPointers = new Map();
  const draftReviewsByPlan = new Map();
  const conflicts = [];

  // CLOSED/ARCHIVED primeiro (prioridade). Ordena desc por chronoKey → a mais recente
  // vence quando o mesmo trade aparece em mais de uma review fechada.
  const closedDesc = reviews
    .filter((r) => CLOSED_STATUSES.has(r.status))
    .map((r) => ({ id: r.id, ids: collectDiscussedTradeIds(r), key: chronoKey(r) }))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  for (const r of closedDesc) {
    for (const id of r.ids) {
      if (discussedByTradeId.has(id)) {
        const kept = discussedByTradeId.get(id);
        if (kept !== r.id) conflicts.push({ tradeId: id, kept, dropped: r.id }); // só conflito REAL entre reviews distintas
      } else {
        discussedByTradeId.set(id, r.id);
      }
    }
  }

  // DRAFT: trades do draft que NÃO foram discutidos numa review fechada.
  for (const r of reviews) {
    if (r.status !== 'DRAFT') continue;
    for (const id of collectDiscussedTradeIds(r)) {
      if (!discussedByTradeId.has(id)) draftByTradeId.set(id, r.id);
    }
    if (r.planId) {
      const list = draftReviewsByPlan.get(r.planId) || [];
      list.push({ id: r.id, sortKey: chronoKey(r) });
      draftReviewsByPlan.set(r.planId, list);
    }
  }

  // Ponteiro plan.activeDraftReviewId: 1 DRAFT por plano. Mais de um (legado) → mantém o
  // mais recente e reporta.
  for (const [planId, list] of draftReviewsByPlan.entries()) {
    list.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1)); // desc
    planPointers.set(planId, list[0].id);
    for (let i = 1; i < list.length; i++) {
      conflicts.push({ planId, kept: list[0].id, dropped: list[i].id });
    }
  }

  return { discussedByTradeId, draftByTradeId, planPointers, conflicts };
};

/**
 * Estado-alvo de um trade. `status` = null significa "não tocar o status".
 * `anchorToPlanDraft:true` = trade com feedback fora de review → a callable resolve o reviewId
 * para o rascunho vigente do plano (criando-o se preciso).
 * @param {string} tradeId
 * @param {object} maps  retorno de buildReviewMaps
 * @param {object} [trade]  doc do trade (precisa do `status` p/ detectar feedback)
 * @returns {{reviewId:string|null, status:'DISCUSSED'|null, anchorToPlanDraft?:boolean}}
 */
const targetReview = (tradeId, { discussedByTradeId, draftByTradeId }, trade) => {
  if (discussedByTradeId.has(tradeId)) {
    return { reviewId: discussedByTradeId.get(tradeId), status: 'DISCUSSED' };
  }
  if (draftByTradeId.has(tradeId)) {
    return { reviewId: draftByTradeId.get(tradeId), status: null };
  }
  if (tradeHasFeedback(trade)) {
    return { reviewId: null, status: null, anchorToPlanDraft: true };
  }
  return { reviewId: null, status: null };
};

/**
 * Atribui sequenceNumber às reviews CLOSED/ARCHIVED em ordem cronológica por aluno.
 * @returns {Map<string,number>} reviewId → sequenceNumber (1-based)
 */
const assignSequenceNumbers = (reviews) => {
  const closed = reviews
    .filter((r) => CLOSED_STATUSES.has(r.status))
    .map((r) => ({ id: r.id, key: chronoKey(r) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const out = new Map();
  closed.forEach((r, i) => out.set(r.id, i + 1));
  return out;
};

/**
 * `true` se o trade precisa de update (estado atual difere do alvo). Trade legado SEM o
 * campo `reviewId` SEMPRE precisa de write (materializar `reviewId=null`): a query de
 * backlog `where reviewId==null` não retorna docs sem o campo. Só considera `status`
 * quando o alvo o define (DISCUSSED).
 */
const tradeNeedsUpdate = (trade, target) => {
  const hasReviewId = Object.prototype.hasOwnProperty.call(trade, 'reviewId');
  if (!hasReviewId) return true;
  if ((trade.reviewId ?? null) !== target.reviewId) return true;
  if (target.status !== null && trade.status !== target.status) return true;
  return false;
};

/** Monta o patch a aplicar no trade a partir do alvo (omite status quando não definido). */
const tradeUpdateData = (target) => {
  const data = { reviewId: target.reviewId };
  if (target.status !== null) data.status = target.status;
  return data;
};

module.exports = {
  CLOSED_STATUSES,
  FEEDBACK_STATUSES,
  tradeHasFeedback,
  collectDiscussedTradeIds,
  buildReviewMaps,
  chronoKey,
  targetReview,
  assignSequenceNumbers,
  tradeNeedsUpdate,
  tradeUpdateData,
};
