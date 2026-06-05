/**
 * CHUNK-11 Fase 2 B1 (#305) — modulação comportamental de F/O em evaluateMaturity.
 * "Vida nova": só trade com behaviorProfile pesa; E fica de fora do B1.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { evaluateMaturity as esm } from '../../../utils/maturityEngine/evaluateMaturity.js';

const require = createRequire(import.meta.url);
const { evaluateMaturity: cjs } = require('../../../../functions/maturity/evaluateMaturity.js');

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

const makeTrade = (id, dayOffset, families) => {
  const ts = Date.parse('2026-03-01T10:00:00Z') + dayOffset * 86400000;
  const t = {
    id, ticker: 'WINM26', side: 'LONG', qty: 1, result: 100,
    date: new Date(ts).toISOString(),
    entryTime: new Date(ts).toISOString(),
    exitTime: new Date(ts + 30 * 60000).toISOString(),
  };
  if (families) t.behaviorProfile = { families };
  return t;
};
const window = (count) => Array.from({ length: count }, (_, i) => makeTrade(`T${i + 1}`, i));
// janela de `count` trades onde só o PRIMEIRO carrega o finding (1 ocorrência, sem bater o cap).
const windowOne = (count, families) => [makeTrade('F1', 0, families), ...Array.from({ length: count - 1 }, (_, i) => makeTrade(`T${i + 2}`, i + 1))];

const greed = [{ canonicalCode: 'GREED_CLUSTER', severity: 'MEDIUM', valence: 'negative' }]; // F, M(-8)
const averaging = [{ canonicalCode: 'AVERAGING_DOWN', severity: 'HIGH', valence: 'negative' }]; // E+F, A(-15)

describe('evaluateMaturity — modulação comportamental F/O (B1)', () => {
  it('janela SEM behaviorProfile não muda F/O (baseline intacta)', () => {
    const out = esm(baseInput({ trades: window(12) }));
    expect(out.breakdown.financial.behavioralNet).toBe(0);
    expect(out.breakdown.operational.behavioralNet).toBe(0);
  });

  it('GREED_CLUSTER (F, médio) baixa só o F em −8', () => {
    const plain = esm(baseInput({ trades: window(12) }));
    const withG = esm(baseInput({ trades: windowOne(12, greed) }));
    expect(withG.dimensionScores.financial).toBe(plain.dimensionScores.financial - 8);
    expect(withG.breakdown.financial.behavioralNet).toBe(-8);
    expect(withG.dimensionScores.operational).toBe(plain.dimensionScores.operational); // GREED não toca O
  });

  it('E fica fora do B1 (não modulado por comportamento ainda)', () => {
    const plain = esm(baseInput({ trades: window(12) }));
    const withA = esm(baseInput({ trades: windowOne(12, averaging) })); // AVERAGING é E+F
    expect(withA.dimensionScores.emotional).toBe(plain.dimensionScores.emotional); // E inalterado no B1
    expect(withA.dimensionScores.financial).toBe(plain.dimensionScores.financial - 15); // F sim
  });

  it('gate ruleViolationRate: janela com padrões (rate alto) reprova o gate (B2)', () => {
    // 12 trades, todos com finding → ruleViolationRate = 1.0 (≥ floor 10)
    const all = Array.from({ length: 12 }, (_, i) => makeTrade(`T${i + 1}`, i, greed));
    const out = esm(baseInput({ trades: all })); // stage 3 → gate rule-violation-rate-5 (≤0.05)
    const gate = out.gates.find((g) => g.id === 'rule-violation-rate-5');
    expect(gate).toBeTruthy();
    expect(gate.met).toBe(false);
  });

  it('gate ruleViolationRate: janela limpa (profiled, sem finding) passa o gate (B2)', () => {
    const clean = Array.from({ length: 12 }, (_, i) => makeTrade(`T${i + 1}`, i, [])); // profiled, zero finding
    const out = esm(baseInput({ trades: clean }));
    const gate = out.gates.find((g) => g.id === 'rule-violation-rate-5');
    expect(gate.met).toBe(true); // rate 0 ≤ 0.05
  });

  it('paridade ESM≡CJS na superfície do B1 (dimensões + behavioralNet)', () => {
    const input = baseInput({ trades: windowOne(12, greed) });
    const a = esm(input); const b = cjs(input);
    expect(b.dimensionScores).toEqual(a.dimensionScores);
    expect(b.breakdown.financial.behavioralNet).toBe(a.breakdown.financial.behavioralNet);
    expect(b.breakdown.operational.behavioralNet).toBe(a.breakdown.operational.behavioralNet);
  });
});
