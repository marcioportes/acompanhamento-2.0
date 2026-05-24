/**
 * closurePlanAdvisor.test.js — issue #259 (1A)
 */

import { describe, it, expect } from 'vitest';
import {
  advisePlanAdjustment,
  ADVISOR_THRESHOLDS,
} from '../../../utils/cycleClosure/closurePlanAdvisor';

const PLAN = { pl: 50000, riskPerOperation: 1, rrTarget: 2, cycleStop: 5 };

describe('advisePlanAdjustment — regras de decisão', () => {
  it('REGRA 1 — sample <50 → manter (insufficient_sample)', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 18, kellySafe: 0.096, expectancy_R: 0.277 },
      cycleMetrics: {},
      maxDDPercent: 0.028,
      ruleAdherenceRate: 0.889,
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.triggeredRule).toBe('insufficient_sample');
    expect(out.changed).toBe(false);
    expect(out.newRiskPerOp).toBe(PLAN.riskPerOperation);
    expect(out.rationale).toContain('18');
    expect(out.rationale).toContain('50');
    expect(out.risks.length).toBeGreaterThan(0);
  });

  it('REGRA 2 — kelly_safe > 2× current AND no regression → scale_up +25%', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.06, expectancy_R: 0.4 },   // 6% > 2 × 1% = 2%
      cycleMetrics: {},
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.triggeredRule).toBe('scale_up');
    expect(out.changed).toBe(true);
    expect(out.newRiskPerOp).toBe(1.25);   // +25%
    expect(out.rationale).toMatch(/Subir/i);
  });

  it('REGRA 2 NÃO dispara se há regression', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.06, expectancy_R: 0.4 },
      cycleMetrics: {},
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: ['emotional'],
    });
    expect(out.triggeredRule).toBe('regression');
  });

  it('REGRA 3 — DD > 70% stop AND aderência <90% → scale_down -25%', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.005, expectancy_R: 0.1 },
      cycleMetrics: {},
      maxDDPercent: 0.04,             // 4% (> 70% × 5% = 3.5%)
      ruleAdherenceRate: 0.85,        // < 90%
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.triggeredRule).toBe('scale_down');
    expect(out.changed).toBe(true);
    expect(out.newRiskPerOp).toBe(0.75);    // -25%
    expect(out.rationale).toMatch(/Reduzir/i);
  });

  it('REGRA 3 — DD alto mas aderência alta → não dispara scale_down', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.005, expectancy_R: 0.1 },
      cycleMetrics: {},
      maxDDPercent: 0.04,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.triggeredRule).toBe('observe');
  });

  it('REGRA 4 — regression presente sem outras condições → manter (regression)', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.005, expectancy_R: 0.15 },
      cycleMetrics: {},
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: ['financial', 'emotional'],
    });
    expect(out.triggeredRule).toBe('regression');
    expect(out.changed).toBe(false);
    expect(out.rationale).toContain('financial');
    expect(out.rationale).toContain('emotional');
  });

  it('REGRA 5 — fallback observe → manter sem riscos', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.005, expectancy_R: 0.15 },
      cycleMetrics: {},
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.triggeredRule).toBe('observe');
    expect(out.changed).toBe(false);
    expect(out.risks).toEqual([]);
  });
});

describe('advisePlanAdjustment — output schema', () => {
  it('source sempre heuristic_stub (1B troca pra llm)', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 5 },
      cycleMetrics: {},
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.source).toBe('heuristic_stub');
  });

  it('campos changed/newPl/newRiskPerOp/newRRTarget sempre presentes', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 5 },
      cycleMetrics: {},
      currentPlan: PLAN,
      regression: [],
    });
    expect(out).toHaveProperty('changed');
    expect(out).toHaveProperty('newPl');
    expect(out).toHaveProperty('newRiskPerOp');
    expect(out).toHaveProperty('newRRTarget');
    expect(out).toHaveProperty('rationale');
    expect(out).toHaveProperty('risks');
    expect(out).toHaveProperty('triggeredRule');
  });
});

describe('ADVISOR_THRESHOLDS', () => {
  it('thresholds documentados', () => {
    expect(ADVISOR_THRESHOLDS.SAMPLE_THRESHOLD_SCALE_UP).toBe(50);
    expect(ADVISOR_THRESHOLDS.KELLY_SCALE_UP_RATIO).toBe(2);
    expect(ADVISOR_THRESHOLDS.SCALE_UP_FACTOR).toBe(1.25);
    expect(ADVISOR_THRESHOLDS.SCALE_DOWN_FACTOR).toBe(0.75);
    expect(ADVISOR_THRESHOLDS.DD_RATIO_DANGER).toBe(0.70);
    expect(ADVISOR_THRESHOLDS.RULE_ADHERENCE_DANGER).toBe(0.90);
  });
  it('thresholds R2 — PAUSA (REGRA 0)', () => {
    expect(ADVISOR_THRESHOLDS.PAUSE_TRADES_AFTER_STOP_MIN).toBe(3);
    expect(ADVISOR_THRESHOLDS.PAUSE_TILT_DAYS_MIN).toBe(5);
    expect(ADVISOR_THRESHOLDS.PAUSE_REVENGE_MIN).toBe(3);
    expect(ADVISOR_THRESHOLDS.PAUSE_STOP_TAMPERING_MIN).toBe(2);
    expect(ADVISOR_THRESHOLDS.PAUSE_LOSS_RATIO_OF_STOP).toBe(1.5);
  });
});

describe('REGRA 0 — pause_restructure (R2)', () => {
  it('dispara quando trades pós-stop ≥ 3', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.06, expectancy_R: 0.4 },
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: {},
      stopBreach: { stopBreachIndex: 5, tradesAfterStop: 7, pnlPctOfStop: 2.8, severity: 'critical' },
      snapshotPlEnd: 47213,
    });
    expect(out.triggeredRule).toBe('pause_restructure');
    expect(out.newRiskPerOp).toBe(0);
    expect(out.newRiskRS).toBe(0);
    expect(out.notifyMentor).toBe(true);
    expect(out.rationale).toMatch(/pausar/i);
    expect(out.rationale).toMatch(/\+7 trade/);
    expect(out.risks.length).toBeGreaterThan(0);
  });

  it('dispara quando tilt ≥ 5 dias', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.04, expectancy_R: 0.2 },
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { tiltDaysCount: 6 },
      stopBreach: {},
    });
    expect(out.triggeredRule).toBe('pause_restructure');
    expect(out.notifyMentor).toBe(true);
    expect(out.rationale).toMatch(/6 dias/);
  });

  it('dispara quando perda final ≥ 1.5× stop planejado', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 80, kellySafe: 0.04, expectancy_R: 0.2 },
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: {},
      stopBreach: { stopBreachIndex: 8, tradesAfterStop: 1, pnlPctOfStop: 2.8 },  // 2.8× cap
    });
    expect(out.triggeredRule).toBe('pause_restructure');
  });

  it('cenário CRÍTICO de março (massa de teste) — múltiplos triggers', () => {
    // 32 trades, WR 37.5%, P&L -13.9%, stop 5%, viol em #7, +7 trades pós-breach,
    // 11 dias plantados com TILT/REVENGE/STOP_TAMPERING.
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 32, kellySafe: 0.012, expectancy_R: -0.35 },
      maxDDPercent: 0.14,
      ruleAdherenceRate: 0.65,
      currentPlan: { pl: 20000, riskPerOperation: 1, rrTarget: 2, cycleStop: 5 },
      regression: ['financial'],
      behavioralCounts: { tilt: 4, tiltDaysCount: 6, revenge: 3, stopTampering: 2, overtrading: 2 },
      stopBreach: { stopBreachIndex: 6, tradesAfterStop: 7, pnlAfterStop: -1500, pnlPctOfStop: 2.78, severity: 'critical' },
      snapshotPlEnd: 17213,
      cycleResultPct: -13.9,
    });
    expect(out.triggeredRule).toBe('pause_restructure');
    expect(out.newRiskPerOp).toBe(0);
    expect(out.notifyMentor).toBe(true);
    expect(out.baseCapital).toBe(17213);   // capital base = plEnd, não plan.pl
  });

  it('NÃO dispara em ciclo equilibrado (zero triggers)', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.025,
      ruleAdherenceRate: 0.92,
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { tilt: 0, revenge: 0, stopTampering: 0 },
      stopBreach: { stopBreachIndex: -1, tradesAfterStop: 0 },
    });
    expect(out.triggeredRule).not.toBe('pause_restructure');
  });

  it('NÃO dispara com stopTampering isolado — só apoio, precisa outro trigger', () => {
    // Decisão #259 pós-rebuild R2: stop tampering pode ser trail legítimo.
    // Sozinho não justifica pausa crítica; vira REGRA 3 (scale_down preventivo).
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.025,
      ruleAdherenceRate: 0.92,
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { tilt: 0, revenge: 0, stopTampering: 2 },
      stopBreach: { stopBreachIndex: -1, tradesAfterStop: 0 },
    });
    expect(out.triggeredRule).not.toBe('pause_restructure');
  });

  it('stopTampering AGREGA à rationale quando outro trigger primário dispara', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { tilt: 0, revenge: 3, stopTampering: 2 },  // revenge ≥3 dispara, tampering agrega
      stopBreach: {},
    });
    expect(out.triggeredRule).toBe('pause_restructure');
    expect(out.rationale).toMatch(/3 instâncias de vingança/);
    expect(out.rationale).toMatch(/2× stop deslocado/);
  });
});

describe('Capital base — R2', () => {
  it('usa snapshotPlEnd quando disponível, não plan.pl', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.025,
      ruleAdherenceRate: 0.92,
      currentPlan: PLAN,
      regression: [],
      snapshotPlEnd: 45000,    // depois de uma perda de 5k em 50k
    });
    expect(out.baseCapital).toBe(45000);
  });

  it('cai pra plan.pl se snapshotPlEnd null', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.025,
      ruleAdherenceRate: 0.92,
      currentPlan: PLAN,
      regression: [],
    });
    expect(out.baseCapital).toBe(PLAN.pl);
  });
});

describe('REGRA 3 expandida — scale_down absorve sinais menores (R2)', () => {
  it('dispara com 2 dias de tilt mesmo sem DD+adherence danger', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { tiltDaysCount: 2 },
      stopBreach: {},
    });
    expect(out.triggeredRule).toBe('scale_down');
    expect(out.newRiskPerOp).toBe(0.75);
    expect(out.rationale).toMatch(/2 dia/);
  });

  it('dispara com 1× stop tampering', () => {
    const out = advisePlanAdjustment({
      kelly: { sampleSize: 60, kellySafe: 0.025, expectancy_R: 0.15 },
      maxDDPercent: 0.02,
      ruleAdherenceRate: 0.95,
      currentPlan: PLAN,
      regression: [],
      behavioralCounts: { stopTampering: 1 },
      stopBreach: {},
    });
    expect(out.triggeredRule).toBe('scale_down');
  });
});
