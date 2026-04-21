import { describe, it, expect } from 'vitest';
import {
  isTradeAlreadyReviewed,
  isTradeInDraft,
  getDraftTradeNote,
} from '../../utils/reviewHelpers';

const CLOSED_REVIEW = (ids = []) => ({ status: 'CLOSED', includedTradeIds: ids });
const ARCHIVED_REVIEW = (ids = []) => ({ status: 'ARCHIVED', includedTradeIds: ids });
const DRAFT_REVIEW = (ids = [], items = []) => ({ status: 'DRAFT', includedTradeIds: ids, takeawayItems: items });

describe('isTradeAlreadyReviewed', () => {
  it('returns false when reviews is empty', () => {
    expect(isTradeAlreadyReviewed('t1', [])).toBe(false);
  });

  it('returns false when reviews is null/undefined', () => {
    expect(isTradeAlreadyReviewed('t1', null)).toBe(false);
    expect(isTradeAlreadyReviewed('t1', undefined)).toBe(false);
  });

  it('returns false when trade is in a DRAFT review only', () => {
    const reviews = [DRAFT_REVIEW(['t1'])];
    expect(isTradeAlreadyReviewed('t1', reviews)).toBe(false);
  });

  it('returns true when trade is in a CLOSED review', () => {
    const reviews = [CLOSED_REVIEW(['t1', 't2'])];
    expect(isTradeAlreadyReviewed('t1', reviews)).toBe(true);
  });

  it('returns true when trade is in an ARCHIVED review', () => {
    const reviews = [ARCHIVED_REVIEW(['t3'])];
    expect(isTradeAlreadyReviewed('t3', reviews)).toBe(true);
  });

  it('returns false when trade is not in any includedTradeIds', () => {
    const reviews = [CLOSED_REVIEW(['t1']), ARCHIVED_REVIEW(['t2'])];
    expect(isTradeAlreadyReviewed('t99', reviews)).toBe(false);
  });

  it('returns false when includedTradeIds is missing from review', () => {
    const reviews = [{ status: 'CLOSED' }];
    expect(isTradeAlreadyReviewed('t1', reviews)).toBe(false);
  });

  it('returns false when tradeId is undefined', () => {
    const reviews = [CLOSED_REVIEW(['t1'])];
    expect(isTradeAlreadyReviewed(undefined, reviews)).toBe(false);
  });
});

describe('isTradeInDraft', () => {
  it('returns false when draft is null', () => {
    expect(isTradeInDraft('t1', null)).toBe(false);
  });

  it('returns false when draft has no includedTradeIds', () => {
    expect(isTradeInDraft('t1', { status: 'DRAFT' })).toBe(false);
  });

  it('returns false when trade is not in draft', () => {
    expect(isTradeInDraft('t99', DRAFT_REVIEW(['t1', 't2']))).toBe(false);
  });

  it('returns true when trade is in draft', () => {
    expect(isTradeInDraft('t1', DRAFT_REVIEW(['t1', 't2']))).toBe(true);
  });
});

describe('getDraftTradeNote', () => {
  it('returns null when draft is null', () => {
    expect(getDraftTradeNote('t1', null)).toBeNull();
  });

  it('returns null when no takeawayItems for trade', () => {
    const draft = DRAFT_REVIEW(['t1'], [{ id: 'i1', text: 'other', sourceTradeId: 't2' }]);
    expect(getDraftTradeNote('t1', draft)).toBeNull();
  });

  it('returns the last note for the trade', () => {
    const draft = DRAFT_REVIEW(['t1'], [
      { id: 'i1', text: 'primeira nota', sourceTradeId: 't1' },
      { id: 'i2', text: 'segunda nota', sourceTradeId: 't1' },
      { id: 'i3', text: 'outra trade', sourceTradeId: 't2' },
    ]);
    expect(getDraftTradeNote('t1', draft)).toBe('segunda nota');
  });

  it('returns null when takeawayItems is empty', () => {
    const draft = DRAFT_REVIEW(['t1'], []);
    expect(getDraftTradeNote('t1', draft)).toBeNull();
  });
});
