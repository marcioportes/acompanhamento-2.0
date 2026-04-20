import { describe, it, expect } from 'vitest';
import {
  getISOWeekKey,
  getISOWeekRange,
  pickTopTrades,
  pickBottomTrades,
  buildReviewId,
  buildWeeklyReviewSnapshot,
} from '../../utils/weeklyReviewSnapshot';

const mkTrade = (overrides = {}) => ({
  id: overrides.id || 't' + Math.random(),
  symbol: 'MNQH6',
  side: 'LONG',
  result: 100,
  entryTime: '2026-04-13T10:00:00',
  exitTime: '2026-04-13T10:30:00',
  setup: 'breakout',
  emotionEntry: 'Confiante',
  emotionExit: 'Confiante',
  stopLoss: 100,
  qty: 1,
  date: '2026-04-13',
  ...overrides,
});

describe('getISOWeekKey', () => {
  it('computes ISO week key with 4-digit year and 2-digit week', () => {
    expect(getISOWeekKey(new Date('2026-04-13'))).toBe('2026-W16');
    expect(getISOWeekKey(new Date('2026-01-05'))).toBe('2026-W02');
    expect(getISOWeekKey(new Date('2025-12-29'))).toBe('2026-W01'); // 1st ISO week of 2026
  });

  it('accepts Date and YYYY-MM-DD string', () => {
    expect(getISOWeekKey('2026-04-13')).toBe('2026-W16');
  });
});

describe('getISOWeekRange', () => {
  it('returns {weekStart, weekEnd} for Monday-Sunday ISO week', () => {
    const { weekStart, weekEnd } = getISOWeekRange(new Date('2026-04-15')); // Wed
    expect(weekStart).toBe('2026-04-13'); // Monday
    expect(weekEnd).toBe('2026-04-19');   // Sunday
  });

  it('when input is Monday, returns same date as weekStart', () => {
    const { weekStart } = getISOWeekRange(new Date('2026-04-13'));
    expect(weekStart).toBe('2026-04-13');
  });

  it('when input is Sunday, returns previous Monday as weekStart', () => {
    const { weekStart, weekEnd } = getISOWeekRange(new Date('2026-04-19')); // Sunday
    expect(weekStart).toBe('2026-04-13');
    expect(weekEnd).toBe('2026-04-19');
  });
});

describe('buildReviewId', () => {
  it('combines periodKey with epoch ms timestamp', () => {
    const id = buildReviewId('2026-W16', 1713456789000);
    expect(id).toBe('2026-W16-1713456789000');
  });

  it('allows multiple reviews for same period without collision', () => {
    const a = buildReviewId('2026-W16', 1000);
    const b = buildReviewId('2026-W16', 2000);
    expect(a).not.toBe(b);
  });
});

describe('pickTopTrades / pickBottomTrades', () => {
  const trades = [
    mkTrade({ id: 'win1', result: 300 }),
    mkTrade({ id: 'win2', result: 200 }),
    mkTrade({ id: 'win3', result: 150 }),
    mkTrade({ id: 'win4', result: 100 }),
    mkTrade({ id: 'loss1', result: -50 }),
    mkTrade({ id: 'loss2', result: -100 }),
    mkTrade({ id: 'loss3', result: -200 }),
    mkTrade({ id: 'loss4', result: -300 }),
  ];

  it('returns top 3 trades by result descending', () => {
    const top = pickTopTrades(trades, 3);
    expect(top.map(t => t.tradeId)).toEqual(['win1', 'win2', 'win3']);
  });

  it('returns bottom 3 trades by result ascending', () => {
    const bottom = pickBottomTrades(trades, 3);
    expect(bottom.map(t => t.tradeId)).toEqual(['loss4', 'loss3', 'loss2']);
  });

  it('uses inline fields (A2): tradeId, symbol, side, pnl, qty, entryTime, closeTime, setup, emotionEntry, emotionExit, stopLoss', () => {
    const top = pickTopTrades(trades, 1)[0];
    expect(top).toEqual({
      tradeId: 'win1',
      symbol: 'MNQH6',
      side: 'LONG',
      pnl: 300,
      qty: 1,
      entryTime: '2026-04-13T10:00:00',
      closeTime: '2026-04-13T10:30:00',
      setup: 'breakout',
      emotionEntry: 'Confiante',
      emotionExit: 'Confiante',
      stopLoss: 100,
    });
  });

  it('never includes _partials (bloat avoidance A2)', () => {
    const withPartials = [mkTrade({ id: 't1', result: 100, _partials: [{ type: 'ENTRY' }, { type: 'EXIT' }] })];
    const top = pickTopTrades(withPartials, 1);
    expect(top[0]._partials).toBeUndefined();
  });

  it('handles fewer trades than requested count', () => {
    const only2 = trades.slice(0, 2); // win1, win2 — both winners
    expect(pickTopTrades(only2, 5)).toHaveLength(2);
    expect(pickBottomTrades(only2, 5)).toHaveLength(0); // no losers
  });

  it('handles empty trades array', () => {
    expect(pickTopTrades([], 3)).toEqual([]);
    expect(pickBottomTrades([], 3)).toEqual([]);
  });

  it('excludes break-even trades (result == 0) from both top and bottom', () => {
    const withBE = [
      mkTrade({ id: 'be', result: 0 }),
      mkTrade({ id: 'win', result: 50 }),
      mkTrade({ id: 'loss', result: -50 }),
    ];
    expect(pickTopTrades(withBE, 3).map(t => t.tradeId)).toEqual(['win']);
    expect(pickBottomTrades(withBE, 3).map(t => t.tradeId)).toEqual(['loss']);
  });

  it('top/bottom are symmetric — no overlap when qty ≥ 2*count', () => {
    const top = pickTopTrades(trades, 3);
    const bottom = pickBottomTrades(trades, 3);
    const topIds = new Set(top.map(t => t.tradeId));
    for (const b of bottom) expect(topIds.has(b.tradeId)).toBe(false);
  });
});

describe('buildWeeklyReviewSnapshot', () => {
  const plan = { id: 'plan1', adjustmentCycle: 'Mensal' };
  const trades = [
    mkTrade({ id: 't1', result: 100 }),
    mkTrade({ id: 't2', result: -50 }),
    mkTrade({ id: 't3', result: 200 }),
  ];
  const kpis = {
    pl: 250,
    trades: 3,
    wr: 66.7,
    avgRR: 1.8,
    maxDD: -50,
    compliance: {
      stopRespected: { count: 3, total: 3, rate: 100 },
      rrRespected: { count: 2, total: 3, rate: 66.7 },
      roRespected: { count: 3, total: 3, rate: 100 },
      overall: 88,
    },
    emotional: {
      compositeScore: 72,
      positivePercent: 66.7,
      negativePercent: 33.3,
      criticalPercent: 0,
      tiltCount: 0,
      revengeCount: 0,
      overtradingDays: 0,
      topEmotion: { name: 'Confiante', category: 'POSITIVE', count: 3 },
    },
  };

  it('returns full frozen snapshot with planContext, kpis, topTrades, bottomTrades', () => {
    const snap = buildWeeklyReviewSnapshot({
      plan,
      trades,
      kpis,
      cycleKey: '2026-04',
    });
    expect(snap.planContext).toEqual({ planId: 'plan1', cycleKey: '2026-04', adjustmentCycle: 'Mensal' });
    expect(snap.kpis).toEqual(kpis);
    expect(snap.topTrades).toHaveLength(2);      // only 2 winners in input
    expect(snap.bottomTrades).toHaveLength(1);   // only 1 loser
  });

  it('requires planContext + kpis, throws otherwise', () => {
    expect(() => buildWeeklyReviewSnapshot({ plan: null, trades, kpis, cycleKey: 'x' })).toThrow();
    expect(() => buildWeeklyReviewSnapshot({ plan, trades, kpis: null, cycleKey: 'x' })).toThrow();
  });
});
