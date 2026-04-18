import { describe, it, expect } from 'vitest';
import { detectRevengeV2, DEFAULT_DETECTION_CONFIG } from '../../utils/emotionalAnalysisV2';

const neutralEmotionConfig = () => ({
  name: 'neutral',
  analysisCategory: 'NEUTRAL',
  behavioralPattern: null,
});
const getEmotionConfig = () => neutralEmotionConfig();

const mkTrade = (id, minuteOffset, result, qty = 1) => {
  const base = new Date('2026-02-12T12:00:00').getTime();
  const t = new Date(base + minuteOffset * 60_000).toISOString();
  return {
    id,
    date: '2026-02-12',
    entryTime: t,
    exitTime: t,
    result,
    qty,
  };
};

describe('detectRevengeV2 — RAPID_SEQUENCE exposes tradeIdsAfter', () => {
  it('returns tradeIdsAfter listing the trades inside the window after the loss', () => {
    // Loss at t=0, followed by 3 trades within 15min (default window)
    const trades = [
      mkTrade('loss', 0, -100),
      mkTrade('after1', 2, -50),
      mkTrade('after2', 5, -30),
      mkTrade('after3', 10, -20),
    ];

    const result = detectRevengeV2(trades, getEmotionConfig, {
      ...DEFAULT_DETECTION_CONFIG.revenge,
      qtyMultiplier: 999, // disable QTY_INCREASE to isolate RAPID_SEQUENCE
    });

    const rapid = result.instances.find(i => i.type === 'RAPID_SEQUENCE');
    expect(rapid).toBeDefined();
    expect(rapid.triggerTrade.id).toBe('loss');
    expect(rapid.tradesAfter).toBe(3);
    expect(Array.isArray(rapid.tradeIdsAfter)).toBe(true);
    expect(rapid.tradeIdsAfter).toEqual(['after1', 'after2', 'after3']);
  });

  it('does NOT include the trigger trade itself in tradeIdsAfter', () => {
    const trades = [
      mkTrade('loss', 0, -100),
      mkTrade('after1', 2, -50),
      mkTrade('after2', 5, -30),
      mkTrade('after3', 10, -20),
    ];
    const result = detectRevengeV2(trades, getEmotionConfig, {
      ...DEFAULT_DETECTION_CONFIG.revenge,
      qtyMultiplier: 999,
    });
    const rapid = result.instances.find(i => i.type === 'RAPID_SEQUENCE');
    expect(rapid.tradeIdsAfter).not.toContain('loss');
  });
});

describe('detectRevengeV2 — concurrent trades must NOT be treated as revenge', () => {
  // Regression for issue-102: trade entered BEFORE the loss exited was flagged
  // as revenge. A revenge trade must be entered AFTER the trigger loss was realized.
  const base = new Date('2026-02-12T12:00:00').getTime();
  const mk = (id, entryMin, exitMin, result, qty = 1) => ({
    id,
    date: '2026-02-12',
    entryTime: new Date(base + entryMin * 60_000).toISOString(),
    exitTime: new Date(base + exitMin * 60_000).toISOString(),
    result,
    qty,
  });

  it('does NOT include a trade entered before the trigger exited (RAPID_SEQUENCE)', () => {
    // trigger enters late, exits fast (12:10-12:12).
    // concurrent enters first, holds long (12:00-12:25) — exits AFTER trigger,
    // so sort-by-exitTime places concurrent in slice(i+1) of trigger.
    // But concurrent was ENTERED at 12:00 — before trigger's exit at 12:12.
    // Without the fix, buggy filter `(entry - triggerExit) / 60k <= 15` passes (-12 <= 15).
    const trades = [
      mk('trigger',    10, 12,  -60),    // chronological-by-exit: first
      mk('after1',     13, 14,  -30),
      mk('after2',     15, 16,  -40),
      mk('after3',     18, 19,  -20),
      mk('concurrent', 0,  25,  -50),    // entered long before trigger, but exits last
    ];
    const result = detectRevengeV2(trades, getEmotionConfig, {
      ...DEFAULT_DETECTION_CONFIG.revenge,
      qtyMultiplier: 999,
    });
    const rapidFromTrigger = result.instances.find(
      i => i.type === 'RAPID_SEQUENCE' && i.triggerTrade.id === 'trigger'
    );
    expect(rapidFromTrigger).toBeDefined();
    expect(rapidFromTrigger.tradeIdsAfter).not.toContain('concurrent');
    expect(rapidFromTrigger.tradeIdsAfter).toEqual(['after1', 'after2', 'after3']);
  });

  it('does NOT flag QTY_INCREASE when currTrade entered before prevTrade exited', () => {
    const trades = [
      mk('trigger',    10, 12, -60, 1),
      mk('concurrent', 0,  25, -50, 1),  // sorted AFTER trigger (exit 25 > 12)
    ];
    const result = detectRevengeV2(trades, getEmotionConfig, {
      ...DEFAULT_DETECTION_CONFIG.revenge,
      qtyMultiplier: 0.5,
    });
    const qtyInc = result.instances.find(
      i => i.type === 'QTY_INCREASE' && i.trade.id === 'concurrent'
    );
    expect(qtyInc).toBeUndefined();
  });
});
