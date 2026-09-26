/**
 * refreshStopFlag.test.js — aviso de stop a partir das ordens do trade (#475).
 *
 * Protegido pelas ordens e sem stop comprovado → pendência STOP_INICIAL_A_INFORMAR, não a
 * violação TRADE_SEM_STOP. Sem proteção, trade manual, stop informado, loss e discutido
 * seguem como antes. A pendência não acende `hasRedFlags`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { refreshStopFlag, stopFlagForTrade } = require('../../trades/refreshStopFlag');
const { recalculateTradesCompliance } = require('../../trades/recalculateTradesCompliance');
const { stopFlagOf, withStopFlag, violationCountOf, STOP_A_INFORMAR_MESSAGE } = require('../../shared/stopFlag');
const vf = require('../../maturity/violationFilter');

const NOW = '2026-09-26T12:00:00.000Z';
const PENDENCIA = { type: 'STOP_INICIAL_A_INFORMAR', message: STOP_A_INFORMAR_MESSAGE, timestamp: NOW };
const VIOLACAO_WIN = { type: 'TRADE_SEM_STOP', message: 'Trade sem stop loss definido — risco não mensurado (win sem stop)', timestamp: NOW };

// O 24/09/2026 no formato gravado: SHORT 10 em duas pernas, sem stop comprovado.
const TRADE = {
  status: 'OPEN', studentId: 'a1', ticker: 'WINV26', side: 'SHORT', entry: 185185, stopLoss: null,
  qty: 10, result: 585, entryTime: '2026-09-24T15:52:21', exitTime: '2026-09-24T17:40:14',
  tzOffset: '-03:00',
  redFlags: [VIOLACAO_WIN, { type: 'EMOCIONAL_BLOQUEADO', message: 'x' }],
  hasRedFlags: true,
};

const ordem = (id, extra) => ({
  correlatedTradeId: 'T1', instrument: 'WINV26', quantity: 5, batchId: 'b1', ...extra, _id: id,
});
const ENTRADAS = [
  ordem('E1', { side: 'SELL', status: 'FILLED', filledPrice: 185070, filledQuantity: 5, limitPrice: 185070, submittedAt: '2026-09-24T15:52:19-03:00', filledAt: '2026-09-24T15:52:21-03:00' }),
  ordem('E2', { side: 'SELL', status: 'FILLED', filledPrice: 185300, filledQuantity: 5, limitPrice: 185300, submittedAt: '2026-09-24T15:49:44-03:00', filledAt: '2026-09-24T16:24:31-03:00' }),
];
// Perna 2: compra stop a 185.280 — onde o stop TERMINOU (arrastado para o ganho).
const STOP_ARRASTADO = ordem('S2', { side: 'BUY', status: 'CANCELLED', stopPrice: 185280, limitPrice: 185430, isStopOrder: true, submittedAt: '2026-09-24T16:24:31-03:00', cancelledAt: '2026-09-24T17:21:04-03:00' });
// Saída limite do lado do GANHO: alvo, não proteção.
const ALVO = ordem('X1', { side: 'BUY', status: 'FILLED', limitPrice: 184800, filledPrice: 184800, filledQuantity: 10, submittedAt: '2026-09-24T16:24:31-03:00', filledAt: '2026-09-24T17:40:14-03:00' });

const fakeDb = ({ trades = {}, orders = [] }) => {
  const dados = new Map(Object.entries(trades).map(([id, d]) => [id, structuredClone(d)]));
  const escritas = [];
  const consultas = [];
  return {
    escritas,
    consultas,
    dados,
    collection: (nome) => ({
      doc: (id) => {
        const ref = {
          id,
          get: async () => ({ id, exists: dados.has(id), data: () => structuredClone(dados.get(id)) }),
          update: async (patch) => { escritas.push({ id, patch }); dados.set(id, { ...dados.get(id), ...patch }); },
        };
        return ref;
      },
      where: (campo, _op, valor) => ({
        get: async () => {
          consultas.push({ nome, campo, valor });
          const docs = orders.filter((o) => o[campo] === valor).map((o) => ({ data: () => structuredClone(o) }));
          return { docs, empty: docs.length === 0 };
        },
      }),
    }),
  };
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => vi.useRealTimers());

describe('#475 · stopFlagOf — a tabela de decisão', () => {
  it('sem stop, win, protegido → pendência com o texto do issue', () => {
    expect(stopFlagOf(TRADE, true)).toEqual(PENDENCIA);
    expect(PENDENCIA.message).toBe('Stop movido durante a operação — informe o stop inicial');
  });
  it('sem stop, win, sem proteção → violação de sempre', () => {
    expect(stopFlagOf(TRADE, false)).toEqual(VIOLACAO_WIN);
  });
  it('breakeven sem proteção → violação sem sufixo', () => {
    expect(stopFlagOf({ ...TRADE, result: 0 }, false).message).toBe('Trade sem stop loss definido');
  });
  it('stop informado que protege → nenhum aviso, com ou sem proteção nas ordens', () => {
    expect(stopFlagOf({ ...TRADE, stopLoss: 185400 }, true)).toBeNull();
    expect(stopFlagOf({ ...TRADE, stopLoss: 185400 }, false)).toBeNull();
  });
  it('stop do lado errado conta como sem stop (#467)', () => {
    expect(stopFlagOf({ ...TRADE, stopLoss: 184000 }, true).type).toBe('STOP_INICIAL_A_INFORMAR');
  });
  it('loss sem stop → stop implícito, sem aviso (DEC-AUTO-208-04)', () => {
    expect(stopFlagOf({ ...TRADE, result: -100 }, true)).toBeNull();
    expect(stopFlagOf({ ...TRADE, result: -100 }, false)).toBeNull();
  });
  it('withStopFlag troca só o aviso de stop; violationCountOf ignora a pendência', () => {
    const f = withStopFlag(TRADE.redFlags, PENDENCIA);
    expect(f.map((x) => x.type)).toEqual(['EMOCIONAL_BLOQUEADO', 'STOP_INICIAL_A_INFORMAR']);
    expect(violationCountOf([PENDENCIA])).toBe(0);
    expect(violationCountOf(f)).toBe(1);
  });
});

describe('#475 · stopFlagForTrade — lê as ordens do trade', () => {
  it('24/09: protegido pelas ordens → pendência', async () => {
    const db = fakeDb({ orders: [...ENTRADAS, STOP_ARRASTADO, ALVO] });
    expect(await stopFlagForTrade(db, 'T1', TRADE)).toEqual(PENDENCIA);
    expect(db.consultas).toEqual([{ nome: 'orders', campo: 'correlatedTradeId', valor: 'T1' }]);
  });
  it('ordens sem nenhuma proteção (só entrada e alvo) → violação', async () => {
    const db = fakeDb({ orders: [...ENTRADAS, ALVO] });
    expect(await stopFlagForTrade(db, 'T1', TRADE)).toEqual(VIOLACAO_WIN);
  });
  it('trade manual (sem ordens) → violação, como antes', async () => {
    const db = fakeDb({ orders: [] });
    expect(await stopFlagForTrade(db, 'T1', { ...TRADE, ticker: 'WINV26' })).toEqual(VIOLACAO_WIN);
  });
  it('ordem de OUTRO trade não protege este', async () => {
    const db = fakeDb({ orders: [...ENTRADAS, { ...STOP_ARRASTADO, correlatedTradeId: 'T9' }] });
    expect((await stopFlagForTrade(db, 'T1', TRADE)).type).toBe('TRADE_SEM_STOP');
  });
  it('com stop informado não consulta `orders`', async () => {
    const db = fakeDb({ orders: [...ENTRADAS, STOP_ARRASTADO] });
    expect(await stopFlagForTrade(db, 'T1', { ...TRADE, stopLoss: 185400 })).toBeNull();
    expect(db.consultas).toHaveLength(0);
  });
});

describe('#475 · refreshStopFlag — reavaliação no fechamento do lote', () => {
  it('24/09: TRADE_SEM_STOP → pendência; demais flags intactas; hasRedFlags pelas violações', async () => {
    const db = fakeDb({ trades: { T1: TRADE }, orders: [...ENTRADAS, STOP_ARRASTADO, ALVO] });
    const r = await refreshStopFlag(db, 'T1');
    expect(r).toEqual({ tradeId: 'T1', status: 'ATUALIZADO', antes: 'TRADE_SEM_STOP', depois: 'STOP_INICIAL_A_INFORMAR' });
    expect(db.escritas).toEqual([{
      id: 'T1',
      patch: { redFlags: [{ type: 'EMOCIONAL_BLOQUEADO', message: 'x' }, PENDENCIA], hasRedFlags: true },
    }]);
  });
  it('só a pendência → hasRedFlags false', async () => {
    const db = fakeDb({ trades: { T1: { ...TRADE, redFlags: [VIOLACAO_WIN] } }, orders: [...ENTRADAS, STOP_ARRASTADO] });
    await refreshStopFlag(db, 'T1');
    expect(db.escritas[0].patch).toEqual({ redFlags: [PENDENCIA], hasRedFlags: false });
  });
  it('dry-run: diz o que mudaria e não escreve', async () => {
    const db = fakeDb({ trades: { T1: TRADE }, orders: [...ENTRADAS, STOP_ARRASTADO] });
    expect((await refreshStopFlag(db, 'T1', { dryRun: true })).status).toBe('MUDARIA');
    expect(db.escritas).toHaveLength(0);
  });
  it('sem proteção nas ordens: violação fica, nada é escrito', async () => {
    const db = fakeDb({ trades: { T1: TRADE }, orders: [...ENTRADAS, ALVO] });
    expect((await refreshStopFlag(db, 'T1')).status).toBe('INALTERADO');
    expect(db.escritas).toHaveLength(0);
  });
  it('aluno informou o stop depois: pendência some', async () => {
    const db = fakeDb({ trades: { T1: { ...TRADE, stopLoss: 185400, redFlags: [PENDENCIA] } }, orders: [...ENTRADAS, STOP_ARRASTADO] });
    await refreshStopFlag(db, 'T1');
    expect(db.escritas[0].patch).toEqual({ redFlags: [], hasRedFlags: false });
  });
  it('INV-30: trade discutido é intocado — nem lê as ordens', async () => {
    const db = fakeDb({ trades: { T1: { ...TRADE, status: 'DISCUSSED' } }, orders: [...ENTRADAS, STOP_ARRASTADO] });
    expect((await refreshStopFlag(db, 'T1')).status).toBe('PRESERVADO');
    expect(db.escritas).toHaveLength(0);
    expect(db.consultas).toHaveLength(0);
  });
  it('trade inexistente', async () => {
    const db = fakeDb({});
    expect((await refreshStopFlag(db, 'TX')).status).toBe('NAO_EXISTE');
  });
});

describe('#475 · recalculateTradesCompliance com as ordens', () => {
  const calculateTradeCompliance = () => ({ riskPercent: null, rrRatio: 1.2, rrAssumed: true, compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' } });
  const RED_FLAG_TYPES = { RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO' };
  const doc = (id, data) => ({ id, data: () => data, ref: { id, update: vi.fn(async () => {}) } });

  it('protegido → pendência e hasRedFlags false', async () => {
    const d = doc('T1', { ...TRADE, redFlags: [VIOLACAO_WIN] });
    const stopFlagFor = vi.fn(async () => PENDENCIA);
    await recalculateTradesCompliance([d], { riskPerOperation: 1 }, { calculateTradeCompliance, RED_FLAG_TYPES, stopFlagFor });
    expect(stopFlagFor).toHaveBeenCalledWith('T1', expect.objectContaining({ side: 'SHORT' }));
    expect(d.ref.update).toHaveBeenCalledWith(expect.objectContaining({ redFlags: [PENDENCIA], hasRedFlags: false }));
  });
  it('discutido: nem pergunta às ordens', async () => {
    const d = doc('T1', { ...TRADE, status: 'DISCUSSED' });
    const stopFlagFor = vi.fn();
    const r = await recalculateTradesCompliance([d], { riskPerOperation: 1 }, { calculateTradeCompliance, RED_FLAG_TYPES, stopFlagFor });
    expect(r).toEqual({ updated: 0, preserved: 1 });
    expect(stopFlagFor).not.toHaveBeenCalled();
    expect(d.ref.update).not.toHaveBeenCalled();
  });
});

describe('#475 · pendência não conta como violação (espelho do servidor)', () => {
  const trade = { redFlags: [PENDENCIA] };
  it('effectiveRedFlags / hasEffectiveRedFlags ignoram a pendência', () => {
    expect(vf.effectiveRedFlags(trade)).toEqual([]);
    expect(vf.hasEffectiveRedFlags(trade)).toBe(false);
    expect(vf.pendingRedFlags(trade)).toEqual([PENDENCIA]);
  });
  it('violação ao lado da pendência continua contando', () => {
    expect(vf.effectiveRedFlags({ redFlags: [PENDENCIA, VIOLACAO_WIN] })).toEqual([VIOLACAO_WIN]);
  });
});
