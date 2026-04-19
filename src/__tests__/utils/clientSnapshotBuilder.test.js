import { describe, it, expect } from 'vitest';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';

const mkTrade = (overrides = {}) => ({
  id: overrides.id || 't' + Math.random(),
  symbol: 'MNQH6',
  side: 'LONG',
  result: 100,
  entry: 20000,
  stopLoss: 19990,
  takeProfit: 20020,
  qty: 1,
  tickerRule: { tickSize: 0.25, tickValue: 0.5 },
  entryTime: '2026-04-13T10:00:00',
  exitTime: '2026-04-13T10:30:00',
  setup: 'breakout',
  emotionEntry: 'Confiante',
  emotionExit: 'Confiante',
  date: '2026-04-13',
  ...overrides,
});

const plan = {
  id: 'plan1',
  adjustmentCycle: 'Mensal',
  pl: 10000,
  riskPerOperation: 1,   // 1%
  rrTarget: 2,
};

describe('buildClientSnapshot', () => {
  it('throws when plan.id is missing', () => {
    expect(() => buildClientSnapshot({ plan: {}, trades: [] })).toThrow();
    expect(() => buildClientSnapshot({ plan: null, trades: [] })).toThrow();
  });

  it('handles empty trades — zero-everything KPIs + empty rankings', () => {
    const snap = buildClientSnapshot({ plan, trades: [], cycleKey: '2026-04' });
    expect(snap.planContext).toEqual({ planId: 'plan1', cycleKey: '2026-04', adjustmentCycle: 'Mensal' });
    expect(snap.kpis.pl).toBe(0);
    expect(snap.kpis.trades).toBe(0);
    expect(snap.kpis.wr).toBe(0);
    expect(snap.kpis.maxDD).toBe(0);
    expect(snap.topTrades).toEqual([]);
    expect(snap.bottomTrades).toEqual([]);
  });

  it('computes pl, wins, wr from trades', () => {
    const trades = [
      mkTrade({ id: 'w1', result: 200 }),
      mkTrade({ id: 'w2', result: 100 }),
      mkTrade({ id: 'l1', result: -50 }),
      mkTrade({ id: 'be', result: 0 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.pl).toBe(250);
    expect(snap.kpis.trades).toBe(4);
    expect(snap.kpis.wr).toBe(50); // 2 wins / 4 trades
  });

  it('computes maxDD from running balance', () => {
    const trades = [
      mkTrade({ id: '1', result: 100, exitTime: '2026-04-13T10:00:00' }),
      mkTrade({ id: '2', result: -50, exitTime: '2026-04-13T11:00:00' }),
      mkTrade({ id: '3', result: -80, exitTime: '2026-04-13T12:00:00' }),
      mkTrade({ id: '4', result: 30,  exitTime: '2026-04-13T13:00:00' }),
    ];
    // running: 100 → 50 → -30 → 0. peak=100, min=-30. maxDD = -30 - 100 = -130
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.maxDD).toBe(-130);
  });

  it('emotional metrics — uses defaults when null', () => {
    const snap = buildClientSnapshot({ plan, trades: [], emotionalMetrics: null });
    expect(snap.kpis.emotional.compositeScore).toBe(100);
    expect(snap.kpis.emotional.topEmotion).toBeNull();
  });

  it('emotional metrics — projects from useEmotionalProfile.metrics shape', () => {
    const metrics = {
      score: 68, positivePercent: 50, negativePercent: 40, criticalPercent: 10,
      tiltCount: 1, revengeCount: 2, overtradingDays: 0,
      topEmotion: { name: 'Frustrado', category: 'NEGATIVE', count: 3 },
    };
    const snap = buildClientSnapshot({ plan, trades: [mkTrade({ id: 'x', result: 10 })], emotionalMetrics: metrics });
    expect(snap.kpis.emotional).toEqual({
      compositeScore: 68,
      positivePercent: 50, negativePercent: 40, criticalPercent: 10,
      tiltCount: 1, revengeCount: 2, overtradingDays: 0,
      topEmotion: { name: 'Frustrado', category: 'NEGATIVE', count: 3 },
    });
  });

  it('compliance — aggregates stop/rr/ro per trade', () => {
    const trades = [
      // stop respeitado, dentro do RO e RR ≥ target
      mkTrade({ id: 'good1', result: 80, stopLoss: 19990, takeProfit: 20010 }),
      // sem stop (RO baseado em loss, dentro do limite)
      mkTrade({ id: 'nostop', result: -50, stopLoss: null, takeProfit: null }),
      // com stop mas RR fora (<target=2)
      mkTrade({ id: 'rrbad', result: 10, stopLoss: 19990, takeProfit: 20001 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.compliance.stopRespected.count).toBe(2);
    expect(snap.kpis.compliance.stopRespected.total).toBe(3);
    expect(snap.kpis.compliance.stopRespected.rate).toBeCloseTo(66.7, 1);
    expect(snap.kpis.compliance.overall).toBeGreaterThanOrEqual(0);
    expect(snap.kpis.compliance.overall).toBeLessThanOrEqual(100);
  });

  it('topTrades/bottomTrades are inline (A2) and exclude break-even', () => {
    const trades = [
      mkTrade({ id: 'win1', result: 500 }),
      mkTrade({ id: 'win2', result: 200 }),
      mkTrade({ id: 'be', result: 0 }),
      mkTrade({ id: 'loss1', result: -100 }),
      mkTrade({ id: 'loss2', result: -300 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.topTrades.map(t => t.tradeId)).toEqual(['win1', 'win2']);
    expect(snap.bottomTrades.map(t => t.tradeId)).toEqual(['loss2', 'loss1']);
    // Inline fields
    expect(snap.topTrades[0]).toHaveProperty('symbol');
    expect(snap.topTrades[0]).toHaveProperty('side');
    expect(snap.topTrades[0]).toHaveProperty('pnl');
    expect(snap.topTrades[0]).toHaveProperty('entryTime');
    expect(snap.topTrades[0]).toHaveProperty('closeTime');
    expect(snap.topTrades[0]._partials).toBeUndefined();
  });

  it('avgRR — zero quando nenhum trade produz rrRatio avaliável', () => {
    // plan sem rrTarget nem pl → rrRatio null em todos
    const trades = [mkTrade({ id: 'x', result: 10, stopLoss: null, takeProfit: null })];
    const snap = buildClientSnapshot({ plan: { id: 'p', pl: 0 }, trades });
    expect(snap.kpis.avgRR).toBe(0);
  });
});
