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

// #269 — data (YYYY-MM-DD) de um trade, priorizando entryTime e caindo em date.
export const tradeDayKey = (trade) =>
  trade?.entryTime ? String(trade.entryTime).slice(0, 10) : (trade?.date || null);

/**
 * Backlog do plano para a tela de criação por backlog (#269): só trades
 * reviewState='NONE', agrupados por dia (desc), trades de cada dia ordenados por
 * horário asc. Tolera reviewState ausente (trade legado pré-migration = NONE).
 *
 * @param {Array} trades — trades do plano (full docs)
 * @returns {Array<{ day: string, trades: Array }>} grupos ordenados (dia mais recente primeiro)
 */
export const groupBacklogByDay = (trades) => {
  const pending = (Array.isArray(trades) ? trades : [])
    .filter(t => (t?.reviewState ?? 'NONE') === 'NONE');
  const byDay = new Map();
  for (const t of pending) {
    const day = tradeDayKey(t) || 'sem-data';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(t);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, list]) => ({
      day,
      trades: list.sort((a, b) =>
        String(a.entryTime || '').localeCompare(String(b.entryTime || ''))),
    }));
};
