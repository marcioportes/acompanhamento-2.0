/**
 * reviewHelpers — utilitários para lógica de inclusão de trades em revisões.
 *
 * isTradeAlreadyReviewed: trade em includedTradeIds de qualquer revisão CLOSED/ARCHIVED
 *   → não é candidato a novo rascunho.
 * isTradeInDraft: trade já está no rascunho aberto atual.
 * getDraftTradeNote: última nota gravada para esse trade no rascunho (sourceTradeId match).
 */

export const isTradeAlreadyReviewed = (tradeId, reviews) =>
  Array.isArray(reviews) && reviews.some(r =>
    ['CLOSED', 'ARCHIVED'].includes(r.status) &&
    Array.isArray(r.includedTradeIds) &&
    r.includedTradeIds.includes(tradeId)
  );

export const isTradeInDraft = (tradeId, draft) =>
  !!draft &&
  Array.isArray(draft.includedTradeIds) &&
  draft.includedTradeIds.includes(tradeId);

export const getDraftTradeNote = (tradeId, draft) => {
  const items = (draft?.takeawayItems || []).filter(it => it.sourceTradeId === tradeId);
  return items.length > 0 ? items[items.length - 1].text : null;
};
