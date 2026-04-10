import { describe, it, expect } from 'vitest';
import {
  calculateAttackPlan,
  calculateMesaConstraints,
  resolveDataSource
} from '../../utils/attackPlanCalculator';
import { normalizeAttackProfile } from '../../constants/propFirmDefaults';

// --- Templates de referência ---
const APEX_EOD_25K = {
  firm: 'APEX',
  accountSize: 25000,
  drawdown: { type: 'TRAILING_EOD', maxAmount: 1000, lockAt: null },
  dailyLossLimit: 500,
  profitTarget: 1500,
  evalTimeLimit: 30,
  contracts: { max: 4 }
};

const APEX_EOD_50K = {
  firm: 'APEX',
  accountSize: 50000,
  drawdown: { type: 'TRAILING_EOD', maxAmount: 2500, lockAt: null },
  dailyLossLimit: 1000,
  profitTarget: 3000,
  evalTimeLimit: 30,
  contracts: { max: 10 }
};

const APEX_INTRADAY_50K = {
  ...APEX_EOD_50K,
  drawdown: { type: 'TRAILING_INTRADAY', maxAmount: 2500 },
  dailyLossLimit: null
};

// --- Perfis 4D ---
const PROFILE_4D_STRONG = { emotionalScore: 80, stage: 4, coefficientOfVariation: 0.3 };
const PROFILE_4D_WEAK = { emotionalScore: 30, stage: 1, coefficientOfVariation: 1.2 };
const PROFILE_4D_MID = { emotionalScore: 50, stage: 3, coefficientOfVariation: 0.5 };

const INDICATORS_GOOD = { winRate: 0.6, coefficientOfVariation: 0.4 };
const INDICATORS_POOR = { winRate: 0.30, coefficientOfVariation: 1.5 };

// ============================================
// normalizeAttackProfile — legacy compat
// ============================================
describe('normalizeAttackProfile', () => {
  it('aceita os 5 novos códigos', () => {
    expect(normalizeAttackProfile('CONS_A')).toBe('CONS_A');
    expect(normalizeAttackProfile('CONS_B')).toBe('CONS_B');
    expect(normalizeAttackProfile('CONS_C')).toBe('CONS_C');
    expect(normalizeAttackProfile('AGRES_A')).toBe('AGRES_A');
    expect(normalizeAttackProfile('AGRES_B')).toBe('AGRES_B');
  });

  it('mapeia legados conservative → CONS_B, aggressive → AGRES_A', () => {
    expect(normalizeAttackProfile('conservative')).toBe('CONS_B');
    expect(normalizeAttackProfile('aggressive')).toBe('AGRES_A');
  });

  it('default CONS_B quando ausente ou desconhecido', () => {
    expect(normalizeAttackProfile(null)).toBe('CONS_B');
    expect(normalizeAttackProfile(undefined)).toBe('CONS_B');
    expect(normalizeAttackProfile('xyz')).toBe('CONS_B');
  });
});

// ============================================
// resolveDataSource
// ============================================
describe('resolveDataSource', () => {
  it('usa 4D completo quando disponível', () => {
    const result = resolveDataSource(PROFILE_4D_STRONG, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('4d_full');
  });

  it('usa indicadores quando 4D ausente', () => {
    const result = resolveDataSource(null, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('indicators');
    expect(result.assumedWR).toBe(0.6);
  });

  it('usa defaults quando nada disponível', () => {
    const result = resolveDataSource(null, null, 'conservative');
    expect(result.dataSource).toBe('defaults');
    expect(result.adjustmentFactor).toBe(0.3);
    expect(result.assumedWR).toBe(0.5);
  });

  it('default agressivo é 0.6 e WR 0.5', () => {
    const result = resolveDataSource(null, null, 'aggressive');
    expect(result.adjustmentFactor).toBe(0.6);
    expect(result.assumedWR).toBe(0.5);
  });

  it('clamp 0..1', () => {
    const extreme = { emotionalScore: 0, stage: 1, coefficientOfVariation: 5.0 };
    expect(resolveDataSource(extreme, null, 'conservative').adjustmentFactor).toBeGreaterThanOrEqual(0);

    const max = { emotionalScore: 100, stage: 5, coefficientOfVariation: 0 };
    expect(resolveDataSource(max, null, 'conservative').adjustmentFactor).toBeLessThanOrEqual(1);
  });
});

// ============================================
// calculateMesaConstraints
// ============================================
describe('calculateMesaConstraints', () => {
  it('retorna constraints absolutas da mesa', () => {
    const c = calculateMesaConstraints(APEX_EOD_25K);
    expect(c.drawdownMax).toBe(1000);
    expect(c.dailyLossLimit).toBe(500);
    expect(c.profitTarget).toBe(1500);
    expect(c.evalBusinessDays).toBe(21);
    expect(c.dailyTarget).toBe(72); // ceil(1500/21) = 72
  });

  it('usa proxy 25% do drawdown quando dailyLossLimit ausente', () => {
    const c = calculateMesaConstraints(APEX_INTRADAY_50K);
    expect(c.dailyLossLimit).toBe(625);
  });

  it('lança erro sem template', () => {
    expect(() => calculateMesaConstraints(null)).toThrow();
  });
});

// ============================================
// calculateAttackPlan — modo abstract
// ============================================
describe('calculateAttackPlan — modo abstract', () => {
  it('CONS_B Apex 25K — RO = 15% do DD = $150', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    expect(plan.mode).toBe('abstract');
    expect(plan.profile).toBe('CONS_B');
    expect(plan.profileFamily).toBe('conservative');
    expect(plan.profileRecommended).toBe(true);
    expect(plan.roPerTrade).toBe(150);
    expect(plan.roPct).toBe(0.15);
    expect(plan.rrMinimum).toBe(2);
    expect(plan.maxTradesPerDay).toBe(2);
    expect(plan.winUSD).toBe(300); // 150 × 2
    expect(plan.lossesToBust).toBe(6); // floor(1000/150)
  });

  it('CONS_A — RO 10% = $100, lossesToBust 10', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION');
    expect(plan.roPerTrade).toBe(100);
    expect(plan.lossesToBust).toBe(10);
    expect(plan.maxTradesPerDay).toBe(2);
  });

  it('AGRES_B — RO 30% = $300, 1 trade/dia, lossesToBust 3', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(plan.roPerTrade).toBe(300);
    expect(plan.maxTradesPerDay).toBe(1);
    expect(plan.lossesToBust).toBe(3);
    expect(plan.profileFamily).toBe('aggressive');
  });

  it('EV @ WR 50% — CONS_B = $75 ((0.5 × 300) - (0.5 × 150))', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    expect(plan.assumedWR).toBe(0.5);
    expect(plan.evPerTrade).toBe(75);
    expect(plan.wrBelowBreakeven).toBe(false);
  });

  it('EV @ WR 50% — AGRES_B = $150', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(plan.evPerTrade).toBe(150);
  });

  it('WR abaixo do breakeven (33.3%) marca wrBelowBreakeven=true', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, INDICATORS_POOR, 'CONS_B', 'EVALUATION');
    expect(plan.assumedWR).toBe(0.30);
    expect(plan.wrBelowBreakeven).toBe(true);
    expect(plan.evPerTrade).toBeLessThan(0);
  });

  it('modo abstract não tem campos de execução em pontos', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    expect(plan.instrument).toBeNull();
    expect(plan.stopPoints).toBeNull();
    expect(plan.stopPerTrade).toBeNull();
    expect(plan.targetPoints).toBeNull();
    expect(plan.sizing).toBeNull();
  });

  it('perfil legado conservative → CONS_B', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    expect(plan.profile).toBe('CONS_B');
  });

  it('perfil legado aggressive → AGRES_A', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'aggressive', 'EVALUATION');
    expect(plan.profile).toBe('AGRES_A');
  });
});

// ============================================
// calculateAttackPlan — modo execution
// ============================================
describe('calculateAttackPlan — modo execution', () => {
  it('CONS_B + MNQ Apex 25K — stop 75 pts back-calculado de $150 / $2', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'MNQ');
    expect(plan.mode).toBe('execution');
    expect(plan.roPerTrade).toBe(150);
    expect(plan.stopPoints).toBe(75); // 150 / 2
    expect(plan.targetPoints).toBe(150); // 75 × 2
    expect(plan.stopPerTrade).toBe(150);
    expect(plan.targetPerTrade).toBe(300);
    expect(plan.maxTradesPerDay).toBe(2);
    expect(plan.sizing).toBe(1);
    expect(plan.incompatible).toBe(false);
    expect(plan.constraintsViolated).toEqual([]);
  });

  it('CONS_A + MNQ — 50 pts (back-calc de $100/$2)', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION', 'MNQ');
    expect(plan.roPerTrade).toBe(100);
    expect(plan.stopPoints).toBe(50);
    expect(plan.targetPoints).toBe(100);
    expect(plan.incompatible).toBe(false);
  });

  it('AGRES_B + MNQ — 150 pts, 1 trade/dia, viável', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION', 'MNQ');
    expect(plan.roPerTrade).toBe(300);
    expect(plan.stopPoints).toBe(150);
    expect(plan.maxTradesPerDay).toBe(1);
    expect(plan.incompatible).toBe(false);
  });

  it('NQ na Apex 25K com CONS_B — INVIÁVEL (stop 7.5pts < 15 minViable)', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'NQ');
    expect(plan.incompatible).toBe(true);
    expect(plan.microSuggestion).toBe('MNQ');
    expect(plan.constraintsViolated).toContain('stop_below_min_viable');
    expect(plan.maxTradesPerDay).toBe(0);
    expect(plan.sizing).toBe(0);
  });

  it('ES na Apex 50K com CONS_B — INVIÁVEL (stop 7.5pts < 15)', () => {
    // 50K: drawdown 2500, RO CONS_B = 375. ES point value 50. Stop = 7.5 pts < 15
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'CONS_B', 'EVALUATION', 'ES');
    expect(plan.incompatible).toBe(true);
    expect(plan.microSuggestion).toBe('MES');
  });

  it('NQ na Apex 50K com CONS_B — VIÁVEL (stop 18.75pts ≥ 15)', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'CONS_B', 'EVALUATION', 'NQ');
    expect(plan.roPerTrade).toBe(375); // 2500 × 0.15
    expect(plan.stopPoints).toBe(18.75);
    expect(plan.incompatible).toBe(false);
  });

  it('GC na Apex — não permitido (suspenso) registra constraint', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'CONS_B', 'EVALUATION', 'GC');
    expect(plan.mode).toBe('execution');
    const hasNotAllowed = plan.constraintsViolated.some(v => v.includes('não permitido'));
    expect(hasNotAllowed).toBe(true);
  });

  it('instrumento desconhecido retorna mode=error', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'XYZ');
    expect(plan.mode).toBe('error');
    expect(plan.error).toContain('XYZ');
    expect(plan.constraintsViolated).toContain('instrument_not_found');
  });

  it('stop como % do range NY é calculado', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'MNQ');
    // NQ avgDailyRange = 549 (real ATR v2), NY range = 549 × 0.6 = 329.4
    // stop 75 / 329.4 × 100 = 22.77%
    expect(plan.nyRangePoints).toBeCloseTo(329.4, 1);
    expect(plan.stopNyPct).toBeCloseTo(22.77, 1);
  });

  it('reduz maxTradesPerDay se RO × profile.maxTradesPerDay > dailyLossLimit', () => {
    // Cenário forçado: dailyLossLimit pequeno
    const tinyDaily = { ...APEX_EOD_25K, dailyLossLimit: 200 };
    const plan = calculateAttackPlan(tinyDaily, null, null, 'CONS_B', 'EVALUATION', 'MNQ');
    // RO = $150. profile.maxTradesPerDay = 2. 150 × 2 = 300 > 200 → reduz para floor(200/150) = 1
    expect(plan.maxTradesPerDay).toBe(1);
  });

  it('RO > dailyLossLimit → INVIÁVEL', () => {
    // CONS_C 20% × $1000 = $200; force daily loss 100
    const tinyDaily = { ...APEX_EOD_25K, dailyLossLimit: 100 };
    const plan = calculateAttackPlan(tinyDaily, null, null, 'CONS_C', 'EVALUATION', 'MNQ');
    expect(plan.incompatible).toBe(true);
    expect(plan.constraintsViolated).toContain('ro_exceeds_daily_loss');
  });

  it('stop NY > 75% → INVIÁVEL (vela única consome stop)', () => {
    // M2K (RTY micro): avgDailyRange 70, NY range 42. Apex 25K CONS_C → RO $200.
    // M2K pointValue $5 → stop pts = 40. 40/42 = 95.2% > 75% INVIÁVEL.
    // Stop 40pts ≥ 15 (minViable equity_index) ✓ não dispara V1
    // RO $200 ≤ daily $500 ✓ não dispara V3
    // Apenas V2 (stop > 75% NY) dispara.
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_C', 'EVALUATION', 'M2K');
    expect(plan.stopPoints).toBe(40);
    expect(plan.stopNyPct).toBeGreaterThan(75);
    expect(plan.incompatible).toBe(true);
    expect(plan.constraintsViolated).toContain('stop_exceeds_ny_range');
  });
});

// ============================================
// calculateAttackPlan — perfis comparativos
// ============================================
describe('calculateAttackPlan — comparação entre perfis', () => {
  it('roPct cresce do CONS_A → AGRES_B', () => {
    const a = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION');
    const b = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    const c = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_C', 'EVALUATION');
    const d = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_A', 'EVALUATION');
    const e = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(a.roPerTrade).toBeLessThan(b.roPerTrade);
    expect(b.roPerTrade).toBeLessThan(c.roPerTrade);
    expect(c.roPerTrade).toBeLessThan(d.roPerTrade);
    expect(d.roPerTrade).toBeLessThan(e.roPerTrade);
  });

  it('agressivos têm 1 trade/dia, conservadores têm 2', () => {
    const cons_a = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION');
    const cons_b = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    const cons_c = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_C', 'EVALUATION');
    const agr_a = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_A', 'EVALUATION');
    const agr_b = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(cons_a.maxTradesPerDay).toBe(2);
    expect(cons_b.maxTradesPerDay).toBe(2);
    expect(cons_c.maxTradesPerDay).toBe(2);
    expect(agr_a.maxTradesPerDay).toBe(1);
    expect(agr_b.maxTradesPerDay).toBe(1);
  });

  it('lossesToBust DECRESCE quando RO cresce', () => {
    const a = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION');
    const e = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(a.lossesToBust).toBeGreaterThan(e.lossesToBust);
  });

  it('EV cresce com RO (dado WR fixo)', () => {
    const a = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_A', 'EVALUATION');
    const e = calculateAttackPlan(APEX_EOD_25K, null, null, 'AGRES_B', 'EVALUATION');
    expect(e.evPerTrade).toBeGreaterThan(a.evPerTrade);
  });

  it('RR sempre 1:2 em todos os perfis', () => {
    for (const code of ['CONS_A', 'CONS_B', 'CONS_C', 'AGRES_A', 'AGRES_B']) {
      const plan = calculateAttackPlan(APEX_EOD_25K, null, null, code, 'EVALUATION');
      expect(plan.rrMinimum).toBe(2);
    }
  });
});

// ============================================
// calculateAttackPlan — hard constraints invioláveis (sweep)
// ============================================
describe('calculateAttackPlan — hard constraints (modo execution viável)', () => {
  const fixtures = [
    { name: 'Apex 25K CONS_A MNQ', t: APEX_EOD_25K, profile: 'CONS_A', sym: 'MNQ' },
    { name: 'Apex 25K CONS_B MNQ', t: APEX_EOD_25K, profile: 'CONS_B', sym: 'MNQ' },
    { name: 'Apex 25K CONS_C MNQ', t: APEX_EOD_25K, profile: 'CONS_C', sym: 'MNQ' },
    { name: 'Apex 25K AGRES_A MNQ', t: APEX_EOD_25K, profile: 'AGRES_A', sym: 'MNQ' },
    { name: 'Apex 25K AGRES_B MNQ', t: APEX_EOD_25K, profile: 'AGRES_B', sym: 'MNQ' },
    { name: 'Apex 50K CONS_B NQ', t: APEX_EOD_50K, profile: 'CONS_B', sym: 'NQ' }
  ];

  for (const fx of fixtures) {
    it(`${fx.name} — viável e respeita constraints`, () => {
      const plan = calculateAttackPlan(fx.t, null, null, fx.profile, 'EVALUATION', fx.sym);
      if (plan.incompatible) return;

      // C1: RO ≤ daily loss
      expect(plan.roPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
      // C2: RO × maxTrades ≤ daily loss
      expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(plan.dailyLossLimit);
      // C3: stop em pontos ≥ minViable
      expect(plan.stopPoints).toBeGreaterThanOrEqual(plan.instrument.minViableStop);
      // C4: stop ≤ 75% do range NY
      expect(plan.stopNyPct).toBeLessThanOrEqual(75);
      // C5: dailyTarget × dias ≥ profitTarget
      expect(plan.dailyTarget * plan.evalBusinessDays).toBeGreaterThanOrEqual(plan.profitTarget);
      // C6: RR fixo 1:2
      expect(plan.rrMinimum).toBe(2);
    });
  }
});

// ============================================
// calculateAttackPlan — restrição de sessão NY (stop pequeno)
// ============================================
describe('calculateAttackPlan — restrição de sessão NY', () => {
  it('NQ Apex 50K CONS_B (stop 18.75pts ≈5.7% NY com ATR real) — operar fora de NY', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'CONS_B', 'EVALUATION', 'NQ');
    expect(plan.incompatible).toBe(false); // viável (stop ≥ 15 minViable)
    expect(plan.stopPoints).toBe(18.75);
    expect(plan.stopNyPct).toBeLessThan(12.5);
    expect(plan.nySessionViable).toBe(false);
    expect(plan.sessionRestricted).toBe(true);
    expect(plan.recommendedSessions).toEqual(['london', 'asia']);
  });

  it('NQ Apex 50K CONS_C (stop 25pts ≈7.6% NY) — operar fora de NY', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'CONS_C', 'EVALUATION', 'NQ');
    expect(plan.stopPoints).toBe(25);
    expect(plan.stopNyPct).toBeLessThan(12.5);
    expect(plan.nySessionViable).toBe(false);
    expect(plan.recommendedSessions).toContain('london');
    expect(plan.recommendedSessions).not.toContain('ny');
  });

  it('NQ Apex 100K AGRES_B (stop 45pts ≈13.7% NY) — NY viável', () => {
    // Com ATR real NQ=549, NY range=329.4. Threshold 12.5% = 41.175 pts.
    // Apex 100K (DD $3000) AGRES_B → RO $900, /20 = 45 pts. 45/329.4 = 13.66% > 12.5 ✓
    const APEX_100K = {
      firm: 'APEX',
      drawdown: { type: 'TRAILING_EOD', maxAmount: 3000 },
      dailyLossLimit: 1500,
      profitTarget: 6000,
      evalTimeLimit: 30
    };
    const plan = calculateAttackPlan(APEX_100K, null, null, 'AGRES_B', 'EVALUATION', 'NQ');
    expect(plan.stopPoints).toBe(45);
    expect(plan.stopNyPct).toBeGreaterThanOrEqual(12.5);
    expect(plan.nySessionViable).toBe(true);
    expect(plan.sessionRestricted).toBe(false);
    expect(plan.recommendedSessions).toContain('ny');
  });

  it('MNQ Apex 25K CONS_B (75pts ≈22.8% NY com ATR real) — NY viável', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'MNQ');
    expect(plan.nySessionViable).toBe(true);
    expect(plan.sessionRestricted).toBe(false);
    expect(plan.recommendedSessions[0]).toBe('ny');
  });

  it('threshold NY exato 12.5% — limite operacional para NQ é ~41pts (ATR real)', () => {
    // NQ NY range = 549 × 0.6 = 329.4. 12.5% = 41.175 pts. RO = 41.175 × 20 = $823.5.
    // CONS_B (15%) → drawdown necessário = 5490
    const tplNQ41 = {
      firm: 'APEX',
      drawdown: { type: 'TRAILING_EOD', maxAmount: 5490 },
      dailyLossLimit: 1500,
      profitTarget: 6000,
      evalTimeLimit: 30
    };
    const plan = calculateAttackPlan(tplNQ41, null, null, 'CONS_B', 'EVALUATION', 'NQ');
    expect(plan.stopPoints).toBe(41.175);
    expect(plan.stopNyPct).toBe(12.5);
    expect(plan.nySessionViable).toBe(true); // exatamente no limite
  });

  it('plano abstract não tem restrição de sessão', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION');
    expect(plan.mode).toBe('abstract');
    expect(plan.nySessionViable).toBeUndefined(); // só existe em mode=execution
  });

  it('incompatível não recomenda sessões', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'NQ');
    expect(plan.incompatible).toBe(true);
    expect(plan.recommendedSessions).toEqual([]);
    expect(plan.nySessionViable).toBe(false);
  });
});

// ============================================
// REGRESSÃO ATR v2 — MES CONS_B Apex 25K agora é VIÁVEL em NY
// ============================================
// Bug v1: ATR ES alucinado em 55 → MES com 30 pts dava 90.9% NY (INVIÁVEL).
// Real ATR ES = 123 → NY range MES = 73.8 → 30 pts = 40.6% (VIÁVEL day trade).
describe('REGRESSÃO ATR v2 — MES Apex 25K CONS_B', () => {
  it('MES com 30 pts é VIÁVEL na NY (40.6% do range, não 90.9%)', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'MES');
    expect(plan.mode).toBe('execution');
    expect(plan.instrument.symbol).toBe('MES');
    expect(plan.roPerTrade).toBe(150); // 15% × $1000
    expect(plan.stopPoints).toBe(30);  // $150 / $5 pt
    expect(plan.stopPerTrade).toBe(150);
    expect(plan.targetPoints).toBe(60); // 30 × 2 (RR fixo 1:2)
    expect(plan.nyRangePoints).toBeCloseTo(73.8, 1); // 123 × 0.6
    expect(plan.stopNyPct).toBeCloseTo(40.65, 1);
    expect(plan.incompatible).toBe(false);
    expect(plan.nySessionViable).toBe(true);
    expect(plan.sessionRestricted).toBe(false);
    expect(plan.recommendedSessions[0]).toBe('ny');
  });
});

// ============================================
// VALIDAÇÃO OPERACIONAL — Apex EOD 25K MNQ CONS_B (recomendado)
// ============================================
describe('VALIDAÇÃO OPERACIONAL — Apex EOD 25K MNQ CONS_B', () => {
  it('valores casam com tabela determinística (75 pts, 2 trades/dia, EV $75)', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'CONS_B', 'EVALUATION', 'MNQ');

    expect(plan.mode).toBe('execution');
    expect(plan.profile).toBe('CONS_B');
    expect(plan.profileRecommended).toBe(true);
    expect(plan.instrument.symbol).toBe('MNQ');
    expect(plan.instrument.isMicro).toBe(true);

    // Constraints da mesa
    expect(plan.dailyLossLimit).toBe(500);
    expect(plan.profitTarget).toBe(1500);

    // RO determinístico — 15% de $1000 = $150
    expect(plan.roPerTrade).toBe(150);
    expect(plan.roPct).toBe(0.15);

    // Stop back-calculado de $150 / $2/pt
    expect(plan.stopPoints).toBe(75);
    expect(plan.stopPerTrade).toBe(150);
    expect(plan.targetPoints).toBe(150);
    expect(plan.targetPerTrade).toBe(300);

    // 2 trades/dia conservador → 150 × 2 = $300 ≤ $500 ✓
    expect(plan.maxTradesPerDay).toBe(2);
    expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(plan.dailyLossLimit);

    // Losses até bust
    expect(plan.lossesToBust).toBe(6);

    // EV @ WR 50% = $75
    expect(plan.evPerTrade).toBe(75);
    expect(plan.wrBelowBreakeven).toBe(false);

    // Meta diária $72 × 21 dias = $1512 ≥ $1500 ✓
    expect(plan.dailyTarget).toBe(72);
    expect(plan.evalBusinessDays).toBe(21);

    // Sem violations
    expect(plan.constraintsViolated).toEqual([]);
    expect(plan.incompatible).toBe(false);
  });
});
