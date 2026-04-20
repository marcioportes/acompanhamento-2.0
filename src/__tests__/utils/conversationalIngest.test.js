/**
 * conversationalIngest.test.js
 * @description Testes do helper puro de roteamento conversacional (Fase E #156).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  routeConversationalDecisions,
  buildEnrichmentPayload,
  enrichConversationalBatch,
  orderMatchFingerprint,
  operationOrderFingerprints,
} from '../../utils/conversationalIngest';
import { CLASSIFICATION } from '../../utils/orderTradeCreation';

// ============================================
// FIXTURES
// ============================================

const makeOp = (overrides = {}) => ({
  operationId: 'op-1',
  instrument: 'MNQH6',
  side: 'LONG',
  totalQty: 2,
  avgEntryPrice: 24900,
  avgExitPrice: 24950,
  entryTime: '2026-02-12T14:41:30',
  exitTime: '2026-02-12T15:02:00',
  entryOrders: [
    { filledPrice: 24900, filledQuantity: 2, filledAt: '2026-02-12T14:41:30', instrument: 'MNQH6', side: 'BUY' },
  ],
  exitOrders: [
    { filledPrice: 24950, filledQuantity: 2, filledAt: '2026-02-12T15:02:00', instrument: 'MNQH6', side: 'SELL' },
  ],
  hasStopProtection: false,
  stopOrders: [],
  ...overrides,
});

const makeItem = (overrides = {}) => ({
  operation: makeOp(),
  classification: CLASSIFICATION.NEW,
  matchCandidates: [],
  userDecision: 'pending',
  ...overrides,
});

// ============================================
// routeConversationalDecisions
// ============================================

describe('routeConversationalDecisions', () => {
  it('fila vazia ou inválida → buckets vazios', () => {
    expect(routeConversationalDecisions([])).toEqual({ toEnrich: [], toCreate: [], discarded: [] });
    expect(routeConversationalDecisions(null)).toEqual({ toEnrich: [], toCreate: [], discarded: [] });
    expect(routeConversationalDecisions(undefined)).toEqual({ toEnrich: [], toCreate: [], discarded: [] });
  });

  it('match_confident + confirmed + tradeId → toEnrich (não toCreate)', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 'trade-abc',
        userDecision: 'confirmed',
      }),
    ];
    const { toEnrich, toCreate, discarded } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
    expect(toEnrich[0].tradeId).toBe('trade-abc');
    expect(toCreate).toHaveLength(0);
    expect(discarded).toHaveLength(0);
  });

  it('match_confident + adjusted + tradeId → toEnrich (mesmo caminho)', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 'trade-abc',
        userDecision: 'adjusted',
        userAdjustments: { entry: 24905 },
      }),
    ];
    const { toEnrich, toCreate } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
    expect(toCreate).toHaveLength(0);
  });

  it('ambiguous + confirmed + tradeId → toEnrich', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.AMBIGUOUS,
        tradeId: 't-selected',
        userDecision: 'confirmed',
      }),
    ];
    const { toEnrich } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
  });

  it('new + confirmed (sem tradeId) → toCreate', () => {
    const queue = [
      makeItem({ classification: CLASSIFICATION.NEW, userDecision: 'confirmed' }),
    ];
    const { toEnrich, toCreate } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(0);
    expect(toCreate).toHaveLength(1);
  });

  it('new + promotedFrom=new + tradeId → toEnrich', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.NEW,
        tradeId: 'trade-picked',
        promotedFrom: 'new',
        userDecision: 'confirmed',
      }),
    ];
    const { toEnrich, toCreate } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
    expect(toCreate).toHaveLength(0);
  });

  it('autoliq + confirmed (sem tradeId) → toCreate', () => {
    const queue = [
      makeItem({ classification: CLASSIFICATION.AUTOLIQ, userDecision: 'confirmed' }),
    ];
    const { toCreate, toEnrich } = routeConversationalDecisions(queue);
    expect(toCreate).toHaveLength(1);
    expect(toEnrich).toHaveLength(0);
  });

  it('userDecision=discarded → discarded bucket', () => {
    const queue = [
      makeItem({ classification: CLASSIFICATION.NEW, userDecision: 'discarded' }),
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 't-1',
        userDecision: 'discarded',
      }),
    ];
    const { discarded, toCreate, toEnrich } = routeConversationalDecisions(queue);
    expect(discarded).toHaveLength(2);
    expect(toCreate).toHaveLength(0);
    expect(toEnrich).toHaveLength(0);
  });

  it('pending → ignorada (não compõe nenhum bucket)', () => {
    const queue = [makeItem({ userDecision: 'pending' })];
    const { toEnrich, toCreate, discarded } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(0);
    expect(toCreate).toHaveLength(0);
    expect(discarded).toHaveLength(0);
  });

  it('match_confident sem tradeId → toCreate (guarda contra estado corrompido)', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: null,
        userDecision: 'confirmed',
      }),
    ];
    const { toEnrich, toCreate } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(0);
    expect(toCreate).toHaveLength(1);
  });

  it('cenário misto — 1 enrich + 1 create + 1 discard', () => {
    const queue = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 't-1',
        userDecision: 'confirmed',
      }),
      makeItem({
        operation: makeOp({ operationId: 'op-2' }),
        classification: CLASSIFICATION.NEW,
        userDecision: 'confirmed',
      }),
      makeItem({
        operation: makeOp({ operationId: 'op-3' }),
        classification: CLASSIFICATION.AMBIGUOUS,
        userDecision: 'discarded',
      }),
    ];
    const { toEnrich, toCreate, discarded } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
    expect(toCreate).toHaveLength(1);
    expect(discarded).toHaveLength(1);
  });
});

// ============================================
// buildEnrichmentPayload
// ============================================

describe('buildEnrichmentPayload', () => {
  it('monta payload a partir da operação — defaults', () => {
    const item = makeItem({
      classification: CLASSIFICATION.MATCH_CONFIDENT,
      tradeId: 't-1',
      userDecision: 'confirmed',
    });
    const payload = buildEnrichmentPayload(item, { importBatchId: 'batch-1' });
    expect(payload.entry).toBe(24900);
    expect(payload.exit).toBe(24950);
    expect(payload.qty).toBe(2);
    expect(payload.stopLoss).toBeNull();
    expect(payload.importBatchId).toBe('batch-1');
    expect(payload._partials).toHaveLength(2);
    expect(payload._partials[0]).toMatchObject({ type: 'ENTRY', price: 24900, qty: 2 });
    expect(payload._partials[1]).toMatchObject({ type: 'EXIT', price: 24950, qty: 2 });
  });

  it('aplica userAdjustments (entry/exit/qty)', () => {
    const item = makeItem({
      classification: CLASSIFICATION.MATCH_CONFIDENT,
      tradeId: 't-1',
      userDecision: 'adjusted',
      userAdjustments: { entry: 24910, exit: 24960, qty: 3 },
    });
    const payload = buildEnrichmentPayload(item);
    expect(payload.entry).toBe(24910);
    expect(payload.exit).toBe(24960);
    expect(payload.qty).toBe(3);
  });

  it('userAdjustments com string (input) → coerção numérica', () => {
    const item = makeItem({
      userAdjustments: { entry: '24905.5' },
    });
    const payload = buildEnrichmentPayload(item);
    expect(payload.entry).toBe(24905.5);
  });

  it('stopLoss: operation.hasStopProtection true → extrai lastStop', () => {
    const op = makeOp({
      hasStopProtection: true,
      stopOrders: [{ stopPrice: 24880 }, { stopPrice: 24890 }],
    });
    const item = makeItem({ operation: op });
    const payload = buildEnrichmentPayload(item);
    expect(payload.stopLoss).toBe(24890);
  });

  it('userAdjustments.stopLoss = null → sobrescreve para null', () => {
    const op = makeOp({ hasStopProtection: true, stopOrders: [{ stopPrice: 24880 }] });
    const item = makeItem({ operation: op, userAdjustments: { stopLoss: null } });
    const payload = buildEnrichmentPayload(item);
    expect(payload.stopLoss).toBeNull();
  });

  it('tickerRuleMap resolvido pelo instrumento', () => {
    const item = makeItem({ operation: makeOp({ instrument: 'mnqh6' }) });
    const payload = buildEnrichmentPayload(item, {
      tickerRuleMap: { MNQH6: { tickSize: 0.25, tickValue: 0.5, pointValue: 2 } },
    });
    expect(payload.tickerRule).toEqual({ tickSize: 0.25, tickValue: 0.5, pointValue: 2 });
  });
});

// ============================================
// enrichConversationalBatch
// ============================================

describe('enrichConversationalBatch', () => {
  it('chama enrichTradeFn para cada item com tradeId + payload', async () => {
    const items = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 'trade-1',
        userDecision: 'confirmed',
      }),
      makeItem({
        operation: makeOp({ operationId: 'op-2', instrument: 'WDOH6', avgEntryPrice: 5000, avgExitPrice: 5010 }),
        classification: CLASSIFICATION.AMBIGUOUS,
        tradeId: 'trade-2',
        userDecision: 'confirmed',
      }),
    ];
    const enrichTradeFn = vi.fn(async (tradeId) => ({
      id: tradeId,
      before: { entry: 1 },
      after: { entry: 2, enrichedByImport: true },
    }));

    const userContext = { uid: 'user-1' };
    const result = await enrichConversationalBatch({
      toEnrich: items,
      userContext,
      importBatchId: 'batch-1',
      enrichTradeFn,
    });

    expect(enrichTradeFn).toHaveBeenCalledTimes(2);
    expect(enrichTradeFn).toHaveBeenNthCalledWith(
      1,
      'trade-1',
      expect.objectContaining({ entry: 24900, importBatchId: 'batch-1' }),
      userContext
    );
    expect(enrichTradeFn).toHaveBeenNthCalledWith(
      2,
      'trade-2',
      expect.objectContaining({ entry: 5000, importBatchId: 'batch-1' }),
      userContext
    );
    expect(result.enriched).toHaveLength(2);
    expect(result.enriched[0].after.enrichedByImport).toBe(true);
    expect(result.failed).toHaveLength(0);
  });

  it('item sem tradeId nunca chega aqui (garantia do router); mesmo assim não quebra se enrichTradeFn falhar', async () => {
    const items = [
      makeItem({
        classification: CLASSIFICATION.MATCH_CONFIDENT,
        tradeId: 'trade-x',
        userDecision: 'confirmed',
      }),
    ];
    const enrichTradeFn = vi.fn(async () => {
      throw new Error('Trade não encontrado');
    });

    const result = await enrichConversationalBatch({
      toEnrich: items,
      userContext: { uid: 'u' },
      enrichTradeFn,
    });
    expect(result.enriched).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toMatch(/não encontrado/);
  });

  it('lança erro se enrichTradeFn não é função', async () => {
    await expect(
      enrichConversationalBatch({ toEnrich: [makeItem()], userContext: {}, enrichTradeFn: null })
    ).rejects.toThrow('enrichTradeFn é obrigatório');
  });

  it('lista vazia → retorna buckets vazios sem tocar enrichTradeFn', async () => {
    const enrichTradeFn = vi.fn();
    const result = await enrichConversationalBatch({
      toEnrich: [],
      userContext: {},
      enrichTradeFn,
    });
    expect(result.enriched).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(enrichTradeFn).not.toHaveBeenCalled();
  });
});

// ============================================
// Fingerprints
// ============================================

describe('orderMatchFingerprint', () => {
  it('compõe instrument|side|filledAt|quantity', () => {
    expect(orderMatchFingerprint({
      instrument: 'MNQH6', side: 'BUY', filledAt: '2026-02-12T14:41:30', filledQuantity: 2,
    })).toBe('MNQH6|BUY|2026-02-12T14:41:30|2');
  });

  it('uppercases instrument', () => {
    expect(orderMatchFingerprint({
      instrument: 'mnqh6', side: 'SELL', filledAt: 'X', filledQuantity: 1,
    })).toBe('MNQH6|SELL|X|1');
  });

  it('quantity fallback: filledQuantity ?? quantity', () => {
    expect(orderMatchFingerprint({
      instrument: 'A', side: 'B', filledAt: 'T', quantity: 5,
    })).toBe('A|B|T|5');
  });
});

describe('operationOrderFingerprints', () => {
  it('agrega fingerprints de entry+exit+stop', () => {
    const op = makeOp({
      hasStopProtection: true,
      stopOrders: [
        { instrument: 'MNQH6', side: 'SELL', filledAt: '2026-02-12T14:45:00', filledQuantity: 2 },
      ],
    });
    const fps = operationOrderFingerprints(op);
    expect(fps.size).toBe(3); // 1 entry + 1 exit + 1 stop
  });

  it('op null → set vazio', () => {
    expect(operationOrderFingerprints(null).size).toBe(0);
  });
});
