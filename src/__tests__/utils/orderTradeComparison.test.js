/**
 * orderTradeComparison.test.js
 * @description Testes para Modo Confronto (issue #93, V1.1b):
 *   - Identificação de operações com trade correspondente
 *   - Detecção de divergências (HIGH/MEDIUM/LOW)
 *   - Preparação do batch de confronto
 */

import { describe, it, expect } from 'vitest';
import {
  identifyMatchedOperations,
  compareOperationWithTrade,
  prepareConfrontBatch,
  DIVERGENCE_SEVERITY,
  DIVERGENCE_FIELD,
} from '../../utils/orderTradeComparison';

// ============================================
// FIXTURES
// ============================================

const makeOperation = (overrides = {}) => ({
  operationId: 'OP-001',
  instrument: 'WINJ26',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 130000,
  avgExitPrice: 130050,
  resultPoints: 50,
  entryTime: '2026-04-04T10:00:00',
  exitTime: '2026-04-04T10:30:00',
  hasStopProtection: false,
  stopOrders: [],
  cancelledOrders: [],
  _isOpen: false,
  entryOrders: [
    { instrument: 'WINJ26', filledPrice: 130000, filledQuantity: 2, filledAt: '2026-04-04T10:00:00', externalOrderId: 'ORD-001' },
  ],
  exitOrders: [
    { instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2, filledAt: '2026-04-04T10:30:00', externalOrderId: 'ORD-002' },
  ],
  ...overrides,
});

const makeCorrelation = (overrides = {}) => ({
  orderIndex: 0,
  externalOrderId: 'ORD-001',
  instrument: 'WINJ26',
  tradeId: 'trade-001',
  confidence: 0.95,
  matchType: 'exact',
  details: 'Match exato',
  ...overrides,
});

const makeTrade = (overrides = {}) => ({
  id: 'trade-001',
  ticker: 'WINJ26',
  side: 'LONG',
  qty: 2,
  entry: 130000,
  exit: 130050,
  stopLoss: null,
  entryTime: '2026-04-04T10:00:00',
  exitTime: '2026-04-04T10:30:00',
  date: '2026-04-04',
  _partials: [
    { type: 'ENTRY', price: 130000, qty: 2, dateTime: '2026-04-04T10:00:00', seq: 1 },
    { type: 'EXIT', price: 130050, qty: 2, dateTime: '2026-04-04T10:30:00', seq: 2 },
  ],
  ...overrides,
});

// ============================================
// identifyMatchedOperations
// ============================================

describe('identifyMatchedOperations', () => {
  it('retorna operações cujas ordens correlacionam com trade existente', () => {
    const ops = [makeOperation()];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001', tradeId: 'trade-001' }),
      makeCorrelation({ externalOrderId: 'ORD-002', tradeId: 'trade-001' }),
    ];
    const trades = [makeTrade()];

    const matched = identifyMatchedOperations(ops, correlations, trades);
    expect(matched).toHaveLength(1);
    expect(matched[0].operation.operationId).toBe('OP-001');
    expect(matched[0].trade.id).toBe('trade-001');
  });

  it('ignora operações abertas (_isOpen)', () => {
    const ops = [makeOperation({ _isOpen: true })];
    const correlations = [makeCorrelation()];
    const trades = [makeTrade()];

    const matched = identifyMatchedOperations(ops, correlations, trades);
    expect(matched).toHaveLength(0);
  });

  it('ignora correlações ghost', () => {
    const ops = [makeOperation()];
    const correlations = [
      makeCorrelation({ matchType: 'ghost', tradeId: null, confidence: 0 }),
    ];
    const trades = [makeTrade()];

    const matched = identifyMatchedOperations(ops, correlations, trades);
    expect(matched).toHaveLength(0);
  });

  it('retorna vazio quando operação matcha com múltiplos trades (ambíguo)', () => {
    const ops = [makeOperation()];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001', tradeId: 'trade-001' }),
      makeCorrelation({ externalOrderId: 'ORD-002', tradeId: 'trade-002' }),
    ];
    const trades = [
      makeTrade({ id: 'trade-001' }),
      makeTrade({ id: 'trade-002' }),
    ];

    const matched = identifyMatchedOperations(ops, correlations, trades);
    expect(matched).toHaveLength(0);
  });

  it('retorna vazio com inputs vazios', () => {
    expect(identifyMatchedOperations([], [], [])).toEqual([]);
    expect(identifyMatchedOperations(null, null, null)).toEqual([]);
  });
});

// ============================================
// compareOperationWithTrade
// ============================================

describe('compareOperationWithTrade', () => {
  it('sem divergências quando todos os campos batem', () => {
    const comparison = compareOperationWithTrade(makeOperation(), makeTrade());
    expect(comparison.hasDivergences).toBe(false);
    expect(comparison.divergences).toHaveLength(0);
    expect(comparison.maxSeverity).toBeNull();
  });

  it('detecta divergência em preço de entrada (HIGH)', () => {
    const op = makeOperation({ avgEntryPrice: 130025 });
    const trade = makeTrade({ entry: 130000 });
    const comparison = compareOperationWithTrade(op, trade);

    expect(comparison.hasDivergences).toBe(true);
    const entryDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.ENTRY);
    expect(entryDiv).toBeDefined();
    expect(entryDiv.severity).toBe(DIVERGENCE_SEVERITY.HIGH);
    expect(entryDiv.operationValue).toBe(130025);
    expect(entryDiv.tradeValue).toBe(130000);
    expect(entryDiv.delta).toBe(25);
    expect(comparison.maxSeverity).toBe(DIVERGENCE_SEVERITY.HIGH);
  });

  it('detecta divergência em preço de saída (HIGH)', () => {
    const op = makeOperation({ avgExitPrice: 130100 });
    const trade = makeTrade({ exit: 130050 });
    const comparison = compareOperationWithTrade(op, trade);

    const exitDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.EXIT);
    expect(exitDiv.severity).toBe(DIVERGENCE_SEVERITY.HIGH);
    expect(exitDiv.delta).toBe(50);
  });

  it('detecta divergência em qty (HIGH)', () => {
    const op = makeOperation({ totalQty: 3 });
    const trade = makeTrade({ qty: 2 });
    const comparison = compareOperationWithTrade(op, trade);

    const qtyDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.QTY);
    expect(qtyDiv.severity).toBe(DIVERGENCE_SEVERITY.HIGH);
    expect(qtyDiv.delta).toBe(1);
  });

  it('detecta divergência em side (HIGH)', () => {
    const op = makeOperation({ side: 'SHORT' });
    const trade = makeTrade({ side: 'LONG' });
    const comparison = compareOperationWithTrade(op, trade);

    const sideDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.SIDE);
    expect(sideDiv.severity).toBe(DIVERGENCE_SEVERITY.HIGH);
  });

  it('detecta stop ausente no diário (MEDIUM)', () => {
    const op = makeOperation({
      hasStopProtection: true,
      stopOrders: [{ stopPrice: 129950 }],
    });
    const trade = makeTrade({ stopLoss: null });
    const comparison = compareOperationWithTrade(op, trade);

    const stopDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.STOP_LOSS);
    expect(stopDiv.severity).toBe(DIVERGENCE_SEVERITY.MEDIUM);
    expect(stopDiv.operationValue).toBe(129950);
    expect(stopDiv.tradeValue).toBeNull();
  });

  it('detecta stop com valor diferente (MEDIUM)', () => {
    const op = makeOperation({
      hasStopProtection: true,
      stopOrders: [{ stopPrice: 129950 }],
    });
    const trade = makeTrade({ stopLoss: 129900 });
    const comparison = compareOperationWithTrade(op, trade);

    const stopDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.STOP_LOSS);
    expect(stopDiv.severity).toBe(DIVERGENCE_SEVERITY.MEDIUM);
    expect(stopDiv.delta).toBe(50);
  });

  it('detecta contagem diferente de parciais (MEDIUM)', () => {
    const op = makeOperation({
      entryOrders: [
        { instrument: 'WINJ26', filledPrice: 130000, filledQuantity: 1 },
        { instrument: 'WINJ26', filledPrice: 130010, filledQuantity: 1 },
      ],
      exitOrders: [
        { instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2 },
      ],
    });
    const trade = makeTrade(); // 2 parciais no trade, 3 na operação
    const comparison = compareOperationWithTrade(op, trade);

    const partialsDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.PARTIALS_COUNT);
    expect(partialsDiv.severity).toBe(DIVERGENCE_SEVERITY.MEDIUM);
    expect(partialsDiv.operationValue).toBe(3);
    expect(partialsDiv.tradeValue).toBe(2);
  });

  it('detecta divergência de horário (LOW) fora da janela', () => {
    const op = makeOperation({ entryTime: '2026-04-04T10:10:00' }); // 10min de diferença
    const trade = makeTrade({ entryTime: '2026-04-04T10:00:00' });
    const comparison = compareOperationWithTrade(op, trade);

    const timeDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.ENTRY_TIME);
    expect(timeDiv.severity).toBe(DIVERGENCE_SEVERITY.LOW);
    expect(timeDiv.deltaMinutes).toBe(10);
  });

  it('ignora divergência de horário dentro da janela (±5min)', () => {
    const op = makeOperation({ entryTime: '2026-04-04T10:03:00' }); // 3min — dentro da janela
    const trade = makeTrade({ entryTime: '2026-04-04T10:00:00' });
    const comparison = compareOperationWithTrade(op, trade);

    const timeDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.ENTRY_TIME);
    expect(timeDiv).toBeUndefined();
  });

  it('maxSeverity prioriza HIGH sobre MEDIUM e LOW', () => {
    const op = makeOperation({
      avgEntryPrice: 130025, // HIGH
      hasStopProtection: true,
      stopOrders: [{ stopPrice: 129950 }], // MEDIUM (trade tem stopLoss null)
      entryTime: '2026-04-04T10:10:00', // LOW
    });
    const trade = makeTrade();
    const comparison = compareOperationWithTrade(op, trade);

    expect(comparison.maxSeverity).toBe(DIVERGENCE_SEVERITY.HIGH);
    expect(comparison.divergences.length).toBeGreaterThanOrEqual(3);
  });

  it('ignora diferença de preço dentro da tolerância (±0.01)', () => {
    const op = makeOperation({ avgEntryPrice: 130000.005 });
    const trade = makeTrade({ entry: 130000 });
    const comparison = compareOperationWithTrade(op, trade);

    const entryDiv = comparison.divergences.find(d => d.field === DIVERGENCE_FIELD.ENTRY);
    expect(entryDiv).toBeUndefined();
  });
});

// ============================================
// prepareConfrontBatch
// ============================================

describe('prepareConfrontBatch', () => {
  it('separa operações divergentes e convergentes', () => {
    const ops = [
      makeOperation({ operationId: 'OP-001' }), // convergente (bate com trade-001)
      makeOperation({
        operationId: 'OP-002',
        avgEntryPrice: 130099, // divergente
        entryOrders: [{ instrument: 'WINJ26', filledPrice: 130099, filledQuantity: 2, externalOrderId: 'ORD-003' }],
        exitOrders: [{ instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2, externalOrderId: 'ORD-004' }],
      }),
    ];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001', tradeId: 'trade-001' }),
      makeCorrelation({ externalOrderId: 'ORD-002', tradeId: 'trade-001' }),
      makeCorrelation({ externalOrderId: 'ORD-003', tradeId: 'trade-002' }),
      makeCorrelation({ externalOrderId: 'ORD-004', tradeId: 'trade-002' }),
    ];
    const trades = [
      makeTrade({ id: 'trade-001' }),
      makeTrade({ id: 'trade-002' }),
    ];

    const result = prepareConfrontBatch(ops, correlations, trades);

    expect(result.divergent).toHaveLength(1);
    expect(result.divergent[0].operation.operationId).toBe('OP-002');
    expect(result.divergent[0].comparison.hasDivergences).toBe(true);

    expect(result.converged).toHaveLength(1);
    expect(result.converged[0].operation.operationId).toBe('OP-001');
  });

  it('retorna vazios quando não há matched operations', () => {
    const ops = [makeOperation()];
    const correlations = [makeCorrelation({ matchType: 'ghost', tradeId: null })];
    const trades = [makeTrade()];

    const result = prepareConfrontBatch(ops, correlations, trades);
    expect(result.divergent).toHaveLength(0);
    expect(result.converged).toHaveLength(0);
  });
});
