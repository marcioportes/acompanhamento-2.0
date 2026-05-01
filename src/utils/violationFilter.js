/**
 * violationFilter.js — issue #221 (Phase B do épico #218).
 *
 * Helpers puros para aplicar `trade.mentorClearedViolations` (string[]) sobre
 * `redFlags` (compliance) e `emotionalEvents` (TILT/REVENGE/etc). Sem dependências
 * React. Espelhado em `functions/maturity/violationFilter.js` (CJS) — paridade
 * obrigatória.
 *
 * Schema de chaves:
 *  - Compliance: o próprio code (`NO_STOP`, `RR_BELOW_MINIMUM`, `RISK_EXCEEDED`,
 *    `DAILY_LOSS_EXCEEDED`, `BLOCKED_EMOTION`).
 *  - Emocional: `${eventType}:${tradeId}` — chave estável por par evento↔trade.
 *    Um evento que afeta vários trades (ex.: RAPID_SEQUENCE) pode ser limpo em
 *    um trade sem afetar os outros. DEC-AUTO-221-01.
 *
 * Fluxo de penalty no `calculatePeriodScore`:
 *  - `effectiveEmotionalEventsForPeriod(trades, events)` mantém apenas os eventos
 *    que ainda têm AO MENOS UM trade vinculado SEM o cleared correspondente.
 *  - Se TODOS os trades vinculados limparam o evento, ele sai da soma de penalties.
 */

export const getEventKey = (event, tradeId) => {
  if (!event?.type || !tradeId) return '';
  return `${event.type}:${tradeId}`;
};

export const isViolationCleared = (trade, key) => {
  if (!trade || !key) return false;
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  return cleared.includes(key);
};

/**
 * Compliance: filtra `trade.redFlags` removendo as cleared pelo mentor.
 * Chave = `flag.type` (o próprio code da violação).
 */
export const effectiveRedFlags = (trade) => {
  if (!trade) return [];
  const flags = Array.isArray(trade.redFlags) ? trade.redFlags : [];
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  if (cleared.length === 0) return flags;
  return flags.filter((f) => f && !cleared.includes(f.type));
};

/**
 * Boolean coerente com pattern legacy `t.hasRedFlags || t.redFlags.length > 0`,
 * mas considerando o cleared do mentor.
 *
 * Quando `redFlags[]` está populado (typed), aplicamos `effectiveRedFlags`.
 * Quando só `hasRedFlags: true` boolean legacy está disponível (sem detalhes),
 * mantemos a flag — sem types individuais, não há como limpar parcialmente.
 */
export const hasEffectiveRedFlags = (trade) => {
  if (!trade) return false;
  if (Array.isArray(trade.redFlags) && trade.redFlags.length > 0) {
    return effectiveRedFlags(trade).length > 0;
  }
  return trade.hasRedFlags === true;
};

/**
 * Emocional (per trade — UI inline): para um trade específico, filtra os eventos
 * que o mentor limpou para esse trade. Usado em ExtractTable / TradesList /
 * FeedbackPage.
 */
export const effectiveEmotionalEventsForTrade = (trade, events) => {
  if (!trade || !Array.isArray(events) || events.length === 0) return [];
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  return events.filter((evt) => {
    if (!evt?.type) return false;
    const ids = Array.isArray(evt.tradeIds) ? evt.tradeIds : [];
    if (!ids.includes(trade.id)) return false;
    return !cleared.includes(getEventKey(evt, trade.id));
  });
};

/**
 * Emocional (período/agregação): mantém o evento se AO MENOS UM trade vinculado
 * ainda não limpou. Quando todos os trades vinculados limparam, o evento sai
 * da soma de penalties em `calculatePeriodScore`.
 *
 * Eventos sem `tradeIds` (legacy, day-level) passam intactos.
 */
export const effectiveEmotionalEventsForPeriod = (trades, events) => {
  if (!Array.isArray(events) || events.length === 0) return [];
  const safeTrades = Array.isArray(trades) ? trades : [];
  const tradeMap = new Map(safeTrades.map((t) => [t?.id, t]).filter(([id]) => id));

  return events.filter((evt) => {
    if (!evt?.type) return false;
    const ids = Array.isArray(evt.tradeIds) ? evt.tradeIds : [];
    if (ids.length === 0) return true; // sem vínculo (legacy) → mantém

    const stillEffective = ids.some((tid) => {
      const trade = tradeMap.get(tid);
      if (!trade) return true; // trade fora da janela → assume não cleared
      const cleared = Array.isArray(trade.mentorClearedViolations)
        ? trade.mentorClearedViolations
        : [];
      return !cleared.includes(getEventKey(evt, tid));
    });
    return stillEffective;
  });
};
