/**
 * brokerReplay.js — replay do import de ordens contra o relatório da corretora (#463)
 *
 * Roda o MESMO caminho do `OrderImportPage` sobre um export real do ProfitChart-Pro e
 * devolve, operação por operação, o que o import produziu ao lado do que o relatório
 * de performance da corretora diz que aconteceu. A corretora é a verdade: o import
 * não tem opinião sobre lado, quantidade, preço ou resultado.
 *
 * Dois caminhos, porque o aluno tem dois:
 *   - `fresh`: arquivo → parser → normalizer → validação → reconstrução (handlePlanConfirm)
 *   - `resumed`: o mesmo lote gravado em `ordersStagingArea` e retomado depois
 *     (stagingDocsToOrders → reconstrução). O staging guarda um subconjunto dos campos
 *     e reordena as ordens; os dois caminhos precisam dar o mesmo trade.
 *
 * Instantes são comparados como relógio de parede (string ingênua), nunca via
 * `new Date(naive)`: o teste roda em UTC e em America/Sao_Paulo e tem de dar o mesmo
 * resultado nos dois.
 */

import { readFileSync } from 'node:fs';
import { detectOrderFormat } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';
import { validateBatch } from '../../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../../utils/orderReconstruction';
import { enrichOperationsWithStopSemantic } from '../../utils/stopSemantic';
import { enrichOperationsWithStopAnalysis } from '../../utils/stopMovementAnalysis';
import { mapOperationToTradeData } from '../../utils/orderTradeCreation';
import { stagingDocsToOrders } from '../../utils/orderImportPipeline';

export const TIMEZONE = 'America/Sao_Paulo';

// R$ por ponto por contrato. Instrumento fora da tabela usa o valor implícito no
// próprio relatório da corretora (resultado ÷ pontos ÷ quantidade).
const POINT_VALUE = [
  [/^WIN/, 0.2],
  [/^IND/, 1],
  [/^WDO/, 10],
  [/^DOL/, 50],
];

// Janela do bracket: a proteção nasce junto com a perna de entrada.
export const JANELA_DA_PERNA_MS = 60 * 1000;

// Campos que `useOrderStaging.addStagingBatch` grava — o resto se perde no airlock.
const CAMPOS_DO_STAGING = [
  'externalOrderId', 'instrument', 'orderType', 'side', 'quantity', 'price',
  'limitPrice', 'stopPrice', 'filledPrice', 'filledQuantity', 'status',
  'submittedAt', 'filledAt', 'cancelledAt', 'modifications', 'isStopOrder',
  'origin', 'text',
];

// ---------- leitura ----------

// O uploader lê ISO-8859-1; os exports do Profit são latin-1.
export const decodeCsv = (buffer) => {
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('�')) text = new TextDecoder('latin1').decode(buffer);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
};

const numeroBR = (s) => {
  const t = String(s ?? '').trim();
  if (!t || t === '-') return NaN;
  return parseFloat(t.replace(/\./g, '').replace(',', '.'));
};

const isoBR = (s) => {
  const m = String(s ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}` : null;
};

/** Relatório de performance do Profit → { from, to, rows[] }. */
export const parseBrokerPerformance = (text) => {
  const lines = text.replace(/\r/g, '').split('\n');
  let from = null;
  let to = null;
  for (const l of lines.slice(0, 6)) {
    let m = l.match(/Data Inicial:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) from = isoBR(`${m[1]} 00:00`).slice(0, 10);
    m = l.match(/Data Final:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) to = isoBR(`${m[1]} 00:00`).slice(0, 10);
    m = l.match(/^Data:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) from = to = isoBR(`${m[1]} 00:00`).slice(0, 10);
  }
  const hi = lines.findIndex(l => l.startsWith('Ativo;'));
  const header = lines[hi].split(';').map(h => h.trim());
  const col = (name) => header.indexOf(name);
  const rows = [];
  for (const l of lines.slice(hi + 1)) {
    const c = l.split(';');
    if (!c[0] || !/\d{2}\/\d{2}/.test(c[1] || '')) continue;
    const side = c[col('Lado')] === 'C' ? 'LONG' : 'SHORT';
    const compra = numeroBR(c[col('Preço Compra')]);
    const venda = numeroBR(c[col('Preço Venda')]);
    rows.push({
      instrument: c[0].trim().toUpperCase(),
      openedAt: isoBR(c[1]),
      closedAt: isoBR(c[2]),
      qty: numeroBR(c[col('Qtd Compra')]),
      side,
      entry: side === 'LONG' ? compra : venda,
      exit: side === 'LONG' ? venda : compra,
      points: venda - compra,
      result: numeroBR(c[col('Res. Operação')]),
    });
  }
  return { from, to, rows };
};

// ---------- pipeline (espelho do OrderImportPage) ----------

const headersDoArquivo = (text) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let headers = [];
  for (const d of [';', ',']) {
    const cand = lines.find(l => (l.match(new RegExp(d, 'g')) || []).length >= 10);
    if (cand) {
      const h = cand.split(d).map(x => x.trim());
      if (h.length > headers.length) headers = h;
    }
  }
  return headers;
};

const reconstruir = (orders) => {
  const ops = reconstructOperations(orders, { timezone: TIMEZONE });
  associateNonFilledOrders(ops, orders);
  enrichOperationsWithStopSemantic(ops);
  enrichOperationsWithStopAnalysis(ops);
  return ops;
};

/** Ordens como voltam da `ordersStagingArea` na retomada de um lote. */
const viaStaging = (orders) => stagingDocsToOrders(orders.map((o, i) => {
  const doc = { id: `stg_${i}` };
  for (const campo of CAMPOS_DO_STAGING) doc[campo] = o[campo] ?? null;
  if (!Array.isArray(doc.modifications)) doc.modifications = [];
  if (typeof doc.isStopOrder !== 'boolean') doc.isStopOrder = false;
  return doc;
}));

/**
 * Roda o import sobre um par (ordens, performance) e casa cada operação com a linha
 * da corretora (mesmo ativo, abertura mais próxima em até 2 min).
 */
export const replayPair = (ordersPath, performancePath) => {
  const perf = parseBrokerPerformance(decodeCsv(readFileSync(performancePath)));
  const text = decodeCsv(readFileSync(ordersPath));
  const detection = detectOrderFormat(headersDoArquivo(text));
  if (!detection.parser) throw new Error(`formato não reconhecido: ${ordersPath}`);
  const parsed = detection.parser(text);
  const { orders: normalized } = normalizeBatch(parsed.orders);
  const validation = validateBatch(normalized);

  // O aluno sobe o período do relatório; ordens fora dele não são deste par.
  const noPeriodo = (o) => {
    const d = (o.submittedAt || o.filledAt || '').slice(0, 10);
    return (!perf.from || d >= perf.from) && (!perf.to || d <= perf.to);
  };
  const orders = validation.validOrders.filter(noPeriodo);

  const fresh = reconstruir(orders);
  const resumed = reconstruir(viaStaging(orders));

  const pvImplicito = {};
  for (const r of perf.rows) {
    if (r.points && r.qty && !(r.instrument in pvImplicito)) {
      pvImplicito[r.instrument] = Math.abs(r.result / (r.points * r.qty));
    }
  }
  const pointValue = (instrument) => {
    const inst = String(instrument || '').toUpperCase();
    const fixo = POINT_VALUE.find(([re]) => re.test(inst));
    return fixo ? fixo[1] : (pvImplicito[inst] ?? null);
  };

  const casar = (ops) => {
    const usadas = new Set();
    const pares = perf.rows.map((row) => {
      let melhor = -1;
      let menor = Infinity;
      ops.forEach((op, i) => {
        if (usadas.has(i) || String(op.instrument).toUpperCase() !== row.instrument) return;
        const d = Math.abs(paredeMs(op.entryTime) - paredeMs(row.openedAt));
        if (d < menor) { menor = d; melhor = i; }
      });
      if (melhor < 0 || menor > 2 * 60 * 1000) return { row, op: null };
      usadas.add(melhor);
      return { row, op: ops[melhor] };
    });
    const extras = ops.filter((_, i) => !usadas.has(i));
    return { pares, extras };
  };

  return {
    format: detection.format,
    parseErrors: parsed.errors || [],
    invalid: validation.invalidOrders,
    perf,
    pointValue,
    fresh: casar(fresh),
    resumed: casar(resumed),
  };
};

// ---------- leitura do resultado ----------

/** Relógio de parede em ms, independente do fuso do processo. */
export const paredeMs = (valor) => {
  if (!valor) return NaN;
  const naive = String(valor).slice(0, 19);
  return new Date(`${naive}Z`).getTime();
};

export const precoEnviado = (o) => {
  const v = parseFloat(o?.stopPrice ?? o?.limitPrice ?? o?.price);
  return Number.isFinite(v) ? v : null;
};

/** O trade que o import gravaria para a operação. */
export const tradeDa = (op) => mapOperationToTradeData(op, 'plano-replay');

/** Pernas de entrada: cada fill de entrada com instante e preço executado. */
export const pernasDe = (op) => (op.entryOrders || []).map(o => ({
  ts: paredeMs(o.filledAt || o.submittedAt),
  price: parseFloat(o.filledPrice ?? o.price),
  qty: Number(o.filledQuantity ?? o.quantity),
  order: o,
}));

/**
 * O que está errado no `stopLoss` que o import gravou — critério do épico #462:
 * a proteção de uma perna é ordem do mesmo ativo, lado oposto, enviada com a perna
 * (±60s), não cancelada antes da entrada, com preço enviado adverso ao preço
 * executado da perna, e que não seja zeragem nem inversão.
 *
 * Devolve códigos; lista vazia = stop defensável.
 */
export const violacoesDoStop = (op) => {
  const trade = tradeDa(op);
  const stop = trade.stopLoss;
  if (stop == null) return [];

  const candidatas = [...(op.stopOrders || []), ...(op.exitOrders || [])]
    .filter(o => precoEnviado(o) === stop);
  if (candidatas.length === 0) return ['SEM_ORIGEM'];
  const origem = candidatas[0];

  const v = [];
  const pernas = pernasDe(op);
  const entradaMs = Math.min(...pernas.map(p => p.ts));
  const enviadaMs = paredeMs(origem.submittedAt);
  const ladoOposto = op.side === 'LONG' ? 'SELL' : 'BUY';

  if (String(origem.instrument).toUpperCase() !== String(op.instrument).toUpperCase()) v.push('OUTRO_ATIVO');
  if (origem.side !== ladoOposto) v.push('MESMO_LADO');
  if (origem.cancelledAt && paredeMs(origem.cancelledAt) < entradaMs) v.push('CANCELADA_ANTES_DA_ENTRADA');
  if (/zerag|invers/i.test(origem.origin || '')) v.push('ZERAGEM_OU_INVERSAO');

  const perna = pernas.find(p => Math.abs(enviadaMs - p.ts) <= JANELA_DA_PERNA_MS);
  if (!perna) {
    v.push('FORA_DA_JANELA_DA_PERNA');
  } else {
    const adversa = op.side === 'LONG' ? stop < perna.price : stop > perna.price;
    if (!adversa) v.push('NAO_ADVERSA_A_PERNA');
  }
  return v;
};

/** Chave estável de uma linha da corretora: `ATIVO@abertura`. */
export const chaveDaLinha = (row) => `${row.instrument}@${row.openedAt}`;
