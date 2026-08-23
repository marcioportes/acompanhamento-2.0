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
import { GATES_BY_TRANSITION } from '../../../utils/maturityEngine/constants.js';

// #376 — a régua saiu de `== 0` para um teto tolerante; o número de eventos que derruba
// cada gate vem da tabela, não de literal, para a próxima recalibração não quebrar o teste.
const tetoDe = (id) => GATES_BY_TRANSITION['3-4'].find((g) => g.id === id).threshold;
// os tradeIds precisam existir na janela (T1..T50) — eventos órfãos são filtrados.
const eventosQueDerrubam = (tipo, id, base) =>
  Array.from({ length: tetoDe(id) + 1 }, (_, i) => ({ type: tipo, tradeId: `T${base + i}` }));

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
        ...eventosQueDerrubam('STOP_TAMPERING', 'no-stop-tampering', 1),
        ...eventosQueDerrubam('CHASE_REENTRY', 'no-chase', 11),
        ...eventosQueDerrubam('STOP_PARTIAL_SIZING', 'disciplined-sizing', 21),
        { type: 'HESITATION_PRE_ENTRY', tradeId: 'T31' }, // não tem gate
      ],
    }));

    const byId = Object.fromEntries(out.gates.map((g) => [g.id, g]));
    for (const id of ['no-stop-tampering', 'no-chase', 'disciplined-sizing']) {
      expect(byId[id].met).toBe(false);
      expect(byId[id].value).toBe(tetoDe(id) + 1);
    }
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
