/**
 * swotHeuristics.test.js — issue #259 (1A)
 */

import { describe, it, expect } from 'vitest';
import {
  computeTradeMEP_R,
  maxLossStreak,
  aggregateBySetup,
  buildStrengths,
  buildWeaknesses,
  buildOpportunities,
  buildThreats,
  buildSWOT,
  SWOT_THRESHOLDS,
} from '../../../utils/cycleClosure/swotHeuristics';

const R = 500;

describe('computeTradeMEP_R', () => {
  it('LONG: (mepPrice - entry) × qty / R', () => {
    const t = { side: 'LONG', entry: 100, mepPrice: 105, qty: 10 };
    expect(computeTradeMEP_R(t, R)).toBe(0.1);   // (105-100)*10 / 500 = 0.1
  });
  it('SHORT: (entry - menPrice) × qty / R', () => {
    const t = { side: 'SHORT', entry: 100, menPrice: 95, qty: 10 };
    expect(computeTradeMEP_R(t, R)).toBe(0.1);
  });
  it('null se mep/men ausente', () => {
    expect(computeTradeMEP_R({ side: 'LONG', entry: 100, qty: 10 }, R)).toBeNull();
    expect(computeTradeMEP_R({ side: 'SHORT', entry: 100, qty: 10 }, R)).toBeNull();
  });
  it('null em side desconhecido', () => {
    expect(computeTradeMEP_R({ side: 'XYZ', entry: 100, mepPrice: 105, qty: 10 }, R)).toBeNull();
  });
});

describe('maxLossStreak', () => {
  it('todas wins → 0', () => {
    expect(maxLossStreak([{ result: 100 }, { result: 50 }])).toBe(0);
  });
  it('alternando: 1', () => {
    expect(maxLossStreak([
      { result: 100 }, { result: -50 },
      { result: 100 }, { result: -50 },
    ])).toBe(1);
  });
  it('sequência de 4 losses', () => {
    expect(maxLossStreak([
      { result: 100 }, { result: -50 }, { result: -50 },
      { result: -50 }, { result: -50 }, { result: 200 },
    ])).toBe(4);
  });
  it('neutral quebra streak', () => {
    expect(maxLossStreak([
      { result: -50 }, { result: -50 },
      { result: 0 },
      { result: -50 },
    ])).toBe(2);
  });
});

describe('aggregateBySetup', () => {
  it('agrupa por setup, computa winRate', () => {
    const trades = [
      { setup: 'pullback', result: 100 },
      { setup: 'pullback', result: 200 },
      { setup: 'pullback', result: -50 },
      { setup: 'reversao', result: -100 },
    ];
    const agg = aggregateBySetup(trades);
    const pullback = agg.find((s) => s.setup === 'pullback');
    expect(pullback.count).toBe(3);
    expect(pullback.wins).toBe(2);
    expect(pullback.winRate).toBeCloseTo(0.667, 2);
    const reversao = agg.find((s) => s.setup === 'reversao');
    expect(reversao.count).toBe(1);
    expect(reversao.winRate).toBe(0);
  });
  it('ignora trades sem setup', () => {
    expect(aggregateBySetup([{ result: 100 }, {}])).toHaveLength(0);
  });
});

describe('buildOpportunities', () => {
  it('detecta best trade saiu cedo', () => {
    const trades = [
      // best: result=+750 (1.5R), MEP=+5R → gap = 3.5R > threshold 1.5R
      { id: 't1', side: 'LONG', entry: 100, mepPrice: 110, qty: 250, result: 750 },
      { id: 't2', side: 'LONG', entry: 100, mepPrice: 102, qty: 100, result: 200 },
    ];
    const opp = buildOpportunities({ trades, R });
    expect(opp.some((o) => o.includes('saiu cedo'))).toBe(true);
    expect(opp.some((o) => o.includes('t1'))).toBe(true);
  });

  it('NÃO dispara se gap < threshold', () => {
    const trades = [
      // exit=2R, MEP=2.5R → gap=0.5R < 1.5R
      { id: 't1', side: 'LONG', entry: 100, mepPrice: 102.5, qty: 200, result: 1000 },
    ];
    const opp = buildOpportunities({ trades, R });
    expect(opp.some((o) => o.includes('saiu cedo'))).toBe(false);
  });

  it('detecta setup recurrent com WR alto', () => {
    const trades = [
      { setup: 'pullback', result: 100 }, { setup: 'pullback', result: 200 },
      { setup: 'pullback', result: 150 },
      { setup: 'pullback', result: -50 },
    ];
    const opp = buildOpportunities({ trades, R });
    expect(opp.some((o) => o.includes('pullback'))).toBe(true);
  });

  it('NÃO dispara se count < 2 ou WR <= 70%', () => {
    const trades = [
      { setup: 'unique', result: 100 },     // só 1
      { setup: 'low_wr', result: 100 }, { setup: 'low_wr', result: -50 },   // WR 50%
    ];
    const opp = buildOpportunities({ trades, R });
    expect(opp).toHaveLength(0);
  });
});

describe('buildThreats', () => {
  it('loss streak ≥4 dispara aviso', () => {
    const trades = [
      { result: -50 }, { result: -50 }, { result: -50 }, { result: -50 },
      { result: 100 },
    ];
    const threats = buildThreats({ trades, maxDDPercent: 0.01, cycleStopPercent: 5 });
    expect(threats.some((t) => t.includes('losses'))).toBe(true);
  });

  it('DD > 70% × stop dispara margem fina', () => {
    const trades = [{ result: 100 }];
    const threats = buildThreats({ trades, maxDDPercent: 0.04, cycleStopPercent: 5 });
    expect(threats.some((t) => t.includes('Margem fina'))).toBe(true);
  });

  it('DD baixo NÃO dispara', () => {
    const trades = [{ result: 100 }];
    const threats = buildThreats({ trades, maxDDPercent: 0.02, cycleStopPercent: 5 });
    expect(threats.some((t) => t.includes('Margem fina'))).toBe(false);
  });

  it('sem dados → array vazio', () => {
    expect(buildThreats({ trades: [], maxDDPercent: null, cycleStopPercent: null }))
      .toEqual([]);
  });
});

describe('buildSWOT — wrapper', () => {
  it('combina opportunities + threats', () => {
    const trades = [
      { setup: 'A', result: 100 }, { setup: 'A', result: 200 },
      { result: -50 }, { result: -50 }, { result: -50 }, { result: -50 },
    ];
    const swot = buildSWOT({ trades, R, maxDDPercent: 0.04, cycleStopPercent: 5 });
    expect(swot.opportunities.length).toBeGreaterThan(0);
    expect(swot.threats.length).toBeGreaterThan(0);
  });
});

describe('buildStrengths — R2 (sustain só com sinal positivo MEDIDO)', () => {
  it('NÃO sugere "zero detecção" como strength', () => {
    const out = buildStrengths({
      metrics: { ruleAdherenceRate: 0.4, profitFactor: 0.5, winRate: 0.3 },
      patterns: { eventCounts: { tilt: 0, revenge: 0, stopTampering: 0 } },
      snapshot: { stopBreach: { stopBreachIndex: -1 } },
    });
    // pode haver outros sinais positivos mas NUNCA "Zero padrões emocionais"
    expect(out.some((s) => /zero/i.test(s))).toBe(false);
  });

  it('sustenta aderência alta apenas se NÃO há sinal crítico', () => {
    const outClean = buildStrengths({
      metrics: { ruleAdherenceRate: 0.97 },
      patterns: { eventCounts: {} },
      snapshot: { stopBreach: { stopBreachIndex: -1 } },
    });
    expect(outClean.some((s) => /Aderência/.test(s))).toBe(true);

    const outDirty = buildStrengths({
      metrics: { ruleAdherenceRate: 0.97 },
      patterns: { eventCounts: { stopTampering: 2 } },
      snapshot: { stopBreach: { stopBreachIndex: -1 } },
    });
    expect(outDirty.some((s) => /Aderência/.test(s))).toBe(false);
  });

  it('sustenta dia limpo positivo (versão sob controle existe)', () => {
    const out = buildStrengths({
      metrics: {},
      patterns: { dayBreakdown: { bestCleanDay: { date: '2026-03-15', pnl: 450, trades: 3 } } },
      snapshot: {},
    });
    expect(out.some((s) => /2026-03-15/.test(s))).toBe(true);
    expect(out.some((s) => /450/.test(s))).toBe(true);
  });
});

describe('buildThreats — R2 (cientes de patterns + stopBreach)', () => {
  it('cenário CRÍTICO de março — múltiplas ameaças listadas', () => {
    const out = buildThreats({
      trades: [],
      maxDDPercent: 0.14,
      cycleStopPercent: 5,
      patterns: {
        eventCounts: {
          tilt: 4, tiltDaysCount: 6, revenge: 3, stopTampering: 2, rapidReentry: 2,
        },
        correlation: { performanceOnTiltDays: -2300, performanceOnCleanDays: -487 },
      },
      snapshot: {
        resultPercent: -13.9,
        stopBreach: {
          stopBreachIndex: 6, tradesAfterStop: 7, pnlPctOfStop: 2.78, severity: 'critical',
        },
      },
    });
    expect(out.some((t) => /Violação de stop/i.test(t))).toBe(true);
    expect(out.some((t) => /Tilt sistêmico/i.test(t))).toBe(true);
    expect(out.some((t) => /vingança|Loss-chasing/i.test(t))).toBe(true);
    expect(out.some((t) => /Stop deslocado/i.test(t))).toBe(true);
    expect(out.some((t) => /reentrada/i.test(t))).toBe(true);
    expect(out.some((t) => /1\.5× o stop|Sistema de gestão de risco falhou/i.test(t))).toBe(true);
  });

  it('sem patterns/breach → não gera falsos positivos comportamentais', () => {
    const out = buildThreats({
      trades: [],
      maxDDPercent: 0.02,
      cycleStopPercent: 5,
    });
    expect(out.every((t) => !/Tilt|vingança|Stop deslocado/i.test(t))).toBe(true);
  });
});

describe('buildOpportunities — R2 (dias limpos)', () => {
  it('lista dias limpos com saldo positivo como oportunidade', () => {
    const out = buildOpportunities({
      trades: [],
      R: 500,
      patterns: {
        dayBreakdown: {
          cleanDays: [
            { date: '2026-03-15', pnl: 300, trades: 2 },
            { date: '2026-03-16', pnl: 400, trades: 3 },
          ],
        },
      },
    });
    expect(out.some((o) => /sem tilt\/vingança/i.test(o))).toBe(true);
  });
});

describe('SWOT_THRESHOLDS', () => {
  it('thresholds documentados', () => {
    expect(SWOT_THRESHOLDS.MEP_GAP_THRESHOLD_R).toBe(1.5);
    expect(SWOT_THRESHOLDS.SETUP_WR_THRESHOLD).toBe(0.70);
    expect(SWOT_THRESHOLDS.SETUP_COUNT_MIN).toBe(2);
    expect(SWOT_THRESHOLDS.LOSS_STREAK_DANGER).toBe(4);
    expect(SWOT_THRESHOLDS.DD_RATIO_DANGER).toBe(0.70);
  });
});
