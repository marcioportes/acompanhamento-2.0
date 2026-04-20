/**
 * orderReconstruction.test.js
 * @version 1.0.0 (v1.20.0)
 * Testes de reconstrução de operações — validado contra 5 operações reais.
 * Ground truth: tela de operações ProfitChart-Pro 19/03/2026.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  reconstructOperations,
  associateNonFilledOrders,
  calculateOperationResult,
  DEFAULT_GAP_THRESHOLD_MS,
} from '../../utils/orderReconstruction';
import { parseTradovateOrders } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/tradovate-orders');

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

// ============================================
// FASE D — ABR-17: segmentação por ticker (fixture real)
// ============================================
describe('Fase D — ABR-17: segmentação por ticker (april.csv)', () => {
  const aprilCSV = readFileSync(resolve(fixturesDir, 'april.csv'), 'utf-8');
  const { orders: parsed } = parseTradovateOrders(aprilCSV);
  const { orders: normalized } = normalizeBatch(parsed);
  const ops = reconstructOperations(normalized);

  it('reconstrói operações (≥1) para MNQM6', () => {
    const mnqOps = ops.filter(o => o.instrument === 'MNQM6');
    expect(mnqOps.length).toBeGreaterThanOrEqual(1);
  });

  it('nenhuma operação mistura MNQM6 e NQM6 (segmentação estrita por ticker)', () => {
    for (const op of ops) {
      const allOrders = [...op.entryOrders, ...op.exitOrders];
      const instrumentsInOp = new Set(allOrders.map(o => o.instrument));
      expect(instrumentsInOp.size).toBe(1);
      expect([...instrumentsInOp][0]).toBe(op.instrument);
    }
  });

  it('cada operação carrega instrument explícito (nunca UNKNOWN)', () => {
    for (const op of ops) {
      expect(op.instrument).toBeTruthy();
      expect(op.instrument).not.toBe('UNKNOWN');
    }
  });

  it('injetando 1 op sintética NQM6 filled → reconstruction segmenta dos MNQM6', () => {
    // A fixture tem NQM6 apenas cancelada → 0 ops em NQM6. Injetamos um par
    // filled de NQM6 entrelaçado com MNQM6 para provar segmentação num dia.
    const synthetic = [
      ...normalized,
      // NQM6 Buy 04/08/2026 11:00:00 fill @ 25100
      { externalOrderId: 'SYN-NQ-1', instrument: 'NQM6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, price: 25100, filledPrice: 25100,
        orderType: 'MARKET', submittedAt: '2026-04-08T11:00:00',
        filledAt: '2026-04-08T11:00:00', isStopOrder: false, events: [] },
      // NQM6 Sell 04/08/2026 11:02:00 fill @ 25110
      { externalOrderId: 'SYN-NQ-2', instrument: 'NQM6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, price: 25110, filledPrice: 25110,
        orderType: 'MARKET', submittedAt: '2026-04-08T11:02:00',
        filledAt: '2026-04-08T11:02:00', isStopOrder: false, events: [] },
    ];
    const synthOps = reconstructOperations(synthetic);
    const mnq = synthOps.filter(o => o.instrument === 'MNQM6');
    const nq = synthOps.filter(o => o.instrument === 'NQM6');
    expect(mnq.length).toBeGreaterThanOrEqual(1);
    expect(nq.length).toBe(1);
    expect(nq[0].side).toBe('LONG');
    expect(nq[0].avgEntryPrice).toBe(25100);
    expect(nq[0].avgExitPrice).toBe(25110);
    // Cruzada: nenhuma op MNQ tem fill NQ e vice-versa
    for (const op of synthOps) {
      const ids = [...op.entryOrders, ...op.exitOrders].map(o => o.instrument);
      expect(new Set(ids).size).toBe(1);
    }
  });
});

// ============================================
// FASE D — FEV-12: agrupamento N×M de fills
// ============================================
describe('Fase D — FEV-12: agrupamento N×M (feb.csv + sintético)', () => {
  it('feb.csv: cada orderId único permanece como 1 ordem lógica (Tradovate já pré-agregado)', () => {
    const febCSV = readFileSync(resolve(fixturesDir, 'feb.csv'), 'utf-8');
    const { orders: parsed } = parseTradovateOrders(febCSV);
    const { orders: normalized } = normalizeBatch(parsed);
    const ops = reconstructOperations(normalized);

    // Tradovate entrega uma linha por ordem (já agregado). O aggregator não
    // deve romper essa 1:1 — cada entryOrder/exitOrder corresponde a uma
    // ordem do CSV, sem duplicação nem colapso incorreto.
    for (const op of ops) {
      for (const entry of op.entryOrders) {
        expect(entry._aggregatedFillCount).toBeUndefined();
      }
    }
    // Ops reconstruídas para 02/12/2026 > 0 (bust day com ≥10 fills)
    const feb12Ops = ops.filter(o => o.entryTime.startsWith('2026-02-12'));
    expect(feb12Ops.length).toBeGreaterThanOrEqual(1);
  });

  it('ordem explodida (3 fills mesmo externalOrderId) → 1 ordem lógica na reconstrução', () => {
    // Simula broker (ex: ProfitChart) que explode 1 ordem de mercado em 3 linhas
    // com mesmo externalOrderId e fills parciais qty 1, qty 2, qty 2 (total qty 5).
    // Saída subsequente de qty 5 zera a posição → 1 operação LONG.
    const exploded = [
      { externalOrderId: 'MKT-ENTRY', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, price: 25000, filledPrice: 25000,
        orderType: 'MARKET', submittedAt: '2026-02-12T12:15:00',
        filledAt: '2026-02-12T12:15:01', isStopOrder: false, events: [] },
      { externalOrderId: 'MKT-ENTRY', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 2, filledQuantity: 2, price: 25005, filledPrice: 25005,
        orderType: 'MARKET', submittedAt: '2026-02-12T12:15:00',
        filledAt: '2026-02-12T12:15:02', isStopOrder: false, events: [] },
      { externalOrderId: 'MKT-ENTRY', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 2, filledQuantity: 2, price: 25010, filledPrice: 25010,
        orderType: 'MARKET', submittedAt: '2026-02-12T12:15:00',
        filledAt: '2026-02-12T12:15:03', isStopOrder: false, events: [] },
      // Saída única qty 5 @ 25020
      { externalOrderId: 'MKT-EXIT', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 5, filledQuantity: 5, price: 25020, filledPrice: 25020,
        orderType: 'MARKET', submittedAt: '2026-02-12T12:20:00',
        filledAt: '2026-02-12T12:20:00', isStopOrder: false, events: [] },
    ];
    const ops = reconstructOperations(exploded);
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.side).toBe('LONG');
    expect(op.totalQty).toBe(5);
    // 1 ordem de entrada agregada + 1 ordem de saída
    expect(op.entryOrders).toHaveLength(1);
    expect(op.exitOrders).toHaveLength(1);
    // Preço médio ponderado: (1*25000 + 2*25005 + 2*25010) / 5 = 125030 / 5 = 25006
    expect(op.avgEntryPrice).toBe(25006);
    expect(op.avgExitPrice).toBe(25020);
    expect(op.resultPoints).toBe(14);
    // Flag de agregação preservada no entryOrder colapsado
    expect(op.entryOrders[0]._aggregatedFillCount).toBe(3);
  });
});

// ============================================
// FASE D — Gap temporal
// ============================================
describe('Fase D — gap temporal entre operações', () => {
  it('threshold default é 60min (exportado como DEFAULT_GAP_THRESHOLD_MS)', () => {
    expect(DEFAULT_GAP_THRESHOLD_MS).toBe(60 * 60 * 1000);
  });

  it('duas operações do mesmo ticker separadas por 2h → 2ª com hasPriorGap=true', () => {
    const orders = [
      // OP1: 10:00-10:02
      { externalOrderId: 'G-E1', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25000,
        submittedAt: '2026-02-12T10:00:00', filledAt: '2026-02-12T10:00:00',
        isStopOrder: false },
      { externalOrderId: 'G-X1', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25010,
        submittedAt: '2026-02-12T10:02:00', filledAt: '2026-02-12T10:02:00',
        isStopOrder: false },
      // gap de 2h (>60min threshold)
      // OP2: 12:05-12:07
      { externalOrderId: 'G-E2', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25100,
        submittedAt: '2026-02-12T12:05:00', filledAt: '2026-02-12T12:05:00',
        isStopOrder: false },
      { externalOrderId: 'G-X2', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25110,
        submittedAt: '2026-02-12T12:07:00', filledAt: '2026-02-12T12:07:00',
        isStopOrder: false },
    ];
    const ops = reconstructOperations(orders);
    expect(ops).toHaveLength(2);
    expect(ops[0].hasPriorGap).toBe(false);
    expect(ops[1].hasPriorGap).toBe(true);
  });

  it('duas operações com gap < threshold → nenhuma tem hasPriorGap', () => {
    const orders = [
      { externalOrderId: 'G-E1', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25000,
        submittedAt: '2026-02-12T10:00:00', filledAt: '2026-02-12T10:00:00',
        isStopOrder: false },
      { externalOrderId: 'G-X1', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25010,
        submittedAt: '2026-02-12T10:02:00', filledAt: '2026-02-12T10:02:00',
        isStopOrder: false },
      // gap de 30min (<60min threshold)
      { externalOrderId: 'G-E2', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25100,
        submittedAt: '2026-02-12T10:32:00', filledAt: '2026-02-12T10:32:00',
        isStopOrder: false },
      { externalOrderId: 'G-X2', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25110,
        submittedAt: '2026-02-12T10:34:00', filledAt: '2026-02-12T10:34:00',
        isStopOrder: false },
    ];
    const ops = reconstructOperations(orders);
    expect(ops).toHaveLength(2);
    expect(ops[0].hasPriorGap).toBe(false);
    expect(ops[1].hasPriorGap).toBe(false);
  });

  it('threshold customizável via opts.gapThresholdMs', () => {
    const orders = [
      { externalOrderId: 'G-E1', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25000,
        submittedAt: '2026-02-12T10:00:00', filledAt: '2026-02-12T10:00:00',
        isStopOrder: false },
      { externalOrderId: 'G-X1', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25010,
        submittedAt: '2026-02-12T10:02:00', filledAt: '2026-02-12T10:02:00',
        isStopOrder: false },
      // gap de 15min
      { externalOrderId: 'G-E2', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25100,
        submittedAt: '2026-02-12T10:17:00', filledAt: '2026-02-12T10:17:00',
        isStopOrder: false },
      { externalOrderId: 'G-X2', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25110,
        submittedAt: '2026-02-12T10:19:00', filledAt: '2026-02-12T10:19:00',
        isStopOrder: false },
    ];
    // Threshold 10min → gap de 15min dispara a flag
    const ops = reconstructOperations(orders, { gapThresholdMs: 10 * 60 * 1000 });
    expect(ops).toHaveLength(2);
    expect(ops[1].hasPriorGap).toBe(true);
  });

  it('gap só considera ops do mesmo instrumento — NQM6 não afeta MNQM6', () => {
    const orders = [
      // MNQ OP1: 10:00
      { externalOrderId: 'M-E1', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25000,
        submittedAt: '2026-02-12T10:00:00', filledAt: '2026-02-12T10:00:00' },
      { externalOrderId: 'M-X1', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25010,
        submittedAt: '2026-02-12T10:02:00', filledAt: '2026-02-12T10:02:00' },
      // NQ OP1: 10:10 (interfere no tempo global mas não nas comparações internas por ticker)
      { externalOrderId: 'N-E1', instrument: 'NQM6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25100,
        submittedAt: '2026-02-12T10:10:00', filledAt: '2026-02-12T10:10:00' },
      { externalOrderId: 'N-X1', instrument: 'NQM6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25110,
        submittedAt: '2026-02-12T10:11:00', filledAt: '2026-02-12T10:11:00' },
      // MNQ OP2: 10:30 — gap de 28min do MNQ OP1 (abaixo do threshold default 60min)
      { externalOrderId: 'M-E2', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25200,
        submittedAt: '2026-02-12T10:30:00', filledAt: '2026-02-12T10:30:00' },
      { externalOrderId: 'M-X2', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        quantity: 1, filledQuantity: 1, filledPrice: 25210,
        submittedAt: '2026-02-12T10:32:00', filledAt: '2026-02-12T10:32:00' },
    ];
    const ops = reconstructOperations(orders);
    const mnqOps = ops.filter(o => o.instrument === 'MNQH6');
    expect(mnqOps).toHaveLength(2);
    expect(mnqOps[1].hasPriorGap).toBe(false); // 28min < 60min threshold
  });
});
