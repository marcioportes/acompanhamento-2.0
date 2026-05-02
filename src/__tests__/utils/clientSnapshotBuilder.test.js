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

  // === KPIs novos do mockup Revisão Semanal (Stage 2) ===

  it('payoff = avgWin / avgLoss', () => {
    // wins: 200, 100 (avg=150) / losses: 50 (avg=50) → payoff 3.0
    const trades = [
      mkTrade({ id: 'w1', result: 200 }),
      mkTrade({ id: 'w2', result: 100 }),
      mkTrade({ id: 'l1', result: -50 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.payoff).toBe(3);
  });

  it('payoff = 0 quando não há wins ou não há losses', () => {
    const onlyWins = [mkTrade({ id: 'w', result: 100 })];
    const onlyLosses = [mkTrade({ id: 'l', result: -100 })];
    expect(buildClientSnapshot({ plan, trades: onlyWins }).kpis.payoff).toBe(0);
    expect(buildClientSnapshot({ plan, trades: onlyLosses }).kpis.payoff).toBe(0);
  });

  it('profitFactor = sum(wins) / |sum(losses)|', () => {
    // sum wins = 300, sum losses = 100 → PF 3.0
    const trades = [
      mkTrade({ id: 'w1', result: 200 }),
      mkTrade({ id: 'w2', result: 100 }),
      mkTrade({ id: 'l1', result: -50 }),
      mkTrade({ id: 'l2', result: -50 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.profitFactor).toBe(3);
  });

  it('evPerTrade = pl / trades.length', () => {
    const trades = [
      mkTrade({ id: '1', result: 100 }),
      mkTrade({ id: '2', result: 200 }),
      mkTrade({ id: '3', result: -50 }),
      mkTrade({ id: '4', result: 50 }),
    ]; // pl=300, 4 trades → ev=75
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.evPerTrade).toBe(75);
  });

  it('evPerTrade = 0 com zero trades', () => {
    const snap = buildClientSnapshot({ plan, trades: [] });
    expect(snap.kpis.evPerTrade).toBe(0);
  });

  it('coefVariation — resultados homogêneos têm CoV baixo; heterogêneos, alto', () => {
    const homog = [100, 102, 98, 100, 100].map((r, i) => mkTrade({ id: `h${i}`, result: r }));
    const heterog = [200, -150, 500, -300, 100].map((r, i) => mkTrade({ id: `x${i}`, result: r }));
    const snapHomog = buildClientSnapshot({ plan, trades: homog });
    const snapHeterog = buildClientSnapshot({ plan, trades: heterog });
    expect(snapHomog.kpis.coefVariation).toBeLessThan(snapHeterog.kpis.coefVariation);
  });

  it('avgHoldTime — overall + win/loss breakdown', () => {
    const trades = [
      mkTrade({ id: 'w', result: 100, entryTime: '2026-04-13T10:00:00', exitTime: '2026-04-13T10:20:00' }), // 20min win
      mkTrade({ id: 'l', result: -50, entryTime: '2026-04-13T11:00:00', exitTime: '2026-04-13T11:05:00' }),  // 5min loss
      mkTrade({ id: 'w2', result: 30, entryTime: '2026-04-13T12:00:00', exitTime: '2026-04-13T12:16:00' }), // 16min win
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.kpis.avgHoldTimeWinMin).toBe(18);  // (20+16)/2
    expect(snap.kpis.avgHoldTimeLossMin).toBe(5);
    expect(snap.kpis.avgHoldTimeMin).toBe(14);     // (20+5+16)/3 ≈ 13.67 → 14
  });

  it('periodTrades — inclui todos os trades inline com qty, pnl, emoções', () => {
    const trades = [
      mkTrade({ id: 't1', result: 100, qty: 2 }),
      mkTrade({ id: 't2', result: -50, qty: 1 }),
    ];
    const snap = buildClientSnapshot({ plan, trades });
    expect(snap.periodTrades).toHaveLength(2);
    expect(snap.periodTrades[0]).toMatchObject({ tradeId: 't1', pnl: 100, qty: 2 });
    expect(snap.periodTrades[1]).toMatchObject({ tradeId: 't2', pnl: -50, qty: 1 });
  });

  // === Stage 2.5: extraTrades (inclusão explícita de trades fora do período) ===

  describe('extraTrades — inclusão explícita além do período', () => {
    it('mescla extraTrades em periodTrades quando IDs são novos', () => {
      const trades = [mkTrade({ id: 't1', result: 100 })];
      const extraTrades = [
        mkTrade({ id: 'x1', result: 50, date: '2026-02-12' }),
        mkTrade({ id: 'x2', result: -30, date: '2026-02-09' }),
      ];
      const snap = buildClientSnapshot({ plan, trades, extraTrades });
      expect(snap.periodTrades).toHaveLength(3);
      const ids = snap.periodTrades.map(t => t.tradeId).sort();
      expect(ids).toEqual(['t1', 'x1', 'x2']);
    });

    it('deduplica: se extraTrades inclui trade já em trades, aparece 1× só', () => {
      const trades = [mkTrade({ id: 't1', result: 100 })];
      const extraTrades = [mkTrade({ id: 't1', result: 100 })]; // mesmo id
      const snap = buildClientSnapshot({ plan, trades, extraTrades });
      expect(snap.periodTrades).toHaveLength(1);
      expect(snap.kpis.trades).toBe(1);
    });

    it('KPIs refletem o set completo (período ∪ extra)', () => {
      // Período: 1 win de 100. Extra: 1 win de 200 + 1 loss de -50.
      // Total: pl=250, 3 trades, wr=66.7%, payoff = 150 / 50 = 3
      const trades = [mkTrade({ id: 't1', result: 100 })];
      const extraTrades = [
        mkTrade({ id: 'x1', result: 200 }),
        mkTrade({ id: 'x2', result: -50 }),
      ];
      const snap = buildClientSnapshot({ plan, trades, extraTrades });
      expect(snap.kpis.pl).toBe(250);
      expect(snap.kpis.trades).toBe(3);
      expect(snap.kpis.wr).toBeCloseTo(66.7, 1);
      expect(snap.kpis.payoff).toBe(3);
    });

    it('extraTrades ausente / vazio — se comporta como antes', () => {
      const trades = [mkTrade({ id: 't1', result: 100 })];
      const snapSem = buildClientSnapshot({ plan, trades });
      const snapVazio = buildClientSnapshot({ plan, trades, extraTrades: [] });
      expect(snapSem.periodTrades).toHaveLength(1);
      expect(snapVazio.periodTrades).toHaveLength(1);
      expect(snapSem.kpis).toEqual(snapVazio.kpis);
    });
  });

  // === Fase E (issue #119 task 15) — freeze maturitySnapshot ===

  describe('maturitySnapshot — freeze do students/{uid}/maturity/current', () => {
    const mockMaturityDoc = {
      id: 'current',
      currentStage: 'AWARENESS',
      dimensionScores: { emotional: 62, financial: 58, operational: 70, maturity: 64 },
      gates: { stopRespect: true, rrTarget: false, complianceFloor: true },
      proposedTransition: { from: 'AWARENESS', to: 'CONTROL', confidence: 0.74 },
      signalRegression: false,
      aiNarrative: { headline: 'Avanço consistente em controle.', body: '...' },
      computedAt: { seconds: 1745000000, nanoseconds: 0 },     // serverTimestamp shape
      asOf: { seconds: 1745000000, nanoseconds: 0 },
      aiGeneratedAt: { seconds: 1745000000, nanoseconds: 0 },
    };

    it('maturity ausente (default) — maturitySnapshot é null', () => {
      const snap = buildClientSnapshot({ plan, trades: [mkTrade({ id: 't', result: 50 })] });
      expect(snap.maturitySnapshot).toBeNull();
    });

    it('maturity = null explícito — maturitySnapshot é null', () => {
      const snap = buildClientSnapshot({ plan, trades: [], maturity: null });
      expect(snap.maturitySnapshot).toBeNull();
    });

    it('congela maturity removendo computedAt/asOf/aiGeneratedAt e adicionando frozenAt ISO', () => {
      const snap = buildClientSnapshot({ plan, trades: [], maturity: mockMaturityDoc });
      const m = snap.maturitySnapshot;
      expect(m).not.toBeNull();
      expect(m.computedAt).toBeUndefined();
      expect(m.asOf).toBeUndefined();
      expect(m.aiGeneratedAt).toBeUndefined();
      expect(typeof m.frozenAt).toBe('string');
      expect(() => new Date(m.frozenAt).toISOString()).not.toThrow();
      // Campos de domínio preservados
      expect(m.currentStage).toBe('AWARENESS');
      expect(m.dimensionScores).toEqual(mockMaturityDoc.dimensionScores);
      expect(m.gates).toEqual(mockMaturityDoc.gates);
      expect(m.proposedTransition).toEqual(mockMaturityDoc.proposedTransition);
      expect(m.signalRegression).toBe(false);
      expect(m.aiNarrative).toEqual(mockMaturityDoc.aiNarrative);
    });

    it('adicionar maturity não afeta KPIs nem rankings nem periodTrades', () => {
      const trades = [
        mkTrade({ id: 'w1', result: 200 }),
        mkTrade({ id: 'l1', result: -50 }),
      ];
      const snapSem = buildClientSnapshot({ plan, trades });
      const snapCom = buildClientSnapshot({ plan, trades, maturity: mockMaturityDoc });
      expect(snapCom.kpis).toEqual(snapSem.kpis);
      expect(snapCom.topTrades).toEqual(snapSem.topTrades);
      expect(snapCom.bottomTrades).toEqual(snapSem.bottomTrades);
      expect(snapCom.periodTrades).toEqual(snapSem.periodTrades);
      expect(snapCom.planContext).toEqual(snapSem.planContext);
    });

    it('input não-objeto (string, número, array) → maturitySnapshot null (degrade silencioso)', () => {
      expect(buildClientSnapshot({ plan, trades: [], maturity: 'invalid' }).maturitySnapshot).toBeNull();
      expect(buildClientSnapshot({ plan, trades: [], maturity: 42 }).maturitySnapshot).toBeNull();
      expect(buildClientSnapshot({ plan, trades: [], maturity: [] }).maturitySnapshot).toBeNull();
    });
  });

  // === Issue #235 F3.1 — kpis.cvNormalized (CV normalizado per-ciclo) ===

  describe('kpis.cvNormalized — CV normalizado per-ciclo (issue #235)', () => {
    // Plano com targetRR para ativar fórmula analítica de cv_exp.
    // Note: o helper lê `plan.targetRR` (não `plan.rrTarget`).
    const planCycle = { id: 'plan1', adjustmentCycle: 'Mensal', pl: 10000, targetRR: 3, expectedWinRate: 0.5 };

    it('C1 — sem cycleStart/cycleEnd → cvNormalized é null (campo presente, valor null)', () => {
      const snap = buildClientSnapshot({ plan: planCycle, trades: [mkTrade({ id: 't1', result: 50 })] });
      expect(snap.kpis).toHaveProperty('cvNormalized');
      expect(snap.kpis.cvNormalized).toBeNull();
    });

    it('C2 — com cycleStart/cycleEnd válidos + trades em ≥5 dias + targetRR → value populado', () => {
      // 5 dias com trade (mínimo do helper) com magnitudes variando para ter std/mean computáveis.
      const trades = [
        mkTrade({ id: 'd1', result: 100, date: '2026-04-01', status: 'CLOSED' }),
        mkTrade({ id: 'd2', result: -50, date: '2026-04-02', status: 'CLOSED' }),
        mkTrade({ id: 'd3', result: 200, date: '2026-04-03', status: 'CLOSED' }),
        mkTrade({ id: 'd4', result: -80, date: '2026-04-04', status: 'CLOSED' }),
        mkTrade({ id: 'd5', result: 300, date: '2026-04-05', status: 'CLOSED' }),
      ];
      const snap = buildClientSnapshot({
        plan: planCycle,
        trades,
        cycleStart: '2026-04-01',
        cycleEnd: '2026-04-30',
      });
      expect(snap.kpis.cvNormalized).not.toBeNull();
      expect(typeof snap.kpis.cvNormalized.value).toBe('number');
      expect(Number.isFinite(snap.kpis.cvNormalized.value)).toBe(true);
      expect(snap.kpis.cvNormalized.daysWithTrade).toBe(5);
      expect(snap.kpis.cvNormalized.insufficientReason).toBeNull();
      expect(typeof snap.kpis.cvNormalized.cvObs).toBe('number');
      expect(typeof snap.kpis.cvNormalized.cvExp).toBe('number');
    });

    it('C3 — com cycleStart/cycleEnd, plan sem targetRR → value null + insufficientReason="no_target_rr"', () => {
      const trades = [
        mkTrade({ id: 'd1', result: 100, date: '2026-04-01', status: 'CLOSED' }),
        mkTrade({ id: 'd2', result: -50, date: '2026-04-02', status: 'CLOSED' }),
        mkTrade({ id: 'd3', result: 200, date: '2026-04-03', status: 'CLOSED' }),
        mkTrade({ id: 'd4', result: -80, date: '2026-04-04', status: 'CLOSED' }),
        mkTrade({ id: 'd5', result: 300, date: '2026-04-05', status: 'CLOSED' }),
      ];
      // Plan sem targetRR — herda de `plan` base (que tem rrTarget mas NÃO targetRR).
      const snap = buildClientSnapshot({
        plan,
        trades,
        cycleStart: '2026-04-01',
        cycleEnd: '2026-04-30',
      });
      expect(snap.kpis.cvNormalized).not.toBeNull();
      expect(snap.kpis.cvNormalized.value).toBeNull();
      expect(snap.kpis.cvNormalized.insufficientReason).toBe('no_target_rr');
    });

    it('coefVariation (CV puro) permanece presente — compat reversa', () => {
      const trades = [100, 102, 98].map((r, i) => mkTrade({ id: `h${i}`, result: r }));
      const snap = buildClientSnapshot({
        plan: planCycle,
        trades,
        cycleStart: '2026-04-01',
        cycleEnd: '2026-04-30',
      });
      expect(snap.kpis).toHaveProperty('coefVariation');
      expect(typeof snap.kpis.coefVariation).toBe('number');
    });
  });
});
