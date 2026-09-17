/**
 * recalculateTradesCompliance.test.js — laço de compliance do `recalculateCompliance` (#451).
 *
 * Trade discutido é pulado antes do cálculo e contado em `preserved`; os demais recebem
 * o mesmo patch que a callable gravava antes da extração.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { recalculateTradesCompliance } = require('../../trades/recalculateTradesCompliance');

// Mesmos valores de functions/index.js.
const RED_FLAG_TYPES = {
  NO_PLAN: 'TRADE_SEM_PLANO',
  NO_STOP: 'TRADE_SEM_STOP',
  RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO',
  RR_BELOW_MINIMUM: 'RR_ABAIXO_MINIMO',
  DAILY_LOSS_EXCEEDED: 'LOSS_DIARIO_EXCEDIDO',
  BLOCKED_EMOTION: 'EMOCIONAL_BLOQUEADO',
};

const NOW = '2026-09-17T12:00:00.000Z';
const plan = { riskPerOperation: 1 };

const doc = (id, data) => ({ id, data: () => data, ref: { id, update: vi.fn(async () => {}) } });

// Compliance injetado: fora do plano quando o trade pede, com risco fixo.
const calculateTradeCompliance = vi.fn((trade) => ({
  riskPercent: trade.fora ? 2.5 : 0.8,
  rrRatio: 1.5,
  rrAssumed: false,
  compliance: { roStatus: trade.fora ? 'FORA_DO_PLANO' : 'CONFORME', rrStatus: 'CONFORME' },
}));

const deps = { calculateTradeCompliance, RED_FLAG_TYPES };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  calculateTradeCompliance.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('recalculateTradesCompliance — patch dos trades não discutidos', () => {
  it('conforme com stop: patch sem flags, preserva flags que não são de compliance', async () => {
    const d = doc('t1', {
      status: 'CLOSED', stopLoss: 100, result: 50,
      redFlags: ['RISCO_ACIMA_PERMITIDO', { type: 'EMOCIONAL_BLOQUEADO', message: 'x' }, { type: 'RR_ABAIXO_MINIMO' }],
    });
    const res = await recalculateTradesCompliance([d], plan, deps);
    expect(res).toEqual({ updated: 1, preserved: 0 });
    expect(d.ref.update).toHaveBeenCalledWith({
      riskPercent: 0.8,
      rrRatio: 1.5,
      rrAssumed: false,
      compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      redFlags: [{ type: 'EMOCIONAL_BLOQUEADO', message: 'x' }],
      hasRedFlags: true,
    });
  });

  it('win sem stop → NO_STOP com sufixo; fora do plano → RISK_EXCEEDED', async () => {
    const d = doc('t2', { status: 'REVIEWED', result: 30, fora: true });
    await recalculateTradesCompliance([d], plan, deps);
    expect(d.ref.update).toHaveBeenCalledWith({
      riskPercent: 2.5,
      rrRatio: 1.5,
      rrAssumed: false,
      compliance: { roStatus: 'FORA_DO_PLANO', rrStatus: 'CONFORME' },
      redFlags: [
        { type: 'TRADE_SEM_STOP', message: 'Trade sem stop loss definido — risco não mensurado (win sem stop)', timestamp: NOW },
        { type: 'RISCO_ACIMA_PERMITIDO', message: 'Risco 2.5% excede maximo (1%)', timestamp: NOW },
      ],
      hasRedFlags: true,
    });
  });

  it('loss sem stop (stop implícito, DEC-AUTO-208-04) não emite NO_STOP', async () => {
    const d = doc('t3', { result: -40 });
    await recalculateTradesCompliance([d], plan, deps);
    expect(d.ref.update.mock.calls[0][0].redFlags).toEqual([]);
    expect(d.ref.update.mock.calls[0][0].hasRedFlags).toBe(false);
  });
});

describe('recalculateTradesCompliance — #451 trade discutido é imutável', () => {
  it('massa mista: discutidos intocados e fora do cálculo; demais atualizados', async () => {
    const docs = [
      doc('d1', { status: 'DISCUSSED', stopLoss: 100, result: 10 }),
      doc('c1', { status: 'CLOSED', stopLoss: 100, result: 10 }),
      doc('d2', { status: 'DISCUSSED', result: 30, fora: true }),
      doc('r1', { status: 'REVIEWED', stopLoss: 100, result: -10 }),
      doc('s1', { stopLoss: 100, result: 5 }), // legado sem status → mutável
    ];
    const res = await recalculateTradesCompliance(docs, plan, deps);

    expect(res).toEqual({ updated: 3, preserved: 2 });
    expect(docs[0].ref.update).not.toHaveBeenCalled();
    expect(docs[2].ref.update).not.toHaveBeenCalled();
    for (const i of [1, 3, 4]) expect(docs[i].ref.update).toHaveBeenCalledTimes(1);
    expect(calculateTradeCompliance).toHaveBeenCalledTimes(3);
  });

  it('caminho tradeId avulso com trade discutido → updated 0, preserved 1, sem erro', async () => {
    const d = doc('d1', { status: 'DISCUSSED' });
    await expect(recalculateTradesCompliance([d], plan, deps)).resolves.toEqual({ updated: 0, preserved: 1 });
    expect(d.ref.update).not.toHaveBeenCalled();
  });

  it('lista vazia → zeros', async () => {
    await expect(recalculateTradesCompliance([], plan, deps)).resolves.toEqual({ updated: 0, preserved: 0 });
  });
});
