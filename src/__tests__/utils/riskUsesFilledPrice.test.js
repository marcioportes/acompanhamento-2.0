/**
 * riskUsesFilledPrice.test.js — issue #371
 *
 * O risco de uma perna de proteção que EXECUTOU vale pelo preço executado, não pelo
 * limite enviado.
 *
 * Caso real (20/08/2026, WINV26 SHORT 5, entrada 169.880). Extrato da corretora:
 *
 *   Preço: 170.280,00 | Preço Stop: - | Preço Médio: 170.130,00 | Tipo: Limite
 *
 * O detector media 400 pontos (limite) e acusava R$ 400 contra um RO de R$ 252 —
 * alerta HIGH que trava progressão de estágio. O risco real foi 250 pontos = R$ 250,
 * dentro do plano. O 170.280 é o limite com folga que garante preenchimento; o que
 * valeu foi o médio. A própria UI já mostrava "Stop (impl.) 170.130".
 *
 * Perna VIVA ou cancelada sem execução continua valendo pelo preço enviado — é o
 * risco que estava no book, que é o alerta que o #359 existe para pegar.
 */

import { describe, it, expect } from 'vitest';
import { detectExecutionEvents, EVENT_TYPES } from '../../utils/executionBehaviorEngine';

const trade = {
  id: 'T1',
  ticker: 'WINV26',
  side: 'SHORT',
  qty: 5,
  entry: 169880,
  entryTime: '2026-08-20T10:18:54',
  exitTime: '2026-08-20T10:22:06',
  planRoPct: 0.84,
  planPl: 30000,            // RO = R$ 252
  tickerRule: { tickSize: 5, tickValue: 1 },  // R$ 0,20 por ponto
};

const entrada = {
  externalOrderId: 'E1', correlatedTradeId: 'T1', instrument: 'WINV26',
  side: 'SELL', quantity: 5, status: 'FILLED',
  submittedAt: '2026-08-20T10:18:50', filledAt: '2026-08-20T10:18:54',
  limitPrice: 169880, price: 169880, filledPrice: 169880, isStopOrder: false,
};

const protecaoExecutada = {
  externalOrderId: 'P1', correlatedTradeId: 'T1', instrument: 'WINV26',
  side: 'BUY', quantity: 5, status: 'FILLED',
  submittedAt: '2026-08-20T10:18:54', filledAt: '2026-08-20T10:22:06',
  limitPrice: 170280, price: 170130, filledPrice: 170130, isStopOrder: false,
};

const roDe = (orders, over = {}) => {
  const eventos = detectExecutionEvents({ trades: [{ ...trade, ...over }], orders });
  return eventos.find(e => e.type === EVENT_TYPES.RISK_OVER_RO) || null;
};

describe('#371 — risco da proteção executada', () => {
  it('não acusa RO quando a execução ficou dentro do limite do plano', () => {
    // 250 pts × R$ 0,20 × 5 = R$ 250 < R$ 252
    expect(roDe([entrada, protecaoExecutada])).toBeNull();
  });

  it('acusa quando a PRÓPRIA execução estourou o RO', () => {
    const pior = { ...protecaoExecutada, filledPrice: 170400, price: 170400 };

    const ev = roDe([entrada, pior]);

    expect(ev).not.toBeNull();
    expect(ev.evidence.riskAmount).toBe(520);
  });

  it('perna VIVA continua medida pelo preço enviado — é o risco parado no book', () => {
    // Stop de verdade, nunca executado nem cancelado: 400 pts × R$ 0,20 × 5 = R$ 400.
    const stopVivo = {
      externalOrderId: 'S1', correlatedTradeId: 'T1', instrument: 'WINV26',
      side: 'BUY', quantity: 5, status: 'WORKING',
      submittedAt: '2026-08-20T10:18:54', filledAt: null, cancelledAt: null,
      stopPrice: 170280, price: 170280, filledPrice: null, isStopOrder: true,
    };

    const ev = roDe([entrada, stopVivo]);

    expect(ev).not.toBeNull();
    expect(ev.evidence.riskAmount).toBe(400);
  });

  it('a evidência reporta o preço que valeu, não o enviado', () => {
    const pior = { ...protecaoExecutada, filledPrice: 170400, price: 170400 };

    const ev = roDe([entrada, pior]);

    expect(ev.evidence.legs[0].stopPrice).toBe(170400);
    expect(ev.evidence.legs[0].distancePoints).toBe(520);
  });

  it('ordem executada sem filledPrice cai no preço enviado', () => {
    const semFill = { ...protecaoExecutada, filledPrice: null, price: 170280, limitPrice: 170280 };

    const ev = roDe([entrada, semFill]);

    expect(ev).not.toBeNull();
    expect(ev.evidence.legs[0].stopPrice).toBe(170280);
  });
});
