import { describe, it, expect } from 'vitest';
import {
  MODEL,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndValidateSwot,
  buildFallbackSwot,
} from '../../../functions/reviews/prompt';

const validSnapshot = {
  planContext: { planId: 'p1', cycleKey: '2026-04', adjustmentCycle: 'Mensal' },
  kpis: {
    pl: 100, trades: 5, wr: 60, avgRR: 1.5, maxDD: -20,
    compliance: {
      stopRespected: { count: 5, total: 5, rate: 100 },
      rrRespected: { count: 3, total: 5, rate: 60 },
      roRespected: { count: 5, total: 5, rate: 100 },
      overall: 85,
    },
    emotional: {
      compositeScore: 72, positivePercent: 60, negativePercent: 40, criticalPercent: 0,
      tiltCount: 0, revengeCount: 0, overtradingDays: 0,
      topEmotion: { name: 'Confiante', category: 'POSITIVE', count: 3 },
    },
  },
  topTrades: [
    { tradeId: 't1', symbol: 'MNQ', side: 'LONG', pnl: 200, setup: 'breakout', emotionEntry: 'Confiante', emotionExit: 'Confiante' },
  ],
  bottomTrades: [
    { tradeId: 't2', symbol: 'MNQ', side: 'SHORT', pnl: -80, setup: 'reversal', emotionEntry: 'Ansioso', emotionExit: 'Frustrado' },
  ],
};

describe('MODEL & PROMPT_VERSION constants', () => {
  it('uses Sonnet 4.6', () => {
    expect(MODEL).toBe('claude-sonnet-4-6');
  });
  it('has a non-empty prompt version', () => {
    expect(PROMPT_VERSION).toMatch(/\d+\.\d+/);
  });
  it('system prompt mentions SWOT + JSON shape', () => {
    expect(SYSTEM_PROMPT).toMatch(/SWOT/i);
    expect(SYSTEM_PROMPT).toMatch(/strengths/);
    expect(SYSTEM_PROMPT).toMatch(/threats/);
  });
});

describe('buildUserPrompt', () => {
  it('includes current snapshot KPIs and top/bottom trades', () => {
    const prompt = buildUserPrompt({
      currentSnapshot: validSnapshot,
      periodLabel: '2026-04-13 → 2026-04-19 (2026-W16)',
    });
    expect(prompt).toMatch(/2026-W16/);
    expect(prompt).toMatch(/P&L: 100/);
    expect(prompt).toMatch(/Top trades/);
    expect(prompt).toMatch(/Bottom trades/);
    expect(prompt).toMatch(/Confiante/);
  });

  it('indicates when there is no previous snapshot', () => {
    const prompt = buildUserPrompt({
      currentSnapshot: validSnapshot,
      periodLabel: 'x',
    });
    expect(prompt).toMatch(/primeira revisão/i);
  });

  it('includes previous snapshot when provided for comparison', () => {
    const prev = { ...validSnapshot, kpis: { ...validSnapshot.kpis, pl: 50 } };
    const prompt = buildUserPrompt({
      currentSnapshot: validSnapshot,
      previousSnapshot: prev,
      periodLabel: 'x',
    });
    expect(prompt).toMatch(/REVISÃO ANTERIOR/);
    expect(prompt).toMatch(/P&L: 50/);
  });
});

describe('parseAndValidateSwot', () => {
  const validSwotText = JSON.stringify({
    strengths: ['Stop respeitado 100%', 'Disciplina em setup A'],
    weaknesses: ['RR abaixo do alvo em 40% dos trades'],
    opportunities: ['Revisar trades do maxDD'],
    threats: ['Compliance geral próximo do limite'],
  });

  it('parses valid JSON output into quadrants', () => {
    const parsed = parseAndValidateSwot(validSwotText);
    expect(parsed.strengths).toHaveLength(2);
    expect(parsed.weaknesses).toHaveLength(1);
  });

  it('strips markdown code fences if model wraps JSON', () => {
    const withFence = '```json\n' + validSwotText + '\n```';
    expect(() => parseAndValidateSwot(withFence)).not.toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAndValidateSwot('not json')).toThrow(/JSON/);
  });

  it('throws when a quadrant is not an array', () => {
    const bad = JSON.stringify({ ...JSON.parse(validSwotText), strengths: 'x' });
    expect(() => parseAndValidateSwot(bad)).toThrow(/strengths/);
  });

  it('throws when a quadrant is empty', () => {
    const bad = JSON.stringify({ ...JSON.parse(validSwotText), opportunities: [] });
    expect(() => parseAndValidateSwot(bad)).toThrow(/opportunities/);
  });

  it('throws when a quadrant has > 4 items', () => {
    const bad = JSON.stringify({ ...JSON.parse(validSwotText), threats: ['a', 'b', 'c', 'd', 'e'] });
    expect(() => parseAndValidateSwot(bad)).toThrow(/threats/);
  });

  it('throws when an item is empty string or non-string', () => {
    const bad1 = JSON.stringify({ ...JSON.parse(validSwotText), strengths: [''] });
    expect(() => parseAndValidateSwot(bad1)).toThrow();
    const bad2 = JSON.stringify({ ...JSON.parse(validSwotText), strengths: [42] });
    expect(() => parseAndValidateSwot(bad2)).toThrow();
  });
});

describe('buildFallbackSwot (A5: aiUnavailable=true)', () => {
  it('produces all 4 quadrants with at least 1 item each', () => {
    const sw = buildFallbackSwot(validSnapshot);
    for (const q of ['strengths', 'weaknesses', 'opportunities', 'threats']) {
      expect(Array.isArray(sw[q])).toBe(true);
      expect(sw[q].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('flags revenge/tilt events into weaknesses when present', () => {
    const snap = { ...validSnapshot, kpis: {
      ...validSnapshot.kpis,
      emotional: { ...validSnapshot.kpis.emotional, revengeCount: 3, tiltCount: 2 },
    }};
    const sw = buildFallbackSwot(snap);
    expect(sw.weaknesses.join(' ')).toMatch(/revenge/i);
    expect(sw.weaknesses.join(' ')).toMatch(/tilt/i);
  });

  it('flags overtrading into threats', () => {
    const snap = { ...validSnapshot, kpis: {
      ...validSnapshot.kpis,
      emotional: { ...validSnapshot.kpis.emotional, overtradingDays: 2 },
    }};
    const sw = buildFallbackSwot(snap);
    expect(sw.threats.join(' ')).toMatch(/overtrading/i);
  });

  it('handles null/incomplete snapshot gracefully', () => {
    const sw = buildFallbackSwot({});
    for (const q of ['strengths', 'weaknesses', 'opportunities', 'threats']) {
      expect(Array.isArray(sw[q])).toBe(true);
      expect(sw[q].length).toBeGreaterThanOrEqual(1);
    }
  });
});
