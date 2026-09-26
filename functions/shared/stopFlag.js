/**
 * functions/shared/stopFlag.js
 * @version 1.0.0 (v1.92.13 — issue #475)
 * @description SSoT do aviso de stop de um trade, lado servidor: violação `TRADE_SEM_STOP`
 *   (operou sem proteção) × pendência `STOP_INICIAL_A_INFORMAR` (protegido, mas o stop
 *   inicial não é comprovável pelo arquivo — stop arrastado, só de ganho, parcial).
 *
 * Espelho CJS de `src/utils/stopFlag.js` — manter o CORPO IDÊNTICO (paridade testada em
 * `src/__tests__/functions/shared/stopFlagMirror.test.js`). A tabela de decisão está no
 * cabeçalho do ESM.
 *
 * Consumido por `onTradeCreated`, `onTradeUpdated`, `recalculateTradesCompliance` e
 * `refreshStopFlag` (fechamento do lote de importação).
 */
const { stopDistanceOf } = require('./orderProtection');

/** Tipos de aviso de stop — o primeiro é violação, o segundo é pendência (#475). */
const STOP_FLAG_TYPES = Object.freeze({
  NO_STOP: 'TRADE_SEM_STOP',
  STOP_A_INFORMAR: 'STOP_INICIAL_A_INFORMAR',
});

const STOP_A_INFORMAR_MESSAGE = 'Stop movido durante a operação — informe o stop inicial';

/**
 * Aviso de stop do trade.
 *
 * @param {Object} trade — { side, entry, stopLoss, result }
 * @param {boolean} [protegido] — as ordens ligadas ao trade mostram proteção da posição
 * @param {string} [timestamp] — ISO; default agora
 * @returns {{type:string, message:string, timestamp:string}|null}
 */
function stopFlagOf(trade, protegido, timestamp) {
  if (!trade) return null;
  // #467 — stop do lado errado da entrada conta como sem stop (mesma conta do risco).
  if (stopDistanceOf(trade.side, trade.entry, trade.stopLoss) != null) return null;
  const resultado = trade.result != null ? Number(trade.result) : 0;
  // Loss sem stop → stop implícito (DEC-AUTO-208-04): a saída em prejuízo é o stop praticado.
  if (resultado < 0) return null;
  const ts = timestamp || new Date().toISOString();
  if (protegido === true) {
    return { type: STOP_FLAG_TYPES.STOP_A_INFORMAR, message: STOP_A_INFORMAR_MESSAGE, timestamp: ts };
  }
  let mensagem = 'Trade sem stop loss definido';
  if (resultado > 0) mensagem += ' — risco não mensurado (win sem stop)';
  return { type: STOP_FLAG_TYPES.NO_STOP, message: mensagem, timestamp: ts };
}

const tipoDe = (f) => (typeof f === 'string' ? f : (f && f.type));

/** O item de `redFlags` é um aviso de stop (violação ou pendência)? */
function isStopFlag(f) {
  const t = tipoDe(f);
  return t === STOP_FLAG_TYPES.NO_STOP || t === STOP_FLAG_TYPES.STOP_A_INFORMAR;
}

/**
 * `redFlags` com o aviso de stop trocado: remove os dois tipos e acrescenta `flag` (se houver).
 * Os demais itens ficam como estavam, na mesma ordem.
 */
function withStopFlag(flags, flag) {
  const out = (Array.isArray(flags) ? flags : []).filter(function (f) { return !isStopFlag(f); });
  if (flag) out.push(flag);
  return out;
}

/** Quantos itens de `redFlags` são VIOLAÇÃO (pendência não conta) — base de `hasRedFlags`. */
function violationCountOf(flags) {
  return (Array.isArray(flags) ? flags : []).filter(function (f) {
    return f && tipoDe(f) !== STOP_FLAG_TYPES.STOP_A_INFORMAR;
  }).length;
}

module.exports = {
  STOP_FLAG_TYPES,
  STOP_A_INFORMAR_MESSAGE,
  stopFlagOf,
  isStopFlag,
  withStopFlag,
  violationCountOf,
};
