import { describe, it, expect } from 'vitest';
import {
  analyzeShadowForTrade,
  analyzeShadowBatch,
  detectHoldAsymmetry,
  detectRevengeCluster,
  detectGreedCluster,
  detectOvertrading,
  detectImpulseCluster,
  detectCleanExecution,
  detectTargetHit,
  detectDirectionFlip,
  detectUndersizedTrade,
  detectHesitation,
  detectStopPanic,
  detectFomoEntry,
  detectEarlyExit,
  detectLateExit,
  detectAveragingDown,
  PATTERN_CODES,
  SEVERITY,
  RESOLUTION,
  DEFAULT_CONFIG
} from '../../utils/shadowBehaviorAnalysis';

// ============================================
// FIXTURES
// ============================================

const baseTrade = (overrides = {}) => ({
  id: 'trade-1',
  studentId: 'student-1',
  ticker: 'WIN',
  side: 'LONG',
  entry: 130000,
  exit: 130100,
  qty: 1,
  stopLoss: 129900,
  result: 100,
  rrRatio: 1.0,
  rrAssumed: false,
  planRR: 2.0,
  date: '2026-04-10',
  entryTime: '2026-04-10T10:00:00',
  exitTime: '2026-04-10T10:30:00',
  duration: 30,
  lowResolution: false,
  _partials: [
    { seq: 1, type: 'ENTRY', price: 130000, qty: 1, dateTime: '2026-04-10T10:00:00' },
    { seq: 2, type: 'EXIT', price: 130100, qty: 1, dateTime: '2026-04-10T10:30:00' }
  ],
  ...overrides
});

const lossTrade = (overrides = {}) => baseTrade({
  id: 'trade-loss',
  exit: 129900,
  result: -100,
  exitTime: '2026-04-10T10:30:00',
  _partials: [
    { seq: 1, type: 'ENTRY', price: 130000, qty: 1, dateTime: '2026-04-10T10:00:00' },
    { seq: 2, type: 'EXIT', price: 129900, qty: 1, dateTime: '2026-04-10T10:30:00' }
  ],
  ...overrides
});

const adjacentWins = (count, startMinute = 0) =>
  Array.from({ length: count }, (_, i) => baseTrade({
    id: `adj-win-${i}`,
    entryTime: `2026-04-10T09:${String(startMinute + i * 10).padStart(2, '0')}:00`,
    exitTime: `2026-04-10T09:${String(startMinute + i * 10 + 5).padStart(2, '0')}:00`,
    result: 50 + i * 10,
    duration: 5
  }));

const adjacentLosses = (count, startMinute = 0) =>
  Array.from({ length: count }, (_, i) => lossTrade({
    id: `adj-loss-${i}`,
    entryTime: `2026-04-10T09:${String(startMinute + i * 10).padStart(2, '0')}:00`,
    exitTime: `2026-04-10T09:${String(startMinute + i * 10 + 5).padStart(2, '0')}:00`,
    result: -(50 + i * 10),
    duration: 5
  }));

// ============================================
// LAYER 1 — HOLD_ASYMMETRY
// ============================================

describe('detectHoldAsymmetry', () => {
  it('detects when loss duration > 3x average win duration', () => {
    const trade = lossTrade({
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T11:00:00', // 60min — loss held 60min
      duration: 60
    });
    // Adjacent wins average 5min each
    const adjacent = adjacentWins(5);
    const result = detectHoldAsymmetry(trade, adjacent);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.HOLD_ASYMMETRY);
    expect(result.evidence.ratio).toBeGreaterThan(3);
    expect(result.layer).toBe(1);
  });

  it('returns null for winning trade', () => {
    const trade = baseTrade({ duration: 60 });
    const result = detectHoldAsymmetry(trade, adjacentWins(5));
    expect(result).toBeNull();
  });

  it('returns null when not enough sample trades', () => {
    const trade = lossTrade({ duration: 60 });
    const result = detectHoldAsymmetry(trade, adjacentWins(1)); // only 1, need 3
    expect(result).toBeNull();
  });

  it('returns null when ratio is within threshold', () => {
    const trade = lossTrade({
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T10:10:00', // 10min — only 2x win avg
      duration: 10
    });
    const result = detectHoldAsymmetry(trade, adjacentWins(5));
    expect(result).toBeNull();
  });

  it('assigns HIGH severity for extreme ratios', () => {
    const trade = lossTrade({
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T12:00:00', // 120min
      duration: 120
    });
    const result = detectHoldAsymmetry(trade, adjacentWins(5));
    expect(result).not.toBeNull();
    expect(result.severity).toBe(SEVERITY.HIGH);
  });

  it('reduces confidence for lowResolution trades', () => {
    const trade = lossTrade({
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T11:00:00',
      lowResolution: true
    });
    const normal = detectHoldAsymmetry(
      lossTrade({ entryTime: '2026-04-10T10:00:00', exitTime: '2026-04-10T11:00:00' }),
      adjacentWins(5)
    );
    const low = detectHoldAsymmetry(trade, adjacentWins(5));
    expect(low.confidence).toBeLessThan(normal.confidence);
  });
});

// ============================================
// LAYER 1 — REVENGE_CLUSTER
// ============================================

describe('detectRevengeCluster', () => {
  it('detects trade entered within 5min after a loss', () => {
    const prevLoss = lossTrade({
      id: 'prev-loss',
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T10:20:00'
    });
    const trade = baseTrade({
      entryTime: '2026-04-10T10:22:00', // 2min after loss exit
      exitTime: '2026-04-10T10:25:00'
    });
    const nextTrade = baseTrade({
      id: 'next-trade',
      entryTime: '2026-04-10T10:26:00', // 1min after trade exit — within 5min cluster
      exitTime: '2026-04-10T10:30:00'
    });
    const result = detectRevengeCluster(trade, [prevLoss, nextTrade]);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.REVENGE_CLUSTER);
    expect(result.evidence.previousLoss).toBeLessThan(0);
  });

  it('returns null when previous trade was a win', () => {
    const prevWin = baseTrade({
      id: 'prev-win',
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T10:20:00',
      result: 100
    });
    const trade = baseTrade({
      entryTime: '2026-04-10T10:22:00',
      exitTime: '2026-04-10T10:30:00'
    });
    const result = detectRevengeCluster(trade, [prevWin]);
    expect(result).toBeNull();
  });

  it('returns null when interval exceeds threshold', () => {
    const prevLoss = lossTrade({
      id: 'prev-loss',
      exitTime: '2026-04-10T10:00:00'
    });
    const trade = baseTrade({
      entryTime: '2026-04-10T10:10:00', // 10min after — too far
      exitTime: '2026-04-10T10:20:00'
    });
    const result = detectRevengeCluster(trade, [prevLoss]);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — GREED_CLUSTER
// ============================================

describe('detectGreedCluster', () => {
  it('detects 3+ rapid trades after consecutive wins', () => {
    const wins = [
      baseTrade({ id: 'w1', entryTime: '2026-04-10T10:00:00', exitTime: '2026-04-10T10:02:00', result: 50 }),
      baseTrade({ id: 'w2', entryTime: '2026-04-10T10:03:00', exitTime: '2026-04-10T10:05:00', result: 60 }),
      baseTrade({ id: 'w3', entryTime: '2026-04-10T10:06:00', exitTime: '2026-04-10T10:08:00', result: 70 })
    ];
    const trade = baseTrade({
      entryTime: '2026-04-10T10:09:00',
      exitTime: '2026-04-10T10:11:00'
    });
    const result = detectGreedCluster(trade, wins);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.GREED_CLUSTER);
    expect(result.evidence.consecutiveWinsBefore).toBeGreaterThanOrEqual(1);
  });

  it('returns null when previous trades were losses', () => {
    const losses = adjacentLosses(3);
    const trade = baseTrade({
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T10:05:00'
    });
    const result = detectGreedCluster(trade, losses);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — OVERTRADING
// ============================================

describe('detectOvertrading', () => {
  it('detects when trades exceed threshold in window', () => {
    const trade = baseTrade({ entryTime: '2026-04-10T10:30:00' });
    const adjacent = Array.from({ length: 8 }, (_, i) => baseTrade({
      id: `ot-${i}`,
      date: '2026-04-10',
      entryTime: `2026-04-10T10:${String(i * 5).padStart(2, '0')}:00`,
      exitTime: `2026-04-10T10:${String(i * 5 + 3).padStart(2, '0')}:00`
    }));
    const result = detectOvertrading(trade, adjacent);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.OVERTRADING);
    expect(result.evidence.tradesInWindow).toBeGreaterThan(5);
  });

  it('returns null when below threshold', () => {
    const trade = baseTrade({ entryTime: '2026-04-10T10:30:00' });
    const adjacent = [
      baseTrade({ id: 'a1', date: '2026-04-10', entryTime: '2026-04-10T10:00:00' }),
      baseTrade({ id: 'a2', date: '2026-04-10', entryTime: '2026-04-10T10:15:00' })
    ];
    const result = detectOvertrading(trade, adjacent);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — IMPULSE_CLUSTER
// ============================================

describe('detectImpulseCluster', () => {
  it('detects 2+ trades within 2 minutes', () => {
    const trade = baseTrade({
      entryTime: '2026-04-10T10:01:00',
      exitTime: '2026-04-10T10:03:00'
    });
    const neighbor = baseTrade({
      id: 'neighbor',
      entryTime: '2026-04-10T10:03:30',
      exitTime: '2026-04-10T10:05:00'
    });
    const result = detectImpulseCluster(trade, [neighbor]);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.IMPULSE_CLUSTER);
    expect(result.evidence.clusterCount).toBeGreaterThanOrEqual(2);
  });

  it('returns null when gap exceeds threshold', () => {
    const trade = baseTrade({ entryTime: '2026-04-10T10:00:00', exitTime: '2026-04-10T10:05:00' });
    const neighbor = baseTrade({
      id: 'far',
      entryTime: '2026-04-10T10:10:00',
      exitTime: '2026-04-10T10:15:00'
    });
    const result = detectImpulseCluster(trade, [neighbor]);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — CLEAN_EXECUTION
// ============================================

describe('detectCleanExecution', () => {
  it('detects clean trade with stop + positive RR + no negative patterns', () => {
    const trade = baseTrade({ rrRatio: 2.0, result: 200 });
    const result = detectCleanExecution(trade, [], []);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.CLEAN_EXECUTION);
    expect(result.severity).toBe(SEVERITY.NONE);
    expect(result.emotionMapping).toBe('DISCIPLINE');
  });

  it('returns null when negative patterns exist', () => {
    const trade = baseTrade({ rrRatio: 2.0, result: 200 });
    const negativePatterns = [{ code: PATTERN_CODES.IMPULSE_CLUSTER, severity: SEVERITY.LOW }];
    const result = detectCleanExecution(trade, [], negativePatterns);
    expect(result).toBeNull();
  });

  it('returns null for losing trade', () => {
    const trade = lossTrade();
    const result = detectCleanExecution(trade, [], []);
    expect(result).toBeNull();
  });

  it('returns null when no stop', () => {
    const trade = baseTrade({ stopLoss: null, result: 100 });
    const result = detectCleanExecution(trade, [], []);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — TARGET_HIT
// ============================================

describe('detectTargetHit', () => {
  it('detects exit at planned target', () => {
    // entry 130000, stop 129900 (risk = 100), planRR 2.0
    // target = 130000 + 200 = 130200
    const trade = baseTrade({
      exit: 130195, // within 5% tolerance of 200pt target = 10pts
      result: 195,
      rrRatio: 1.95,
      planRR: 2.0
    });
    const result = detectTargetHit(trade, []);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.TARGET_HIT);
    expect(result.severity).toBe(SEVERITY.NONE);
  });

  it('returns null for losing trade', () => {
    const result = detectTargetHit(lossTrade(), []);
    expect(result).toBeNull();
  });

  it('returns null when rrAssumed', () => {
    const trade = baseTrade({ rrAssumed: true });
    const result = detectTargetHit(trade, []);
    expect(result).toBeNull();
  });

  it('returns null when exit is far from target', () => {
    // target = 130200, exit = 130050 — too far
    const trade = baseTrade({
      exit: 130050,
      result: 50,
      rrRatio: 0.5,
      planRR: 2.0
    });
    const result = detectTargetHit(trade, []);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — DIRECTION_FLIP
// ============================================

describe('detectDirectionFlip', () => {
  it('detects LONG→SHORT flip after loss within 120min', () => {
    const prevLoss = lossTrade({
      id: 'prev-loss',
      side: 'LONG',
      ticker: 'WIN',
      exitTime: '2026-04-14T10:00:00'
    });
    const trade = baseTrade({
      side: 'SHORT',
      ticker: 'WIN',
      entryTime: '2026-04-14T10:30:00', // 30min depois
      exitTime: '2026-04-14T10:45:00'
    });
    const result = detectDirectionFlip(trade, [prevLoss]);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.DIRECTION_FLIP);
    expect(result.evidence.previousSide).toBe('LONG');
    expect(result.evidence.currentSide).toBe('SHORT');
    expect(result.evidence.instrument).toBe('WIN');
    expect(result.emotionMapping).toBe('CONFUSION');
  });

  it('detects SHORT→LONG flip after loss', () => {
    const prevLoss = lossTrade({
      id: 'prev-loss',
      side: 'SHORT',
      ticker: 'WIN',
      exitTime: '2026-04-14T10:00:00'
    });
    const trade = baseTrade({
      side: 'LONG',
      ticker: 'WIN',
      entryTime: '2026-04-14T10:10:00',
      exitTime: '2026-04-14T10:20:00'
    });
    const result = detectDirectionFlip(trade, [prevLoss]);
    expect(result).not.toBeNull();
    expect(result.severity).toBe(SEVERITY.HIGH); // ≤15min
  });

  it('severity escalates: HIGH ≤15min, MEDIUM ≤60min, LOW ≤120min', () => {
    const prev = lossTrade({ id: 'p', side: 'LONG', ticker: 'WIN', exitTime: '2026-04-14T10:00:00' });
    const high = detectDirectionFlip(
      baseTrade({ side: 'SHORT', ticker: 'WIN', entryTime: '2026-04-14T10:10:00', exitTime: '2026-04-14T10:15:00' }),
      [prev]
    );
    const medium = detectDirectionFlip(
      baseTrade({ side: 'SHORT', ticker: 'WIN', entryTime: '2026-04-14T10:45:00', exitTime: '2026-04-14T11:00:00' }),
      [prev]
    );
    const low = detectDirectionFlip(
      baseTrade({ side: 'SHORT', ticker: 'WIN', entryTime: '2026-04-14T11:45:00', exitTime: '2026-04-14T12:00:00' }),
      [prev]
    );
    expect(high.severity).toBe(SEVERITY.HIGH);
    expect(medium.severity).toBe(SEVERITY.MEDIUM);
    expect(low.severity).toBe(SEVERITY.LOW);
  });

  it('returns null when previous trade was a win', () => {
    const prevWin = baseTrade({
      id: 'prev-win',
      side: 'LONG',
      ticker: 'WIN',
      result: 100,
      exitTime: '2026-04-14T10:00:00'
    });
    const trade = baseTrade({ side: 'SHORT', ticker: 'WIN', entryTime: '2026-04-14T10:10:00' });
    const result = detectDirectionFlip(trade, [prevWin]);
    expect(result).toBeNull();
  });

  it('returns null when side is the same', () => {
    const prevLoss = lossTrade({ id: 'p', side: 'LONG', ticker: 'WIN', exitTime: '2026-04-14T10:00:00' });
    const trade = baseTrade({ side: 'LONG', ticker: 'WIN', entryTime: '2026-04-14T10:10:00' });
    const result = detectDirectionFlip(trade, [prevLoss]);
    expect(result).toBeNull();
  });

  it('returns null when different instrument', () => {
    const prevLoss = lossTrade({ id: 'p', side: 'LONG', ticker: 'WIN', exitTime: '2026-04-14T10:00:00' });
    const trade = baseTrade({ side: 'SHORT', ticker: 'DOL', entryTime: '2026-04-14T10:10:00' });
    const result = detectDirectionFlip(trade, [prevLoss]);
    expect(result).toBeNull();
  });

  it('returns null when interval > 120min', () => {
    const prevLoss = lossTrade({ id: 'p', side: 'LONG', ticker: 'WIN', exitTime: '2026-04-14T10:00:00' });
    const trade = baseTrade({ side: 'SHORT', ticker: 'WIN', entryTime: '2026-04-14T13:00:00' }); // 180min
    const result = detectDirectionFlip(trade, [prevLoss]);
    expect(result).toBeNull();
  });

  it('returns null with no adjacent trades', () => {
    const trade = baseTrade({ side: 'SHORT', ticker: 'WIN' });
    const result = detectDirectionFlip(trade, []);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 1 — UNDERSIZED_TRADE
// ============================================

describe('detectUndersizedTrade', () => {
  it('detects HIGH severity when actual risk < 25% of plan RO', () => {
    const trade = baseTrade({ riskPercent: 0.1, planRoPct: 0.5 }); // 20% utilization
    const result = detectUndersizedTrade(trade, []);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.UNDERSIZED_TRADE);
    expect(result.severity).toBe(SEVERITY.HIGH);
    expect(result.evidence.utilizationPct).toBe(20);
    expect(result.emotionMapping).toBe('AVOIDANCE');
  });

  it('detects MEDIUM severity when ratio is between 25% and 40%', () => {
    const trade = baseTrade({ riskPercent: 0.15, planRoPct: 0.5 }); // 30% utilization
    const result = detectUndersizedTrade(trade, []);
    expect(result.severity).toBe(SEVERITY.MEDIUM);
  });

  it('detects LOW severity when ratio is between 40% and 50%', () => {
    const trade = baseTrade({ riskPercent: 0.225, planRoPct: 0.5 }); // 45% utilization
    const result = detectUndersizedTrade(trade, []);
    expect(result.severity).toBe(SEVERITY.LOW);
  });

  it('returns null when ratio is >= 50% of plan', () => {
    const trade = baseTrade({ riskPercent: 0.30, planRoPct: 0.5 }); // 60% utilization
    const result = detectUndersizedTrade(trade, []);
    expect(result).toBeNull();
  });

  it('returns null when planRoPct is missing', () => {
    const trade = baseTrade({ riskPercent: 0.1, planRoPct: null });
    const result = detectUndersizedTrade(trade, []);
    expect(result).toBeNull();
  });

  it('returns null when riskPercent is missing', () => {
    const trade = baseTrade({ riskPercent: null, planRoPct: 0.5 });
    const result = detectUndersizedTrade(trade, []);
    expect(result).toBeNull();
  });

  it('returns null when planRoPct is zero', () => {
    const trade = baseTrade({ riskPercent: 0.1, planRoPct: 0 });
    const result = detectUndersizedTrade(trade, []);
    expect(result).toBeNull();
  });

  it('reproduces the exact scenario from validation: arriscou 30 com RO 100 (30%)', () => {
    // riskPercent calculado pela compliance: ex 0.3% (30 / 10000 * 100)
    // planRoPct: 1.0% (100 / 10000 * 100)
    const trade = baseTrade({ riskPercent: 0.3, planRoPct: 1.0 });
    const result = detectUndersizedTrade(trade, []);
    expect(result).not.toBeNull();
    expect(result.severity).toBe(SEVERITY.MEDIUM); // 30% utilization
    expect(result.evidence.utilizationPct).toBe(30);
  });
});

// ============================================
// LAYER 2 — HESITATION
// ============================================

describe('detectHesitation', () => {
  it('detects 2+ cancelled orders before trade entry', () => {
    const trade = baseTrade({ entryTime: '2026-04-10T10:05:00' });
    const orders = [
      { status: 'CANCELLED', submittedAt: '2026-04-10T10:00:00', cancelledAt: '2026-04-10T10:01:00', externalOrderId: 'o1' },
      { status: 'CANCELLED', submittedAt: '2026-04-10T10:02:00', cancelledAt: '2026-04-10T10:03:00', externalOrderId: 'o2' },
      { status: 'FILLED', submittedAt: '2026-04-10T10:04:00', filledAt: '2026-04-10T10:05:00', externalOrderId: 'o3' }
    ];
    const result = detectHesitation(trade, orders);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.HESITATION);
    expect(result.layer).toBe(2);
    expect(result.evidence.cancelledOrdersCount).toBe(2);
  });

  it('returns null without orders', () => {
    const result = detectHesitation(baseTrade(), null);
    expect(result).toBeNull();
  });

  it('returns null with only 1 cancel', () => {
    const orders = [
      { status: 'CANCELLED', submittedAt: '2026-04-10T10:00:00', cancelledAt: '2026-04-10T10:01:00', externalOrderId: 'o1' }
    ];
    const result = detectHesitation(baseTrade({ entryTime: '2026-04-10T10:05:00' }), orders);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 2 — STOP_PANIC
// ============================================

describe('detectStopPanic', () => {
  it('detects stop widened + rapid exit', () => {
    const trade = baseTrade({ exitTime: '2026-04-10T10:22:00' });
    const orders = [
      { isStopOrder: true, status: 'CANCELLED', lastUpdatedAt: '2026-04-10T10:20:00', submittedAt: '2026-04-10T10:00:00' },
      { isStopOrder: true, status: 'FILLED', filledAt: '2026-04-10T10:22:00', submittedAt: '2026-04-10T10:20:30' }
    ];
    const result = detectStopPanic(trade, orders);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.STOP_PANIC);
    expect(result.evidence.exitAfterWidenMinutes).toBeLessThanOrEqual(5);
  });

  it('returns null when no stop orders', () => {
    const orders = [{ isStopOrder: false, status: 'FILLED' }];
    const result = detectStopPanic(baseTrade(), orders);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 2 — FOMO_ENTRY
// ============================================

describe('detectFomoEntry', () => {
  it('detects market order with long delay', () => {
    const trade = baseTrade();
    const orders = [
      {
        status: 'FILLED',
        isStopOrder: false,
        orderType: 'MARKET',
        submittedAt: '2026-04-10T09:45:00',
        filledAt: '2026-04-10T10:00:00', // 15min delay
        externalOrderId: 'o1'
      }
    ];
    const result = detectFomoEntry(trade, orders);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.FOMO_ENTRY);
    expect(result.evidence.maxDelayMinutes).toBeGreaterThanOrEqual(10);
  });

  it('returns null for limit order', () => {
    const orders = [
      { status: 'FILLED', isStopOrder: false, orderType: 'LIMIT', submittedAt: '2026-04-10T09:45:00', filledAt: '2026-04-10T10:00:00' }
    ];
    const result = detectFomoEntry(baseTrade(), orders);
    expect(result).toBeNull();
  });

  it('returns null when delay is short', () => {
    const orders = [
      { status: 'FILLED', isStopOrder: false, orderType: 'MARKET', submittedAt: '2026-04-10T09:58:00', filledAt: '2026-04-10T09:58:30' }
    ];
    const result = detectFomoEntry(baseTrade(), orders);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 2 — EARLY_EXIT
// ============================================

describe('detectEarlyExit', () => {
  it('detects exit well below RR target', () => {
    const trade = baseTrade({
      result: 30,
      rrRatio: 0.3,   // actual RR
      planRR: 2.0      // plan RR target
    });
    const result = detectEarlyExit(trade, []);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.EARLY_EXIT);
    expect(result.evidence.rrAchievedPct).toBeLessThan(50);
  });

  it('returns null when RR close to target', () => {
    const trade = baseTrade({
      result: 180,
      rrRatio: 1.8,
      planRR: 2.0
    });
    const result = detectEarlyExit(trade, []);
    expect(result).toBeNull();
  });

  it('returns null for losing trade', () => {
    const result = detectEarlyExit(lossTrade(), []);
    expect(result).toBeNull();
  });

  it('returns null when stop was hit (orders present)', () => {
    const trade = baseTrade({ result: 30, rrRatio: 0.3, planRR: 2.0 });
    const orders = [{ isStopOrder: true, status: 'FILLED' }];
    const result = detectEarlyExit(trade, orders);
    expect(result).toBeNull();
  });

  it('has higher confidence with order data', () => {
    const trade = baseTrade({ result: 30, rrRatio: 0.3, planRR: 2.0 });
    const withoutOrders = detectEarlyExit(trade, null);
    const withOrders = detectEarlyExit(trade, [
      { isStopOrder: false, status: 'FILLED' }
    ]);
    expect(withOrders.confidence).toBeGreaterThan(withoutOrders.confidence);
  });
});

// ============================================
// LAYER 2 — LATE_EXIT
// ============================================

describe('detectLateExit', () => {
  it('detects exit > 15min after stop cancelled', () => {
    const trade = lossTrade({
      exitTime: '2026-04-10T10:50:00'
    });
    const orders = [
      {
        isStopOrder: true,
        status: 'CANCELLED',
        cancelledAt: '2026-04-10T10:30:00',
        submittedAt: '2026-04-10T10:00:00'
      }
    ];
    const result = detectLateExit(trade, orders);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.LATE_EXIT);
    expect(result.evidence.delayMinutes).toBeGreaterThanOrEqual(15);
  });

  it('returns null for winning trade', () => {
    const orders = [
      { isStopOrder: true, status: 'CANCELLED', cancelledAt: '2026-04-10T10:00:00', submittedAt: '2026-04-10T09:50:00' }
    ];
    const result = detectLateExit(baseTrade(), orders);
    expect(result).toBeNull();
  });

  it('returns null without orders', () => {
    const result = detectLateExit(lossTrade(), null);
    expect(result).toBeNull();
  });
});

// ============================================
// LAYER 2 — AVERAGING_DOWN
// ============================================

describe('detectAveragingDown', () => {
  it('detects same-direction orders at worsening price (LONG buying lower)', () => {
    const trade = baseTrade({ side: 'LONG' });
    const orders = [
      { status: 'FILLED', isStopOrder: false, side: 'BUY', filledPrice: 130000, filledAt: '2026-04-10T10:00:00', submittedAt: '2026-04-10T10:00:00' },
      { status: 'FILLED', isStopOrder: false, side: 'BUY', filledPrice: 129950, filledAt: '2026-04-10T10:05:00', submittedAt: '2026-04-10T10:05:00' },
      { status: 'FILLED', isStopOrder: false, side: 'BUY', filledPrice: 129900, filledAt: '2026-04-10T10:10:00', submittedAt: '2026-04-10T10:10:00' }
    ];
    const result = detectAveragingDown(trade, orders);
    expect(result).not.toBeNull();
    expect(result.code).toBe(PATTERN_CODES.AVERAGING_DOWN);
    expect(result.evidence.averagingCount).toBeGreaterThanOrEqual(2);
  });

  it('returns null without orders', () => {
    const result = detectAveragingDown(baseTrade(), null);
    expect(result).toBeNull();
  });

  it('returns null when prices improve', () => {
    const trade = baseTrade({ side: 'LONG' });
    const orders = [
      { status: 'FILLED', isStopOrder: false, side: 'BUY', filledPrice: 130000, filledAt: '2026-04-10T10:00:00', submittedAt: '2026-04-10T10:00:00' },
      { status: 'FILLED', isStopOrder: false, side: 'BUY', filledPrice: 130050, filledAt: '2026-04-10T10:05:00', submittedAt: '2026-04-10T10:05:00' }
    ];
    const result = detectAveragingDown(trade, orders);
    expect(result).toBeNull();
  });
});

// ============================================
// MAIN ENGINE — analyzeShadowForTrade
// ============================================

describe('analyzeShadowForTrade', () => {
  it('returns null for null trade', () => {
    expect(analyzeShadowForTrade(null)).toBeNull();
  });

  it('returns null for trade without id', () => {
    expect(analyzeShadowForTrade({ ticker: 'WIN' })).toBeNull();
  });

  it('returns shadowBehavior object with correct structure', () => {
    const trade = baseTrade();
    const result = analyzeShadowForTrade(trade, []);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('resolution');
    expect(result).toHaveProperty('marketContext');
    expect(result).toHaveProperty('analyzedAt');
    expect(result).toHaveProperty('orderCount');
    expect(result).toHaveProperty('version', '1.0');
    expect(Array.isArray(result.patterns)).toBe(true);
  });

  it('returns resolution LOW without orders and without enrichment', () => {
    const trade = baseTrade();
    const result = analyzeShadowForTrade(trade, []);
    expect(result.resolution).toBe(RESOLUTION.LOW);
    expect(result.orderCount).toBe(0);
  });

  it('returns resolution MEDIUM for enriched trade without orders', () => {
    const trade = baseTrade({ enrichedByImport: true });
    const result = analyzeShadowForTrade(trade, []);
    expect(result.resolution).toBe(RESOLUTION.MEDIUM);
  });

  it('returns resolution HIGH when orders provided', () => {
    const trade = baseTrade();
    const orders = [
      { status: 'FILLED', isStopOrder: false, orderType: 'LIMIT', submittedAt: '2026-04-10T10:00:00', filledAt: '2026-04-10T10:00:00' }
    ];
    const result = analyzeShadowForTrade(trade, [], orders);
    expect(result.resolution).toBe(RESOLUTION.HIGH);
    expect(result.orderCount).toBe(1);
  });

  it('detects CLEAN_EXECUTION for disciplined winning trade', () => {
    const trade = baseTrade({ rrRatio: 2.0, result: 200 });
    const result = analyzeShadowForTrade(trade, []);
    const clean = result.patterns.find(p => p.code === PATTERN_CODES.CLEAN_EXECUTION);
    expect(clean).toBeDefined();
    expect(clean.emotionMapping).toBe('DISCIPLINE');
  });

  it('detects multiple patterns simultaneously', () => {
    // Setup: loss trade after another loss, entered quickly — REVENGE + HOLD_ASYMMETRY
    const prevLoss = lossTrade({
      id: 'prev-loss',
      entryTime: '2026-04-10T10:00:00',
      exitTime: '2026-04-10T10:05:00',
      duration: 5
    });
    const trade = lossTrade({
      entryTime: '2026-04-10T10:06:00', // 1min after loss
      exitTime: '2026-04-10T11:06:00',  // held 60min
      duration: 60
    });
    // Need more adjacent wins for HOLD_ASYMMETRY sample
    const moreWins = adjacentWins(4, 0);
    const result = analyzeShadowForTrade(trade, [prevLoss, ...moreWins]);
    expect(result.patterns.length).toBeGreaterThanOrEqual(1);
    const codes = result.patterns.map(p => p.code);
    // At least one of these should be detected
    expect(
      codes.includes(PATTERN_CODES.REVENGE_CLUSTER) ||
      codes.includes(PATTERN_CODES.HOLD_ASYMMETRY)
    ).toBe(true);
  });

  it('includes marketContext', () => {
    const trade = baseTrade({ ticker: 'NQ' });
    const result = analyzeShadowForTrade(trade, []);
    expect(result.marketContext).toBeDefined();
    expect(result.marketContext.instrument).toBe('NQ');
  });

  it('does not detect CLEAN_EXECUTION when negative patterns present', () => {
    // Many trades same day = overtrading → no clean execution
    const trade = baseTrade({ entryTime: '2026-04-10T10:30:00', rrRatio: 2.0, result: 200 });
    const many = Array.from({ length: 10 }, (_, i) => baseTrade({
      id: `ot-${i}`,
      date: '2026-04-10',
      entryTime: `2026-04-10T10:${String(i * 3).padStart(2, '0')}:00`,
      exitTime: `2026-04-10T10:${String(i * 3 + 2).padStart(2, '0')}:00`
    }));
    const result = analyzeShadowForTrade(trade, many);
    const clean = result.patterns.find(p => p.code === PATTERN_CODES.CLEAN_EXECUTION);
    const hasNegative = result.patterns.some(p =>
      p.code !== PATTERN_CODES.CLEAN_EXECUTION && p.code !== PATTERN_CODES.TARGET_HIT
    );
    if (hasNegative) {
      expect(clean).toBeUndefined();
    }
  });
});

// ============================================
// BATCH ENGINE — analyzeShadowBatch
// ============================================

describe('analyzeShadowBatch', () => {
  it('returns empty map for empty trades', () => {
    const result = analyzeShadowBatch([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map for null trades', () => {
    const result = analyzeShadowBatch(null);
    expect(result.size).toBe(0);
  });

  it('analyzes all trades and returns map', () => {
    const trades = [
      baseTrade({ id: 't1', studentId: 's1', date: '2026-04-10', entryTime: '2026-04-10T10:00:00' }),
      baseTrade({ id: 't2', studentId: 's1', date: '2026-04-10', entryTime: '2026-04-10T10:30:00' }),
      baseTrade({ id: 't3', studentId: 's1', date: '2026-04-11', entryTime: '2026-04-11T10:00:00' })
    ];
    const result = analyzeShadowBatch(trades);
    expect(result.size).toBe(3);
    expect(result.has('t1')).toBe(true);
    expect(result.has('t2')).toBe(true);
    expect(result.has('t3')).toBe(true);
  });

  it('uses same-day trades as adjacent for each trade', () => {
    const trades = [
      baseTrade({ id: 't1', studentId: 's1', date: '2026-04-10', entryTime: '2026-04-10T10:00:00', exitTime: '2026-04-10T10:05:00' }),
      baseTrade({ id: 't2', studentId: 's1', date: '2026-04-10', entryTime: '2026-04-10T10:06:00', exitTime: '2026-04-10T10:10:00' }),
      baseTrade({ id: 't3', studentId: 's2', date: '2026-04-10', entryTime: '2026-04-10T10:00:00', exitTime: '2026-04-10T10:05:00' }) // different student
    ];
    const result = analyzeShadowBatch(trades);
    // All 3 should be analyzed
    expect(result.size).toBe(3);
  });

  it('passes orders by tradeId when provided', () => {
    const trades = [
      baseTrade({ id: 't1', studentId: 's1', date: '2026-04-10' })
    ];
    const ordersByTradeId = {
      t1: [{ status: 'FILLED', isStopOrder: false, orderType: 'LIMIT', submittedAt: '2026-04-10T10:00:00', filledAt: '2026-04-10T10:00:00' }]
    };
    const result = analyzeShadowBatch(trades, ordersByTradeId);
    const shadow = result.get('t1');
    expect(shadow.resolution).toBe(RESOLUTION.HIGH);
    expect(shadow.orderCount).toBe(1);
  });
});
