/**
 * extractInlineEvents
 * @description Atribui eventos emocionais a um trade específico no extrato.
 *
 * Regra: TILT/REVENGE exigem match estrito por tradeId (o evento carrega
 * `tradeIds` com as ids dos trades que pertencem à instância). STATUS_CRITICAL
 * é evento day-level — match por data.
 *
 * Histórico do bug: até v1.32.x o pareamento caía em fallback por data quando
 * a alerta não trazia tradeId. Resultado: todos os trades do dia herdavam
 * REVENGE — inclusive o primeiro trade, que por definição não pode ser revenge
 * (detecção exige loss anterior na janela).
 */

const DAY_LEVEL_EVENT_TYPES = new Set(['STATUS_CRITICAL']);

export const matchEmotionalEventsToTrade = (trade, emotionalEvents = []) => {
  if (!trade || !Array.isArray(emotionalEvents) || emotionalEvents.length === 0) {
    return [];
  }

  const { id: tradeId, date: tradeDate } = trade;
  const matches = [];
  const seen = new Set();

  for (const evt of emotionalEvents) {
    if (!evt?.type || seen.has(evt.type)) continue;

    const isDayLevel = DAY_LEVEL_EVENT_TYPES.has(evt.type);
    const matchesByTradeId = Array.isArray(evt.tradeIds) && evt.tradeIds.includes(tradeId);
    const matchesByDate = isDayLevel && evt.date && evt.date === tradeDate;

    if (matchesByTradeId || matchesByDate) {
      seen.add(evt.type);
      matches.push(evt.type);
    }
  }

  return matches;
};
