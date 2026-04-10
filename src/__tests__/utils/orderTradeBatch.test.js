/**
 * orderTradeBatch.test.js
 * @description Testes do helper de criação automática de trades em batch
 *   (issue #93 redesign V1.1a). Mock de createTrade injetado via createTradeFn.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTradesBatch } from '../../utils/orderTradeBatch';

// ============================================
// FIXTURES
// ============================================

const makeOp = (id, overrides = {}) => ({
  operationId: id,
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
    { _rowIndex: 1, instrument: 'WINJ26', filledPrice: 130000, filledQuantity: 2, filledAt: '2026-04-04T10:00:00' },
  ],
  exitOrders: [
    { _rowIndex: 2, instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2, filledAt: '2026-04-04T10:30:00' },
  ],
  ...overrides,
});

const makeUser = () => ({ uid: 'user-001', email: 'aluno@test.com', displayName: 'Aluno Teste' });

const makeFakeTrade = (id, result = 100) => ({ id, result });

/** Mock de createTrade que sempre resolve com fake trade incremental */
const mockCreateOk = () => {
  let counter = 0;
  return vi.fn(async () => {
    counter++;
    return makeFakeTrade(`trade-mock-${counter}`, counter * 50);
  });
};

/** Mock de createTrade que rejeita */
const mockCreateFail = (errorMsg = 'Firestore offline') =>
  vi.fn(async () => { throw new Error(errorMsg); });

// ============================================
// inputs vazios / inválidos
// ============================================

describe('createTradesBatch — inputs vazios', () => {
  it('toCreate vazio → 3 arrays vazios', async () => {
    const result = await createTradesBatch({
      toCreate: [],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: mockCreateOk(),
    });
    expect(result).toEqual({ created: [], duplicates: [], failed: [] });
  });

  it('toCreate undefined → 3 arrays vazios', async () => {
    const result = await createTradesBatch({
      toCreate: undefined,
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: mockCreateOk(),
    });
    expect(result).toEqual({ created: [], duplicates: [], failed: [] });
  });

  it('userContext sem uid → todas as ops em failed', async () => {
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002')],
      planId: 'plan-001',
      userContext: { email: 'sem-uid@test.com' },
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBe('Usuário não autenticado');
    expect(fn).not.toHaveBeenCalled();
  });
});

// ============================================
// caminho paralelo (≤ threshold)
// ============================================

describe('createTradesBatch — paralelo (batch ≤ threshold)', () => {
  it('cria 1 trade sem duplicata → vai para created', async () => {
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      importBatchId: 'batch-XYZ',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(1);
    expect(result.created[0].id).toBe('trade-mock-1');
    expect(result.created[0].ticker).toBe('WINJ26');
    expect(result.created[0].operationId).toBe('OP-001');
    expect(result.created[0].result).toBe(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('chama createTradeFn em paralelo via Promise.allSettled (3 ops)', async () => {
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002'), makeOp('OP-003')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('1 trade falha → outros continuam (created + failed coexistem)', async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call === 2) throw new Error('Plano inválido');
      return makeFakeTrade(`trade-mock-${call}`);
    });
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002'), makeOp('OP-003')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('Plano inválido');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('todos falham → batch retorna todos em failed sem abortar', async () => {
    const fn = mockCreateFail('Firestore offline');
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed.every(f => f.error === 'Firestore offline')).toBe(true);
  });
});

// ============================================
// deduplicação
// ============================================

describe('createTradesBatch — deduplicação', () => {
  it('op duplicada → vai para duplicates, não chama createTrade', async () => {
    const existingTrade = {
      id: 'trade-existing',
      ticker: 'WINJ26',
      side: 'LONG',
      qty: 2,
      entryTime: '2026-04-04T10:00:00',
      exitTime: '2026-04-04T10:30:00',
      date: '2026-04-04',
    };
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      existingTrades: [existingTrade],
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].operationId).toBe('OP-001');
    expect(result.duplicates[0].matchedTradeId).toBe('trade-existing');
    expect(fn).not.toHaveBeenCalled();
  });

  it('mix duplicata + criação → particiona corretamente', async () => {
    const existingTrade = {
      id: 'trade-existing',
      ticker: 'WINJ26',
      side: 'LONG',
      qty: 2,
      entryTime: '2026-04-04T10:00:00',
      exitTime: '2026-04-04T10:30:00',
      date: '2026-04-04',
    };
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [
        makeOp('OP-DUP'),  // duplicata
        makeOp('OP-NEW', {
          instrument: 'WDOJ26',
          avgEntryPrice: 5000,
          avgExitPrice: 5010,
          entryTime: '2026-04-04T11:00:00',
          exitTime: '2026-04-04T11:30:00',
          entryOrders: [{ _rowIndex: 3, instrument: 'WDOJ26', filledPrice: 5000, filledQuantity: 1, filledAt: '2026-04-04T11:00:00' }],
          exitOrders: [{ _rowIndex: 4, instrument: 'WDOJ26', filledPrice: 5010, filledQuantity: 1, filledAt: '2026-04-04T11:30:00' }],
        }),
      ],
      planId: 'plan-001',
      existingTrades: [existingTrade],
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(1);
    expect(result.created[0].ticker).toBe('WDOJ26');
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].ticker).toBe('WINJ26');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// caminho sequencial (> threshold)
// ============================================

describe('createTradesBatch — sequencial (batch > threshold)', () => {
  it('threshold custom 2: 3 ops → caminho sequencial, progresso por trade', async () => {
    const fn = mockCreateOk();
    const progressCalls = [];
    const onProgress = vi.fn((cur, tot, msg) => progressCalls.push({ cur, tot, msg }));

    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002'), makeOp('OP-003')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
      onProgress,
      threshold: 2,
    });

    expect(result.created).toHaveLength(3);
    // Sequencial chama onProgress N vezes (current incremental)
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(progressCalls[0]).toEqual({ cur: 1, tot: 3, msg: 'Criando trade 1 de 3...' });
    expect(progressCalls[1]).toEqual({ cur: 2, tot: 3, msg: 'Criando trade 2 de 3...' });
    expect(progressCalls[2]).toEqual({ cur: 3, tot: 3, msg: 'Criando trade 3 de 3...' });
  });

  it('sequencial: falha em meio do batch → outras continuam', async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call === 2) throw new Error('Erro no trade 2');
      return makeFakeTrade(`trade-mock-${call}`);
    });
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002'), makeOp('OP-003')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
      threshold: 1,
    });
    expect(result.created).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('Erro no trade 2');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ============================================
// onProgress no caminho paralelo
// ============================================

describe('createTradesBatch — onProgress', () => {
  it('paralelo: chama onProgress 1 vez com (0, total, msg)', async () => {
    const fn = mockCreateOk();
    const onProgress = vi.fn();
    await createTradesBatch({
      toCreate: [makeOp('OP-001'), makeOp('OP-002')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(0, 2, 'Criando 2 trades...');
  });

  it('paralelo singular: msg sem plural', async () => {
    const fn = mockCreateOk();
    const onProgress = vi.fn();
    await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledWith(0, 1, 'Criando 1 trade...');
  });
});

// ============================================
// propagação de campos
// ============================================

describe('createTradesBatch — propagação de campos', () => {
  it('lowResolution: true propagado para tradeData', async () => {
    const fn = vi.fn(async (tradeData) => {
      expect(tradeData.lowResolution).toBe(true);
      return makeFakeTrade('trade-mock-1');
    });
    await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
      lowResolution: true,
    });
    expect(fn).toHaveBeenCalled();
  });

  it('lowResolution default false propagado', async () => {
    const fn = vi.fn(async (tradeData) => {
      expect(tradeData.lowResolution).toBe(false);
      return makeFakeTrade('trade-mock-1');
    });
    await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(fn).toHaveBeenCalled();
  });

  it('tickerRuleMap resolvido por instrument', async () => {
    const tickerRuleMap = {
      WINJ26: { tickSize: 5, tickValue: 1, pointValue: 0.2 },
    };
    const fn = vi.fn(async (tradeData) => {
      expect(tradeData.tickerRule).toEqual({ tickSize: 5, tickValue: 1, pointValue: 0.2 });
      return makeFakeTrade('trade-mock-1');
    });
    await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      tickerRuleMap,
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(fn).toHaveBeenCalled();
  });

  it('importBatchId propagado', async () => {
    const fn = vi.fn(async (tradeData) => {
      expect(tradeData.importBatchId).toBe('batch-XYZ');
      expect(tradeData.source).toBe('order_import');
      return makeFakeTrade('trade-mock-1');
    });
    await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: 'plan-001',
      importBatchId: 'batch-XYZ',
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(fn).toHaveBeenCalled();
  });
});

// ============================================
// erros de mapeamento
// ============================================

describe('createTradesBatch — erros de mapeamento', () => {
  it('op sem planId implícito → falha em mapOperationToTradeData → vai para failed sem chamar createTrade', async () => {
    const fn = mockCreateOk();
    const result = await createTradesBatch({
      toCreate: [makeOp('OP-001')],
      planId: null, // mapOperationToTradeData lança 'obrigatórios'
      userContext: makeUser(),
      createTradeFn: fn,
    });
    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toMatch(/obrigatórios/);
    expect(fn).not.toHaveBeenCalled();
  });
});
