/**
 * Issue #208 — gates 3→4 comportamentais em evaluateMaturity.
 *
 * Verifica:
 *   - executionEvents + tradesWithOrderData ≥ 30 → counts derivados,
 *     gates met/missed conforme presença
 *   - tradesWithOrderData < 30 → métricas null → gates METRIC_UNAVAILABLE
 *   - eventos fora da janela W são filtrados
 */

import { describe, it, expect } from 'vitest';
import { evaluateMaturity } from '../../../utils/maturityEngine/evaluateMaturity.js';

const baseInput = (overrides = {}) => ({
  trades: [],
  plans: [],
  now: '2026-04-22T12:00:00Z',
  stageCurrent: 3,
  baseline: { emotional: 60, financial: 70, operational: 65 },
  emotionalAnalysis: { periodScore: 80, tiltCount: 0, revengeCount: 0 },
  complianceRate: 95,
  stats: { winRate: 55, payoffRatio: 2.0 },
  payoff: { ratio: 2.0 },
  consistencyCV: { cv: 0.4 },
  maxDrawdown: { maxDDPercent: 5 },
  advancedMetricsPresent: true,
  complianceRate100: 100,
  ...overrides,
});

const makeTrade = (id, dateOffsetDays = 0) => {
  const baseDate = Date.parse('2026-03-01T10:00:00Z');
  const ts = baseDate + dateOffsetDays * 86400000;
  return {
    id,
    ticker: 'WINM26',
    side: 'LONG',
    qty: 1,
    result: 100,
    date: new Date(ts).toISOString(),
    entryTime: new Date(ts).toISOString(),
    exitTime: new Date(ts + 30 * 60000).toISOString(),
  };
};

const makeWindow = (count) =>
  Array.from({ length: count }, (_, i) => makeTrade(`T${i + 1}`, i));

describe('evaluateMaturity — gates comportamentais (#208)', () => {
  it('coverage<30: 3 novos gates ficam METRIC_UNAVAILABLE', () => {
    const out = evaluateMaturity(baseInput({
      trades: makeWindow(50),
      tradesWithOrderData: 10,
      executionEvents: [],
    }));

    const newGateIds = ['no-stop-tampering', 'no-chase', 'disciplined-sizing'];
    const newGates = out.gates.filter((g) => newGateIds.includes(g.id));
    expect(newGates).toHaveLength(3);
    for (const g of newGates) {
      expect(g.met).toBeNull();
      expect(g.reason).toBe('METRIC_UNAVAILABLE');
      expect(g.value).toBeNull();
    }
  });

  it('coverage>=30 sem eventos: 3 novos gates met (counts=0)', () => {
    const out = evaluateMaturity(baseInput({
      trades: makeWindow(50),
      tradesWithOrderData: 50,
      executionEvents: [],
    }));

    const newGateIds = ['no-stop-tampering', 'no-chase', 'disciplined-sizing'];
    const newGates = out.gates.filter((g) => newGateIds.includes(g.id));
    expect(newGates).toHaveLength(3);
    for (const g of newGates) {
      expect(g.met).toBe(true);
      expect(g.value).toBe(0);
    }
  });

  it('eventos presentes derrubam os gates correspondentes', () => {
    const trades = makeWindow(50);
    const out = evaluateMaturity(baseInput({
      trades,
      tradesWithOrderData: 50,
      executionEvents: [
        { type: 'STOP_TAMPERING', tradeId: 'T1' },
        { type: 'CHASE_REENTRY', tradeId: 'T2' },
        { type: 'STOP_PARTIAL_SIZING', tradeId: 'T3' },
        { type: 'HESITATION_PRE_ENTRY', tradeId: 'T4' }, // não tem gate
      ],
    }));

    const byId = Object.fromEntries(out.gates.map((g) => [g.id, g]));
    expect(byId['no-stop-tampering'].met).toBe(false);
    expect(byId['no-stop-tampering'].value).toBe(1);
    expect(byId['no-chase'].met).toBe(false);
    expect(byId['no-chase'].value).toBe(1);
    expect(byId['disciplined-sizing'].met).toBe(false);
    expect(byId['disciplined-sizing'].value).toBe(1);
  });

  it('eventos fora da janela W são filtrados', () => {
    const trades = makeWindow(50);
    const out = evaluateMaturity(baseInput({
      trades,
      tradesWithOrderData: 50,
      executionEvents: [
        { type: 'STOP_TAMPERING', tradeId: 'T1' },                  // dentro
        { type: 'STOP_TAMPERING', tradeId: 'TRADE_FORA_DA_JANELA' }, // fora
      ],
    }));

    const gate = out.gates.find((g) => g.id === 'no-stop-tampering');
    expect(gate.value).toBe(1);
  });

  it('tradesWithOrderData ausente trata como 0 → METRIC_UNAVAILABLE', () => {
    const out = evaluateMaturity(baseInput({
      trades: makeWindow(50),
      executionEvents: [{ type: 'STOP_TAMPERING', tradeId: 'T1' }],
    }));

    const gate = out.gates.find((g) => g.id === 'no-stop-tampering');
    expect(gate.met).toBeNull();
    expect(gate.reason).toBe('METRIC_UNAVAILABLE');
  });
});
