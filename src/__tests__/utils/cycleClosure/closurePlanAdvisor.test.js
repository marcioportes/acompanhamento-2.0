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
});
