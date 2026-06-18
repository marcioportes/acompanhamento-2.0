/**
 * migrationLogic.js — núcleo puro da migration retroativa de reviewState (#269 Fase C, D8).
 *
 * Sem dependências de firebase-*: recebe POJOs (reviews e trades já lidos) e devolve
 * o estado-alvo + diffs. A callable migrateReviewStateBackfill faz só o I/O do
 * Firestore (ler reviews/trades, aplicar em batch, dry-run vs apply).
 *
 * Estado-alvo por trade (§9.1, ordem de prioridade):
 *   1. está em review CLOSED/ARCHIVED  → DISCUSSED (imortal, vence DRAFT)
 *   2. está em review DRAFT            → DRAFT + draftReviewId
 *   3. caso contrário                  → NONE
 */

const CLOSED_STATUSES = new Set(['CLOSED', 'ARCHIVED']);

/**
 * IDs de trades "discutidos" em uma review = união de
 * frozenSnapshot.periodTrades[].tradeId ∪ topTrades ∪ bottomTrades ∪ includedTradeIds.
 *
 * Decisão (#269 gate 16/06): fonte primária = periodTrades ∪ includedTradeIds.
 * Aqui também unimos top/bottomTrades — em reviews modernas são subconjunto de
 * periodTrades (não muda nada); em reviews legadas (anteriores ao periodTrades)
 * são o único sinal disponível além do includedTradeIds esparso. Aditivo e seguro:
 * top/bottom estavam literalmente na revisão publicada → foram discutidos.
 *
 * @param {Object} review
 * @returns {string[]} tradeIds (com possíveis duplicatas; o caller dedup em Set)
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
  return ids;
};

/**
 * A partir das reviews de UM aluno, monta os mapas de decisão.
 *
 * @param {Array<{id:string, ...reviewData}>} reviews — docs com id + campos
 * @returns {{
 *   discussedSet: Set<string>,
 *   draftByTradeId: Map<string,string>,     // tradeId → reviewId (DRAFT)
 *   planPointers: Map<string,string>,        // planId → reviewId DRAFT ativo
 *   conflicts: Array<{planId:string, kept:string, dropped:string}>
 * }}
 */
const buildReviewMaps = (reviews) => {
  const discussedSet = new Set();
  const draftByTradeId = new Map();
  const planPointers = new Map();
  const draftReviewsByPlan = new Map(); // planId → [{id, sortKey}]
  const conflicts = [];

  // Primeiro: discussed (prioridade). Depois draft.
  for (const r of reviews) {
    if (CLOSED_STATUSES.has(r.status)) {
      for (const id of collectDiscussedTradeIds(r)) discussedSet.add(id);
    }
  }
  for (const r of reviews) {
    if (r.status !== 'DRAFT') continue;
    // Trades do draft que NÃO foram discutidos em outra review fechada.
    for (const id of collectDiscussedTradeIds(r)) {
      if (!discussedSet.has(id)) draftByTradeId.set(id, r.id);
    }
    if (r.planId) {
      const list = draftReviewsByPlan.get(r.planId) || [];
      list.push({ id: r.id, sortKey: chronoKey(r) });
      draftReviewsByPlan.set(r.planId, list);
    }
  }

  // Ponteiro plan.activeDraftReviewId: 1 DRAFT por plano (invariante novo). Se houver
  // mais de um DRAFT no mesmo plano (legado bagunçado), mantém o mais recente e reporta.
  for (const [planId, list] of draftReviewsByPlan.entries()) {
    list.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1)); // desc — mais recente primeiro
    planPointers.set(planId, list[0].id);
    for (let i = 1; i < list.length; i++) {
      conflicts.push({ planId, kept: list[0].id, dropped: list[i].id });
    }
  }

  return { discussedSet, draftByTradeId, planPointers, conflicts };
};

/** Chave cronológica de uma review: closedAt → periodStart → weekStart → ''. */
const chronoKey = (review) => {
  const ts = review?.closedAt;
  if (ts && typeof ts.toMillis === 'function') return String(ts.toMillis()).padStart(16, '0');
  if (typeof ts === 'string') return ts;
  return review?.periodStart || review?.weekStart || '';
};

/**
 * Estado-alvo de um trade dado os mapas. draftReviewId só é setado em DRAFT.
 * @returns {{reviewState:'NONE'|'DRAFT'|'DISCUSSED', draftReviewId:string|null}}
 */
const targetReviewState = (tradeId, { discussedSet, draftByTradeId }) => {
  if (discussedSet.has(tradeId)) return { reviewState: 'DISCUSSED', draftReviewId: null };
  if (draftByTradeId.has(tradeId)) return { reviewState: 'DRAFT', draftReviewId: draftByTradeId.get(tradeId) };
  return { reviewState: 'NONE', draftReviewId: null };
};

/**
 * Atribui sequenceNumber às reviews CLOSED/ARCHIVED em ordem cronológica por aluno.
 * @param {Array<{id:string, ...}>} reviews
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
 * `true` se o trade precisa de update (estado atual difere do alvo). Tolera campos
 * ausentes em docs legados (reviewState undefined ≠ 'NONE' → conta como mudança).
 */
const tradeNeedsUpdate = (trade, target) => {
  const curState = trade.reviewState ?? null;
  const curDraft = trade.draftReviewId ?? null;
  return curState !== target.reviewState || curDraft !== target.draftReviewId;
};

module.exports = {
  CLOSED_STATUSES,
  collectDiscussedTradeIds,
  buildReviewMaps,
  chronoKey,
  targetReviewState,
  assignSequenceNumbers,
  tradeNeedsUpdate,
};
