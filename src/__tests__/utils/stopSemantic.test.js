/**
 * stopSemantic.test.js
 * @description Issue #242 — distinção stop loss vs stop de ganho em legs de
 *   bracket OCO LIMIT. Crítico para compliance e shadow behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  STOP_SEMANTIC,
  classifyStopSemantic,
  enrichOperationsWithStopSemantic,
} from '../../utils/stopSemantic';

// ============================================
// classifyStopSemantic — função pura
// ============================================

describe('classifyStopSemantic — LONG', () => {
  it('Preço Stop ABAIXO do limite de entrada → STOP_LOSS', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.130,
      opSide: 'LONG',
      entryLimitPrice: 190.565,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_LOSS);
  });

  it('Preço Stop ACIMA do limite de entrada → STOP_GAIN', () => {
    // Cenário trade #1 do CSV 040526-ORDER (LONG entry 190.500, exit @ 190.515)
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.515,
      opSide: 'LONG',
      entryLimitPrice: 190.500,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_GAIN);
  });

  it('Preço Stop EXATAMENTE no limite → STOP_GAIN (breakeven)', () => {
    // Borda: tratamos breakeven como ganho mínimo (não é loss real).
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.500,
      opSide: 'LONG',
      entryLimitPrice: 190.500,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_GAIN);
  });
});

describe('classifyStopSemantic — SHORT', () => {
  it('Preço Stop ACIMA do limite de entrada → STOP_LOSS', () => {
    // Cenário trade #4: SHORT entry limite 189.645, alvo cancelado com Preço Stop 189.810
    const r = classifyStopSemantic({
      orderSide: 'BUY',
      orderStopPrice: 189.810,
      opSide: 'SHORT',
      entryLimitPrice: 189.645,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_LOSS);
  });

  it('Preço Stop ABAIXO do limite de entrada → STOP_GAIN', () => {
    const r = classifyStopSemantic({
      orderSide: 'BUY',
      orderStopPrice: 189.500,
      opSide: 'SHORT',
      entryLimitPrice: 189.645,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_GAIN);
  });

  it('Preço Stop EXATAMENTE no limite → STOP_GAIN (breakeven)', () => {
    const r = classifyStopSemantic({
      orderSide: 'BUY',
      orderStopPrice: 189.645,
      opSide: 'SHORT',
      entryLimitPrice: 189.645,
    });
    expect(r).toBe(STOP_SEMANTIC.STOP_GAIN);
  });
});

describe('classifyStopSemantic — entry SuperDOM (mesmo lado)', () => {
  it('LONG + ordem BUY com Preço Stop → null (não é proteção)', () => {
    const r = classifyStopSemantic({
      orderSide: 'BUY',
      orderStopPrice: 190.000,
      opSide: 'LONG',
      entryLimitPrice: 190.500,
    });
    expect(r).toBeNull();
  });

  it('SHORT + ordem SELL com Preço Stop → null (não é proteção)', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.000,
      opSide: 'SHORT',
      entryLimitPrice: 189.645,
    });
    expect(r).toBeNull();
  });
});

describe('classifyStopSemantic — defensivo', () => {
  it('orderStopPrice null → null', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: null,
      opSide: 'LONG',
      entryLimitPrice: 190.500,
    });
    expect(r).toBeNull();
  });

  it('entryLimitPrice null → null', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.130,
      opSide: 'LONG',
      entryLimitPrice: null,
    });
    expect(r).toBeNull();
  });

  it('opSide unknown → null', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: 190.130,
      opSide: 'NEUTRAL',
      entryLimitPrice: 190.565,
    });
    expect(r).toBeNull();
  });

  it('orderStopPrice NaN → null', () => {
    const r = classifyStopSemantic({
      orderSide: 'SELL',
      orderStopPrice: NaN,
      opSide: 'LONG',
      entryLimitPrice: 190.500,
    });
    expect(r).toBeNull();
  });

  it('input vazio → null', () => {
    expect(classifyStopSemantic()).toBeNull();
    expect(classifyStopSemantic({})).toBeNull();
  });
});

// ============================================
// enrichOperationsWithStopSemantic — integração no shape de operação
// ============================================

const makeOp = (overrides = {}) => ({
  operationId: 'OP-001',
  side: 'LONG',
  entryOrders: [{ side: 'BUY', price: 190.500, filledPrice: 190.500 }],
  exitOrders: [],
  stopOrders: [],
  cancelledOrders: [],
  ...overrides,
});

describe('enrichOperationsWithStopSemantic — marcação de operações', () => {
  it('marca exitOrder como STOP_GAIN quando saída tem stopPrice acima do entry (trade #1 cenário)', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY', price: 190.500 }],
      exitOrders: [{ side: 'SELL', price: 190.365, stopPrice: 190.515, filledPrice: 190.515 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].exitOrders[0].stopSemantic).toBe(STOP_SEMANTIC.STOP_GAIN);
    expect(ops[0].hasRealStopLoss).toBe(false);
  });

  it('marca exitOrder como STOP_LOSS quando stopPrice abaixo do entry (trade #2 cenário)', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY', price: 190.565 }],
      exitOrders: [{ side: 'SELL', price: 189.980, stopPrice: 190.130 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].exitOrders[0].stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);
    expect(ops[0].hasRealStopLoss).toBe(true);
  });

  it('marca cancelledOrder como STOP_LOSS para SHORT (trade #4 cenário)', () => {
    const ops = [makeOp({
      side: 'SHORT',
      entryOrders: [{ side: 'SELL', price: 189.645 }],
      exitOrders: [{ side: 'BUY', price: 189.180 }],
      cancelledOrders: [
        { side: 'BUY', price: 189.960, stopPrice: 189.810, status: 'CANCELLED' },
      ],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].cancelledOrders[0].stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);
    expect(ops[0].hasRealStopLoss).toBe(true);
  });

  it('hasRealStopLoss true quando ≥1 ordem do bracket é STOP_LOSS, mesmo havendo STOP_GAIN também', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY', price: 190.500 }],
      exitOrders: [
        { side: 'SELL', price: 190.300, stopPrice: 190.200 }, // STOP_LOSS
        { side: 'SELL', price: 190.700, stopPrice: 190.800 }, // STOP_GAIN
      ],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].exitOrders[0].stopSemantic).toBe(STOP_SEMANTIC.STOP_LOSS);
    expect(ops[0].exitOrders[1].stopSemantic).toBe(STOP_SEMANTIC.STOP_GAIN);
    expect(ops[0].hasRealStopLoss).toBe(true);
  });

  it('hasRealStopLoss false quando todas as ordens com stopPrice são STOP_GAIN', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY', price: 190.500 }],
      exitOrders: [{ side: 'SELL', price: 190.700, stopPrice: 190.800 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].hasRealStopLoss).toBe(false);
  });

  it('hasRealStopLoss false quando nenhuma ordem tem stopPrice', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY', price: 190.500 }],
      exitOrders: [{ side: 'SELL', price: 190.700 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].hasRealStopLoss).toBe(false);
  });

  it('NÃO marca entryOrders SuperDOM mesmo com stopPrice (mesmo lado da posição)', () => {
    const ops = [makeOp({
      side: 'LONG',
      // Entry SuperDOM: BUY com stopPrice anexado (configuração de stop pré-execução).
      entryOrders: [{ side: 'BUY', price: 190.500, stopPrice: 190.300 }],
      exitOrders: [{ side: 'SELL', price: 190.700 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].entryOrders[0].stopSemantic).toBeNull();
    expect(ops[0].hasRealStopLoss).toBe(false);
  });

  it('múltiplas operações são processadas independentemente', () => {
    const ops = [
      makeOp({
        operationId: 'OP-A',
        side: 'LONG',
        entryOrders: [{ side: 'BUY', price: 190.000 }],
        exitOrders: [{ side: 'SELL', price: 189.500, stopPrice: 189.500 }],
      }),
      makeOp({
        operationId: 'OP-B',
        side: 'SHORT',
        entryOrders: [{ side: 'SELL', price: 189.000 }],
        exitOrders: [{ side: 'BUY', price: 188.500, stopPrice: 188.000 }],
      }),
    ];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].hasRealStopLoss).toBe(true);   // LONG, stop 189.5 < 190 → STOP_LOSS
    expect(ops[1].hasRealStopLoss).toBe(false);  // SHORT, stop 188 < 189 → STOP_GAIN
  });

  it('operação aberta (_isOpen) tem hasRealStopLoss=false (sem análise)', () => {
    // Não rejeita nem crasha; apenas seta hasRealStopLoss=false.
    const ops = [{
      operationId: 'OP-OPEN',
      side: 'LONG',
      _isOpen: true,
      entryOrders: [{ side: 'BUY', price: 190.500, stopPrice: 190.000 }],
      exitOrders: [],
      stopOrders: [],
      cancelledOrders: [],
    }];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].hasRealStopLoss).toBe(false);
  });

  it('input vazio/null não crasha', () => {
    expect(() => enrichOperationsWithStopSemantic([])).not.toThrow();
    expect(() => enrichOperationsWithStopSemantic(null)).not.toThrow();
    expect(() => enrichOperationsWithStopSemantic(undefined)).not.toThrow();
  });

  it('retorna a mesma referência (mutation in-place)', () => {
    const ops = [makeOp()];
    const result = enrichOperationsWithStopSemantic(ops);
    expect(result).toBe(ops);
  });

  it('entryOrders[0].price ausente → hasRealStopLoss false (defensivo)', () => {
    const ops = [makeOp({
      side: 'LONG',
      entryOrders: [{ side: 'BUY' /* sem price */ }],
      exitOrders: [{ side: 'SELL', price: 190.700, stopPrice: 190.500 }],
    })];

    enrichOperationsWithStopSemantic(ops);

    expect(ops[0].hasRealStopLoss).toBe(false);
  });
});
