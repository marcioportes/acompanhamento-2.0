/**
 * migrationLogic.test.js — Issue #269 v2
 *
 * Cobre o núcleo puro da migration retroativa (FK reviewId + status DISCUSSED).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  collectDiscussedTradeIds,
  buildReviewMaps,
  targetReview,
  assignSequenceNumbers,
  tradeNeedsUpdate,
  tradeUpdateData,
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

describe('buildReviewMaps + targetReview', () => {
  it('DISCUSSED (review fechada) vence DRAFT; FK = id da review', () => {
    const reviews = [
      closed('R1', { frozenSnapshot: { periodTrades: [{ tradeId: 't1' }] } }),
      draft('R2', { planId: 'p1', frozenSnapshot: { periodTrades: [{ tradeId: 't1' }, { tradeId: 't2' }] } }),
    ];
    const maps = buildReviewMaps(reviews);
    expect(targetReview('t1', maps)).toEqual({ reviewId: 'R1', status: 'DISCUSSED' });
    expect(targetReview('t2', maps)).toEqual({ reviewId: 'R2', status: null });   // draft: status intocado
    expect(targetReview('t9', maps)).toEqual({ reviewId: null, status: null });   // backlog
  });

  it('trade em duas reviews fechadas → vence a mais recente, conflito reportado', () => {
    const reviews = [
      closed('R-old', { periodStart: '2026-04-01', frozenSnapshot: { periodTrades: [{ tradeId: 't1' }] } }),
      closed('R-new', { periodStart: '2026-06-01', frozenSnapshot: { periodTrades: [{ tradeId: 't1' }] } }),
    ];
    const maps = buildReviewMaps(reviews);
    expect(targetReview('t1', maps)).toEqual({ reviewId: 'R-new', status: 'DISCUSSED' });
    expect(maps.conflicts).toEqual([{ tradeId: 't1', kept: 'R-new', dropped: 'R-old' }]);
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
  it('detecta divergência de reviewId e de status (quando o alvo o define)', () => {
    // backlog estável (campo já presente e null, alvo não toca status)
    expect(tradeNeedsUpdate({ reviewId: null }, { reviewId: null, status: null })).toBe(false);
    // legado SEM o campo reviewId → precisa materializar reviewId=null (query de backlog)
    expect(tradeNeedsUpdate({}, { reviewId: null, status: null })).toBe(true);
    // FK diverge
    expect(tradeNeedsUpdate({ reviewId: 'R1' }, { reviewId: 'R2', status: null })).toBe(true);
    // já tem a FK certa mas status ainda não é DISCUSSED
    expect(tradeNeedsUpdate({ reviewId: 'R1', status: 'CLOSED' }, { reviewId: 'R1', status: 'DISCUSSED' })).toBe(true);
    // tudo no alvo
    expect(tradeNeedsUpdate({ reviewId: 'R1', status: 'DISCUSSED' }, { reviewId: 'R1', status: 'DISCUSSED' })).toBe(false);
  });
});

describe('tradeUpdateData', () => {
  it('omite status quando o alvo não o define', () => {
    expect(tradeUpdateData({ reviewId: 'R1', status: 'DISCUSSED' })).toEqual({ reviewId: 'R1', status: 'DISCUSSED' });
    expect(tradeUpdateData({ reviewId: 'R2', status: null })).toEqual({ reviewId: 'R2' });
    expect(tradeUpdateData({ reviewId: null, status: null })).toEqual({ reviewId: null });
  });
});
