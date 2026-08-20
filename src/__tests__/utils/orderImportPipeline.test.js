/**
 * orderImportPipeline.test.js
 * @description Helpers do passo final do Order Import (issue #366).
 *
 *   O wizard gravava em `orders` na Revisão de Operações, antes da decisão por
 *   operação — descartada e pending ficavam gravadas para sempre. Estes helpers
 *   são o que permite mover a escrita para depois da decisão:
 *
 *   - finalOrderKeysFromQueue: só as ordens de operações efetivamente decididas
 *   - correlationsFromDecisions: o vínculo vem da DECISÃO do aluno, não da
 *     sugestão automática (as ordens de operação enriquecida nunca eram ligadas —
 *     linkOrdersToCreatedTrade só cobre trade novo)
 *   - stagingDocsToOrders: rehydration para retomada, reatribuindo _rowIndex, que
 *     é a chave de join da correlação (orderTradeCreation.js) e NÃO é persistido
 *     no staging
 */

import { describe, it, expect } from 'vitest';
import {
  operationOrders,
  finalOrderKeysFromQueue,
  correlationsFromDecisions,
  stagingDocsToOrders,
} from '../../utils/orderImportPipeline';

const ordem = (over = {}) => ({
  externalOrderId: null,
  instrument: 'WDOQ26',
  side: 'BUY',
  submittedAt: '2026-08-19T13:00:00.000Z',
  quantity: 1,
  filledAt: '2026-08-19T13:00:01.000Z',
  ...over,
});

const operacao = (id, over = {}) => ({
  operationId: id,
  entryOrders: [ordem({ externalOrderId: `${id}-E` })],
  exitOrders: [ordem({ externalOrderId: `${id}-X`, side: 'SELL' })],
  stopOrders: [ordem({ externalOrderId: `${id}-S`, side: 'SELL' })],
  cancelledOrders: [ordem({ externalOrderId: `${id}-C`, side: 'SELL' })],
  ...over,
});

describe('operationOrders', () => {
  it('reúne entry + exit + stop + cancelled', () => {
    expect(operationOrders(operacao('OP-001'))).toHaveLength(4);
  });

  it('tolera operação sem os arrays opcionais', () => {
    expect(operationOrders({ entryOrders: [ordem()] })).toHaveLength(1);
    expect(operationOrders(null)).toEqual([]);
  });
});

describe('finalOrderKeysFromQueue', () => {
  const fila = [
    { operation: operacao('OP-001'), userDecision: 'confirmed' },
    { operation: operacao('OP-002'), userDecision: 'adjusted' },
    { operation: operacao('OP-003'), userDecision: 'discarded' },
    { operation: operacao('OP-004'), userDecision: 'pending' },
  ];

  it('inclui as 4 ordens de cada operação decidida', () => {
    const keys = finalOrderKeysFromQueue(fila);
    expect(keys).toContain('eid:OP-001-E');
    expect(keys).toContain('eid:OP-001-X');
    expect(keys).toContain('eid:OP-001-S');
    expect(keys).toContain('eid:OP-001-C');
    expect(keys).toContain('eid:OP-002-E');
  });

  it('NUNCA inclui ordem de operação descartada', () => {
    const keys = finalOrderKeysFromQueue(fila);
    expect(keys.some(k => k.startsWith('eid:OP-003'))).toBe(false);
  });

  it('NUNCA inclui ordem de operação pending', () => {
    const keys = finalOrderKeysFromQueue(fila);
    expect(keys.some(k => k.startsWith('eid:OP-004'))).toBe(false);
  });

  it('fila só com pending devolve lista vazia — nada a gravar', () => {
    expect(finalOrderKeysFromQueue([{ operation: operacao('OP-009'), userDecision: 'pending' }])).toEqual([]);
  });

  it('deduplica chave repetida entre operações', () => {
    const compartilhada = ordem({ externalOrderId: 'SHARED' });
    const dupla = [
      { operation: { operationId: 'A', entryOrders: [compartilhada] }, userDecision: 'confirmed' },
      { operation: { operationId: 'B', entryOrders: [compartilhada] }, userDecision: 'confirmed' },
    ];
    expect(finalOrderKeysFromQueue(dupla)).toEqual(['eid:SHARED']);
  });
});

describe('correlationsFromDecisions', () => {
  it('usa o trade escolhido pelo aluno quando ele contraria a sugestão automática', () => {
    const item = { operation: operacao('OP-010'), userDecision: 'confirmed', tradeId: 'TRADE-B' };
    const auto = [{ externalOrderId: 'OP-010-E', tradeId: 'TRADE-A', confidence: 0.8 }];
    const map = correlationsFromDecisions([item], auto);
    expect(map['eid:OP-010-E']).toEqual({ tradeId: 'TRADE-B', confidence: 1 });
  });

  it('liga as ordens de operação ENRIQUECIDA — hoje elas ficam órfãs', () => {
    const item = {
      operation: operacao('OP-011'),
      userDecision: 'adjusted',
      classification: 'match_confident',
      tradeId: 'TRADE-EXISTENTE',
    };
    const map = correlationsFromDecisions([item], []);
    expect(map['eid:OP-011-E'].tradeId).toBe('TRADE-EXISTENTE');
    expect(map['eid:OP-011-S'].tradeId).toBe('TRADE-EXISTENTE');
  });

  it('preserva a correlação automática de ordem cuja operação não tem tradeId decidido', () => {
    const item = { operation: operacao('OP-012'), userDecision: 'confirmed' };
    const auto = [{ externalOrderId: 'OP-012-E', tradeId: 'TRADE-AUTO', confidence: 0.9 }];
    const map = correlationsFromDecisions([item], auto);
    expect(map['eid:OP-012-E']).toEqual({ tradeId: 'TRADE-AUTO', confidence: 0.9 });
  });

  it('ignora operação descartada — não gera vínculo', () => {
    const item = { operation: operacao('OP-013'), userDecision: 'discarded', tradeId: 'TRADE-X' };
    expect(correlationsFromDecisions([item], [])).toEqual({});
  });

  it('ignora entrada automática sem tradeId', () => {
    const auto = [{ externalOrderId: 'OP-014-E', tradeId: null, confidence: 0 }];
    expect(correlationsFromDecisions([], auto)).toEqual({});
  });
});

describe('stagingDocsToOrders', () => {
  const docs = [
    {
      id: 'doc-b', studentId: 'S1', importBatchId: 'ord_1', planId: 'P1', createdAt: { seconds: 2 },
      userDecision: 'pending', classification: null, matchCandidates: [], importTimezone: 'America/Sao_Paulo',
      externalOrderId: 'B', instrument: 'WDOQ26', side: 'SELL', quantity: 1,
      submittedAt: '2026-08-19T13:05:00.000Z', filledAt: '2026-08-19T13:05:02.000Z',
    },
    {
      id: 'doc-a', studentId: 'S1', importBatchId: 'ord_1', planId: 'P1', createdAt: { seconds: 1 },
      userDecision: 'pending', classification: null, matchCandidates: [], importTimezone: 'America/Sao_Paulo',
      externalOrderId: 'A', instrument: 'WDOQ26', side: 'BUY', quantity: 1,
      submittedAt: '2026-08-19T13:00:00.000Z', filledAt: '2026-08-19T13:00:02.000Z',
    },
  ];

  it('reatribui _rowIndex sequencial — sem isso a correlação da retomada casa contra undefined', () => {
    const orders = stagingDocsToOrders(docs);
    expect(orders.map(o => o._rowIndex)).toEqual([1, 2]);
  });

  it('ordena determinicamente por submittedAt, não pela ordem de chegada do snapshot', () => {
    expect(stagingDocsToOrders(docs).map(o => o.externalOrderId)).toEqual(['A', 'B']);
  });

  it('devolve ordens no formato do parser — sem os campos de controle do staging', () => {
    const [primeira] = stagingDocsToOrders(docs);
    expect(primeira.instrument).toBe('WDOQ26');
    expect(primeira.externalOrderId).toBe('A');
    for (const campo of ['id', 'importBatchId', 'studentId', 'createdAt', 'userDecision', 'importTimezone']) {
      expect(primeira).not.toHaveProperty(campo);
    }
  });

  it('_rowIndex é estável entre duas rehydrations do mesmo lote', () => {
    const a = stagingDocsToOrders(docs);
    const b = stagingDocsToOrders([...docs].reverse());
    expect(a.map(o => o._rowIndex)).toEqual(b.map(o => o._rowIndex));
    expect(a.map(o => o.externalOrderId)).toEqual(b.map(o => o.externalOrderId));
  });

  it('tolera lista vazia', () => {
    expect(stagingDocsToOrders([])).toEqual([]);
  });
});
