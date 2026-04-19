import { describe, it, expect } from 'vitest';
import { matchEmotionalEventsToTrade } from '../../utils/extractInlineEvents';

const mkTrade = (id, date = '2026-02-12') => ({ id, date });

describe('matchEmotionalEventsToTrade', () => {
  it('returns empty when no events', () => {
    expect(matchEmotionalEventsToTrade(mkTrade('t1'), [])).toEqual([]);
    expect(matchEmotionalEventsToTrade(mkTrade('t1'), null)).toEqual([]);
  });

  it('returns empty when trade is nullish', () => {
    expect(matchEmotionalEventsToTrade(null, [{ type: 'REVENGE_DETECTED', tradeIds: ['t1'] }])).toEqual([]);
  });

  describe('REVENGE — strict tradeId match (bug regression)', () => {
    it('does NOT attribute REVENGE to a trade whose id is not in tradeIds', () => {
      const trade = mkTrade('first_of_day');
      const events = [{
        type: 'REVENGE_DETECTED',
        date: '2026-02-12',
        tradeIds: ['t2', 't3', 't4'],
      }];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual([]);
    });

    it('attributes REVENGE to trades whose id is in tradeIds', () => {
      const trade = mkTrade('t3');
      const events = [{
        type: 'REVENGE_DETECTED',
        date: '2026-02-12',
        tradeIds: ['t2', 't3', 't4'],
      }];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual(['REVENGE_DETECTED']);
    });

    it('does NOT fall back to date match for REVENGE (prevents over-match)', () => {
      const trade = mkTrade('unrelated', '2026-02-12');
      const events = [{
        type: 'REVENGE_DETECTED',
        date: '2026-02-12',
        tradeIds: null,
      }];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual([]);
    });
  });

  describe('TILT — strict tradeId match', () => {
    it('only attributes TILT to trades inside the tilt sequence', () => {
      const inside = mkTrade('t2');
      const outside = mkTrade('t99');
      const events = [{
        type: 'TILT_DETECTED',
        date: '2026-02-12',
        tradeIds: ['t1', 't2', 't3'],
      }];
      expect(matchEmotionalEventsToTrade(inside, events)).toEqual(['TILT_DETECTED']);
      expect(matchEmotionalEventsToTrade(outside, events)).toEqual([]);
    });
  });

  describe('STATUS_CRITICAL — day-level match is preserved', () => {
    it('matches by date even without tradeIds (day-wide event)', () => {
      const trade = mkTrade('tX', '2026-02-12');
      const events = [{
        type: 'STATUS_CRITICAL',
        date: '2026-02-12',
        tradeIds: null,
      }];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual(['STATUS_CRITICAL']);
    });

    it('does not match STATUS_CRITICAL of other days', () => {
      const trade = mkTrade('tX', '2026-02-12');
      const events = [{
        type: 'STATUS_CRITICAL',
        date: '2026-02-13',
        tradeIds: null,
      }];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual([]);
    });
  });

  describe('combined — multiple events in same day', () => {
    it('returns each event type once even with duplicate matches', () => {
      const trade = mkTrade('t2');
      const events = [
        { type: 'REVENGE_DETECTED', date: '2026-02-12', tradeIds: ['t2'] },
        { type: 'REVENGE_DETECTED', date: '2026-02-12', tradeIds: ['t2', 't3'] },
        { type: 'TILT_DETECTED', date: '2026-02-12', tradeIds: ['t1', 't2'] },
        { type: 'STATUS_CRITICAL', date: '2026-02-12', tradeIds: null },
      ];
      expect(matchEmotionalEventsToTrade(trade, events)).toEqual([
        'REVENGE_DETECTED',
        'TILT_DETECTED',
        'STATUS_CRITICAL',
      ]);
    });

    it('first trade of day: REVENGE elsewhere does NOT bleed in, STATUS_CRITICAL does (day-wide)', () => {
      const first = mkTrade('first');
      const events = [
        { type: 'REVENGE_DETECTED', date: '2026-02-12', tradeIds: ['t2', 't3'] },
        { type: 'STATUS_CRITICAL', date: '2026-02-12', tradeIds: null },
      ];
      expect(matchEmotionalEventsToTrade(first, events)).toEqual(['STATUS_CRITICAL']);
    });
  });
});
