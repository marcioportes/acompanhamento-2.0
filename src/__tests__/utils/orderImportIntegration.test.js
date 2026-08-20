/**
 * orderImportIntegration.test.js
 * @description Testes de integração end-to-end do Order Import v1.1 redesign (issue #93).
 *   Validam composição entre módulos: categorização → criação → confronto → dedup → throttling.
 *   Firestore mockado via injeção de deps nos helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import { categorizeConfirmedOps, mapOperationToTradeData, checkDuplication, CLASSIFICATION } from '../../utils/orderTradeCreation';
import { createTradesBatch } from '../../utils/orderTradeBatch';
import { compareOperationWithTrade } from '../../utils/orderTradeComparison';
import { detectLowResolution } from '../../utils/orderTemporalResolution';
import {
  routeConversationalDecisions,
  enrichConversationalBatch,
} from '../../utils/conversationalIngest';
import { parseProfitChartPro } from '../../utils/orderParsers';
import { reconstructOperations } from '../../utils/orderReconstruction';
import { correlateOrders } from '../../utils/orderCorrelation';
import { persistImportDecisions, stagingDocsToOrders } from '../../utils/orderImportPipeline';

// ============================================
// FIXTURES
// ============================================

const makeOp = (id, entryRowIndex, exitRowIndex, overrides = {}) => ({
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
    { _rowIndex: entryRowIndex, instrument: 'WINJ26', filledPrice: 130000, filledQuantity: 2, filledAt: '2026-04-04T10:00:00' },
  ],
  exitOrders: [
    { _rowIndex: exitRowIndex, instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2, filledAt: '2026-04-04T10:30:00' },
  ],
  ...overrides,
});

const corr = (orderIndex, opts = {}) => ({
  orderIndex,
  externalOrderId: opts.externalOrderId ?? null,
  instrument: opts.instrument ?? 'WINJ26',
  tradeId: opts.tradeId ?? null,
  matchType: opts.matchType ?? 'ghost',
  confidence: opts.confidence ?? 0,
});

const makeTrade = (overrides = {}) => ({
  id: 'trade-001',
  ticker: 'WINJ26',
  side: 'LONG',
  entry: 130000,
  exit: 130050,
  qty: 2,
  entryTime: '2026-04-04T10:00:00',
  exitTime: '2026-04-04T10:30:00',
  date: '2026-04-04',
  stopLoss: null,
  _partials: [],
  ...overrides,
});

const makeUser = () => ({ uid: 'user-001', email: 'aluno@test.com', displayName: 'Aluno' });

// ============================================
// 1. CSV com 3 ops ghost → 3 trades criados
// ============================================

describe('Cenário 1: 3 ops ghost → 3 trades criados automaticamente', () => {
  it('categoriza 3 ops como toCreate e batch cria 3 trades', async () => {
    const ops = [
      makeOp('OP-A', 1, 2),
      makeOp('OP-B', 3, 4, { instrument: 'WDOJ26', entryOrders: [{ _rowIndex: 3, instrument: 'WDOJ26', filledPrice: 5000, filledQuantity: 1, filledAt: '2026-04-04T11:00:00' }], exitOrders: [{ _rowIndex: 4, instrument: 'WDOJ26', filledPrice: 5010, filledQuantity: 1, filledAt: '2026-04-04T11:30:00' }], avgEntryPrice: 5000, avgExitPrice: 5010, entryTime: '2026-04-04T11:00:00' }),
      makeOp('OP-C', 5, 6, { entryTime: '2026-04-04T14:00:00', entryOrders: [{ _rowIndex: 5, instrument: 'WINJ26', filledPrice: 130100, filledQuantity: 2, filledAt: '2026-04-04T14:00:00' }], exitOrders: [{ _rowIndex: 6, instrument: 'WINJ26', filledPrice: 130150, filledQuantity: 2, filledAt: '2026-04-04T14:30:00' }] }),
    ];
    const correlations = [
      corr(1), corr(2), corr(3, { instrument: 'WDOJ26' }), corr(4, { instrument: 'WDOJ26' }), corr(5), corr(6),
    ];

    // 1. Categorizar
    const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(ops, correlations);
    expect(toCreate).toHaveLength(3);
    expect(toConfront).toHaveLength(0);
    expect(ambiguous).toHaveLength(0);

    // 2. Batch cria trades
    let callCount = 0;
    const mockCreate = vi.fn(async () => ({ id: `trade-new-${++callCount}`, result: 100 }));
    const result = await createTradesBatch({
      toCreate,
      planId: 'plan-001',
      existingTrades: [],
      userContext: makeUser(),
      createTradeFn: mockCreate,
    });

    expect(result.created).toHaveLength(3);
    expect(result.duplicates).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});

// ============================================
// 2. 2 ops batem com 1 trade cada → 2 confrontos
// ============================================

describe('Cenário 2: 2 ops correlacionadas → confronto com divergências', () => {
  it('categoriza como toConfront e detecta divergências', () => {
    const ops = [
      makeOp('OP-A', 1, 2),
      makeOp('OP-B', 3, 4, { avgEntryPrice: 130099, entryOrders: [{ _rowIndex: 3, instrument: 'WINJ26', filledPrice: 130099, filledQuantity: 2, filledAt: '2026-04-04T11:00:00' }], exitOrders: [{ _rowIndex: 4, instrument: 'WINJ26', filledPrice: 130050, filledQuantity: 2, filledAt: '2026-04-04T11:30:00' }] }),
    ];
    const correlations = [
      corr(1, { tradeId: 'trade-001', matchType: 'exact' }),
      corr(2, { tradeId: 'trade-001', matchType: 'exact' }),
      corr(3, { tradeId: 'trade-002', matchType: 'exact' }),
      corr(4, { tradeId: 'trade-002', matchType: 'exact' }),
    ];

    const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(ops, correlations);
    expect(toCreate).toHaveLength(0);
    expect(toConfront).toHaveLength(2);
    expect(ambiguous).toHaveLength(0);

    // Simular confronto com trade existente que diverge
    const trade = makeTrade({ id: 'trade-002', entry: 130000 });
    const comparison = compareOperationWithTrade(toConfront[1].operation, trade);
    expect(comparison.hasDivergences).toBe(true);
    expect(comparison.divergences.some(d => d.field === 'entry')).toBe(true);
  });
});

// ============================================
// 3. Mix: 1 ghost + 1 confront + 1 ambígua → 3 grupos
// ============================================

describe('Cenário 3: cenário misto — 3 ops → 3 grupos distintos', () => {
  it('nenhuma op cai em limbo', () => {
    const ops = [
      makeOp('OP-GHOST', 1, 2),
      makeOp('OP-CONFRONT', 3, 4),
      makeOp('OP-AMBIGUOUS', 5, 6),
    ];
    const correlations = [
      corr(1, { matchType: 'ghost' }),
      corr(2, { matchType: 'ghost' }),
      corr(3, { tradeId: 'trade-A', matchType: 'exact' }),
      corr(4, { tradeId: 'trade-A', matchType: 'exact' }),
      corr(5, { tradeId: 'trade-B', matchType: 'exact' }),
      corr(6, { tradeId: 'trade-C', matchType: 'exact' }),
    ];

    const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(ops, correlations);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].operationId).toBe('OP-GHOST');
    expect(toConfront).toHaveLength(1);
    expect(toConfront[0].operation.operationId).toBe('OP-CONFRONT');
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].operation.operationId).toBe('OP-AMBIGUOUS');
    expect(ambiguous[0].tradeIds).toHaveLength(2);

    // Total = input total — nenhuma perdida
    expect(toCreate.length + toConfront.length + ambiguous.length).toBe(3);
  });
});

// ============================================
// 4. Deduplicação previne criação duplicada
// ============================================

describe('Cenário 4: dedup impede criação de trade existente', () => {
  it('op com mesmo ticker+side+entryTime+qty → duplicata ignorada', async () => {
    const op = makeOp('OP-DUP', 1, 2);
    const existingTrade = makeTrade({
      id: 'existing-001',
      ticker: 'WINJ26',
      side: 'LONG',
      qty: 2,
      entryTime: '2026-04-04T10:00:00',
    });

    const mockCreate = vi.fn(async () => ({ id: 'should-not-be-called' }));
    const result = await createTradesBatch({
      toCreate: [op],
      planId: 'plan-001',
      existingTrades: [existingTrade],
      userContext: makeUser(),
      createTradeFn: mockCreate,
    });

    expect(result.created).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].matchedTradeId).toBe('existing-001');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ============================================
// 5. Throttling batch > 20 → sequencial com progresso
// ============================================

describe('Cenário 5: batch grande → throttling sequencial', () => {
  it('25 ops com threshold 20 → onProgress chamado 25 vezes', async () => {
    const ops = Array.from({ length: 25 }, (_, i) =>
      makeOp(`OP-${i}`, i * 2 + 1, i * 2 + 2, {
        entryTime: `2026-04-04T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}:00`,
      })
    );

    let callCount = 0;
    const mockCreate = vi.fn(async () => ({ id: `trade-${++callCount}`, result: 50 }));
    const progressCalls = [];

    const result = await createTradesBatch({
      toCreate: ops,
      planId: 'plan-001',
      existingTrades: [],
      userContext: makeUser(),
      createTradeFn: mockCreate,
      onProgress: (cur, tot, msg) => progressCalls.push({ cur, tot, msg }),
      threshold: 20,
    });

    expect(result.created).toHaveLength(25);
    expect(progressCalls).toHaveLength(25);
    expect(progressCalls[0].msg).toBe('Criando trade 1 de 25...');
    expect(progressCalls[24].msg).toBe('Criando trade 25 de 25...');
  });
});

// ============================================
// 6. enrichTrade preserva campos comportamentais
// ============================================

describe('Cenário 6: enriquecimento preserva emoção/setup', () => {
  it('mapOperationToTradeData NÃO sobrescreve emoção (campos ficam no gateway via patch seletivo)', () => {
    // enrichTrade só atualiza campos financeiros — testado em tradeGatewayEnrich.test.js
    // Aqui validamos que mapOperationToTradeData seta null nos campos comportamentais
    const op = makeOp('OP-001', 1, 2);
    const tradeData = mapOperationToTradeData(op, 'plan-001');
    expect(tradeData.emotionEntry).toBeNull();
    expect(tradeData.emotionExit).toBeNull();
    expect(tradeData.setup).toBeNull();
    // enrichTrade lê o trade existente e NÃO inclui emoção/setup no patch
    // (coberto em tradeGatewayEnrich.test.js cenário "patch NÃO inclui emotionEntry")
  });
});

// ============================================
// 7. enrichTrade snapshot (coberto em tradeGatewayEnrich.test.js — cross-ref)
// ============================================

describe('Cenário 7: snapshot de enriquecimento verificável', () => {
  it('cross-ref: tradeGatewayEnrich.test.js cobre snapshot com campos before', () => {
    // O snapshot é testado unitariamente em tradeGatewayEnrich.test.js
    // cenário "snapshot contém campos anteriores do trade"
    // Este teste documenta a dependência para rastreabilidade
    expect(true).toBe(true);
  });
});

// ============================================
// 8-9. lowResolution propagação end-to-end
// ============================================

describe('Cenário 8-9: lowResolution flag end-to-end', () => {
  it('CSV sem segundos → lowResolution true → propagado no tradeData', () => {
    const orders = [
      { filledAt: '2026-04-04T10:00:00.000Z', submittedAt: '2026-04-04T09:59:00.000Z' },
      { filledAt: '2026-04-04T10:30:00.000Z', submittedAt: '2026-04-04T10:29:00.000Z' },
    ];
    const lowRes = detectLowResolution(orders);
    expect(lowRes).toBe(true);

    const op = makeOp('OP-001', 1, 2);
    const tradeData = mapOperationToTradeData(op, 'plan-001', 'batch-001', null, true);
    expect(tradeData.lowResolution).toBe(true);
  });

  it('CSV com segundos → lowResolution false → propagado no tradeData', () => {
    const orders = [
      { filledAt: '2026-04-04T10:00:42.000Z' },
    ];
    const lowRes = detectLowResolution(orders);
    expect(lowRes).toBe(false);

    const op = makeOp('OP-001', 1, 2);
    const tradeData = mapOperationToTradeData(op, 'plan-001', 'batch-001', null, false);
    expect(tradeData.lowResolution).toBe(false);
  });
});

// ============================================
// 10. importSummary shape — contagens corretas
// ============================================

describe('Cenário 10: importSummary shape para cenário misto', () => {
  it('contagens refletem categorização real, não parse cheia', async () => {
    // Simula cenário: 3 ops confirmadas, 1 ghost criada, 1 confronto, 1 ambígua
    const ops = [
      makeOp('OP-GHOST', 1, 2),
      makeOp('OP-CONFRONT', 3, 4),
      makeOp('OP-AMBIGUOUS', 5, 6),
    ];
    const correlations = [
      corr(1), corr(2),
      corr(3, { tradeId: 'trade-A', matchType: 'exact' }),
      corr(4, { tradeId: 'trade-A', matchType: 'exact' }),
      corr(5, { tradeId: 'trade-B', matchType: 'exact' }),
      corr(6, { tradeId: 'trade-C', matchType: 'exact' }),
    ];

    const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(ops, correlations);

    // Batch cria trades
    const mockCreate = vi.fn(async () => ({ id: 'trade-new-1', result: 100 }));
    const batchResult = await createTradesBatch({
      toCreate,
      planId: 'plan-001',
      existingTrades: [],
      userContext: makeUser(),
      createTradeFn: mockCreate,
    });

    // Montar importSummary como OrderImportPage faz
    const importSummary = {
      ordersConfirmed: 6, // 6 ordens nas 3 ops
      opsConfirmed: 3,
      toCreateCount: toCreate.length,
      tradesCreated: batchResult.created,
      tradesDuplicates: batchResult.duplicates.length,
      tradesFailed: batchResult.failed,
      toConfrontCount: toConfront.length,
      ambiguousCount: ambiguous.length,
    };

    expect(importSummary.opsConfirmed).toBe(3);
    expect(importSummary.tradesCreated).toHaveLength(1);
    expect(importSummary.toConfrontCount).toBe(1);
    expect(importSummary.ambiguousCount).toBe(1);
    expect(importSummary.tradesDuplicates).toBe(0);
    expect(importSummary.tradesCreated[0].id).toBe('trade-new-1');
  });
});

// ============================================
// 11. Conversational queue (Fase C #156) — composição + decisões
// ============================================

describe('Cenário 11: fila conversacional respeita userDecision antes de criar trades', () => {
  it('só ops com decision confirmed chegam no createTradesBatch; discarded são ignoradas', async () => {
    const ops = [
      makeOp('OP-NEW-1', 1, 2),
      makeOp('OP-NEW-2', 3, 4, { entryTime: '2026-04-04T11:00:00' }),
      makeOp('OP-NEW-3', 5, 6, { entryTime: '2026-04-04T12:00:00' }),
    ];
    const correlations = [
      corr(1), corr(2), corr(3), corr(4), corr(5), corr(6),
    ];

    const { toCreate, toConfront, ambiguous, autoliq } =
      categorizeConfirmedOps(ops, correlations);

    expect(toCreate).toHaveLength(3);
    expect(toConfront).toHaveLength(0);
    expect(ambiguous).toHaveLength(0);
    expect(autoliq).toHaveLength(0);

    // Simula fila conversacional: aluno confirma 2, descarta 1.
    const queue = toCreate.map((op, i) => ({
      operation: op,
      classification: 'new',
      userDecision: i === 1 ? 'discarded' : 'confirmed',
    }));

    const toProcess = queue
      .filter(item => item.userDecision === 'confirmed')
      .map(item => item.operation);

    expect(toProcess).toHaveLength(2);
    expect(toProcess.map(o => o.operationId)).toEqual(['OP-NEW-1', 'OP-NEW-3']);

    const mockCreate = vi.fn(async (data) => ({ id: `created-${data.entryTime}` }));
    const batchResult = await createTradesBatch({
      toCreate: toProcess,
      planId: 'plan-001',
      existingTrades: [],
      userContext: makeUser(),
      createTradeFn: mockCreate,
    });

    expect(batchResult.created).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('classification propagada pela Fase B chega intacta no item da fila', () => {
    const ops = [
      makeOp('OP-NEW', 1, 2),
      makeOp('OP-MATCH', 3, 4),
    ];
    const correlations = [
      corr(1), corr(2),
      corr(3, { tradeId: 'trade-X', matchType: 'exact', confidence: 0.9 }),
      corr(4, { tradeId: 'trade-X', matchType: 'exact', confidence: 0.9 }),
    ];

    const { toCreate, toConfront } = categorizeConfirmedOps(ops, correlations);

    expect(toCreate[0].classification).toBe('new');
    expect(toConfront[0].operation.classification).toBe('match_confident');
    expect(toConfront[0].matchCandidates).toEqual([{ tradeId: 'trade-X', score: 0.9 }]);
  });
});

// ============================================
// 12. Fase E — match_confident enriquece SEM criar duplicata
// ============================================

describe('Cenário 12: match_confident → enrichTrade chamado, createTrade NÃO chamado (Fase E)', () => {
  it('fluxo end-to-end: 1 op correlacionada com trade manual → enrichTrade(tradeId, payload); createTrade zero calls', async () => {
    // Estado: 1 trade manual já registrado no diário
    const existingTrade = makeTrade({
      id: 'trade-manual-001',
      ticker: 'WINJ26',
      side: 'LONG',
      entry: 130000,
      exit: 130050,
      qty: 2,
      entryTime: '2026-04-04T10:00:00',
      emotionEntry: 'CALMO',
      emotionExit: 'SATISFEITO',
      setup: 'BREAKOUT',
    });

    // CSV com ordens correspondentes ao trade manual
    const ops = [makeOp('OP-MATCHED', 1, 2)];
    const correlations = [
      corr(1, { tradeId: 'trade-manual-001', matchType: 'exact', confidence: 0.95 }),
      corr(2, { tradeId: 'trade-manual-001', matchType: 'exact', confidence: 0.95 }),
    ];

    // Classificação Fase B emite match_confident com tradeId
    const { toCreate, toConfront, ambiguous, autoliq } = categorizeConfirmedOps(ops, correlations);
    expect(toCreate).toHaveLength(0);
    expect(toConfront).toHaveLength(1);
    expect(ambiguous).toHaveLength(0);
    expect(autoliq).toHaveLength(0);
    expect(toConfront[0].operation.classification).toBe(CLASSIFICATION.MATCH_CONFIDENT);
    expect(toConfront[0].tradeId).toBe('trade-manual-001');

    // Aluno clica "Confirmar" → fila com userDecision=confirmed
    const queue = toConfront.map(({ operation, tradeId, matchCandidates }) => ({
      operation,
      classification: CLASSIFICATION.MATCH_CONFIDENT,
      tradeId,
      matchCandidates,
      userDecision: 'confirmed',
    }));

    // Router Fase E: tudo em toEnrich, nada em toCreate
    const { toEnrich, toCreate: toCreateOps, discarded } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(1);
    expect(toEnrich[0].tradeId).toBe('trade-manual-001');
    expect(toCreateOps).toHaveLength(0);
    expect(discarded).toHaveLength(0);

    // Simular tradeGateway.enrichTrade: retorna before (snapshot) + after (enriquecido)
    const enrichTradeFn = vi.fn(async (tradeId, payload, userCtx) => {
      expect(userCtx.uid).toBe('user-001');
      return {
        id: tradeId,
        before: { ...existingTrade },
        after: {
          ...existingTrade,
          entry: payload.entry,
          exit: payload.exit,
          qty: payload.qty,
          _partials: payload._partials,
          enrichedByImport: true,
          importBatchId: payload.importBatchId,
          // Invariante: snapshot preservado (testado unitariamente em tradeGatewayEnrich)
          _enrichmentSnapshot: { entry: existingTrade.entry, exit: existingTrade.exit, qty: existingTrade.qty },
        },
      };
    });

    // Mock de createTrade — DEVE ficar com zero calls.
    const createTradeFn = vi.fn(async () => {
      throw new Error('createTrade não deveria ser chamado em match_confident');
    });

    // Executar enrichment batch
    const enrichResult = await enrichConversationalBatch({
      toEnrich,
      userContext: makeUser(),
      importBatchId: 'batch-TEST',
      enrichTradeFn,
    });

    expect(enrichResult.enriched).toHaveLength(1);
    expect(enrichResult.failed).toHaveLength(0);
    expect(enrichTradeFn).toHaveBeenCalledTimes(1);
    expect(enrichTradeFn).toHaveBeenCalledWith(
      'trade-manual-001',
      expect.objectContaining({
        entry: 130000,
        exit: 130050,
        qty: 2,
        importBatchId: 'batch-TEST',
        _partials: expect.any(Array),
      }),
      expect.objectContaining({ uid: 'user-001' })
    );

    // Snapshot preservado no retorno (_enrichmentSnapshot é garantia do gateway)
    expect(enrichResult.enriched[0].after._enrichmentSnapshot).toBeDefined();
    expect(enrichResult.enriched[0].after._enrichmentSnapshot.entry).toBe(130000);

    // Fluxo de criação de novo trade — zero invocações
    const batchResult = await createTradesBatch({
      toCreate: toCreateOps,
      planId: 'plan-001',
      existingTrades: [existingTrade],
      userContext: makeUser(),
      createTradeFn,
    });
    expect(batchResult.created).toHaveLength(0);
    expect(createTradeFn).not.toHaveBeenCalled();
  });

  it('userDecision=discarded NÃO cria trade nem enriquece; vai para bucket discarded', async () => {
    const ops = [makeOp('OP-DISC', 1, 2)];
    const correlations = [corr(1), corr(2)]; // ghost

    const { toCreate } = categorizeConfirmedOps(ops, correlations);
    const queue = toCreate.map(op => ({
      operation: op,
      classification: CLASSIFICATION.NEW,
      userDecision: 'discarded',
    }));

    const { toEnrich, toCreate: toCreateOps, discarded } = routeConversationalDecisions(queue);
    expect(toEnrich).toHaveLength(0);
    expect(toCreateOps).toHaveLength(0);
    expect(discarded).toHaveLength(1);
    expect(discarded[0].operation.operationId).toBe('OP-DISC');

    const enrichTradeFn = vi.fn();
    const createTradeFn = vi.fn();
    await enrichConversationalBatch({
      toEnrich,
      userContext: makeUser(),
      enrichTradeFn,
    });
    await createTradesBatch({
      toCreate: toCreateOps,
      planId: 'p',
      existingTrades: [],
      userContext: makeUser(),
      createTradeFn,
    });
    expect(enrichTradeFn).not.toHaveBeenCalled();
    expect(createTradeFn).not.toHaveBeenCalled();
  });
});

// ============================================
// Cenário 13: aumento de posição no meio da operação (#351)
// ============================================

// Recorte do CSV real de ordens do ProfitChart-Pro (WINV26, 18/08/2026, op de +R$521,00):
// compra de 5 na abertura, compra de 3 no meio (14:46:17), saída de 8 no fechamento.
// O fill do meio fica a 47min46s da abertura e 28min31s do fechamento do trade.
const CSV_AUMENTO_POSICAO = [
  '20851ac4bd71833bfde04b20e00024b1,18/08/2026,18/08/2026',
  'Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criacao;Ultima Atualizacao;Preco;Preco Stop;Qtd;Preco Medio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estrategia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem',
  'Simulador;1000319383;Marcio Portes;NELO.126524;WINV26;V;Executada;18/08/2026 13:58:31;18/08/2026 15:14:48;170.155,00;-;5;170.155,00;5;-;170.155,00;170.155,00;Hoje;-;Normal;;-;Limite;-;BMF;Estrategia',
  ';;;;;;Trade;18/08/2026 15:14:48;;;;;170.155,00;5',
  'Simulador;1000319383;Marcio Portes;NELO.134405;WINV26;V;Executada;18/08/2026 14:46:17;18/08/2026 15:14:48;170.155,00;-;3;170.155,00;3;-;102.093,00;102.093,00;Hoje;-;Normal;;-;Limite;-;BMF;Estrategia',
  ';;;;;;Trade;18/08/2026 15:14:48;;;;;170.155,00;3',
  'Simulador;1000319383;Marcio Portes;NELO.126657;WINV26;C;Executada;18/08/2026 13:59:00;18/08/2026 14:46:17;169.950,00;-;3;169.945,00;3;-;101.970,00;101.967,00;Hoje;-;Normal;;-;Limite;-;BMF;Grafico',
  ';;;;;;Trade;18/08/2026 14:46:17;;;;;169.945,00;3',
  'Simulador;1000319383;Marcio Portes;NELO.126522;WINV26;C;Executada;18/08/2026 13:58:30;18/08/2026 13:58:31;169.760,00;-;5;169.760,00;5;-;169.760,00;169.760,00;Hoje;-;Normal;;-;Limite;-;BMF;Grafico',
  ';;;;;;Trade;18/08/2026 13:58:31;;;;;169.760,00;1',
  ';;;;;;Trade;18/08/2026 13:58:31;;;;;169.760,00;4',
].join('\n');

describe('Cenário 13: aumento de posição no meio da operação (#351)', () => {
  const parse = () => parseProfitChartPro(CSV_AUMENTO_POSICAO);

  it('reconstrução agrega as 2 entradas — média ponderada bate com a corretora', () => {
    const { orders } = parse();
    const ops = reconstructOperations(orders, { timezone: 'America/Sao_Paulo' });

    expect(ops).toHaveLength(1);
    expect(ops[0].entryOrders).toHaveLength(2);
    expect(ops[0].totalQty).toBe(8);
    // (5×169.760 + 3×169.945) / 8 — o "Preço Compra" do CSV de operações é 169.829,38
    expect(ops[0].avgEntryPrice).toBeCloseTo(169829.375, 2);
    expect(ops[0].resultPoints).toBeCloseTo(325.625, 2);
  });

  it('pipeline completo: nenhum fill fica órfão do trade existente', () => {
    const { orders } = parse();
    const tradeExistente = {
      id: 'tradeWIN18',
      ticker: 'WINV26',
      side: 'LONG',
      qty: 8,
      entryTime: '2026-08-18T13:58:31-03:00',
      exitTime: '2026-08-18T15:14:48-03:00',
    };

    const { correlations, stats } = correlateOrders(orders, [tradeExistente]);

    expect(stats.ghost).toBe(0);
    expect(stats.orphanFills).toBe(0);
    expect(correlations.every(c => c.tradeId === 'tradeWIN18')).toBe(true);
  });

  it('operação cai em match_confident — o fill do meio não a torna ambígua', () => {
    const { orders } = parse();
    const ops = reconstructOperations(orders, { timezone: 'America/Sao_Paulo' });
    const tradeExistente = {
      id: 'tradeWIN18',
      ticker: 'WINV26',
      side: 'LONG',
      qty: 8,
      entryTime: '2026-08-18T13:58:31-03:00',
      exitTime: '2026-08-18T15:14:48-03:00',
    };

    const { correlations } = correlateOrders(orders, [tradeExistente]);
    const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(ops, correlations);

    expect(ambiguous).toHaveLength(0);
    expect(toCreate).toHaveLength(0);
    expect(toConfront).toHaveLength(1);
    expect(toConfront[0].tradeId).toBe('tradeWIN18');
    expect(toConfront[0].operation.classification).toBe(CLASSIFICATION.MATCH_CONFIDENT);
  });
});

// ============================================
// Cenários 14-18 (#366) — a gravação acontece depois da decisão
// ============================================

describe('#366 — ordem de gravação e escopo do que é gravado', () => {
  const opComOrdens = (id, tradeId = null) => ({
    operation: {
      operationId: id,
      instrument: 'WINJ26',
      entryOrders: [{ externalOrderId: `${id}-E`, instrument: 'WINJ26', side: 'BUY', quantity: 1 }],
      exitOrders: [{ externalOrderId: `${id}-X`, instrument: 'WINJ26', side: 'SELL', quantity: 1 }],
      stopOrders: [],
      cancelledOrders: [],
    },
    classification: tradeId ? CLASSIFICATION.MATCH_CONFIDENT : CLASSIFICATION.NEW,
    tradeId,
    userDecision: 'pending',
  });

  const rodar = async (queue, extra = {}) => {
    const callOrder = [];
    const ingestFn = vi.fn(async (correlations, orderKeys) => {
      callOrder.push('ingest');
      return { success: orderKeys.length, correlations };
    });
    const createFn = vi.fn(async (toCreate) => {
      callOrder.push('create');
      return { created: toCreate.map(o => ({ id: `T-${o.operationId}` })), duplicates: [], failed: [] };
    });
    const enrichFn = vi.fn(async (toEnrich) => {
      callOrder.push('enrich');
      return { enriched: toEnrich.map(i => ({ tradeId: i.tradeId })), failed: [] };
    });

    const r = await persistImportDecisions({ queue, ingestFn, createFn, enrichFn, ...extra });
    return { ...r, callOrder, ingestFn, createFn, enrichFn };
  };

  it('as ordens são gravadas ANTES do primeiro trade — guarda do #351', async () => {
    // linkOrdersToCreatedTrade roda dentro de onTradeCreated e desiste se `orders`
    // do batch estiver vazia. Inverter esta ordem devolve todo trade nascido do
    // import ao estado órfão (194 de 198 medidos em produção).
    const { callOrder } = await rodar([{ ...opComOrdens('OP-1'), userDecision: 'confirmed' }]);

    expect(callOrder).toEqual(['ingest', 'create', 'enrich']);
  });

  it('operação descartada não tem ordem gravada nem trade criado', async () => {
    const { ingestFn, createFn } = await rodar([
      { ...opComOrdens('OP-1'), userDecision: 'confirmed' },
      { ...opComOrdens('OP-2'), userDecision: 'discarded' },
    ]);

    const chaves = ingestFn.mock.calls[0][1];
    expect(chaves).toContain('eid:OP-1-E');
    expect(chaves.some(k => k.startsWith('eid:OP-2'))).toBe(false);
    expect(createFn.mock.calls[0][0]).toHaveLength(1);
  });

  it('operação sem decisão não grava nada — nem ordem, nem trade', async () => {
    const { ingestFn, createFn, enrichFn } = await rodar([opComOrdens('OP-3')]);

    expect(ingestFn.mock.calls[0][1]).toEqual([]);
    expect(createFn.mock.calls[0][0]).toEqual([]);
    expect(enrichFn.mock.calls[0][0]).toEqual([]);
  });

  it('o vínculo das ordens vem da decisão do aluno, não da sugestão automática', async () => {
    const item = { ...opComOrdens('OP-4', 'TRADE-ESCOLHIDO'), userDecision: 'confirmed' };
    const auto = [{ externalOrderId: 'OP-4-E', tradeId: 'TRADE-SUGERIDO', confidence: 0.7 }];
    const { ingestFn } = await rodar([item], { autoCorrelations: auto });

    expect(ingestFn.mock.calls[0][0]['eid:OP-4-E'].tradeId).toBe('TRADE-ESCOLHIDO');
    expect(ingestFn.mock.calls[0][0]['eid:OP-4-X'].tradeId).toBe('TRADE-ESCOLHIDO');
  });

  it('retry após falha na criação de trades não reingere', async () => {
    const queue = [{ ...opComOrdens('OP-5'), userDecision: 'confirmed' }];
    const { ingestFn, createFn } = await rodar(queue, { alreadyIngested: true });

    expect(ingestFn).not.toHaveBeenCalled();
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('repassa as chaves já existentes em `orders` para a ingestão pular', async () => {
    const existingKeys = new Set(['eid:OP-6-E']);
    const { ingestFn } = await rodar(
      [{ ...opComOrdens('OP-6'), userDecision: 'confirmed' }],
      { existingKeys },
    );

    expect(ingestFn.mock.calls[0][2]).toEqual({ existingKeys });
  });
});

describe('#366 — retomada de lote pendente', () => {
  const parse = () => parseProfitChartPro(CSV_AUMENTO_POSICAO);

  it('preserva a classificação: op já confrontada não vira trade novo', () => {
    // O join da correlação é por _rowIndex, que o staging não persiste. Sem
    // reatribuição, correlationByRowIndex.get(undefined) não casa e a operação cai
    // em toCreate — duplicando o trade que ela já tinha.
    const { orders } = parse();
    const docsDeStaging = orders.map(({ _rowIndex, ...resto }, i) => ({
      ...resto, id: `stg-${i}`, importBatchId: 'ord_1', studentId: 'S1', userDecision: 'pending',
    }));

    const reidratadas = stagingDocsToOrders(docsDeStaging);
    const ops = reconstructOperations(reidratadas, { timezone: 'America/Sao_Paulo' });
    const tradeExistente = {
      id: 'tradeWIN18', ticker: 'WINV26', side: 'LONG', qty: 8,
      entryTime: '2026-08-18T13:58:31-03:00', exitTime: '2026-08-18T15:14:48-03:00',
    };

    const { correlations } = correlateOrders(reidratadas, [tradeExistente]);
    const { toCreate, toConfront } = categorizeConfirmedOps(ops, correlations);

    expect(toConfront).toHaveLength(1);
    expect(toCreate).toHaveLength(0);
  });
});
