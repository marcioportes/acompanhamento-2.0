/**
 * migrationLogic.test.js — Issue #269 (Fase C)
 *
 * Cobre o núcleo puro da migration retroativa de reviewState (D8).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  collectDiscussedTradeIds,
  buildReviewMaps,
  targetReviewState,
  assignSequenceNumbers,
  tradeNeedsUpdate,
} = require('../../reviews/migrationLogic');

const closed = (id, opts = {}) => ({ id, status: 'CLOSED', ...opts });
const draft = (id, opts = {}) => ({ id, status: 'DRAFT', ...opts });

describe('collectDiscussedTradeIds', () => {
  it('une periodTrades + includedTradeIds', () => {
    const r = closed('R1', {
      frozenSnapshot: { periodTrades: [{ tradeId: 't1' }, { tradeId: 't2' }] },
      includedTradeIds: ['t3'],
    });
    expect(collectDiscussedTradeIds(r).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('cai em top/bottomTrades quando periodTrades ausente (review legada)', () => {
    const r = closed('R0', {
      frozenSnapshot: { topTrades: [{ tradeId: 'a' }], bottomTrades: [{ tradeId: 'b' }] },
    });
    expect(collectDiscussedTradeIds(r).sort()).toEqual(['a', 'b']);
  });

  it('tolera snapshot ausente e ids não-string', () => {
    expect(collectDiscussedTradeIds({ id: 'X' })).toEqual([]);
    expect(collectDiscussedTradeIds({ frozenSnapshot: { periodTrades: [{ tradeId: 5 }, {}] } })).toEqual([]);
  });
});

describe('buildReviewMaps + targetReviewState', () => {
  it('DISCUSSED vence DRAFT (imortalidade)', () => {
    const reviews = [
      closed('R1', { frozenSnapshot: { periodTrades: [{ tradeId: 't1' }] } }),
      draft('R2', { planId: 'p1', frozenSnapshot: { periodTrades: [{ tradeId: 't1' }, { tradeId: 't2' }] } }),
    ];
    const maps = buildReviewMaps(reviews);
    expect(targetReviewState('t1', maps)).toEqual({ reviewState: 'DISCUSSED', draftReviewId: null });
    expect(targetReviewState('t2', maps)).toEqual({ reviewState: 'DRAFT', draftReviewId: 'R2' });
    expect(targetReviewState('t9', maps)).toEqual({ reviewState: 'NONE', draftReviewId: null });
  });

  it('ponteiro do plano = DRAFT mais recente; múltiplos DRAFT geram conflito reportado', () => {
    const reviews = [
      draft('R-old', { planId: 'p1', periodStart: '2026-05-01', frozenSnapshot: { periodTrades: [{ tradeId: 'a' }] } }),
      draft('R-new', { planId: 'p1', periodStart: '2026-06-01', frozenSnapshot: { periodTrades: [{ tradeId: 'b' }] } }),
    ];
    const maps = buildReviewMaps(reviews);
    expect(maps.planPointers.get('p1')).toBe('R-new');
    expect(maps.conflicts).toEqual([{ planId: 'p1', kept: 'R-new', dropped: 'R-old' }]);
  });
});

describe('assignSequenceNumbers', () => {
  it('numera CLOSED/ARCHIVED por ordem cronológica, ignora DRAFT', () => {
    const reviews = [
      closed('B', { periodStart: '2026-05-10' }),
      draft('D', { planId: 'p1' }),
      closed('A', { periodStart: '2026-04-01' }),
      { id: 'C', status: 'ARCHIVED', periodStart: '2026-06-20' },
    ];
    const seq = assignSequenceNumbers(reviews);
    expect(seq.get('A')).toBe(1);
    expect(seq.get('B')).toBe(2);
    expect(seq.get('C')).toBe(3);
    expect(seq.has('D')).toBe(false);
  });

  it('usa closedAt (toMillis) antes de periodStart', () => {
    const reviews = [
      closed('late', { closedAt: { toMillis: () => 2000 } }),
      closed('early', { closedAt: { toMillis: () => 1000 } }),
    ];
    const seq = assignSequenceNumbers(reviews);
    expect(seq.get('early')).toBe(1);
    expect(seq.get('late')).toBe(2);
  });
});

describe('tradeNeedsUpdate', () => {
  it('detecta divergência de estado e de ponteiro', () => {
    expect(tradeNeedsUpdate({ reviewState: 'NONE', draftReviewId: null }, { reviewState: 'NONE', draftReviewId: null })).toBe(false);
    expect(tradeNeedsUpdate({}, { reviewState: 'NONE', draftReviewId: null })).toBe(true); // legado sem campo
    expect(tradeNeedsUpdate({ reviewState: 'DRAFT', draftReviewId: 'R1' }, { reviewState: 'DRAFT', draftReviewId: 'R2' })).toBe(true);
    expect(tradeNeedsUpdate({ reviewState: 'DISCUSSED', draftReviewId: null }, { reviewState: 'DISCUSSED', draftReviewId: null })).toBe(false);
  });
});
