/**
 * orderTradeCreation.test.js
 * @description Testes para Modo Criação (issue #93, V1.1a):
 *   - Identificação de operações ghost
 *   - Mapeamento operação → tradeData
 *   - Deduplicação (ticker + side + entryTime ±5min + qty)
 *   - Preparação de batch
 */

import { describe, it, expect } from 'vitest';
import {
  identifyGhostOperations,
  mapOperationToTradeData,
  checkDuplication,
  prepareBatchCreation,
} from '../../utils/orderTradeCreation';

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
  duration: '30min',
  durationMs: 1800000,
  hasStopProtection: false,
  stopExecuted: false,
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
  tradeId: null,
  confidence: 0,
  matchType: 'ghost',
  details: 'Nenhum trade encontrado',
  ...overrides,
});

const makeTrade = (overrides = {}) => ({
  id: 'trade-001',
  ticker: 'WINJ26',
  side: 'LONG',
  qty: 2,
  entry: 130000,
  exit: 130050,
  entryTime: '2026-04-04T10:00:00',
  exitTime: '2026-04-04T10:30:00',
  date: '2026-04-04',
  ...overrides,
});

// ============================================
// identifyGhostOperations
// ============================================

describe('identifyGhostOperations', () => {
  it('retorna operações cujas ordens são todas ghost', () => {
    const ops = [makeOperation()];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001', instrument: 'WINJ26' }),
      makeCorrelation({ externalOrderId: 'ORD-002', instrument: 'WINJ26', orderIndex: 1 }),
    ];

    const ghosts = identifyGhostOperations(ops, correlations);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].operationId).toBe('OP-001');
  });

  it('ignora operações abertas (_isOpen)', () => {
    const ops = [makeOperation({ _isOpen: true })];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001' }),
      makeCorrelation({ externalOrderId: 'ORD-002' }),
    ];

    const ghosts = identifyGhostOperations(ops, correlations);
    expect(ghosts).toHaveLength(0);
  });

  it('ignora operações sem ordens de saída', () => {
    const ops = [makeOperation({ exitOrders: [] })];
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001' }),
    ];

    const ghosts = identifyGhostOperations(ops, correlations);
    expect(ghosts).toHaveLength(0);
  });

  it('retorna vazio quando não há correlações ghost', () => {
    const ops = [makeOperation()];
    const correlations = [
      makeCorrelation({ matchType: 'exact', tradeId: 'trade-001', confidence: 0.95 }),
    ];

    const ghosts = identifyGhostOperations(ops, correlations);
    expect(ghosts).toHaveLength(0);
  });

  it('retorna vazio com inputs vazios', () => {
    expect(identifyGhostOperations([], [])).toEqual([]);
    expect(identifyGhostOperations(null, null)).toEqual([]);
    expect(identifyGhostOperations(undefined, undefined)).toEqual([]);
  });

  it('filtra múltiplas operações — só retorna as ghost', () => {
    const ops = [
      makeOperation({ operationId: 'OP-001' }),
      makeOperation({
        operationId: 'OP-002',
        instrument: 'WDOJ26',
        entryOrders: [{ instrument: 'WDOJ26', filledPrice: 5000, filledQuantity: 1, filledAt: '2026-04-04T11:00:00', externalOrderId: 'ORD-003' }],
        exitOrders: [{ instrument: 'WDOJ26', filledPrice: 5010, filledQuantity: 1, filledAt: '2026-04-04T11:30:00', externalOrderId: 'ORD-004' }],
      }),
    ];

    // Apenas OP-001 é ghost, OP-002 tem match
    const correlations = [
      makeCorrelation({ externalOrderId: 'ORD-001', instrument: 'WINJ26' }),
      makeCorrelation({ externalOrderId: 'ORD-002', instrument: 'WINJ26' }),
      makeCorrelation({ externalOrderId: 'ORD-003', instrument: 'WDOJ26', matchType: 'exact', tradeId: 'trade-002' }),
      makeCorrelation({ externalOrderId: 'ORD-004', instrument: 'WDOJ26', matchType: 'exact', tradeId: 'trade-002' }),
    ];

    const ghosts = identifyGhostOperations(ops, correlations);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].operationId).toBe('OP-001');
  });
});

// ============================================
// mapOperationToTradeData
// ============================================

describe('mapOperationToTradeData', () => {
  it('mapeia operação para tradeData com campos corretos', () => {
    const op = makeOperation();
    const data = mapOperationToTradeData(op, 'plan-001', 'batch-001');

    expect(data.planId).toBe('plan-001');
    expect(data.ticker).toBe('WINJ26');
    expect(data.side).toBe('LONG');
    expect(data.entry).toBe('130000');
    expect(data.exit).toBe('130050');
    expect(data.qty).toBe('2');
    expect(data.entryTime).toBe('2026-04-04T10:00:00');
    expect(data.exitTime).toBe('2026-04-04T10:30:00');
    expect(data.source).toBe('order_import');
    expect(data.importSource).toBe('order_import');
    expect(data.importBatchId).toBe('batch-001');
    expect(data.operationId).toBe('OP-001');
  });

  it('campos comportamentais são null (aluno complementa)', () => {
    const data = mapOperationToTradeData(makeOperation(), 'plan-001');
    expect(data.emotionEntry).toBeNull();
    expect(data.emotionExit).toBeNull();
    expect(data.setup).toBeNull();
  });

  it('constrói _partials a partir de entryOrders e exitOrders (INV-12)', () => {
    const op = makeOperation({
      entryOrders: [
        { filledPrice: 130000, filledQuantity: 1, filledAt: '2026-04-04T10:00:00' },
        { filledPrice: 130010, filledQuantity: 1, filledAt: '2026-04-04T10:01:00' },
      ],
      exitOrders: [
        { filledPrice: 130050, filledQuantity: 2, filledAt: '2026-04-04T10:30:00' },
      ],
    });

    const data = mapOperationToTradeData(op, 'plan-001');

    expect(data._partials).toHaveLength(3);
    expect(data._partials[0]).toEqual({ type: 'ENTRY', price: 130000, qty: 1, dateTime: '2026-04-04T10:00:00', seq: 1 });
    expect(data._partials[1]).toEqual({ type: 'ENTRY', price: 130010, qty: 1, dateTime: '2026-04-04T10:01:00', seq: 2 });
    expect(data._partials[2]).toEqual({ type: 'EXIT', price: 130050, qty: 2, dateTime: '2026-04-04T10:30:00', seq: 3 });
  });

  it('extrai stopLoss do último stop order', () => {
    const op = makeOperation({
      hasStopProtection: true,
      stopOrders: [
        { stopPrice: 129950, price: 129950 },
        { stopPrice: 129970, price: 129970 },
      ],
    });

    const data = mapOperationToTradeData(op, 'plan-001');
    expect(data.stopLoss).toBe(129970);
  });

  it('stopLoss null quando não há stop protection', () => {
    const data = mapOperationToTradeData(makeOperation(), 'plan-001');
    expect(data.stopLoss).toBeNull();
  });

  it('rejeita sem planId', () => {
    expect(() => mapOperationToTradeData(makeOperation(), null)).toThrow('obrigatórios');
  });

  it('rejeita sem operation', () => {
    expect(() => mapOperationToTradeData(null, 'plan-001')).toThrow('obrigatórios');
  });

  it('operação SHORT mapeia corretamente', () => {
    const op = makeOperation({
      side: 'SHORT',
      avgEntryPrice: 130050,
      avgExitPrice: 130000,
    });

    const data = mapOperationToTradeData(op, 'plan-001');
    expect(data.side).toBe('SHORT');
    expect(data.entry).toBe('130050');
    expect(data.exit).toBe('130000');
  });
});

// ============================================
// checkDuplication
// ============================================

describe('checkDuplication', () => {
  it('detecta duplicata: mesmo ticker + side + qty + entryTime dentro de 5min', () => {
    const tradeData = {
      ticker: 'WINJ26',
      side: 'LONG',
      qty: '2',
      entryTime: '2026-04-04T10:02:00', // 2min de diferença
    };

    const existing = [makeTrade()];
    const result = checkDuplication(tradeData, existing);

    expect(result.isDuplicate).toBe(true);
    expect(result.matchedTradeId).toBe('trade-001');
  });

  it('não detecta duplicata quando entryTime > 5min de diferença', () => {
    const tradeData = {
      ticker: 'WINJ26',
      side: 'LONG',
      qty: '2',
      entryTime: '2026-04-04T10:06:00', // 6min de diferença
    };

    const result = checkDuplication(tradeData, [makeTrade()]);
    expect(result.isDuplicate).toBe(false);
  });

  it('não detecta duplicata com ticker diferente', () => {
    const tradeData = {
      ticker: 'WDOJ26',
      side: 'LONG',
      qty: '2',
      entryTime: '2026-04-04T10:00:00',
    };

    const result = checkDuplication(tradeData, [makeTrade()]);
    expect(result.isDuplicate).toBe(false);
  });

  it('não detecta duplicata com side diferente', () => {
    const tradeData = {
      ticker: 'WINJ26',
      side: 'SHORT',
      qty: '2',
      entryTime: '2026-04-04T10:00:00',
    };

    const result = checkDuplication(tradeData, [makeTrade()]);
    expect(result.isDuplicate).toBe(false);
  });

  it('não detecta duplicata com qty diferente', () => {
    const tradeData = {
      ticker: 'WINJ26',
      side: 'LONG',
      qty: '5',
      entryTime: '2026-04-04T10:00:00',
    };

    const result = checkDuplication(tradeData, [makeTrade()]);
    expect(result.isDuplicate).toBe(false);
  });

  it('detecta duplicata por data quando trade não tem hora', () => {
    const tradeData = {
      ticker: 'WINJ26',
      side: 'LONG',
      qty: '2',
      entryTime: '2026-04-04T10:00:00',
    };

    const existing = [makeTrade({ entryTime: null, date: '2026-04-04' })];
    const result = checkDuplication(tradeData, existing);

    expect(result.isDuplicate).toBe(true);
  });

  it('retorna false quando não há trades existentes', () => {
    const tradeData = { ticker: 'WINJ26', side: 'LONG', qty: '2', entryTime: '2026-04-04T10:00:00' };
    const result = checkDuplication(tradeData, []);
    expect(result.isDuplicate).toBe(false);
  });

  it('retorna false com existingTrades null', () => {
    const tradeData = { ticker: 'WINJ26', side: 'LONG', qty: '2', entryTime: '2026-04-04T10:00:00' };
    const result = checkDuplication(tradeData, null);
    expect(result.isDuplicate).toBe(false);
  });
});

// ============================================
// prepareBatchCreation
// ============================================

describe('prepareBatchCreation', () => {
  it('separa operações em toCreate e duplicates', () => {
    const ghostOps = [
      makeOperation({ operationId: 'OP-001' }),
      makeOperation({
        operationId: 'OP-002',
        instrument: 'WDOJ26',
        avgEntryPrice: 5000,
        avgExitPrice: 5010,
        entryTime: '2026-04-04T11:00:00',
        exitTime: '2026-04-04T11:30:00',
        entryOrders: [{ filledPrice: 5000, filledQuantity: 1, filledAt: '2026-04-04T11:00:00' }],
        exitOrders: [{ filledPrice: 5010, filledQuantity: 1, filledAt: '2026-04-04T11:30:00' }],
      }),
    ];

    // OP-001 tem duplicata, OP-002 não
    const existingTrades = [makeTrade()];
    const result = prepareBatchCreation(ghostOps, 'plan-001', existingTrades, 'batch-001');

    expect(result.toCreate).toHaveLength(1);
    expect(result.toCreate[0].tradeData.ticker).toBe('WDOJ26');

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].operation.operationId).toBe('OP-001');
    expect(result.duplicates[0].matchedTradeId).toBe('trade-001');

    expect(result.errors).toHaveLength(0);
  });

  it('todas operações criáveis quando não há trades existentes', () => {
    const ghostOps = [makeOperation()];
    const result = prepareBatchCreation(ghostOps, 'plan-001', []);

    expect(result.toCreate).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
  });

  it('seta importBatchId em todos os tradeData', () => {
    const ghostOps = [makeOperation()];
    const result = prepareBatchCreation(ghostOps, 'plan-001', [], 'batch-xyz');

    expect(result.toCreate[0].tradeData.importBatchId).toBe('batch-xyz');
  });

  it('tradeData tem source: order_import', () => {
    const ghostOps = [makeOperation()];
    const result = prepareBatchCreation(ghostOps, 'plan-001', []);

    expect(result.toCreate[0].tradeData.source).toBe('order_import');
    expect(result.toCreate[0].tradeData.importSource).toBe('order_import');
  });
});
