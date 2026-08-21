/**
 * abortedOrderEvents.test.js — issue #369
 *
 * Ordens que não viraram posição, agora atribuídas ao trade vizinho, são lidas pelo
 * tempo que as separa do trade:
 *
 *   até 5 min antes da entrada     → hesitação de gatilho
 *   5 a 30 min antes               → HESITATION_PRE_ENTRY (peso 5, já existia)
 *   30 min a 2 h antes             → RECONSIDERATION_PRE_ENTRY — "pensei melhor", não pontua
 *   depois da saída                → ABORTED_ATTEMPT_POST_TRADE — tentativa que não se converteu
 *
 * A natureza sai dos timestamps: nenhum campo novo, nenhuma marca persistida.
 */

import { describe, it, expect } from 'vitest';
import { detectExecutionEvents, EVENT_TYPES } from '../../utils/executionBehaviorEngine';

const DIA = '2026-08-20';
const t = (h, m) => `${DIA}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

const trade = {
  id: 'T-12h',
  ticker: 'WINV26',
  side: 'LONG',
  qty: 5,
  entryTime: t(12, 0),
  exitTime: t(12, 30),
  result: 150,
};

const entrada = {
  externalOrderId: 'FILL-ENTRY',
  correlatedTradeId: 'T-12h',
  instrument: 'WINV26',
  side: 'BUY',
  quantity: 5,
  status: 'FILLED',
  submittedAt: t(12, 0),
  filledAt: t(12, 0),
  isStopOrder: false,
};

const abortada = (h, m, over = {}) => ({
  externalOrderId: `CL-${h}${m}`,
  correlatedTradeId: 'T-12h',
  instrument: 'WINV26',
  side: 'BUY',
  quantity: 5,
  status: 'CANCELLED',
  submittedAt: t(h, m),
  cancelledAt: t(h, m + 1),
  isStopOrder: false,
  ...over,
});

const tiposDe = (orders, trades = [trade]) =>
  detectExecutionEvents({ trades, orders }).map(e => e.type);

describe('#369 — leitura das ordens que não viraram posição', () => {
  it('cancelada 28 min antes da entrada é hesitação', () => {
    // Cenário do Marcio: set das 11h30 desmontado, entrada às 12h.
    expect(tiposDe([entrada, abortada(11, 30)])).toContain(EVENT_TYPES.HESITATION_PRE_ENTRY);
  });

  it('cancelada 3 min antes é hesitação de gatilho, não reconsideração', () => {
    const eventos = detectExecutionEvents({ trades: [trade], orders: [entrada, abortada(11, 56)] });
    const hesitacao = eventos.find(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY);

    expect(hesitacao).toBeDefined();
    expect(hesitacao.evidence.pattern).toBe('TRIGGER');
  });

  it('cancelada 1h antes é reconsideração — decisão, não descontrole', () => {
    const tipos = tiposDe([entrada, abortada(11, 0)]);

    expect(tipos).toContain(EVENT_TYPES.RECONSIDERATION_PRE_ENTRY);
    expect(tipos).not.toContain(EVENT_TYPES.HESITATION_PRE_ENTRY);
  });

  it('reconsideração carrega o intervalo, para o aluno ver o próprio tempo de espera', () => {
    const eventos = detectExecutionEvents({ trades: [trade], orders: [entrada, abortada(11, 0)] });
    const ev = eventos.find(e => e.type === EVENT_TYPES.RECONSIDERATION_PRE_ENTRY);

    // 11h01 (cancelamento) → 12h00 (entrada). O intervalo conta do momento em que a
    // ordem foi retirada, não de quando foi montada.
    expect(ev.evidence.gapMinutes).toBe(59);
    expect(ev.tradeId).toBe('T-12h');
  });

  it('cancelada DEPOIS da saída é tentativa posterior, não hesitação', () => {
    const tipos = tiposDe([entrada, abortada(12, 45)]);

    expect(tipos).toContain(EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE);
    expect(tipos).not.toContain(EVENT_TYPES.HESITATION_PRE_ENTRY);
  });

  it('tentativa posterior a trade perdedor é sinal mais forte que após ganho', () => {
    const perdedor = { ...trade, result: -300 };
    const eventos = detectExecutionEvents({ trades: [perdedor], orders: [entrada, abortada(12, 45)] });
    const ev = eventos.find(e => e.type === EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE);

    expect(ev.evidence.afterLoss).toBe(true);
    expect(ev.severity).toBe('MEDIUM');
  });

  it('tentativa posterior a trade vencedor fica em LOW', () => {
    const eventos = detectExecutionEvents({ trades: [trade], orders: [entrada, abortada(12, 45)] });
    const ev = eventos.find(e => e.type === EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE);

    expect(ev.evidence.afterLoss).toBe(false);
    expect(ev.severity).toBe('LOW');
  });

  it('stop cancelado não vira hesitação de entrada', () => {
    const tipos = tiposDe([entrada, abortada(11, 30, { isStopOrder: true })]);

    expect(tipos).not.toContain(EVENT_TYPES.HESITATION_PRE_ENTRY);
    expect(tipos).not.toContain(EVENT_TYPES.RECONSIDERATION_PRE_ENTRY);
  });

  it('cancelada do lado oposto ao trade não conta como hesitação daquela entrada', () => {
    const tipos = tiposDe([entrada, abortada(11, 30, { side: 'SELL' })]);

    expect(tipos).not.toContain(EVENT_TYPES.HESITATION_PRE_ENTRY);
  });

  it('sem ordem abortada, nenhum dos três eventos aparece', () => {
    const tipos = tiposDe([entrada]);

    for (const tipo of [
      EVENT_TYPES.HESITATION_PRE_ENTRY,
      EVENT_TYPES.RECONSIDERATION_PRE_ENTRY,
      EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE,
    ]) {
      expect(tipos).not.toContain(tipo);
    }
  });
});
