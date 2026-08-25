/**
 * functions/maturity/violationFilter.js
 * @description Mirror CJS de `src/utils/violationFilter.js`. Issue #221 (Phase B).
 *   Paridade obrigatória ESM↔CJS — pattern `emotionalAnalysisMirror.js`.
 *   Toda mudança no .js precisa ser refletida aqui.
 */


/**
 * #376 — violações REVOGADAS: a regra deixou de existir, mas o registro do trade
 * não pode ser reescrito.
 *
 * `redFlags` é snapshot gravado no doc. Quando uma regra é revogada, os trades
 * antigos continuam acusados. Reescrevê-los seria a saída óbvia — e é proibida:
 * metade deles (53 de 106 em 23/08) já está em `status: 'DISCUSSED'`, e trade
 * discutido é imutável (tradeGateway, #269 v2). O que foi conversado com o aluno
 * fica como foi.
 *
 * A saída é filtrar no consumo, não na persistência: o histórico preserva que a
 * violação existia, e nenhuma métrica volta a contá-la. Mesmo princípio do #282
 * (consistência display-time, sem congelar snapshot).
 *
 * RR_ABAIXO_MINIMO — revogado por Marcio em 23/08: "sair abaixo do alvo não é
 * violação de plano, é comportamento". Era 106 de 282 flags da base.
 *
 * LOSS_DIARIO_EXCEDIDO — revogado em 25/08 (#402). Não era uma regra ruim: era um
 * fato do DIA gravado como propriedade de um TRADE. Quem o emitia somava o dia
 * inteiro sem corte temporal e só as perdas, então (a) o veredicto dependia da
 * ordem em que o importador gravou o lote — o primeiro trade de 25/08, −R$ 250
 * contra um limite de R$ 501, foi acusado por causa de um trade que aconteceu 40
 * minutos DEPOIS dele — e (b) todo trade do dia levava uma cópia, virando N
 * violações. Na base: 34 trades acusados, 3 violações reais, 31 falsas.
 * O período passou a ser medido por `dayState` e mostrado no card do dia.
 */
const REVOKED_RED_FLAG_TYPES = ['RR_ABAIXO_MINIMO', 'LOSS_DIARIO_EXCEDIDO'];

function isRevoked(type) { return REVOKED_RED_FLAG_TYPES.indexOf(type) !== -1; }

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
  const vigentes = flags.filter(function (f) { return f && !isRevoked(f.type); });
  const cleared = Array.isArray(trade.mentorClearedViolations)
    ? trade.mentorClearedViolations
    : [];
  if (cleared.length === 0) return vigentes;
  return vigentes.filter(function (f) { return cleared.indexOf(f.type) === -1; });
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
  REVOKED_RED_FLAG_TYPES,
  getEventKey,
  isViolationCleared,
  effectiveRedFlags,
  hasEffectiveRedFlags,
  effectiveEmotionalEventsForTrade,
  effectiveEmotionalEventsForPeriod,
};
