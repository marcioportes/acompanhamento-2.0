/**
 * dayState.js — issue #402
 *
 * Motor do PERÍODO (dia ou semana, conforme `plan.operationPeriod`). Separa três
 * fatos que o produto vinha misturando num só campo:
 *
 *   F1  fato atômico       — propriedade da operação isolada (mora em trade.redFlags)
 *   F2  autorização        — havia orçamento quando ESTA operação abriu?
 *   F3  fato do período    — resultado líquido, stop atingido, meta, operações após o stop
 *
 * POR QUE EXISTE:
 *   `LOSS_DIARIO_EXCEDIDO` era o único fato AGREGADO guardado num container
 *   ATÔMICO (`trade.redFlags[]`), calculado por uma função que somava o dia
 *   inteiro sem corte temporal e ignorava os ganhos. Em 25/08/2026 isso acusou
 *   o primeiro trade do dia (−R$ 250 contra um limite de R$ 501) de estourar o
 *   stop diário, porque o importador gravou o segundo trade antes dele.
 *
 * DUAS REGRAS QUE GOVERNAM TUDO AQUI:
 *   1. Resultado do período é LÍQUIDO. Ganhos compensam perdas. A soma bruta das
 *      perdas continua exposta (`losses`) porque é útil de ler, mas não decide nada.
 *   2. O stop do período governa AUTORIZAÇÃO PARA ABRIR (DEC-069: o período é
 *      `maxTrades × RO`). "O período fechou além do stop" é fato do período e
 *      não pertence a operação nenhuma.
 *
 * Espelho CJS: `functions/shared/dayState.js`.
 *
 * @see src/utils/tradeInstant.js — ordem cronológica canônica
 * @see src/utils/planStateMachine.js — getPeriodKey (bucketização por período)
 */
import { sortTradesChrono, orderingConfidence, tradeInstantInfo } from './tradeInstant';
import { getPeriodKey } from './planStateMachine';

/**
 * O que a operação decidiu ao abrir. Só `AFTER_STOP` é violação.
 *
 * `NO_ROOM` é AVISO, não violação: o plano pode ser aritmeticamente incoerente
 * — o Ago-Plano autoriza R$ 252 por operação e para o dia em R$ 501, isto é,
 * 1,99 operações. Acusar o aluno por defeito de autoria do plano é a falsa
 * análise que este issue existe para eliminar.
 */
export const AUTHORIZATION = {
  AUTHORIZED: 'AUTORIZADA',
  NO_ROOM: 'SEM_FOLGA',
  AFTER_STOP: 'APOS_STOP',
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cents = (v) => Math.round(v * 100) / 100;

/** Limiares em dinheiro derivados do plano. `null` quando o plano não os define. */
function thresholdsOf(plan) {
  const pl = num(plan?.pl) ?? num(plan?.currentPl);
  if (pl == null || pl <= 0) {
    return { pl: null, stopValue: null, goalValue: null, roValue: null, maxAuthorizedTrades: null };
  }
  const pct = (v) => {
    const p = num(v);
    return p != null && p > 0 ? cents(pl * (p / 100)) : null;
  };
  const stopValue = pct(plan.periodStop);
  const roValue = pct(plan.riskPerOperation);
  return {
    pl,
    stopValue,
    goalValue: pct(plan.periodGoal),
    roValue,
    maxAuthorizedTrades: stopValue != null && roValue != null && roValue > 0
      ? Math.floor(stopValue / roValue)
      : null,
  };
}

/**
 * Estado completo de um período.
 *
 * @param {Object[]} trades — trades do período, em qualquer ordem (ordena internamente)
 * @param {Object|null} plan — { pl, periodStop, periodGoal, riskPerOperation, operationPeriod }
 * @param {Object} [opts]
 * @param {'net'|'floor'} [opts.cushionPolicy='net'] — 'net': ganho anterior estende o
 *   orçamento de risco; 'floor': ganho não estende (o orçamento nunca passa do stop cheio)
 * @param {string|null} [opts.periodKey]
 * @returns {Object} PeriodState
 */
export function buildPeriodState(trades, plan, opts = {}) {
  const cushionPolicy = opts.cushionPolicy === 'floor' ? 'floor' : 'net';
  const lista = Array.isArray(trades) ? trades : [];
  const ordenados = sortTradesChrono(lista);
  const { pl, stopValue, goalValue, roValue, maxAuthorizedTrades } = thresholdsOf(plan);

  const avaliaAutorizacao = stopValue != null;

  let cum = 0;
  let gains = 0;
  let losses = 0;
  let qty = 0;
  let stopHitIndex = null;
  let goalHitIndex = null;
  let tradesAfterStop = 0;

  const rows = ordenados.map((t, index) => {
    const result = num(t?.result) ?? 0;
    const cumBefore = cents(cum);

    // Orçamento disponível no instante em que ESTA operação abriu.
    const colchao = cushionPolicy === 'floor' ? Math.min(cumBefore, 0) : cumBefore;
    const budgetBefore = stopValue != null ? cents(stopValue + colchao) : null;

    let authorization = null;
    if (avaliaAutorizacao) {
      if (cumBefore <= -stopValue) {
        authorization = AUTHORIZATION.AFTER_STOP;
        tradesAfterStop += 1;
      } else if (roValue != null && budgetBefore < roValue) {
        // Inclui o caso de orçamento já negativo por política 'net' com ganho — aí
        // budgetBefore < roValue também, e o aviso é legítimo.
        authorization = AUTHORIZATION.NO_ROOM;
      } else {
        authorization = AUTHORIZATION.AUTHORIZED;
      }
    }

    cum = cents(cum + result);
    if (result > 0) gains = cents(gains + result);
    if (result < 0) losses = cents(losses + Math.abs(result));
    qty += num(t?.qty) ?? 0;

    if (stopValue != null && stopHitIndex === null && cum <= -stopValue) stopHitIndex = index;
    if (goalValue != null && goalHitIndex === null && cum >= goalValue) goalHitIndex = index;

    const info = tradeInstantInfo(t);
    return {
      index,
      tradeId: t?.id ?? null,
      instantMs: info.ms,
      instantSource: info.source,
      result,
      cumBefore,
      cumAfter: cents(cum),
      budgetBefore,
      budgetAfter: stopValue != null ? cents(stopValue + (cushionPolicy === 'floor' ? Math.min(cum, 0) : cum)) : null,
      authorization,
    };
  });

  const net = cents(cum);
  const closedBeyondStop = stopValue != null ? net <= -stopValue : null;

  return {
    periodKey: opts.periodKey ?? null,
    operationPeriod: plan?.operationPeriod ?? 'Diário',
    cushionPolicy,

    pl,
    stopValue,
    goalValue,
    roValue,
    maxAuthorizedTrades,

    net,
    gains,
    losses,
    qty,
    count: rows.length,

    rows,
    stopHitIndex,
    goalHitIndex,
    reachedGoal: goalHitIndex !== null,
    closedBeyondStop,
    // Quanto passou do stop, em dinheiro. Só faz sentido quando passou.
    beyondStopBy: closedBeyondStop ? cents(Math.abs(net) - stopValue) : null,
    tradesAfterStop,

    ordering: orderingConfidence(ordenados),
  };
}

/**
 * Índice de estados por chave de período, usando a bucketização já existente
 * (`getPeriodKey` — 'Diário' pela data, 'Semanal' pela segunda ISO).
 *
 * @returns {Map<string, Object>}
 */
export function buildPeriodIndex(trades, plan, opts = {}) {
  const lista = Array.isArray(trades) ? trades : [];
  const operationPeriod = plan?.operationPeriod ?? 'Diário';
  const buckets = new Map();

  for (const t of lista) {
    if (!t?.date) continue;
    const key = getPeriodKey(t.date, operationPeriod, opts.cycleStart, opts.cycleEnd);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  const index = new Map();
  for (const [key, doPeriodo] of buckets) {
    index.set(key, buildPeriodState(doPeriodo, plan, { ...opts, periodKey: key }));
  }
  return index;
}

/**
 * A linha de um trade dentro de um estado de período já construído.
 * @returns {Object|null}
 */
export function authorizationFor(trade, periodState) {
  if (!trade?.id || !periodState?.rows) return null;
  return periodState.rows.find((r) => r.tradeId === trade.id) ?? null;
}
