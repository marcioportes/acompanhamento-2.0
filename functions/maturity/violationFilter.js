/**
 * functions/maturity/violationFilter.js
 * @description Mirror CJS de `src/utils/violationFilter.js`. Issue #221 (Phase B).
 *   Paridade obrigatória ESM↔CJS — pattern `emotionalAnalysisMirror.js`.
 *   Toda mudança no .js precisa ser refletida aqui.
 */

function getEventKey(event, tradeId) {
  if (!event || !event.type || !tradeId) return '';
  return event.type + ':' + tradeId;
}

function isViolationCleared(trade, key) {
  if (!trade || !key) return false;
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  return cleared.indexOf(key) !== -1;
}

function effectiveRedFlags(trade) {
  if (!trade) return [];
  const flags = Array.isArray(trade.redFlags) ? trade.redFlags : [];
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  if (cleared.length === 0) return flags;
  return flags.filter(function (f) { return f && cleared.indexOf(f.type) === -1; });
}

function hasEffectiveRedFlags(trade) {
  if (!trade) return false;
  if (Array.isArray(trade.redFlags) && trade.redFlags.length > 0) {
    return effectiveRedFlags(trade).length > 0;
  }
  return trade.hasRedFlags === true;
}

function effectiveEmotionalEventsForTrade(trade, events) {
  if (!trade || !Array.isArray(events) || events.length === 0) return [];
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  return events.filter(function (evt) {
    if (!evt || !evt.type) return false;
    const ids = Array.isArray(evt.tradeIds) ? evt.tradeIds : [];
    if (ids.indexOf(trade.id) === -1) return false;
    return cleared.indexOf(getEventKey(evt, trade.id)) === -1;
  });
}

function effectiveEmotionalEventsForPeriod(trades, events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const safeTrades = Array.isArray(trades) ? trades : [];
  const tradeMap = new Map();
  for (const t of safeTrades) {
    if (t && t.id) tradeMap.set(t.id, t);
  }

  return events.filter(function (evt) {
    if (!evt || !evt.type) return false;
    const ids = Array.isArray(evt.tradeIds) ? evt.tradeIds : [];
    if (ids.length === 0) return true;

    return ids.some(function (tid) {
      const trade = tradeMap.get(tid);
      if (!trade) return true;
      const cleared = Array.isArray(trade.mentorClearedViolations)
        ? trade.mentorClearedViolations
        : [];
      return cleared.indexOf(getEventKey(evt, tid)) === -1;
    });
  });
}

module.exports = {
  getEventKey,
  isViolationCleared,
  effectiveRedFlags,
  hasEffectiveRedFlags,
  effectiveEmotionalEventsForTrade,
  effectiveEmotionalEventsForPeriod,
};
