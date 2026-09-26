/**
 * stopFlag.js — issue #475
 *
 * SSoT do aviso de stop de um trade, lado cliente. Espelho ESM de
 * `functions/shared/stopFlag.js` — o CORPO é idêntico, só muda o import e o export
 * (paridade testada em `src/__tests__/functions/shared/stopFlagMirror.test.js`).
 *
 * POR QUE EXISTE: o mesmo `TRADE_SEM_STOP` servia para dois fatos diferentes —
 * "operou sem proteção" e "tinha proteção, mas o stop inicial não está no arquivo" (stop
 * arrastado para o ganho, só de ganho, proteção parcial; regra do épico #462). No
 * 24/09/2026 o painel de ordens dizia "Protegido o tempo todo" e a violação dizia "Trade
 * sem stop loss definido", na mesma tela. Agora:
 *
 * | stop que protege | resultado | ordens mostram proteção | aviso                     |
 * |------------------|-----------|-------------------------|---------------------------|
 * | sim              | qualquer  | —                       | nenhum                    |
 * | não              | < 0       | —                       | nenhum (stop implícito, DEC-AUTO-208-04) |
 * | não              | >= 0      | não (ou trade manual)   | TRADE_SEM_STOP (violação) |
 * | não              | >= 0      | sim                     | STOP_INICIAL_A_INFORMAR (pendência) |
 *
 * "Ordens mostram proteção" é a MESMA leitura do painel de ordens (`protectiveLegsOf`,
 * definição única do #466) — quem chama resolve e passa o booleano.
 *
 * Sem campo novo (INV-15): muda só o tipo do item em `redFlags`.
 */
import { stopDistanceOf } from './orderProtection';

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

export {
  STOP_FLAG_TYPES,
  STOP_A_INFORMAR_MESSAGE,
  stopFlagOf,
  isStopFlag,
  withStopFlag,
  violationCountOf,
};
