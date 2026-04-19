import { describe, it, expect } from 'vitest';
import {
  isMentor,
  isISODate,
  isPeriodKey,
  validateSnapshot,
  validateStatusTransition,
} from '../../../functions/reviews/validators';

describe('isMentor', () => {
  it('accepts the mentor email (case-insensitive)', () => {
    expect(isMentor('marcio.portes@me.com')).toBe(true);
    expect(isMentor('MARCIO.PORTES@me.com')).toBe(true);
  });
  it('rejects non-mentor emails and falsy input', () => {
    expect(isMentor('other@example.com')).toBe(false);
    expect(isMentor(null)).toBe(false);
    expect(isMentor(undefined)).toBe(false);
    expect(isMentor('')).toBe(false);
  });
});

describe('isISODate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isISODate('2026-04-13')).toBe(true);
  });
  it('rejects other formats', () => {
    expect(isISODate('2026/04/13')).toBe(false);
    expect(isISODate('13/04/2026')).toBe(false);
    expect(isISODate('2026-4-13')).toBe(false);
    expect(isISODate('')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
});

describe('isPeriodKey', () => {
  it('accepts ISO week format YYYY-Www', () => {
    expect(isPeriodKey('2026-W16')).toBe(true);
    expect(isPeriodKey('2026-W01')).toBe(true);
  });
  it('accepts custom period key CUSTOM-<timestamp>', () => {
    expect(isPeriodKey('CUSTOM-1713456789')).toBe(true);
  });
  it('rejects other formats', () => {
    expect(isPeriodKey('2026-16')).toBe(false);
    expect(isPeriodKey('W16')).toBe(false);
    expect(isPeriodKey(null)).toBe(false);
  });
});

describe('validateSnapshot', () => {
  const valid = {
    planContext: { planId: 'p1', cycleKey: '2026-04', adjustmentCycle: 'Mensal' },
    kpis: {
      pl: 100, trades: 5, wr: 60, avgRR: 1.5, maxDD: -20,
      compliance: { overall: 85 },
      emotional: { compositeScore: 70 },
    },
    topTrades: [],
    bottomTrades: [],
  };

  it('accepts valid snapshot', () => {
    expect(validateSnapshot(valid)).toBe(true);
  });

  it('requires planContext.planId', () => {
    expect(() => validateSnapshot({ ...valid, planContext: {} })).toThrow(/planId/);
  });

  it('requires kpis object', () => {
    expect(() => validateSnapshot({ ...valid, kpis: null })).toThrow(/kpis/);
  });

  it('requires every kpi sub-field', () => {
    for (const f of ['pl', 'trades', 'wr', 'avgRR', 'maxDD', 'compliance', 'emotional']) {
      const invalid = { ...valid, kpis: { ...valid.kpis } };
      delete invalid.kpis[f];
      expect(() => validateSnapshot(invalid)).toThrow(new RegExp(f));
    }
  });

  it('requires topTrades/bottomTrades arrays', () => {
    expect(() => validateSnapshot({ ...valid, topTrades: null })).toThrow();
    expect(() => validateSnapshot({ ...valid, bottomTrades: 'x' })).toThrow();
  });
});

describe('validateStatusTransition (A4 state machine)', () => {
  it('allows DRAFT → DRAFT (in-place edits)', () => {
    expect(validateStatusTransition('DRAFT', 'DRAFT')).toBe(true);
  });
  it('allows DRAFT → CLOSED', () => {
    expect(validateStatusTransition('DRAFT', 'CLOSED')).toBe(true);
  });
  it('allows CLOSED → CLOSED (in-place edits)', () => {
    expect(validateStatusTransition('CLOSED', 'CLOSED')).toBe(true);
  });
  it('allows CLOSED → ARCHIVED', () => {
    expect(validateStatusTransition('CLOSED', 'ARCHIVED')).toBe(true);
  });
  it('forbids DRAFT → ARCHIVED (must go through CLOSED)', () => {
    expect(() => validateStatusTransition('DRAFT', 'ARCHIVED')).toThrow();
  });
  it('forbids reverting CLOSED → DRAFT', () => {
    expect(() => validateStatusTransition('CLOSED', 'DRAFT')).toThrow();
  });
  it('forbids ARCHIVED → anything else (terminal)', () => {
    expect(() => validateStatusTransition('ARCHIVED', 'CLOSED')).toThrow();
    expect(() => validateStatusTransition('ARCHIVED', 'DRAFT')).toThrow();
  });
  it('allows ARCHIVED → ARCHIVED (idempotent)', () => {
    expect(validateStatusTransition('ARCHIVED', 'ARCHIVED')).toBe(true);
  });
  it('rejects invalid origin status', () => {
    expect(() => validateStatusTransition('UNKNOWN', 'DRAFT')).toThrow();
  });
});
