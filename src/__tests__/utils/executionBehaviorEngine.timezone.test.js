/**
 * Regressão #375 — instante de ordem resolvido no fuso do trade.
 *
 * `orders` guarda instante ingênuo ("2026-08-21T11:27:51"); `trades` guarda com offset
 * explícito desde o #285/#292 ("...-03:00"). Quem lê string sem offset a interpreta no
 * fuso DO PROCESSO — e a Cloud Function roda em UTC. Em produção isso fez toda perna de
 * proteção parecer cancelada 3h antes da saída: `liveStopsAt` descartava tudo e TODO
 * trade com ordem correlacionada saía com UNPROTECTED_SIZE HIGH e cobertura zero,
 * travando progressão de estágio em posição integralmente protegida.
 *
 * Os offsets abaixo são propositalmente distantes entre si: qualquer fuso em que o
 * runner esteja diverge de pelo menos um deles, então o teste falha se a correção for
 * revertida — independente da máquina que roda a suíte.
 */
import { describe, it, expect } from 'vitest';
import { detectExecutionEvents, EVENT_TYPES } from '../../utils/executionBehaviorEngine';

// Com o bug, a ordem ingênua é lida no fuso do runner (L) e o trade no dele (T): a perna
// só some quando T < L. Um único offset não cobre toda máquina — '-11:00' fica a oeste de
// qualquer runner plausível e garante que a regressão apareça em qualquer lugar.
const OFFSETS = ['-03:00', '-05:00', '-11:00', '+09:00', 'Z'];

/** Trade LONG 10 protegido por dois brackets de 5, cancelados pelo OCO na saída. */
const cenarioProtegido = (offset) => {
  const off = offset === 'Z' ? 'Z' : offset;
  const trade = {
    id: 'T1', side: 'LONG', qty: 10, entry: 174030, exit: 174290, result: 520,
    ticker: 'WINV26', date: '2026-08-21',
    entryTime: `2026-08-21T11:25:15${off}`,
    exitTime: `2026-08-21T11:27:51${off}`,
  };
  const base = { correlatedTradeId: 'T1', instrument: 'WINV26' };
  const orders = [
    { ...base, externalOrderId: 'e1', side: 'BUY', orderType: 'LIMIT', isStopOrder: false,
      price: 174050, limitPrice: 174050, stopPrice: null, filledPrice: 174050,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:14', filledAt: '2026-08-21T11:25:15', cancelledAt: null },
    { ...base, externalOrderId: 'e2', side: 'BUY', orderType: 'LIMIT', isStopOrder: false,
      price: 174010, limitPrice: 174010, stopPrice: null, filledPrice: 174010,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:09', filledAt: '2026-08-21T11:25:18', cancelledAt: null },
    { ...base, externalOrderId: 'e3', side: 'SELL', orderType: 'STOP_LIMIT', isStopOrder: true,
      price: 173755, limitPrice: 173755, stopPrice: 173905, filledPrice: null,
      quantity: 5, filledQuantity: 5, status: 'CANCELLED',
      submittedAt: '2026-08-21T11:25:15', filledAt: null, cancelledAt: '2026-08-21T11:27:51' },
    { ...base, externalOrderId: 'e4', side: 'SELL', orderType: 'STOP_LIMIT', isStopOrder: true,
      price: 173755, limitPrice: 173755, stopPrice: 173905, filledPrice: null,
      quantity: 5, filledQuantity: 5, status: 'CANCELLED',
      submittedAt: '2026-08-21T11:25:18', filledAt: null, cancelledAt: '2026-08-21T11:27:51' },
    { ...base, externalOrderId: 'e5', side: 'SELL', orderType: 'LIMIT', isStopOrder: false,
      price: 174290, limitPrice: 174290, stopPrice: null, filledPrice: 174290,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:15', filledAt: '2026-08-21T11:27:51', cancelledAt: null },
    { ...base, externalOrderId: 'e6', side: 'SELL', orderType: 'LIMIT', isStopOrder: false,
      price: 174290, limitPrice: 174290, stopPrice: null, filledPrice: 174290,
      quantity: 5, filledQuantity: 5, status: 'FILLED',
      submittedAt: '2026-08-21T11:25:18', filledAt: '2026-08-21T11:27:51', cancelledAt: null },
  ];
  return { trade, orders };
};

const eventosDe = (res) => (Array.isArray(res) ? res : (res.events || []));

describe('#375 — instante de ordem no fuso do trade', () => {
  it.each(OFFSETS)('posição coberta não vira UNPROTECTED_SIZE com trade em %s', (offset) => {
    const { trade, orders } = cenarioProtegido(offset);
    const eventos = eventosDe(detectExecutionEvents({ trades: [trade], orders }));
    const nus = eventos.filter((e) => e.type === EVENT_TYPES.UNPROTECTED_SIZE);
    expect(nus).toHaveLength(0);
  });

  it('posição realmente descoberta continua emitindo — o fix não cega o detector', () => {
    const { trade, orders } = cenarioProtegido('-03:00');
    // Remove uma das duas pernas: 5 de 10 contratos ficam sem cobertura.
    const semUmaPerna = orders.filter((o) => o.externalOrderId !== 'e4');
    const eventos = eventosDe(detectExecutionEvents({ trades: [trade], orders: semUmaPerna }));
    const nus = eventos.filter((e) => e.type === EVENT_TYPES.UNPROTECTED_SIZE);
    expect(nus).toHaveLength(1);
    expect(nus[0].evidence.uncoveredQty).toBe(5);
    expect(nus[0].evidence.hasAnyStop).toBe(true);
  });

  it('ordem que já vem com offset é respeitada, não recebe o do trade', () => {
    const { trade, orders } = cenarioProtegido('-03:00');
    // Mesmo instante, escrito em UTC: continua coberto.
    const comOffset = orders.map((o) => ({
      ...o,
      submittedAt: o.submittedAt ? `${o.submittedAt.replace('11:2', '14:2')}Z` : o.submittedAt,
      filledAt: o.filledAt ? `${o.filledAt.replace('11:2', '14:2')}Z` : o.filledAt,
      cancelledAt: o.cancelledAt ? `${o.cancelledAt.replace('11:2', '14:2')}Z` : o.cancelledAt,
    }));
    const eventos = eventosDe(detectExecutionEvents({ trades: [trade], orders: comOffset }));
    expect(eventos.filter((e) => e.type === EVENT_TYPES.UNPROTECTED_SIZE)).toHaveLength(0);
  });
});
