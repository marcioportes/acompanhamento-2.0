/**
 * executionBehaviorEngine.test.js
 * @version 1.0.0 (v1.49.0 — issue #208 Fase 2)
 * Testes para detectExecutionEvents (5 detectores).
 */

import { describe, it, expect } from 'vitest';
import {
  detectExecutionEvents,
  EVENT_TYPES,
  EVENT_SEVERITY,
} from '../../utils/executionBehaviorEngine';

// ============================================
// FIXTURES
// ============================================

// #357 — baseline de risco. `planRoPct`/`planPl` são anexados ao trade por
// buildBehaviorProfile antes do motor rodar; `tickerRule` vem do doc do trade.
// WIN: tickValue 1 / tickSize 5 = R$ 0,20 por ponto. RO = 0,84% × 30.000 = R$ 252.
const makeTrade = (overrides = {}) => ({
  id: 'T1',
  ticker: 'WINM26',
  side: 'LONG',
  qty: 2,
  entry: '100000',
  entryTime: '2026-04-22T10:30:00Z',
  exitTime: '2026-04-22T11:00:00Z',
  planRoPct: 0.84,
  planPl: 30000,
  tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  externalOrderId: 'ORD001',
  instrument: 'WINM26',
  side: 'BUY',
  type: 'MARKET',
  status: 'FILLED',
  quantity: 2,
  price: null,
  stopPrice: null,
  filledPrice: 100000,
  submittedAt: '2026-04-22T10:30:00Z',
  filledAt: '2026-04-22T10:30:01Z',
  cancelledAt: null,
  isStopOrder: false,
  correlatedTradeId: 'T1',
  ...overrides,
});

// ============================================
// RISK_OVER_RO (#357 — substitui STOP_TAMPERING)
// ============================================
describe('detectExecutionEvents — RISK_OVER_RO', () => {
  // RO = R$ 252. Ponto = R$ 0,20.
  const stop = (id, price, qty, at) => makeOrder({
    externalOrderId: id, isStopOrder: true, type: 'STOP', status: 'CANCELLED',
    stopPrice: price, quantity: qty, submittedAt: at,
  });

  it('dispara quando o risco financeiro passa do RO', () => {
    // 8 contratos a 250 pts = 250 × 0,20 × 8 = R$ 400 > R$ 252
    const trade = makeTrade({ qty: 8 });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [stop('S1', 99750, 8, '2026-04-22T10:30:30Z')],
    });
    const over = events.filter(e => e.type === EVENT_TYPES.RISK_OVER_RO);
    expect(over).toHaveLength(1);
    expect(over[0].severity).toBe(EVENT_SEVERITY.HIGH);
    expect(over[0].evidence.riskAmount).toBe(400);
    expect(over[0].evidence.roAmount).toBe(252);
    expect(over[0].evidence.excessAmount).toBe(148);
    expect(over[0].evidence.maxDistancePoints).toBe(157.5);
    expect(over[0].source).toBe('plan');
  });

  it('NÃO dispara quando o risco cabe no RO — mesmo com o stop mais longe em pontos', () => {
    // Regressão do falso positivo: mover o stop para longe não é sinal por si só.
    const trade = makeTrade({ qty: 5 });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [
        // S1 é SUBSTITUÍDO por S2 (cancelado antes do novo nascer) — não soma junto,
        // senão o mesmo risco seria contado duas vezes.
        makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'CANCELLED',
          stopPrice: 99900, quantity: 5,
          submittedAt: '2026-04-22T10:30:30Z', cancelledAt: '2026-04-22T10:34:00Z' }),
        stop('S2', 99800, 5, '2026-04-22T10:35:00Z'),   // 200 pts × 0,20 × 5 = R$ 200 < 252
      ],
    });
    expect(events.filter(e => e.type === EVENT_TYPES.RISK_OVER_RO)).toHaveLength(0);
  });

  it('compõe POR PERNA — cada stop protege sua própria quantidade', () => {
    // Caso real WINV26 18/08: 5 ctr @ 49,38 pts + 3 ctr @ 129,38 pts = R$ 127,01.
    const trade = makeTrade({ qty: 8, entry: '169829.38' });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [
        stop('S1', 169780, 5, '2026-04-22T10:30:30Z'),
        stop('S2', 169700, 3, '2026-04-22T10:35:00Z'),
      ],
    });
    // 49,38×0,2×5 = 49,38  +  129,38×0,2×3 = 77,63  →  127,01 < 252
    expect(events.filter(e => e.type === EVENT_TYPES.RISK_OVER_RO)).toHaveLength(0);
  });

  it('sem baseline de plano não emite (nem alerta, nem positivo)', () => {
    const trade = makeTrade({ qty: 8, planRoPct: null, planPl: null });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [stop('S1', 99750, 8, '2026-04-22T10:30:30Z')],
    });
    expect(events.filter(e => e.type === EVENT_TYPES.RISK_OVER_RO)).toHaveLength(0);
    expect(events.filter(e => e.type === EVENT_TYPES.SIZING_DISCIPLINE)).toHaveLength(0);
  });

  it('sem tickerRule não converte para R$ e não emite', () => {
    const trade = makeTrade({ qty: 8, tickerRule: null });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [stop('S1', 99750, 8, '2026-04-22T10:30:30Z')],
    });
    expect(events.filter(e => e.type === EVENT_TYPES.RISK_OVER_RO)).toHaveLength(0);
  });
});

// ============================================
// SIZING_DISCIPLINE (#357 — positivo)
// ============================================
describe('detectExecutionEvents — SIZING_DISCIPLINE', () => {
  const stop = (id, price, qty) => makeOrder({
    externalOrderId: id, isStopOrder: true, status: 'CANCELLED', stopPrice: price, quantity: qty,
  });
  const comDuasEntradas = (o = {}) => makeTrade({
    qty: 8, entry: '169829.38',
    _partials: [
      { type: 'ENTRY', qty: 5, price: 169760 },
      { type: 'ENTRY', qty: 3, price: 169945 },
      { type: 'EXIT', qty: 8, price: 170155 },
    ],
    ...o,
  });

  it('reconhece aumento de posição com risco dentro do RO', () => {
    const events = detectExecutionEvents({
      trades: [comDuasEntradas()],
      orders: [stop('S1', 169780, 5), stop('S2', 169700, 3)],
    });
    const good = events.filter(e => e.type === EVENT_TYPES.SIZING_DISCIPLINE);
    expect(good).toHaveLength(1);
    expect(good[0].severity).toBeNull();
    expect(good[0].evidence.entryCount).toBe(2);
    expect(good[0].evidence.riskAmount).toBe(127.01);
    expect(good[0].evidence.roAmount).toBe(252);
  });

  it('NÃO reconhece quando parte da posição está descoberta', () => {
    // Risco baixo por falta de stop não é disciplina.
    const events = detectExecutionEvents({
      trades: [comDuasEntradas()],
      orders: [stop('S1', 169780, 5)],   // só 5 de 8 cobertos
    });
    expect(events.filter(e => e.type === EVENT_TYPES.SIZING_DISCIPLINE)).toHaveLength(0);
  });

  it('NÃO reconhece sem aumento de posição (entrada única)', () => {
    const trade = comDuasEntradas({ _partials: [{ type: 'ENTRY', qty: 8, price: 169829.38 }] });
    const events = detectExecutionEvents({
      trades: [trade],
      orders: [stop('S1', 169780, 8)],
    });
    expect(events.filter(e => e.type === EVENT_TYPES.SIZING_DISCIPLINE)).toHaveLength(0);
  });
});

// ============================================
// UNPROTECTED_SIZE (#357 — substitui STOP_PARTIAL_SIZING)
// ============================================
describe('detectExecutionEvents — UNPROTECTED_SIZE', () => {
  it('detecta cobertura parcial: stop qty=1 com trade qty=2', () => {
    const trade = makeTrade({ qty: 2 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const un = events.filter(e => e.type === EVENT_TYPES.UNPROTECTED_SIZE);
    expect(un).toHaveLength(1);
    expect(un[0].severity).toBe(EVENT_SEVERITY.HIGH);
    expect(un[0].evidence.uncoveredQty).toBe(1);
    expect(un[0].evidence.ratio).toBe(0.5);
    expect(un[0].evidence.hasAnyStop).toBe(true);
  });

  it('detecta posição TOTALMENTE descoberta — o caso que o detector antigo deixava passar', () => {
    // O antigo saía em `if (!stops.length) return []`: zero stops = nenhum evento.
    // Era justamente o caso mais grave. Cenário de Marcio: entram 3 contratos sem stop.
    const trade = makeTrade({ qty: 8 });
    const orders = [
      makeOrder({ externalOrderId: 'E1', isStopOrder: false, quantity: 8, status: 'FILLED' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const un = events.filter(e => e.type === EVENT_TYPES.UNPROTECTED_SIZE);
    expect(un).toHaveLength(1);
    expect(un[0].evidence.uncoveredQty).toBe(8);
    expect(un[0].evidence.hasAnyStop).toBe(false);
    expect(un[0].evidence.ratio).toBe(0);
  });

  it('soma múltiplos stops parciais antes de decidir', () => {
    const trade = makeTrade({ qty: 5 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, quantity: 2, stopPrice: 99500 }),
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, quantity: 1, stopPrice: 99400 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const un = events.filter(e => e.type === EVENT_TYPES.UNPROTECTED_SIZE);
    expect(un).toHaveLength(1);
    expect(un[0].evidence.coveredQty).toBe(3);
    expect(un[0].evidence.uncoveredQty).toBe(2);
  });

  it('NÃO detecta quando a cobertura é completa', () => {
    const trade = makeTrade({ qty: 5 });
    const orders = [
      makeOrder({ externalOrderId: 'S1', isStopOrder: true, quantity: 5, stopPrice: 99500 }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.UNPROTECTED_SIZE)).toHaveLength(0);
  });

  it('sem ordens correlacionadas não afirma nada (resolução insuficiente)', () => {
    const trade = makeTrade({ qty: 5 });
    const events = detectExecutionEvents({ trades: [trade], orders: [] });
    expect(events.filter(e => e.type === EVENT_TYPES.UNPROTECTED_SIZE)).toHaveLength(0);
  });
});

// ============================================
// RAPID_REENTRY_POST_STOP
// ============================================
describe('detectExecutionEvents — RAPID_REENTRY_POST_STOP', () => {
  it('detecta reentrada <10min após exit em loss, mesmo side, mesmo instrument', () => {
    const t1 = makeTrade({ id: 'T1', side: 'SHORT', result: -100,
      entryTime: '2026-04-22T10:50:00Z', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT',
      entryTime: '2026-04-22T11:07:00Z', exitTime: '2026-04-22T11:15:00Z' });
    const events = detectExecutionEvents({ trades: [t1, t2], orders: [makeOrder()] });
    const rapid = events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP);
    expect(rapid).toHaveLength(1);
    expect(rapid[0].tradeId).toBe('T2');
    expect(rapid[0].evidence.prevTradeId).toBe('T1');
    expect(rapid[0].evidence.prevResult).toBe(-100);
    expect(rapid[0].evidence.gapMinutes).toBe(7);
    expect(rapid[0].severity).toBe(EVENT_SEVERITY.MEDIUM);
  });

  it('NÃO detecta quando gap >= 10min', () => {
    const t1 = makeTrade({ id: 'T1', result: -50, exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', entryTime: '2026-04-22T11:15:00Z' });
    const events = detectExecutionEvents({ trades: [t1, t2], orders: [makeOrder()] });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta quando trade prev fechou em lucro (result >= 0)', () => {
    const t1 = makeTrade({ id: 'T1', result: 100, exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', entryTime: '2026-04-22T11:05:00Z' });
    const events = detectExecutionEvents({ trades: [t1, t2], orders: [makeOrder()] });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta side diferente', () => {
    const t1 = makeTrade({ id: 'T1', side: 'LONG', result: -50, exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT', entryTime: '2026-04-22T11:05:00Z' });
    const events = detectExecutionEvents({ trades: [t1, t2], orders: [makeOrder()] });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });

  it('NÃO detecta instrument diferente', () => {
    const t1 = makeTrade({ id: 'T1', ticker: 'WINM26', result: -50, exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', ticker: 'WDOM26', entryTime: '2026-04-22T11:05:00Z' });
    const events = detectExecutionEvents({ trades: [t1, t2], orders: [makeOrder()] });
    expect(events.filter(e => e.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP)).toHaveLength(0);
  });
});

// ============================================
// HESITATION_PRE_ENTRY
// ============================================
describe('detectExecutionEvents — HESITATION_PRE_ENTRY', () => {
  it('detecta cancel mesmo side seguido de fill <30min', () => {
    const trade = makeTrade({ id: 'T2', side: 'SHORT',
      entryTime: '2026-04-22T10:55:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'SELL', status: 'CANCELLED',
        instrument: 'WINM26', correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T10:36:00Z',
        cancelledAt: '2026-04-22T10:36:30Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'SELL', status: 'FILLED',
        instrument: 'WINM26', correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T10:55:00Z',
        filledAt: '2026-04-22T10:55:01Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const hesit = events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY);
    expect(hesit).toHaveLength(1);
    expect(hesit[0].severity).toBe(EVENT_SEVERITY.LOW);
    expect(hesit[0].source).toBe('heuristic');
    expect(hesit[0].evidence.gapMinutes).toBeGreaterThan(18);
    expect(hesit[0].evidence.gapMinutes).toBeLessThan(20);
  });

  it('NÃO detecta quando gap >= 30min', () => {
    const trade = makeTrade({ id: 'T1', side: 'LONG',
      entryTime: '2026-04-22T11:30:00Z' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', status: 'CANCELLED',
        correlatedTradeId: 'T1', cancelledAt: '2026-04-22T10:50:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', status: 'FILLED',
        correlatedTradeId: 'T1', filledAt: '2026-04-22T11:30:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY)).toHaveLength(0);
  });

  it('NÃO detecta sem cancel correspondente', () => {
    const trade = makeTrade();
    const orders = [makeOrder({ externalOrderId: 'E1', status: 'FILLED' })];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.HESITATION_PRE_ENTRY)).toHaveLength(0);
  });
});

// ============================================
// CHASE_REENTRY
// ============================================
describe('detectExecutionEvents — CHASE_REENTRY', () => {
  it('detecta BUY com preço pior após cancel', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', type: 'LIMIT',
        status: 'CANCELLED', price: 100000,
        submittedAt: '2026-04-22T10:25:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', type: 'LIMIT',
        status: 'FILLED', price: 100050, filledPrice: 100050,
        submittedAt: '2026-04-22T10:30:00Z',
        filledAt: '2026-04-22T10:30:01Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    const chase = events.filter(e => e.type === EVENT_TYPES.CHASE_REENTRY);
    expect(chase).toHaveLength(1);
    expect(chase[0].evidence.prevPrice).toBe(100000);
    expect(chase[0].evidence.currPrice).toBe(100050);
    expect(chase[0].evidence.worseBy).toBe(50);
  });

  it('NÃO detecta quando preço melhorou (BUY mais barato)', () => {
    const trade = makeTrade({ side: 'LONG' });
    const orders = [
      makeOrder({ externalOrderId: 'C1', side: 'BUY', status: 'CANCELLED',
        price: 100050, submittedAt: '2026-04-22T10:25:00Z' }),
      makeOrder({ externalOrderId: 'E1', side: 'BUY', status: 'FILLED',
        price: 100000, filledPrice: 100000,
        submittedAt: '2026-04-22T10:30:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events.filter(e => e.type === EVENT_TYPES.CHASE_REENTRY)).toHaveLength(0);
  });
});

// ============================================
// FIXTURE SEM1 — INTEGRAÇÃO (3 eventos esperados)
// ============================================
describe('detectExecutionEvents — fixture SEM1 (integração)', () => {
  // Dataset real: 3 trades WINM26 em 20-22/04/2026.
  // T1 (LONG 20/04): stop qty=1 com entry qty=2 → STOP_PARTIAL_SIZING
  // T2 (SHORT 22/04): cancel 10:36 → entry 10:55 → HESITATION_PRE_ENTRY; result=-100
  // T3 (SHORT 22/04): T2 fechou em loss → T3 entry 11:07:52 (7min) → RAPID_REENTRY_POST_STOP
  const t1 = { id: 'T1', ticker: 'WINM26', side: 'LONG', qty: 2, result: 200,
    entryTime: '2026-04-20T10:00:00Z', exitTime: '2026-04-20T10:30:00Z' };
  const t2 = { id: 'T2', ticker: 'WINM26', side: 'SHORT', qty: 2, result: -100,
    entryTime: '2026-04-22T10:55:00Z', exitTime: '2026-04-22T11:00:52Z' };
  const t3 = { id: 'T3', ticker: 'WINM26', side: 'SHORT', qty: 2, result: 200,
    entryTime: '2026-04-22T11:07:52Z', exitTime: '2026-04-22T11:19:49Z' };

  const orders = [
    // T1 — entry qty=2 + stop qty=1 (partial sizing — protegeu metade)
    { externalOrderId: 'NLGC...111', instrument: 'WINM26', side: 'BUY',
      type: 'LIMIT', status: 'FILLED', quantity: 2, filledPrice: 200225,
      submittedAt: '2026-04-20T10:00:00Z', filledAt: '2026-04-20T10:00:01Z',
      isStopOrder: false, correlatedTradeId: 'T1' },
    { externalOrderId: 'NLGC...439492', instrument: 'WINM26', side: 'SELL',
      type: 'STOP', status: 'CANCELLED', quantity: 1, stopPrice: 200245,
      submittedAt: '2026-04-20T10:00:30Z', cancelledAt: '2026-04-20T10:30:00Z',
      isStopOrder: true, correlatedTradeId: 'T1' },
    // T2 — cancel 10:36 + entry 10:55 (HESITATION). Saída via ordem LIMITE
    // comum, NÃO ordem stop — refletindo dataset real onde aluno fechou em
    // loss manualmente, sem ter ordem stop colocada.
    { externalOrderId: 'NLGC...297106', instrument: 'WINM26', side: 'SELL',
      type: 'LIMIT', status: 'CANCELLED', quantity: 2, price: null,
      submittedAt: '2026-04-22T10:36:00Z', cancelledAt: '2026-04-22T10:36:30Z',
      isStopOrder: false, correlatedTradeId: 'T2' },
    { externalOrderId: 'NLGC...359605', instrument: 'WINM26', side: 'SELL',
      type: 'LIMIT', status: 'FILLED', quantity: 2, filledPrice: 198500,
      submittedAt: '2026-04-22T10:55:00Z', filledAt: '2026-04-22T10:55:01Z',
      isStopOrder: false, correlatedTradeId: 'T2' },
    { externalOrderId: 'NLGC...t2exit', instrument: 'WINM26', side: 'BUY',
      type: 'LIMIT', status: 'FILLED', quantity: 2, filledPrice: 198750,
      submittedAt: '2026-04-22T10:55:30Z', filledAt: '2026-04-22T11:00:52Z',
      isStopOrder: false, correlatedTradeId: 'T2' },
    // T3 — entry 11:07:52 (7min após exit em loss de T2)
    { externalOrderId: 'NLGC...t3entry', instrument: 'WINM26', side: 'SELL',
      type: 'LIMIT', status: 'FILLED', quantity: 2, filledPrice: 198370,
      submittedAt: '2026-04-22T11:07:52Z', filledAt: '2026-04-22T11:07:53Z',
      isStopOrder: false, correlatedTradeId: 'T3' },
  ];

  it('detecta exatamente 5 eventos esperados', () => {
    // #357 — eram 3. T2 e T3 passaram a emitir UNPROTECTED_SIZE: nenhum dos dois
    // tinha ordem de stop (T2 fechou em loss manualmente), e o detector antigo saía
    // em `if (!stops.length) return []` — posição totalmente descoberta não gerava
    // nada. Era o caso mais grave e o único não coberto.
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const types = events.map(e => e.type).sort();
    expect(types).toEqual([
      EVENT_TYPES.HESITATION_PRE_ENTRY,
      EVENT_TYPES.RAPID_REENTRY_POST_STOP,
      EVENT_TYPES.UNPROTECTED_SIZE,   // T1 — cobertura parcial (1 de 2)
      EVENT_TYPES.UNPROTECTED_SIZE,   // T2 — sem stop nenhum
      EVENT_TYPES.UNPROTECTED_SIZE,   // T3 — sem stop nenhum
    ].sort());
  });

  it('UNPROTECTED_SIZE aponta T1 com ratio 0.5', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.UNPROTECTED_SIZE && x.tradeId === 'T1');
    expect(e.evidence.ratio).toBe(0.5);
    expect(e.evidence.uncoveredQty).toBe(1);
  });

  it('HESITATION_PRE_ENTRY aponta T2 com gap ~19min', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.HESITATION_PRE_ENTRY);
    expect(e.tradeId).toBe('T2');
    expect(e.evidence.gapMinutes).toBeGreaterThan(18);
    expect(e.evidence.gapMinutes).toBeLessThan(20);
  });

  it('RAPID_REENTRY_POST_STOP aponta T3 com gap 7min', () => {
    const events = detectExecutionEvents({ trades: [t1, t2, t3], orders });
    const e = events.find(x => x.type === EVENT_TYPES.RAPID_REENTRY_POST_STOP);
    expect(e.tradeId).toBe('T3');
    expect(e.evidence.prevTradeId).toBe('T2');
    expect(e.evidence.gapMinutes).toBe(7);
  });
});

// ============================================
// EDGE CASES
// ============================================
describe('detectExecutionEvents — edge cases', () => {
  it('retorna [] com input vazio', () => {
    expect(detectExecutionEvents({ trades: [], orders: [] })).toEqual([]);
    expect(detectExecutionEvents({})).toEqual([]);
  });

  it('retorna [] quando orders não correlacionam com trades', () => {
    const trade = makeTrade({ id: 'T1' });
    const orders = [makeOrder({ correlatedTradeId: 'T999' })];
    const events = detectExecutionEvents({ trades: [trade], orders });
    expect(events).toEqual([]);
  });

  it('eventos retornam ordenados por timestamp', () => {
    const t1 = makeTrade({ id: 'T1', side: 'SHORT', result: -100,
      entryTime: '2026-04-22T10:50:00Z', exitTime: '2026-04-22T11:00:00Z' });
    const t2 = makeTrade({ id: 'T2', side: 'SHORT', qty: 2,
      entryTime: '2026-04-22T11:07:00Z', exitTime: '2026-04-22T11:15:00Z' });
    const orders = [
      // T1 — order qualquer (não precisa mais ser stop FILLED)
      makeOrder({ externalOrderId: 'X1', isStopOrder: false, status: 'FILLED',
        correlatedTradeId: 'T1', filledAt: '2026-04-22T11:00:00Z' }),
      // T2 partial sizing
      makeOrder({ externalOrderId: 'S2', isStopOrder: true, status: 'CANCELLED',
        quantity: 1, stopPrice: 99500, correlatedTradeId: 'T2',
        submittedAt: '2026-04-22T11:08:00Z' }),
    ];
    const events = detectExecutionEvents({ trades: [t1, t2], orders });
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      const ta = new Date(events[i - 1].timestamp).getTime();
      const tb = new Date(events[i].timestamp).getTime();
      expect(tb).toBeGreaterThanOrEqual(ta);
    }
  });
});
