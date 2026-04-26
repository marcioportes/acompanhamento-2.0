import { describe, it, expect } from 'vitest';
import {
  calculatePlanMechanics,
  buildMesaConstraints,
  buildRetailConstraints,
  resolveDataSource
} from '../../utils/calculatePlanMechanics';
import {
  ATTACK_PROFILES,
  STYLE_ATR_FRACTIONS,
  PROFILE_STOP_VARIANCE,
  MIN_VIABLE_STOP,
  PROP_FIRM_PHASES,
  ATTACK_PLAN_DATA_SOURCES
} from '../../constants/propFirmDefaults';
import { getInstrument } from '../../constants/instrumentsTable';

// ============================================
// Fixtures — templates de mesa
// ============================================

const APEX_INTRADAY_50K = {
  firm: 'APEX',
  accountSize: 50000,
  drawdown: { type: 'TRAILING_INTRADAY', maxAmount: 2500 },
  dailyLossLimit: null,
  profitTarget: 3000,
  evalTimeLimit: 30,
  contracts: { max: 10 }
};

const APEX_INTRADAY_25K = {
  firm: 'APEX',
  accountSize: 25000,
  drawdown: { type: 'TRAILING_INTRADAY', maxAmount: 1000 },
  dailyLossLimit: null,
  profitTarget: 1500,
  evalTimeLimit: 30,
  contracts: { max: 4 }
};

const APEX_EOD_25K = {
  firm: 'APEX',
  accountSize: 25000,
  drawdown: { type: 'TRAILING_EOD', maxAmount: 1000 },
  dailyLossLimit: 500,
  profitTarget: 1500,
  evalTimeLimit: 30,
  contracts: { max: 4 }
};

// ============================================
// Helpers
// ============================================

const mnq = () => getInstrument('MNQ');
const nq = () => getInstrument('NQ');
const rty = () => getInstrument('RTY');
const es = () => getInstrument('ES');

// ============================================
// Hard validation
// ============================================
describe('calculatePlanMechanics — hard validation', () => {
  const baseConstraints = buildMesaConstraints(APEX_INTRADAY_50K);

  it('throws sem input', () => {
    expect(() => calculatePlanMechanics()).toThrow(/input é obrigatório/);
  });

  it('throws sem constraints', () => {
    expect(() => calculatePlanMechanics({ instrument: mnq(), style: 'day', profile: 'CONS_B' }))
      .toThrow(/constraints é obrigatório/);
  });

  it('throws sem instrument (mode abstract deprecated)', () => {
    expect(() => calculatePlanMechanics({ constraints: baseConstraints, style: 'day', profile: 'CONS_B' }))
      .toThrow(/instrument é obrigatório/);
  });

  it('throws com instrument sem pointValue', () => {
    expect(() => calculatePlanMechanics({
      constraints: baseConstraints,
      instrument: { symbol: 'X', avgDailyRange: 100, type: 'equity_index' },
      style: 'day',
      profile: 'CONS_B'
    })).toThrow(/pointValue inválido/);
  });

  it('throws com instrument sem avgDailyRange', () => {
    expect(() => calculatePlanMechanics({
      constraints: baseConstraints,
      instrument: { symbol: 'X', pointValue: 2, type: 'equity_index' },
      style: 'day',
      profile: 'CONS_B'
    })).toThrow(/avgDailyRange inválido/);
  });

  it('throws com style inválido', () => {
    expect(() => calculatePlanMechanics({
      constraints: baseConstraints,
      instrument: mnq(),
      style: 'turbo',
      profile: 'CONS_B'
    })).toThrow(/style inválido/);
  });

  it('throws com style ausente', () => {
    expect(() => calculatePlanMechanics({
      constraints: baseConstraints,
      instrument: mnq(),
      profile: 'CONS_B'
    })).toThrow(/style inválido/);
  });
});

// ============================================
// buildMesaConstraints
// ============================================
describe('buildMesaConstraints', () => {
  it('extrai drawdownBudget pela fase EVALUATION', () => {
    const c = buildMesaConstraints(APEX_INTRADAY_50K, PROP_FIRM_PHASES.EVALUATION);
    expect(c.type).toBe('prop');
    expect(c.drawdownBudget).toBe(2500);
    expect(c.targetGoal).toBe(3000);
    expect(c.contractsMax).toBe(10);
    expect(c.firm).toBe('apex');
  });

  it('quando dailyLossLimit é null, fallback usa drawdownBudget inteiro (cap natural trailing intraday)', () => {
    const c = buildMesaConstraints(APEX_INTRADAY_50K);
    expect(c.dailyLossLimit).toBe(2500);
  });

  it('quando dailyLossLimit é explícito, preserva', () => {
    const c = buildMesaConstraints(APEX_EOD_25K);
    expect(c.dailyLossLimit).toBe(500);
  });

  it('throws sem templateRules', () => {
    expect(() => buildMesaConstraints(null)).toThrow(/templateRules é obrigatório/);
  });
});

// ============================================
// Caso de referência §4 — Apex Intraday 50K + MNQ + CONS_B + day
// ============================================
describe('calculatePlanMechanics — caso de referência (Apex Intraday 50K + MNQ)', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);
  const baseInput = { constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' };

  it('day + CONS_B → stopBase ≈ 54.9 pts, contracts = 3', () => {
    const r = calculatePlanMechanics(baseInput);
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(54.9, 1);
    expect(r.mechanicalPlan.contracts).toBe(3);
    expect(r.mechanicalPlan.stopUSDPerContract).toBeCloseTo(109.8, 1);
    expect(r.mechanicalPlan.roEffective).toBeCloseTo(329.4, 1);
    expect(r.mechanicalPlan.roBudget).toBe(375);
    expect(r.mechanicalPlan.targetPoints).toBeCloseTo(109.8, 1);
    expect(r.mechanicalPlan.rrMinimum).toBe(2);
    expect(r.mechanicalPlan.maxTradesPerDay).toBe(2);
    expect(r.mechanicalPlan.maxTradesReducedFromProfile).toBe(false);
    expect(r.viability.incompatible).toBe(false);
  });

  it('conviction + CONS_B → stopBase ≈ 164.7 pts × 1 contrato', () => {
    const r = calculatePlanMechanics({ ...baseInput, style: 'conviction' });
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(164.7, 1);
    expect(r.mechanicalPlan.contracts).toBe(1);
    expect(r.viability.incompatible).toBe(false);
  });

  it('AGRES_B + day → maxTradesPerDay = 1, contracts re-ajusta para roBudget $750', () => {
    const r = calculatePlanMechanics({ ...baseInput, profile: 'AGRES_B' });
    expect(r.mechanicalPlan.maxTradesPerDay).toBe(1);
    expect(r.mechanicalPlan.roBudget).toBe(750);
    // AGRES_B variance = ((0.30-0.15)/0.15) * -0.10 = -0.10
    // stopBase = 54.9 * 0.90 ≈ 49.41
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(49.41, 1);
    // contracts = floor(750 / (49.41 * 2)) = floor(7.59) = 7
    expect(r.mechanicalPlan.contracts).toBe(7);
  });

  it('CONS_A + day → stopBase mais largo que CONS_B (variance positiva)', () => {
    const r = calculatePlanMechanics({ ...baseInput, profile: 'CONS_A' });
    // CONS_A roPct=0.10 → variance = ((0.10-0.15)/0.15) * -0.10 = +0.0333
    // multiplier ≈ 1.0333
    // stopBase = 54.9 * 1.0333 ≈ 56.73
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(56.73, 1);
    expect(r.meta.profileVariance).toBeCloseTo(1.0333, 3);
  });

  it('scalp + CONS_B → stopBase ≈ 27.45, contracts permanecem altos', () => {
    const r = calculatePlanMechanics({ ...baseInput, style: 'scalp' });
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(27.45, 1);
    expect(r.mechanicalPlan.contracts).toBe(6); // floor(375 / (27.45 * 2)) = 6
  });

  it('swing + CONS_B → stopBase ≈ 109.8 pts, contracts = 1', () => {
    const r = calculatePlanMechanics({ ...baseInput, style: 'swing' });
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(109.8, 1);
    // floor(375 / (109.8 * 2)) = floor(1.7077) = 1
    expect(r.mechanicalPlan.contracts).toBe(1);
  });

  it('NQ full-size é incompatível em Apex 25K → microSuggestion = MNQ', () => {
    const c25k = buildMesaConstraints(APEX_INTRADAY_25K);
    const r = calculatePlanMechanics({ constraints: c25k, instrument: nq(), style: 'day', profile: 'CONS_B' });
    expect(r.viability.incompatible).toBe(true);
    expect(r.viability.violations).toContain('insufficient_ro_for_one_contract');
    expect(r.viability.microSuggestion).toBe('MNQ');
  });
});

// ============================================
// Cobertura 4 estilos × CONS_B em Apex 50K + MNQ
// ============================================
describe('calculatePlanMechanics — varredura 4 estilos (CONS_B + MNQ + Apex Intraday 50K)', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);

  Object.keys(STYLE_ATR_FRACTIONS).forEach((style) => {
    it(`${style} → stopBase = avgDailyRange × ${STYLE_ATR_FRACTIONS[style]}`, () => {
      const r = calculatePlanMechanics({ constraints, instrument: mnq(), style, profile: 'CONS_B' });
      const expected = 549 * STYLE_ATR_FRACTIONS[style];
      expect(r.mechanicalPlan.stopBase).toBeCloseTo(expected, 1);
      expect(r.style).toBe(style);
    });
  });
});

// ============================================
// Variação ±PROFILE_STOP_VARIANCE entre profiles
// ============================================
describe('calculatePlanMechanics — banda ±10% de stopBase entre profiles', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);
  const stopBaseFor = (profile) =>
    calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile }).mechanicalPlan.stopBase;

  it('CONS_B é referência (variance = 1.0)', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    expect(r.meta.profileVariance).toBeCloseTo(1.0, 3);
  });

  it('CONS_A (mais conservador) tem stop maior que CONS_B', () => {
    expect(stopBaseFor('CONS_A')).toBeGreaterThan(stopBaseFor('CONS_B'));
  });

  it('AGRES_B (mais agressivo) tem stop menor que CONS_B', () => {
    expect(stopBaseFor('AGRES_B')).toBeLessThan(stopBaseFor('CONS_B'));
  });

  it('cap em ±PROFILE_STOP_VARIANCE — AGRES_B clamp a -10%', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'AGRES_B' });
    // AGRES_B raw variance = -0.20 mas clamp a -PROFILE_STOP_VARIANCE = -0.10
    expect(r.meta.profileVariance).toBeCloseTo(1 - PROFILE_STOP_VARIANCE, 3);
  });
});

// ============================================
// DT-042 — floor effective = max(MIN_VIABLE_STOP[type], minStopPoints)
// ============================================
describe('calculatePlanMechanics — DT-042 floor consolidation', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);

  it('MNQ scalp: usa per-instrument floor (20) > type floor (15)', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'scalp', profile: 'CONS_B' });
    expect(r.meta.effectiveMinStop).toBe(20);
    // 549 * 0.05 = 27.45 > 20 → não clipa
    expect(r.viability.clippedByFloor).toBe(false);
    expect(r.mechanicalPlan.stopBase).toBeCloseTo(27.45, 1);
  });

  it('RTY scalp: type floor (15) > per-instrument (3) e clipa stopBaseRaw=3.5', () => {
    const r = calculatePlanMechanics({ constraints, instrument: rty(), style: 'scalp', profile: 'CONS_B' });
    expect(r.meta.effectiveMinStop).toBe(MIN_VIABLE_STOP.equity_index);
    // RTY 70 * 0.05 = 3.5 < 15 → clipa por floor
    expect(r.viability.clippedByFloor).toBe(true);
    expect(r.viability.incompatible).toBe(true);
    expect(r.viability.violations).toContain('stop_below_min_viable');
  });
});

// ============================================
// Sizing dinâmico — cap por contractsMax
// ============================================
describe('calculatePlanMechanics — sizing cap por contractsMax', () => {
  it('quando rawContracts > contractsMax, contracts = contractsMax', () => {
    // Apex 25K (contractsMax=4) com MNQ scalp + AGRES_B (roBudget alto, stopUSD baixo)
    const constraints = buildMesaConstraints(APEX_INTRADAY_25K);
    const r = calculatePlanMechanics({
      constraints,
      instrument: mnq(),
      style: 'scalp',
      profile: 'AGRES_B'
    });
    // roBudget = 1000 * 0.30 = 300
    // AGRES_B scalp: 549*0.05*0.90 = 24.7 (clamp por floor 20 = não, 24.7 > 20)
    // stopUSD = 24.7 * 2 = 49.4 → raw = 300/49.4 ≈ 6.07 → cap em 4
    expect(r.mechanicalPlan.contracts).toBe(4);
  });
});

// ============================================
// Sessão restrita — stopNyPct < NY_MIN_VIABLE_STOP_PCT
// ============================================
describe('calculatePlanMechanics — soft viability (sessões)', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);

  it('day style em MNQ: nySessionViable=true (stopNyPct ≈ 16.67%)', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    expect(r.viability.nySessionViable).toBe(true);
    expect(r.viability.recommendedSessions).toContain('ny');
    expect(r.viability.stopNyPct).toBeCloseTo(16.67, 1);
  });

  it('scalp style em MNQ: stopNyPct < 12.5% → sessionRestricted', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'scalp', profile: 'CONS_B' });
    // stop=27.45, nyRange=329.4 → 8.33%
    expect(r.viability.stopNyPct).toBeLessThan(12.5);
    expect(r.viability.nySessionViable).toBe(false);
    expect(r.viability.sessionRestricted).toBe(true);
    expect(r.viability.recommendedSessions).not.toContain('ny');
    expect(r.viability.recommendedSessions).toEqual(expect.arrayContaining(['london', 'asia']));
  });
});

// ============================================
// Métricas estatísticas (informativas)
// ============================================
describe('calculatePlanMechanics — métricas informativas', () => {
  const constraints = buildMesaConstraints(APEX_INTRADAY_50K);

  it('lossesToBust = floor(drawdownBudget / roBudget)', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    // 2500 / 375 = 6.67 → 6
    expect(r.mechanicalPlan.lossesToBust).toBe(6);
  });

  it('evPerTrade > 0 com WR 50% e RR 1:2', () => {
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    // EV = 0.5 * 750 - 0.5 * 375 = 187.5
    expect(r.mechanicalPlan.evPerTrade).toBeCloseTo(187.5, 1);
    expect(r.mechanicalPlan.assumedWR).toBe(0.5);
    expect(r.mechanicalPlan.wrBelowBreakeven).toBe(false);
  });

  it('wrBelowBreakeven=true quando indicators.winRate < 1/3', () => {
    const r = calculatePlanMechanics({
      constraints,
      instrument: mnq(),
      style: 'day',
      profile: 'CONS_B',
      indicators: { winRate: 0.30, coefficientOfVariation: 1.0 }
    });
    expect(r.mechanicalPlan.assumedWR).toBe(0.30);
    expect(r.mechanicalPlan.wrBelowBreakeven).toBe(true);
  });
});

// ============================================
// resolveDataSource — cascata 4D > indicadores > defaults
// ============================================
describe('resolveDataSource', () => {
  it('FULL_4D quando profile4D completo', () => {
    const r = resolveDataSource(
      { emotionalScore: 80, stage: 4, coefficientOfVariation: 0.3 },
      { winRate: 0.6, coefficientOfVariation: 0.4 },
      'conservative'
    );
    expect(r.dataSource).toBe(ATTACK_PLAN_DATA_SOURCES.FULL_4D);
    expect(r.assumedWR).toBe(0.6);
    expect(r.adjustmentFactor).toBeCloseTo(0.77, 2);
  });

  it('INDICATORS quando 4D ausente', () => {
    const r = resolveDataSource(null, { winRate: 0.6, coefficientOfVariation: 0.4 }, 'conservative');
    expect(r.dataSource).toBe(ATTACK_PLAN_DATA_SOURCES.INDICATORS);
    expect(r.assumedWR).toBe(0.6);
  });

  it('DEFAULTS quando ambos ausentes', () => {
    const r = resolveDataSource(null, null, 'conservative');
    expect(r.dataSource).toBe(ATTACK_PLAN_DATA_SOURCES.DEFAULTS);
    expect(r.assumedWR).toBe(0.5);
    expect(r.adjustmentFactor).toBe(0.3);
  });

  it('DEFAULTS aggressive → adjustmentFactor 0.6', () => {
    const r = resolveDataSource(null, null, 'aggressive');
    expect(r.adjustmentFactor).toBe(0.6);
  });
});

// ============================================
// Retail mode — mesma fórmula com type='retail'
// ============================================
describe('calculatePlanMechanics — retail mode', () => {
  it('buildRetailConstraints normaliza Kelly + balance', () => {
    const c = buildRetailConstraints({ balance: 10000, kellyFraction: 0.05 });
    expect(c.type).toBe('retail');
    expect(c.drawdownBudget).toBe(500);
    expect(c.dailyLossLimit).toBe(200); // 10000 * 0.02
    expect(c.contractsMax).toBe(Infinity);
  });

  it('throws quando balance ausente ou ≤ 0', () => {
    expect(() => buildRetailConstraints({ balance: 0, kellyFraction: 0.05 })).toThrow(/balance/);
  });

  it('throws quando kellyFraction fora de (0, 1]', () => {
    expect(() => buildRetailConstraints({ balance: 10000, kellyFraction: 0 })).toThrow(/kellyFraction/);
    expect(() => buildRetailConstraints({ balance: 10000, kellyFraction: 1.5 })).toThrow(/kellyFraction/);
  });

  it('motor aceita constraints retail e usa mesma fórmula de sizing', () => {
    const constraints = buildRetailConstraints({ balance: 10000, kellyFraction: 0.05 });
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    expect(r.constraintsType).toBe('retail');
    // roBudget = 500 * 0.15 = 75
    // stopUSD = 54.9 * 2 = 109.8 → contracts = floor(75/109.8) = 0 → incompatible
    expect(r.viability.incompatible).toBe(true);
    expect(r.viability.violations).toContain('insufficient_ro_for_one_contract');
  });

  it('retail com balance maior gera plano viável', () => {
    const constraints = buildRetailConstraints({ balance: 50000, kellyFraction: 0.05 });
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    // roBudget = 50000 * 0.05 * 0.15 = 375 (mesmo do exemplo Apex 50K)
    expect(r.mechanicalPlan.contracts).toBe(3);
    expect(r.viability.incompatible).toBe(false);
  });
});

// ============================================
// Output shape sanity
// ============================================
describe('calculatePlanMechanics — output shape', () => {
  it('contém todas as chaves esperadas', () => {
    const constraints = buildMesaConstraints(APEX_INTRADAY_50K);
    const r = calculatePlanMechanics({ constraints, instrument: mnq(), style: 'day', profile: 'CONS_B' });
    expect(r).toHaveProperty('constraintsType', 'prop');
    expect(r).toHaveProperty('profile.code', 'CONS_B');
    expect(r).toHaveProperty('style', 'day');
    expect(r).toHaveProperty('instrument.symbol', 'MNQ');
    expect(r).toHaveProperty('mechanicalPlan.stopBase');
    expect(r).toHaveProperty('mechanicalPlan.contracts');
    expect(r).toHaveProperty('mechanicalPlan.targetPoints');
    expect(r).toHaveProperty('viability.incompatible');
    expect(r).toHaveProperty('viability.recommendedSessions');
    expect(r).toHaveProperty('meta.dataSource');
    expect(r).toHaveProperty('meta.generatedAt');
  });
});
