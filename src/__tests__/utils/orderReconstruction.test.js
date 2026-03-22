/**
 * orderReconstruction.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes de reconstrução de operações — validado contra 5 operações reais.
 * Ground truth: tela de operações ProfitChart-Pro 19/03/2026.
 */

import { describe, it, expect } from 'vitest';
import {
  reconstructOperations,
  associateNonFilledOrders,
  calculateOperationResult,
} from '../../utils/orderReconstruction';

// ============================================
// FIXTURE: 18 ordens reais parseadas (output do parseProfitChartPro)
// Ordenadas cronologicamente (como o parser entrega)
// ============================================

const REAL_ORDERS = [
  // --- OP1 ENTRY: V 2×177.975 (10:11:11→10:11:25) ---
  { externalOrderId: 'ORD-225450', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 177975, filledPrice: 177975, avgFillPrice: 177975,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:11:11', filledAt: '2026-03-19T10:11:25',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP1 STOP: C 1 Stop Limite CANCELADA ---
  { externalOrderId: 'ORD-226983', instrument: 'WINJ26', side: 'BUY', status: 'CANCELLED',
    quantity: 1, filledQuantity: null, price: 178430, filledPrice: null,
    orderType: 'STOP_LIMIT', submittedAt: '2026-03-19T10:11:41', cancelledAt: '2026-03-19T10:14:15',
    isStopOrder: true, stopPrice: 178280, origin: 'Estratégia', events: [] },

  // --- OP1 TARGET: C 1 Limite CANCELADA ---
  { externalOrderId: 'ORD-226984', instrument: 'WINJ26', side: 'BUY', status: 'CANCELLED',
    quantity: 1, filledQuantity: null, price: 177460, filledPrice: null,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:11:41', cancelledAt: '2026-03-19T10:14:15',
    isStopOrder: false, stopPrice: null, origin: 'Estratégia', events: [] },

  // --- OP1 EXIT: C 2×177.970 (10:14:08→10:14:15), 2 fills ---
  { externalOrderId: 'ORD-236153', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 178115, filledPrice: 177970, avgFillPrice: 177970,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:14:08', filledAt: '2026-03-19T10:14:15',
    isStopOrder: false, stopPrice: 177965, origin: 'SuperDOM', events: [] },

  // --- OP2 ENTRY: V 2×178.310 (10:30:39→10:30:40) ---
  { externalOrderId: 'ORD-293322', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 178295, filledPrice: 178310, avgFillPrice: 178310,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:30:39', filledAt: '2026-03-19T10:30:39',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP2 TARGET CANCELLED: C 2 Limite 177.810 ---
  { externalOrderId: 'ORD-295005', instrument: 'WINJ26', side: 'BUY', status: 'CANCELLED',
    quantity: 2, filledQuantity: null, price: 177810, filledPrice: null,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:31:00', cancelledAt: '2026-03-19T10:33:36',
    isStopOrder: false, stopPrice: null, origin: 'Gráfico', events: [] },

  // --- OP2 EXIT (Zeragem): C 2×178.660 (10:33:36) ---
  { externalOrderId: 'ORD-302810', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 178860, filledPrice: 178660, avgFillPrice: 178660,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:33:36', filledAt: '2026-03-19T10:33:36',
    isStopOrder: false, stopPrice: null, origin: 'Zeragem', events: [] },

  // --- OP3 ENTRY: C 4×178.590 (10:34:01→10:34:02) ---
  { externalOrderId: 'ORD-304385', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 4, filledQuantity: 4, price: 178785, filledPrice: 178590, avgFillPrice: 178590,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:34:01', filledAt: '2026-03-19T10:34:01',
    isStopOrder: false, stopPrice: null, origin: 'Gráfico', events: [] },

  // --- OP3 CANCELLED: V 4 Limite 179.270 ---
  { externalOrderId: 'ORD-304886', instrument: 'WINJ26', side: 'SELL', status: 'CANCELLED',
    quantity: 4, filledQuantity: null, price: 179270, filledPrice: null,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:34:11', cancelledAt: '2026-03-19T10:36:12',
    isStopOrder: false, stopPrice: null, origin: 'Gráfico', events: [] },

  // --- OP3 EXIT1: V 2×178.950 (10:35:56) ---
  { externalOrderId: 'ORD-311490', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 178745, filledPrice: 178950, avgFillPrice: 178950,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:35:56', filledAt: '2026-03-19T10:35:56',
    isStopOrder: false, stopPrice: null, origin: 'Gráfico', events: [] },

  // --- OP3 EXIT2: V 2×179.160 (10:36:07→10:36:55) ---
  { externalOrderId: 'ORD-312134', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 179160, filledPrice: 179160, avgFillPrice: 179160,
    orderType: 'LIMIT', submittedAt: '2026-03-19T10:36:07', filledAt: '2026-03-19T10:36:55',
    isStopOrder: false, stopPrice: null, origin: 'Gráfico', events: [] },

  // --- OP4 ENTRY: C 2×181.925 (16:02:13) ---
  { externalOrderId: 'ORD-889846', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182125, filledPrice: 181925, avgFillPrice: 181925,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:02:13', filledAt: '2026-03-19T16:02:13',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP4 EXIT: V 2×182.015 (16:02:14→16:02:16) ---
  { externalOrderId: 'ORD-889936', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182015, filledPrice: 182015, avgFillPrice: 182015,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:02:14', filledAt: '2026-03-19T16:02:16',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP5 ENTRY1: C 2×182.290 (16:02:51) ---
  { externalOrderId: 'ORD-892223', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182485, filledPrice: 182290, avgFillPrice: 182290,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:02:51', filledAt: '2026-03-19T16:02:51',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP5 CANCELLED: V 2 Limite 182.390 ---
  { externalOrderId: 'ORD-892298', instrument: 'WINJ26', side: 'SELL', status: 'CANCELLED',
    quantity: 2, filledQuantity: null, price: 182390, filledPrice: null,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:02:53', cancelledAt: '2026-03-19T16:03:42',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP5 ENTRY2: C 2×181.975 (16:03:07) ---
  { externalOrderId: 'ORD-893050', instrument: 'WINJ26', side: 'BUY', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182165, filledPrice: 181975, avgFillPrice: 181975,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:03:07', filledAt: '2026-03-19T16:03:07',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP5 EXIT1: V 2×182.175 (16:03:38) ---
  { externalOrderId: 'ORD-894236', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182145, filledPrice: 182175, avgFillPrice: 182175,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:03:38', filledAt: '2026-03-19T16:03:38',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },

  // --- OP5 EXIT2: V 2×182.200 (16:03:26→16:03:40) ---
  { externalOrderId: 'ORD-893767', instrument: 'WINJ26', side: 'SELL', status: 'FILLED',
    quantity: 2, filledQuantity: 2, price: 182200, filledPrice: 182200, avgFillPrice: 182200,
    orderType: 'LIMIT', submittedAt: '2026-03-19T16:03:26', filledAt: '2026-03-19T16:03:40',
    isStopOrder: false, stopPrice: null, origin: 'SuperDOM', events: [] },
];

// ============================================
// CORE: reconstructOperations
// ============================================
describe('reconstructOperations — 5 operações reais', () => {
  const ops = reconstructOperations(REAL_ORDERS);

  it('reconstrói exatamente 5 operações', () => {
    expect(ops).toHaveLength(5);
  });

  it('OP1: SHORT WINJ26, +5pts, V2→C2', () => {
    const op = ops[0];
    expect(op.instrument).toBe('WINJ26');
    expect(op.side).toBe('SHORT');
    expect(op.totalQty).toBe(2);
    expect(op.entryOrders).toHaveLength(1);
    expect(op.exitOrders).toHaveLength(1);
    expect(op.avgEntryPrice).toBe(177975);
    expect(op.avgExitPrice).toBe(177970);
    expect(op.resultPoints).toBe(5); // SHORT: entry - exit = 177975 - 177970
  });

  it('OP2: SHORT WINJ26, -350pts, V2→C2 (Zeragem)', () => {
    const op = ops[1];
    expect(op.side).toBe('SHORT');
    expect(op.totalQty).toBe(2);
    expect(op.avgEntryPrice).toBe(178310);
    expect(op.avgExitPrice).toBe(178660);
    expect(op.resultPoints).toBe(-350); // 178310 - 178660
  });

  it('OP3: LONG WINJ26, +465pts, C4→V2+V2', () => {
    const op = ops[2];
    expect(op.side).toBe('LONG');
    expect(op.totalQty).toBe(4);
    expect(op.entryOrders).toHaveLength(1); // C4 = 1 ordem de 4 lotes
    expect(op.exitOrders).toHaveLength(2); // V2 + V2
    expect(op.avgEntryPrice).toBe(178590);
    // avg exit: (178950×2 + 179160×2) / 4 = 179055
    expect(op.avgExitPrice).toBe(179055);
    expect(op.resultPoints).toBe(465); // 179055 - 178590
  });

  it('OP4: LONG WINJ26, +90pts, C2→V2 (3s scalp)', () => {
    const op = ops[3];
    expect(op.side).toBe('LONG');
    expect(op.totalQty).toBe(2);
    expect(op.avgEntryPrice).toBe(181925);
    expect(op.avgExitPrice).toBe(182015);
    expect(op.resultPoints).toBe(90);
  });

  it('OP5: LONG WINJ26, +55pts, C2+C2→V2+V2', () => {
    const op = ops[4];
    expect(op.side).toBe('LONG');
    expect(op.totalQty).toBe(4);
    expect(op.entryOrders).toHaveLength(2); // C2 + C2
    expect(op.exitOrders).toHaveLength(2); // V2 + V2
    // avg entry: (182290×2 + 181975×2) / 4 = 182132.5
    expect(op.avgEntryPrice).toBe(182132.5);
    // avg exit: (182175×2 + 182200×2) / 4 = 182187.5
    expect(op.avgExitPrice).toBe(182187.5);
    expect(op.resultPoints).toBe(55); // 182187.5 - 182132.5
  });

  it('soma dos resultados = 265 pts (+5 -350 +465 +90 +55)', () => {
    const totalPts = ops.reduce((sum, op) => sum + (op.resultPoints ?? 0), 0);
    expect(totalPts).toBe(265);
  });

  it('todas as operações fechadas (nenhuma _isOpen)', () => {
    expect(ops.every(op => !op._isOpen)).toBe(true);
  });

  it('cronologia correta (OP1 < OP2 < OP3 < OP4 < OP5)', () => {
    for (let i = 1; i < ops.length; i++) {
      expect(new Date(ops[i].entryTime).getTime()).toBeGreaterThan(new Date(ops[i - 1].entryTime).getTime());
    }
  });
});

// ============================================
// associateNonFilledOrders
// ============================================
describe('associateNonFilledOrders — stops e canceladas', () => {
  const ops = reconstructOperations(REAL_ORDERS);
  associateNonFilledOrders(ops, REAL_ORDERS);

  it('OP1: stop cancelada associada', () => {
    const op = ops[0];
    expect(op.stopOrders.length).toBeGreaterThanOrEqual(1);
    expect(op.hasStopProtection).toBe(true);
    // Stop foi cancelada, não executada
    expect(op.stopExecuted).toBe(false);
  });

  it('OP1: target cancelada associada', () => {
    const op = ops[0];
    expect(op.cancelledOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('OP2: saída por Zeragem → stopExecuted=true', () => {
    const op = ops[1];
    expect(op.stopExecuted).toBe(true);
  });

  it('OP2: target cancelada associada', () => {
    const op = ops[1];
    expect(op.cancelledOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('OP3: ordem cancelada (V4 179.270) associada', () => {
    const op = ops[2];
    expect(op.cancelledOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('OP4: sem stops, sem canceladas', () => {
    const op = ops[3];
    expect(op.stopOrders).toHaveLength(0);
    expect(op.cancelledOrders).toHaveLength(0);
  });

  it('OP5: cancelada (V2 182.390) associada', () => {
    const op = ops[4];
    expect(op.cancelledOrders.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// Edge cases
// ============================================
describe('reconstructOperations — edge cases', () => {
  it('array vazio retorna array vazio', () => {
    expect(reconstructOperations([])).toHaveLength(0);
    expect(reconstructOperations(null)).toHaveLength(0);
  });

  it('apenas ordens canceladas → nenhuma operação', () => {
    const cancelled = [
      { instrument: 'WINJ26', side: 'BUY', status: 'CANCELLED', quantity: 2,
        submittedAt: '2026-03-19T10:00:00', isStopOrder: false },
    ];
    expect(reconstructOperations(cancelled)).toHaveLength(0);
  });

  it('operação incompleta (só entrada, sem saída) → _isOpen=true', () => {
    const open = [
      { instrument: 'WINJ26', side: 'BUY', status: 'FILLED', quantity: 2,
        filledQuantity: 2, filledPrice: 180000, submittedAt: '2026-03-19T10:00:00',
        filledAt: '2026-03-19T10:00:00', isStopOrder: false },
    ];
    const ops = reconstructOperations(open);
    expect(ops).toHaveLength(1);
    expect(ops[0]._isOpen).toBe(true);
    expect(ops[0].resultPoints).toBeNull();
  });

  it('múltiplos instrumentos → operações separadas', () => {
    const multi = [
      { instrument: 'WINJ26', side: 'BUY', status: 'FILLED', quantity: 2,
        filledQuantity: 2, filledPrice: 180000, submittedAt: '2026-03-19T10:00:00',
        filledAt: '2026-03-19T10:00:00', isStopOrder: false },
      { instrument: 'WINJ26', side: 'SELL', status: 'FILLED', quantity: 2,
        filledQuantity: 2, filledPrice: 180100, submittedAt: '2026-03-19T10:01:00',
        filledAt: '2026-03-19T10:01:00', isStopOrder: false },
      { instrument: 'WDOJ26', side: 'BUY', status: 'FILLED', quantity: 1,
        filledQuantity: 1, filledPrice: 5700, submittedAt: '2026-03-19T10:02:00',
        filledAt: '2026-03-19T10:02:00', isStopOrder: false },
      { instrument: 'WDOJ26', side: 'SELL', status: 'FILLED', quantity: 1,
        filledQuantity: 1, filledPrice: 5710, submittedAt: '2026-03-19T10:03:00',
        filledAt: '2026-03-19T10:03:00', isStopOrder: false },
    ];
    const ops = reconstructOperations(multi);
    expect(ops).toHaveLength(2);
    expect(ops.map(o => o.instrument).sort()).toEqual(['WDOJ26', 'WINJ26']);
  });
});

// ============================================
// calculateOperationResult (verification utility)
// ============================================
describe('calculateOperationResult', () => {
  it('recalcula OP3 corretamente', () => {
    const ops = reconstructOperations(REAL_ORDERS);
    const result = calculateOperationResult(ops[2]);
    expect(result.resultPoints).toBe(465);
    expect(result.avgEntry).toBe(178590);
    expect(result.avgExit).toBe(179055);
  });
});
