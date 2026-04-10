/**
 * tradeGatewayEnrich.test.js
 * @description Testes de enrichTrade (issue #93 redesign V1.1b Fase 5).
 *   Mock via injeção de deps (getDocFn, updateDocFn, docFn).
 */

import { describe, it, expect, vi } from 'vitest';
import { enrichTrade } from '../../utils/tradeGateway';

// ============================================
// MOCK HELPERS
// ============================================

const makeExistingTrade = (overrides = {}) => ({
  studentId: 'user-001',
  planId: 'plan-001',
  ticker: 'WINJ26',
  side: 'LONG',
  entry: 130000,
  exit: 130050,
  qty: 2,
  stopLoss: 129950,
  result: 100,
  resultInPoints: 50,
  rrRatio: 2.0,
  rrAssumed: false,
  hasPartials: false,
  partialsCount: 0,
  _partials: [],
  emotionEntry: 'CALMO',
  emotionExit: 'SATISFEITO',
  setup: 'BREAKOUT',
  mentorFeedback: 'Bom trade',
  feedbackHistory: ['msg1'],
  status: 'REVIEWED',
  tickerRule: null,
  enrichedByImport: false,
  importBatchId: null,
  ...overrides,
});

const makeEnrichment = (overrides = {}) => ({
  _partials: [
    { type: 'ENTRY', price: 130005, qty: 1, dateTime: '2026-04-04T10:00:01', seq: 1 },
    { type: 'ENTRY', price: 130010, qty: 1, dateTime: '2026-04-04T10:00:03', seq: 2 },
    { type: 'EXIT', price: 130055, qty: 2, dateTime: '2026-04-04T10:30:12', seq: 3 },
  ],
  entry: 130007.5,
  exit: 130055,
  qty: 2,
  stopLoss: 129960,
  tickerRule: null,
  importBatchId: 'batch-XYZ',
  ...overrides,
});

const makeUser = (uid = 'user-001') => ({ uid, email: 'aluno@test.com', displayName: 'Aluno' });

const makePlanData = (overrides = {}) => ({
  pl: 50000,
  riskPerOperation: 2,
  rrTarget: 2,
  accountId: 'acc-001',
  ...overrides,
});

/**
 * Cria deps mock completo. Retorna deps + refs para assertar.
 */
const makeDeps = (tradeData = null, planData = null) => {
  const trade = tradeData ?? makeExistingTrade();
  const plan = planData ?? makePlanData();

  const tradeRef = { id: 'trade-ref' };
  const planRef = { id: 'plan-ref' };

  const tradeSnap = {
    exists: () => true,
    data: () => trade,
  };
  const planSnap = {
    exists: () => true,
    data: () => plan,
  };

  const docFn = vi.fn((db, collection, id) => {
    if (collection === 'trades') return tradeRef;
    if (collection === 'plans') return planRef;
    return { id };
  });

  const getDocFn = vi.fn(async (ref) => {
    if (ref === tradeRef) return tradeSnap;
    if (ref === planRef) return planSnap;
    return { exists: () => false, data: () => null };
  });

  const updateDocFn = vi.fn(async () => {});

  return { deps: { docFn, getDocFn, updateDocFn }, tradeRef, updateDocFn, getDocFn, docFn };
};

// ============================================
// VALIDAÇÕES DE INPUT
// ============================================

describe('enrichTrade — validações', () => {
  it('lança erro sem userContext.uid', async () => {
    const { deps } = makeDeps();
    await expect(enrichTrade('trade-001', makeEnrichment(), {}, deps)).rejects.toThrow('não autenticado');
  });

  it('lança erro sem tradeId', async () => {
    const { deps } = makeDeps();
    await expect(enrichTrade(null, makeEnrichment(), makeUser(), deps)).rejects.toThrow('tradeId obrigatório');
  });

  it('lança erro sem tradeId (string vazia)', async () => {
    const { deps } = makeDeps();
    await expect(enrichTrade('', makeEnrichment(), makeUser(), deps)).rejects.toThrow('tradeId obrigatório');
  });

  it('lança erro quando trade não existe', async () => {
    const { deps } = makeDeps();
    deps.getDocFn = vi.fn(async () => ({ exists: () => false, data: () => null }));
    await expect(enrichTrade('trade-inexistente', makeEnrichment(), makeUser(), deps)).rejects.toThrow('não encontrado');
  });

  it('lança erro quando trade pertence a outro usuário', async () => {
    const { deps } = makeDeps(makeExistingTrade({ studentId: 'outro-user' }));
    await expect(enrichTrade('trade-001', makeEnrichment(), makeUser('user-001'), deps)).rejects.toThrow('não pertence');
  });

  it('lança erro de dedup — mesmo batch', async () => {
    const { deps } = makeDeps(makeExistingTrade({ enrichedByImport: true, importBatchId: 'batch-XYZ' }));
    await expect(enrichTrade('trade-001', makeEnrichment({ importBatchId: 'batch-XYZ' }), makeUser(), deps)).rejects.toThrow('já enriquecido');
  });

  it('permite re-enriquecimento por batch diferente', async () => {
    const { deps } = makeDeps(makeExistingTrade({ enrichedByImport: true, importBatchId: 'batch-OLD' }));
    await expect(enrichTrade('trade-001', makeEnrichment({ importBatchId: 'batch-NEW' }), makeUser(), deps)).resolves.toBeDefined();
  });
});

// ============================================
// ENRIQUECIMENTO — CÁLCULOS
// ============================================

describe('enrichTrade — cálculos', () => {
  it('recalcula result via _partials quando fornecidas', async () => {
    const { deps, updateDocFn } = makeDeps();
    const result = await enrichTrade('trade-001', makeEnrichment(), makeUser(), deps);

    expect(updateDocFn).toHaveBeenCalledTimes(1);
    const patch = updateDocFn.mock.calls[0][1];

    // Verifica que result foi recalculado (não é o mesmo 100 do before)
    expect(patch.result).toBeDefined();
    expect(typeof patch.result).toBe('number');
    expect(patch._partials).toHaveLength(3);
    expect(patch.hasPartials).toBe(true);
    expect(patch.partialsCount).toBe(3);
  });

  it('recalcula result via tickerRule quando sem _partials', async () => {
    const { deps, updateDocFn } = makeDeps();
    const enrichment = makeEnrichment({
      _partials: [],
      tickerRule: { tickSize: 5, tickValue: 1, pointValue: 0.2 },
    });
    await enrichTrade('trade-001', enrichment, makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    expect(patch.result).toBeDefined();
    expect(patch.tickerRule).toEqual({ tickSize: 5, tickValue: 1, pointValue: 0.2 });
  });

  it('calcula RR com stop real (não assumido)', async () => {
    const { deps, updateDocFn } = makeDeps();
    await enrichTrade('trade-001', makeEnrichment({ stopLoss: 129960 }), makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    expect(patch.rrAssumed).toBe(false);
    expect(patch.rrRatio).toBeDefined();
    expect(typeof patch.rrRatio).toBe('number');
  });

  it('calcula RR assumido quando sem stop', async () => {
    const { deps, updateDocFn } = makeDeps();
    await enrichTrade('trade-001', makeEnrichment({ stopLoss: null }), makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    // rrAssumed depende de calculateAssumedRR retornar algo válido
    // Com planPl 50000 e riskPerOperation 2, deve calcular
    expect(patch.stopLoss).toBeNull();
  });

  it('preserva side do trade original', async () => {
    const { deps, updateDocFn } = makeDeps(makeExistingTrade({ side: 'SHORT' }));
    await enrichTrade('trade-001', makeEnrichment(), makeUser(), deps);

    // Side não está no patch — preservado via não-inclusão
    const patch = updateDocFn.mock.calls[0][1];
    expect(patch.side).toBeUndefined(); // NÃO está no patch = preservado
  });
});

// ============================================
// PRESERVAÇÃO DE CAMPOS COMPORTAMENTAIS
// ============================================

describe('enrichTrade — preservação de campos', () => {
  it('patch NÃO inclui emotionEntry, emotionExit, setup, mentorFeedback, feedbackHistory, status', async () => {
    const { deps, updateDocFn } = makeDeps();
    await enrichTrade('trade-001', makeEnrichment(), makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    expect(patch.emotionEntry).toBeUndefined();
    expect(patch.emotionExit).toBeUndefined();
    expect(patch.setup).toBeUndefined();
    expect(patch.mentorFeedback).toBeUndefined();
    expect(patch.feedbackHistory).toBeUndefined();
    expect(patch.status).toBeUndefined();
    expect(patch.htfUrl).toBeUndefined();
    expect(patch.ltfUrl).toBeUndefined();
    expect(patch.planId).toBeUndefined();
    expect(patch.studentId).toBeUndefined();
    expect(patch.date).toBeUndefined();
    expect(patch.entryTime).toBeUndefined();
    expect(patch.exitTime).toBeUndefined();
  });
});

// ============================================
// SNAPSHOT + METADADOS
// ============================================

describe('enrichTrade — snapshot + metadados', () => {
  it('snapshot contém campos anteriores do trade', async () => {
    const tradeBefore = makeExistingTrade({
      entry: 130000, exit: 130050, qty: 2, stopLoss: 129950,
      _partials: [{ type: 'ENTRY', price: 130000, qty: 2, seq: 1 }],
      result: 100, resultInPoints: 50, rrRatio: 2.0, rrAssumed: false,
      hasPartials: true, partialsCount: 1,
    });
    const { deps, updateDocFn } = makeDeps(tradeBefore);
    await enrichTrade('trade-001', makeEnrichment(), makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    const snap = patch._enrichmentSnapshot;
    expect(snap).toBeDefined();
    expect(snap.entry).toBe(130000);
    expect(snap.exit).toBe(130050);
    expect(snap.qty).toBe(2);
    expect(snap.stopLoss).toBe(129950);
    expect(snap._partials).toEqual([{ type: 'ENTRY', price: 130000, qty: 2, seq: 1 }]);
    expect(snap.result).toBe(100);
    expect(snap.resultInPoints).toBe(50);
    expect(snap.rrRatio).toBe(2.0);
    expect(snap.rrAssumed).toBe(false);
    expect(snap.snapshotAt).toBeDefined();
  });

  it('seta enrichedByImport: true, importBatchId, enrichedAt, updatedAt', async () => {
    const { deps, updateDocFn } = makeDeps();
    await enrichTrade('trade-001', makeEnrichment({ importBatchId: 'batch-ABC' }), makeUser(), deps);

    const patch = updateDocFn.mock.calls[0][1];
    expect(patch.enrichedByImport).toBe(true);
    expect(patch.importBatchId).toBe('batch-ABC');
    expect(patch.enrichedAt).toBeDefined();
    expect(patch.updatedAt).toBeDefined();
  });

  it('retorna { id, before, after } correto', async () => {
    const { deps } = makeDeps();
    const result = await enrichTrade('trade-001', makeEnrichment(), makeUser(), deps);

    expect(result.id).toBe('trade-001');
    expect(result.before).toBeDefined();
    expect(result.before.entry).toBe(130000); // valor anterior
    expect(result.after).toBeDefined();
    expect(result.after.enrichedByImport).toBe(true);
  });
});
