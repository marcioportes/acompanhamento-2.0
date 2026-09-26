/**
 * gravadoDoImport.js — estado GRAVADO de um dia importado, a partir dos exports reais do
 * ProfitChart-Pro (fixtures do #463), e Firestore em memória.
 *
 * Extraído de `recalcImportTrades468.test.js` (#468) para o #475 reusar: um trade por
 * operação fechada (como o import criou) e as ordens gravadas como o `ingestBatch` grava em
 * `orders` — com offset (#464), sem `origin`, com `batchId` e `correlatedTradeId` (como
 * `orderTradeLinks`: a ordem que vira a mão fica com o trade que ela FECHA).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeCsv, headersDoArquivo, TIMEZONE } from './brokerReplay';
import { detectOrderFormat } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';
import { validateBatch } from '../../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../../utils/orderReconstruction';
import { mapOperationToTradeData } from '../../utils/orderTradeCreation';
import { orderInstantsWithOffset, operationOrders } from '../../utils/orderImportPipeline';
import { calculateFromPartials } from '../../utils/tradeCalculations';

const FIX = resolve(__dirname, '../fixtures/broker-replay');
export const WIN = { tickSize: 5, tickValue: 1, pointValue: 0.2 };
export const ALUNO = 'aluno-1';

// ---------- ordens do arquivo → docs de `orders` ----------

export const ordensDoArquivo = (arquivo) => {
  const text = decodeCsv(readFileSync(resolve(FIX, arquivo)));
  const det = detectOrderFormat(headersDoArquivo(text));
  const { orders } = normalizeBatch(det.parser(text).orders);
  return validateBatch(orders).validOrders;
};

/** Payload de `useOrderStaging.ingestBatch` — sem `origin`, instantes com offset. */
export const comoOrders = (o, batchId) => ({
  studentId: ALUNO,
  planId: 'plano-1',
  batchId,
  externalOrderId: o.externalOrderId ?? null,
  instrument: o.instrument,
  orderType: o.orderType,
  side: o.side,
  quantity: o.quantity,
  price: o.price,
  limitPrice: o.limitPrice,
  stopPrice: o.stopPrice,
  filledPrice: o.filledPrice,
  filledQuantity: o.filledQuantity,
  status: o.status,
  ...orderInstantsWithOffset(o, TIMEZONE),
  modifications: o.modifications || [],
  isStopOrder: o.isStopOrder || false,
  sourceFormat: 'profitchart_pro',
});

/**
 * Monta o estado gravado de um dia: um trade por operação fechada (como o import criou),
 * cada ordem do lote com `correlatedTradeId` (como `orderTradeLinks`: a ordem que vira a
 * mão fica com o trade que ela FECHA). Ordem sem trade não existe (INV-29).
 */
export const montarDia = (arquivo, batchId) => {
  const brutas = ordensDoArquivo(arquivo);
  const ops = reconstructOperations(brutas, { timezone: TIMEZONE });
  associateNonFilledOrders(ops, brutas, { timezone: TIMEZONE });
  const trades = {};
  const orders = {};
  const idDe = (o) => `ord_${o.externalOrderId}`;
  ops.filter(op => !op._isOpen).forEach((op, i) => {
    const tradeId = `T${String(i + 1).padStart(2, '0')}`;
    const td = mapOperationToTradeData(op, 'plano-1', batchId, WIN);
    const calc = calculateFromPartials({ side: td.side, partials: td._partials, tickerRule: WIN });
    trades[tradeId] = {
      ...td,
      entry: Number(td.entry), exit: Number(td.exit), qty: Number(td.qty),
      date: td.entryTime.slice(0, 10),
      result: calc.result, resultCalculated: calc.result,
      studentId: ALUNO, studentName: 'Aluno', status: 'OPEN',
    };
    for (const o of operationOrders(op)) {
      const id = idDe(o);
      if (orders[id]) continue;
      const bruta = brutas.find(b => b.externalOrderId === o.externalOrderId);
      orders[id] = { ...comoOrders(bruta, batchId), correlatedTradeId: tradeId };
    }
  });
  return { trades, orders, ops };
};

// ---------- Firestore em memória ----------

export const fakeDb = (colecoes) => {
  const dados = {};
  for (const [nome, docs] of Object.entries(colecoes)) {
    dados[nome] = new Map(Object.entries(docs).map(([id, d]) => [id, structuredClone(d)]));
  }
  const escritas = [];
  const snap = (nome, id) => {
    const d = dados[nome]?.get(id);
    return { id, exists: d !== undefined, data: () => (d === undefined ? undefined : structuredClone(d)) };
  };
  const ref = (nome, id) => ({
    id,
    get: async () => snap(nome, id),
    update: async (patch) => {
      escritas.push({ colecao: nome, id, patch });
      dados[nome].set(id, { ...dados[nome].get(id), ...patch });
    },
  });
  const consulta = (nome, filtro) => ({
    get: async () => {
      const docs = [...(dados[nome] || new Map()).keys()]
        .filter(id => !filtro || dados[nome].get(id)[filtro.campo] === filtro.valor)
        .map(id => ({ ...snap(nome, id), ref: ref(nome, id) }));
      return { docs, empty: docs.length === 0 };
    },
  });
  return {
    escritas,
    dados,
    collection: (nome) => ({
      doc: (id) => ref(nome, id),
      where: (campo, op, valor) => consulta(nome, { campo, valor }),
      get: () => consulta(nome).get(),
    }),
  };
};

