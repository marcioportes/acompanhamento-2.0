/**
 * #375 — proteção medida no TEMPO, não na foto da saída.
 *
 * Regra de negócio (Marcio, 21/08/2026): cancelar o stop não é o problema — o problema é
 * a posição ficar sem stop enquanto está aberta. Cancelar e criar outra é condução de
 * posição: o sistema mostra e não acusa. A tolerância de 20s é o tempo real de trocar
 * uma ordem na plataforma.
 */
import { describe, it, expect } from 'vitest';
import {
  detectExecutionEvents, protectionTimeline, EVENT_TYPES, EVENT_SEVERITY,
  REPLACEMENT_TOLERANCE_MS,
} from '../../utils/executionBehaviorEngine';

const T0 = Date.parse('2026-08-21T11:25:00-03:00');
const iso = (offsetMs) => new Date(T0 + offsetMs).toISOString();
const min = (n) => n * 60000;
const seg = (n) => n * 1000;

const trade = (over = {}) => ({
  id: 'T1', ticker: 'WINV26', side: 'LONG', qty: 10, entry: 174030, exit: 174290,
  result: 520, entryTime: iso(0), exitTime: iso(min(10)), ...over,
});

const entrada = (id, at, qty = 10) => ({
  externalOrderId: id, correlatedTradeId: 'T1', instrument: 'WINV26', side: 'BUY',
  orderType: 'LIMIT', isStopOrder: false, price: 174030, limitPrice: 174030,
  stopPrice: null, filledPrice: 174030, quantity: qty, filledQuantity: qty,
  status: 'FILLED', submittedAt: at, filledAt: at, cancelledAt: null,
});

const saida = (id, at, qty = 10) => ({
  externalOrderId: id, correlatedTradeId: 'T1', instrument: 'WINV26', side: 'SELL',
  orderType: 'LIMIT', isStopOrder: false, price: 174290, limitPrice: 174290,
  stopPrice: null, filledPrice: 174290, quantity: qty, filledQuantity: qty,
  status: 'FILLED', submittedAt: at, filledAt: at, cancelledAt: null,
});

const protecao = (id, de, ate, { qty = 10, price = 173905, status = 'CANCELLED' } = {}) => ({
  externalOrderId: id, correlatedTradeId: 'T1', instrument: 'WINV26', side: 'SELL',
  orderType: 'STOP_LIMIT', isStopOrder: true, price, limitPrice: price, stopPrice: price,
  filledPrice: null, quantity: qty, filledQuantity: qty, status,
  submittedAt: de, filledAt: null, cancelledAt: ate,
});

const nus = (t, orders) => detectExecutionEvents({ trades: [t], orders })
  .filter((e) => e.type === EVENT_TYPES.UNPROTECTED_SIZE);

describe('#375 — linha do tempo da proteção', () => {
  it('cancelar no alvo não é exposição — posição já zerou no mesmo instante', () => {
    const t = trade();
    const orders = [
      entrada('E1', iso(0)),
      protecao('S1', iso(0), iso(min(10))),
      saida('X1', iso(min(10))),
    ];
    expect(protectionTimeline(t, orders).windows).toHaveLength(0);
    expect(nus(t, orders)).toHaveLength(0);
  });

  it('trocar a proteção dentro de 20s é condução, não exposição', () => {
    const t = trade();
    const orders = [
      entrada('E1', iso(0)),
      protecao('S1', iso(0), iso(min(5))),
      protecao('S2', iso(min(5) + seg(8)), iso(min(10)), { price: 174000 }),
      saida('X1', iso(min(10))),
    ];
    const tl = protectionTimeline(t, orders);
    expect(tl.windows).toHaveLength(0);
    expect(tl.replacements).toHaveLength(1);
    expect(tl.replacements[0].direction).toBe('TIGHTENED');
    expect(nus(t, orders)).toHaveLength(0);
  });

  it('gap acima da tolerância é exposição de verdade', () => {
    const t = trade();
    const orders = [
      entrada('E1', iso(0)),
      protecao('S1', iso(0), iso(min(5))),
      protecao('S2', iso(min(5) + seg(45)), iso(min(10)), { price: 174000 }),
      saida('X1', iso(min(10))),
    ];
    const tl = protectionTimeline(t, orders);
    expect(tl.windows).toHaveLength(1);
    expect(tl.windows[0].durationMs).toBe(seg(45));
    expect(tl.windows[0].contracts).toBe(10);
    expect(nus(t, orders)).toHaveLength(1);
  });

  it('retirar e não recolocar até a saída → Esperança', () => {
    const t = trade();
    const orders = [
      entrada('E1', iso(0)),
      protecao('S1', iso(0), iso(min(3))),
      saida('X1', iso(min(10))),
    ];
    const [ev] = nus(t, orders);
    expect(ev.evidence.emotionMapping).toBe('HOPE');
    expect(ev.evidence.hasAnyStop).toBe(true);
    expect(ev.evidence.neverProtected).toBe(false);
    expect(ev.evidence.nakedSeconds).toBe(7 * 60);
  });

  it('retirar e ainda aumentar a posição → Negação', () => {
    const t = trade({ qty: 15 });
    const orders = [
      entrada('E1', iso(0), 10),
      protecao('S1', iso(0), iso(min(3)), { qty: 10 }),
      entrada('E2', iso(min(5)), 5),
      saida('X1', iso(min(10)), 15),
    ];
    const [ev] = nus(t, orders);
    expect(ev.evidence.emotionMapping).toBe('DENIAL');
    expect(ev.evidence.addedWhileNaked).toBe(true);
  });

  it('nunca protegeu → é processo, não emoção; e trava estágio', () => {
    const t = trade();
    const orders = [entrada('E1', iso(0)), saida('X1', iso(min(10)))];
    const [ev] = nus(t, orders);
    expect(ev.evidence.neverProtected).toBe(true);
    expect(ev.evidence.emotionMapping).toBeNull();
    expect(ev.severity).toBe(EVENT_SEVERITY.HIGH);
  });

  it('janela curta e isolada em posição protegida é informativa, não sentença', () => {
    const t = trade({ exitTime: iso(min(60)) });
    const orders = [
      entrada('E1', iso(0)),
      protecao('S1', iso(0), iso(min(20))),
      protecao('S2', iso(min(21)), iso(min(60)), { price: 174000 }),
      saida('X1', iso(min(60))),
    ];
    const [ev] = nus(t, orders);
    expect(ev.severity).toBe(EVENT_SEVERITY.MEDIUM);
    expect(ev.evidence.nakedRatio).toBeLessThan(0.5);
  });

  it('tolerância é a que Marcio definiu', () => {
    expect(REPLACEMENT_TOLERANCE_MS).toBe(20000);
  });
});
