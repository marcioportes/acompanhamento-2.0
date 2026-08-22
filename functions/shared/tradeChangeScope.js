/**
 * functions/shared/tradeChangeScope.js
 * @version 1.0.0 (v1.83.25 — issue #389)
 * @description Decide, a partir do antes/depois de um trade, O QUE mudou de verdade —
 *   e portanto o que precisa ser recalculado.
 *
 * POR QUE ISTO EXISTE COMO MÓDULO PRÓPRIO
 *
 * Esta regra vivia solta no meio de `onTradeUpdated`, uma função de ~250 linhas, sem
 * teste. Foi ali que o #383 a quebrou: bastou incluir `tickerRule` — um MAPA — na lista
 * comparada por identidade para o guard nunca mais cortar nada. Duas leituras do mesmo
 * mapa são referências distintas, então "mudou" era sempre verdadeiro; a CF regravava o
 * trade, a regravação disparava a CF, e o loop rodou a 326 invocações por minuto até o
 * #388. Cada volta empurrava um snapshot para o navegador do mentor.
 *
 * REGRA DE NEGÓCIO (Marcio, 22/08/2026)
 *
 * "Se a origem é igual, o resultado deveria ser o mesmo. Não concordo que o fato de eu
 * dar feedback recalcule o comportamento — se algum parâmetro muda, ele precisa estar na
 * minha tela antes de eu submeter o feedback."
 *
 * Traduzindo: recalcula quando o DADO DE ORIGEM muda (o trade, as ordens, o plano) ou
 * quando o mentor pede explicitamente. Enviar feedback, comentar, anexar reflexão ou
 * marcar como revisado são atos de CONVERSA, não de dado — não podem alterar o registro
 * comportamental que o mentor acabou de revisar.
 *
 * Campo escalar compara por identidade; campo composto compara por VALOR.
 */

/** Campos escalares cuja mudança altera compliance/comportamento. */
const SCALAR_FIELDS = Object.freeze(['stopLoss', 'entry', 'exit', 'qty', 'side', 'emotionEntry']);

/** Campos compostos (mapas/arrays) — comparados por conteúdo, nunca por referência. */
const OBJECT_FIELDS = Object.freeze(['tickerRule']);

const fingerprint = (v) => (v === undefined ? null : JSON.stringify(v) ?? null);

const scalarChanged = (before, after) =>
  SCALAR_FIELDS.some((f) => (before[f] ?? null) !== (after[f] ?? null));

const objectChanged = (before, after) =>
  OBJECT_FIELDS.some((f) => fingerprint(before[f]) !== fingerprint(after[f]));

const clearedChanged = (before, after) => {
  const fp = (t) => JSON.stringify(
    (Array.isArray(t.mentorClearedViolations) ? t.mentorClearedViolations : []).slice().sort(),
  );
  return fp(before) !== fp(after);
};

/**
 * @param {Object} before — snapshot anterior do trade
 * @param {Object} after — snapshot novo
 * @returns {{
 *   complianceChanged: boolean, resultChanged: boolean, planChanged: boolean,
 *   clearedChanged: boolean, timeChanged: boolean, mepCleared: boolean,
 *   shouldRecompute: boolean,
 * }}
 */
function tradeChangeScope(before = {}, after = {}) {
  const resultChanged = Math.abs((Number(after.result) || 0) - (Number(before.result) || 0)) > 0.01;
  const planChanged = before.planId !== after.planId;
  const complianceChanged = scalarChanged(before, after) || objectChanged(before, after);
  const cleared = clearedChanged(before, after);
  const timeChanged = before.entryTime !== after.entryTime || before.exitTime !== after.exitTime;
  const mepCleared = before.mepPrice != null && after.mepPrice == null;

  return {
    resultChanged,
    planChanged,
    complianceChanged,
    clearedChanged: cleared,
    timeChanged,
    mepCleared,
    shouldRecompute: resultChanged || planChanged || complianceChanged
      || cleared || timeChanged || mepCleared,
  };
}

module.exports = { tradeChangeScope, SCALAR_FIELDS, OBJECT_FIELDS };
