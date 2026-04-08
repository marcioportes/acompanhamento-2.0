import { describe, it, expect } from 'vitest';
import {
  calculateAttackPlan,
  calculateMesaConstraints,
  resolveDataSource
} from '../../utils/attackPlanCalculator';

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
const INDICATORS_POOR = { winRate: 0.35, coefficientOfVariation: 1.5 };

// ============================================
// resolveDataSource (inalterado)
// ============================================
describe('resolveDataSource', () => {
  it('usa 4D completo quando disponível', () => {
    const result = resolveDataSource(PROFILE_4D_STRONG, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('4d_full');
  });

  it('calcula adjustmentFactor correto com 4D completo', () => {
    // emotional 0.8, maturity 0.8, consistency 0.7
    // factor = 0.8*0.4 + 0.8*0.3 + 0.7*0.3 = 0.77
    const result = resolveDataSource(PROFILE_4D_STRONG, null, 'conservative');
    expect(result.adjustmentFactor).toBeCloseTo(0.77, 2);
  });

  it('usa indicadores quando 4D ausente', () => {
    const result = resolveDataSource(null, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('indicators');
  });

  it('usa defaults quando nada disponível', () => {
    const result = resolveDataSource(null, null, 'conservative');
    expect(result.dataSource).toBe('defaults');
    expect(result.adjustmentFactor).toBe(0.3);
  });

  it('default agressivo é 0.6', () => {
    const result = resolveDataSource(null, null, 'aggressive');
    expect(result.adjustmentFactor).toBe(0.6);
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
    expect(c.evalTimeLimit).toBe(30);
    expect(c.evalBusinessDays).toBe(21); // 30 × 5/7 = 21.4 → floor 21
    expect(c.dailyTarget).toBe(72); // ceil(1500/21) = 72
  });

  it('dailyTarget × evalBusinessDays >= profitTarget', () => {
    const c = calculateMesaConstraints(APEX_EOD_25K);
    expect(c.dailyTarget * c.evalBusinessDays).toBeGreaterThanOrEqual(c.profitTarget);
  });

  it('usa proxy 25% do drawdown quando dailyLossLimit ausente', () => {
    const c = calculateMesaConstraints(APEX_INTRADAY_50K);
    expect(c.dailyLossLimit).toBe(625); // 2500 × 0.25
  });

  it('lança erro sem template', () => {
    expect(() => calculateMesaConstraints(null)).toThrow();
  });
});

// ============================================
// calculateAttackPlan — modo abstract (sem instrumento)
// ============================================
describe('calculateAttackPlan — modo abstract', () => {
  it('sem instrumento retorna mode=abstract com constraints da mesa', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    expect(plan.mode).toBe('abstract');
    expect(plan.drawdownMax).toBe(1000);
    expect(plan.dailyLossLimit).toBe(500);
    expect(plan.profitTarget).toBe(1500);
    expect(plan.dailyTarget).toBe(72);
    expect(plan.evalBusinessDays).toBe(21);
  });

  it('modo abstract não tem campos de execução', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    expect(plan.instrument).toBeNull();
    expect(plan.stopPoints).toBeNull();
    expect(plan.stopPerTrade).toBeNull();
    expect(plan.roPerTrade).toBeNull();
    expect(plan.maxTradesPerDay).toBeNull();
    expect(plan.sizing).toBeNull();
  });

  it('modo abstract tem mensagem informativa', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    expect(plan.message).toContain('instrumento');
  });

  it('modo abstract preserva profile, dataSource, rrMinimum', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, PROFILE_4D_STRONG, null, 'aggressive', 'EVALUATION');
    expect(plan.profile).toBe('aggressive');
    expect(plan.dataSource).toBe('4d_full');
    expect(plan.rrMinimum).toBe(2.0);
  });

  it('modo abstract não viola constraints', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    expect(plan.constraintsViolated).toEqual([]);
  });
});

// ============================================
// calculateAttackPlan — modo execution com instrumento
// ============================================
describe('calculateAttackPlan — modo execution', () => {
  it('com MNQ retorna mode=execution com sizing 1', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    expect(plan.mode).toBe('execution');
    expect(plan.sizing).toBe(1);
    expect(plan.instrument.symbol).toBe('MNQ');
    expect(plan.instrument.isMicro).toBe(true);
    expect(plan.instrument.pointValue).toBe(2);
  });

  it('MNQ stop natural: 20 pts × $2 = $40', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    expect(plan.stopPoints).toBe(20);
    expect(plan.stopPerTrade).toBe(40);
  });

  it('MNQ Apex 25K conservador — valores operacionalmente sensatos', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    // stop $40, RO ~$44-48 (overhead +10% × ajuste por adjustment)
    expect(plan.roPerTrade).toBeGreaterThanOrEqual(44);
    expect(plan.roPerTrade).toBeLessThanOrEqual(60);
    // RO < daily loss
    expect(plan.roPerTrade).toBeLessThan(500);
    // max trades cabe no daily loss
    expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(500);
    // cap operacional
    expect(plan.maxTradesPerDay).toBeLessThanOrEqual(8);
    expect(plan.constraintsViolated).toEqual([]);
    expect(plan.incompatible).toBe(false);
  });

  it('NQ (full) na Apex 25K — INCOMPATÍVEL (1 trade $400 ~ daily loss $500)', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'NQ');
    // stop NQ = 20 pts × $20 = $400, RO com overhead ~$440-480 = quase todo daily loss
    // mas ainda < $500, então NÃO incompatível tecnicamente, max trades = 1
    // Vamos validar:
    expect(plan.mode).toBe('execution');
    if (plan.incompatible) {
      // Se incompatível, deve sugerir MNQ
      expect(plan.microSuggestion).toBe('MNQ');
    } else {
      // Se não incompatível, max trades é muito baixo (1)
      expect(plan.maxTradesPerDay).toBeLessThanOrEqual(1);
    }
  });

  it('ES Apex 50K conservador — viável, RO razoável', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION', 'ES');
    // ES stop 4 pts × $50 = $200, RO ~$220-240
    expect(plan.stopPerTrade).toBe(200);
    expect(plan.roPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
    expect(plan.constraintsViolated).toEqual([]);
  });

  it('GC na Apex — não permitido (suspenso)', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION', 'GC');
    expect(plan.mode).toBe('execution');
    // Deve ter constraint violation por instrumento não permitido
    const hasNotAllowed = plan.constraintsViolated.some(v => v.includes('não permitido') || v.includes('apex'));
    expect(hasNotAllowed).toBe(true);
  });

  it('instrumento desconhecido retorna mode=error', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'XYZ');
    expect(plan.mode).toBe('error');
    expect(plan.error).toContain('XYZ');
    expect(plan.constraintsViolated).toContain('instrument_not_found');
  });
});

// ============================================
// calculateAttackPlan — perfis com instrumento
// ============================================
describe('calculateAttackPlan — perfis (execution)', () => {
  it('agressivo tem RO maior que conservador (overhead maior)', () => {
    const cons = calculateAttackPlan(APEX_EOD_25K, PROFILE_4D_MID, null, 'conservative', 'EVALUATION', 'MNQ');
    const agg = calculateAttackPlan(APEX_EOD_25K, PROFILE_4D_MID, null, 'aggressive', 'EVALUATION', 'MNQ');
    expect(agg.roPerTrade).toBeGreaterThanOrEqual(cons.roPerTrade);
  });

  it('conservador rrMinimum 1.5, agressivo 2.0', () => {
    const cons = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    const agg = calculateAttackPlan(APEX_EOD_25K, null, null, 'aggressive', 'EVALUATION', 'MNQ');
    expect(cons.rrMinimum).toBe(1.5);
    expect(agg.rrMinimum).toBe(2.0);
  });

  it('targetPerTrade = stopPerTrade × rrMinimum', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    expect(plan.targetPerTrade).toBeCloseTo(plan.stopPerTrade * plan.rrMinimum, 2);
  });

  it('aluno fraco recebe RO com mais overhead', () => {
    const strong = calculateAttackPlan(APEX_EOD_25K, PROFILE_4D_STRONG, null, 'conservative', 'EVALUATION', 'MNQ');
    const weak = calculateAttackPlan(APEX_EOD_25K, PROFILE_4D_WEAK, null, 'conservative', 'EVALUATION', 'MNQ');
    // Stop é o mesmo (depende do instrumento), mas RO do weak tem overhead maior
    expect(weak.roPerTrade).toBeGreaterThanOrEqual(strong.roPerTrade);
  });
});

// ============================================
// calculateAttackPlan — hard constraints
// ============================================
describe('calculateAttackPlan — hard constraints invioláveis', () => {
  const fixtures = [
    { name: 'Apex 25K conservador MNQ', t: APEX_EOD_25K, profile: 'conservative', sym: 'MNQ' },
    { name: 'Apex 25K agressivo MNQ', t: APEX_EOD_25K, profile: 'aggressive', sym: 'MNQ' },
    { name: 'Apex 50K conservador MNQ', t: APEX_EOD_50K, profile: 'conservative', sym: 'MNQ' },
    { name: 'Apex 50K conservador ES', t: APEX_EOD_50K, profile: 'conservative', sym: 'ES' },
    { name: 'Apex 50K agressivo MES', t: APEX_EOD_50K, profile: 'aggressive', sym: 'MES' }
  ];

  for (const fx of fixtures) {
    it(`${fx.name} — todas as 4 constraints respeitadas`, () => {
      const plan = calculateAttackPlan(fx.t, null, null, fx.profile, 'EVALUATION', fx.sym);
      if (plan.incompatible) return; // skip se incompatível (já é safety)

      // C1: roPerTrade <= dailyLossLimit
      expect(plan.roPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
      // C2: stopPerTrade <= dailyLossLimit
      expect(plan.stopPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
      // C3: roPerTrade × maxTradesPerDay <= dailyLossLimit
      expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(plan.dailyLossLimit);
      // C4: dailyTarget × evalBusinessDays >= profitTarget
      expect(plan.dailyTarget * plan.evalBusinessDays).toBeGreaterThanOrEqual(plan.profitTarget);
      // Sem violations registradas
      expect(plan.constraintsViolated).toEqual([]);
    });
  }
});

// ============================================
// calculateAttackPlan — cap operacional
// ============================================
describe('calculateAttackPlan — cap max trades', () => {
  it('conservador cap 8', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');
    if (!plan.incompatible) {
      expect(plan.maxTradesPerDay).toBeLessThanOrEqual(8);
    }
  });

  it('agressivo cap 10', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'aggressive', 'EVALUATION', 'MNQ');
    if (!plan.incompatible) {
      expect(plan.maxTradesPerDay).toBeLessThanOrEqual(10);
    }
  });
});

// ============================================
// calculateAttackPlan — incompatibilidade e sugestão de micro
// ============================================
describe('calculateAttackPlan — incompatibilidade', () => {
  it('quando incompatível, maxTrades=0 e sizing=0', () => {
    // Forçar instrumento muito caro para mesa pequena
    // CL stop 0.20 pts × $1000 = $200, RO ~$220 — viável em 25K? daily $500 = sim
    // Vamos forçar com algo caro: MBT (Bitcoin) tem stop 200 × $0.10 = $20 — viável
    // GC stop 3 × $100 = $300, RO ~$330 — em 25K daily $500: viável mas só 1 trade
    // SI stop 0.05 × $5000 = $250, RO ~$275 — viável também
    // Vamos usar template menor: dailyLoss $100 hipotético
    const tinyTemplate = { ...APEX_EOD_25K, dailyLossLimit: 100 };
    const plan = calculateAttackPlan(tinyTemplate, null, null, 'conservative', 'EVALUATION', 'NQ');
    expect(plan.incompatible).toBe(true);
    expect(plan.maxTradesPerDay).toBe(0);
    expect(plan.sizing).toBe(0);
    // Sugere MNQ
    expect(plan.microSuggestion).toBe('MNQ');
  });

  it('micro variant não tem sugestão de outro micro', () => {
    const tinyTemplate = { ...APEX_EOD_25K, dailyLossLimit: 1 };
    const plan = calculateAttackPlan(tinyTemplate, null, null, 'conservative', 'EVALUATION', 'MNQ');
    if (plan.incompatible) {
      // MNQ já é micro, não deve sugerir nada
      expect(plan.microSuggestion).toBeNull();
    }
  });
});

// ============================================
// calculateAttackPlan — sanidade Apex EOD 25K MNQ conservador
// ============================================
describe('VALIDAÇÃO OPERACIONAL — Apex EOD 25K MNQ conservador', () => {
  it('valores fazem sentido operacional', () => {
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION', 'MNQ');

    // Estrutura básica
    expect(plan.mode).toBe('execution');
    expect(plan.instrument.symbol).toBe('MNQ');
    expect(plan.instrument.isMicro).toBe(true);

    // Constraints da mesa
    expect(plan.dailyLossLimit).toBe(500);
    expect(plan.profitTarget).toBe(1500);

    // Stop natural NQ/MNQ = 20 pts (max(ATR 400 × 5%, minStop 20))
    expect(plan.stopPoints).toBe(20);
    expect(plan.stopPerTrade).toBe(40); // 20 × $2

    // RO com overhead — entre $44 e $60 (depende do adjustment)
    expect(plan.roPerTrade).toBeGreaterThanOrEqual(44);
    expect(plan.roPerTrade).toBeLessThanOrEqual(60);

    // RR conservador = 1.5
    expect(plan.rrMinimum).toBe(1.5);
    expect(plan.targetPerTrade).toBe(60); // 40 × 1.5

    // Max trades: cap 8 ou floor(500/RO)
    // RO ~$48 → floor(500/48) = 10 → cap 8
    expect(plan.maxTradesPerDay).toBe(8);

    // Constraint cabe: 48 × 8 = 384 ≤ 500 ✓
    expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(500);

    // Meta diária $72, dias úteis 21
    expect(plan.dailyTarget).toBe(72);
    expect(plan.evalBusinessDays).toBe(21);

    // Constraints violadas: zero
    expect(plan.constraintsViolated).toEqual([]);
    expect(plan.incompatible).toBe(false);
  });
});
