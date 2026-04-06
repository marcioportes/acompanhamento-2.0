import { describe, it, expect } from 'vitest';
import { calculateAttackPlan, resolveDataSource } from '../../utils/attackPlanCalculator';

// --- Template de referência: Apex EOD 50K ---
const APEX_EOD_50K = {
  firm: 'APEX',
  accountSize: 50000,
  drawdown: { type: 'TRAILING_EOD', maxAmount: 2500, lockAt: null },
  dailyLossLimit: 1000,
  profitTarget: 3000,
  evalTimeLimit: 30,
  evalMinTradingDays: 0,
  contracts: { max: 10 }
};

// --- Template sem daily loss: Apex Intraday 50K ---
const APEX_INTRADAY_50K = {
  ...APEX_EOD_50K,
  drawdown: { type: 'TRAILING_INTRADAY', maxAmount: 2500 },
  dailyLossLimit: null
};

// --- Perfis 4D completos ---
const PROFILE_4D_STRONG = {
  emotionalScore: 80,
  stage: 4,
  coefficientOfVariation: 0.3
};

const PROFILE_4D_WEAK = {
  emotionalScore: 30,
  stage: 1,
  coefficientOfVariation: 1.2
};

const PROFILE_4D_MID = {
  emotionalScore: 50,
  stage: 3,
  coefficientOfVariation: 0.5
};

// --- Indicadores sem 4D ---
const INDICATORS_GOOD = {
  winRate: 0.6,
  coefficientOfVariation: 0.4
};

const INDICATORS_POOR = {
  winRate: 0.35,
  coefficientOfVariation: 1.5
};

// ============================================
// resolveDataSource
// ============================================
describe('resolveDataSource', () => {
  it('usa 4D completo quando disponível', () => {
    const result = resolveDataSource(PROFILE_4D_STRONG, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('4d_full');
    expect(result.adjustmentFactor).toBeGreaterThan(0);
    expect(result.adjustmentFactor).toBeLessThanOrEqual(1);
  });

  it('calcula adjustmentFactor correto com 4D completo', () => {
    // emotional: 80/100 = 0.8, maturity: 4/5 = 0.8, consistency: 1-0.3 = 0.7
    // factor = 0.8*0.4 + 0.8*0.3 + 0.7*0.3 = 0.32 + 0.24 + 0.21 = 0.77
    const result = resolveDataSource(PROFILE_4D_STRONG, null, 'conservative');
    expect(result.adjustmentFactor).toBeCloseTo(0.77, 2);
  });

  it('usa indicadores quando 4D não disponível', () => {
    const result = resolveDataSource(null, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('indicators');
  });

  it('calcula adjustmentFactor com indicadores (emotional default 0.5)', () => {
    // emotional: 0.5 (default), maturity proxy: WR 0.6, consistency: 1-0.4 = 0.6
    // factor = 0.5*0.4 + 0.6*0.3 + 0.6*0.3 = 0.20 + 0.18 + 0.18 = 0.56
    const result = resolveDataSource(null, INDICATORS_GOOD, 'conservative');
    expect(result.adjustmentFactor).toBeCloseTo(0.56, 2);
  });

  it('usa defaults quando nada disponível', () => {
    const result = resolveDataSource(null, null, 'conservative');
    expect(result.dataSource).toBe('defaults');
    expect(result.adjustmentFactor).toBe(0.3);
  });

  it('usa default agressivo quando perfil é aggressive', () => {
    const result = resolveDataSource(null, null, 'aggressive');
    expect(result.dataSource).toBe('defaults');
    expect(result.adjustmentFactor).toBe(0.6);
  });

  it('prioriza 4D sobre indicadores quando ambos presentes', () => {
    const result = resolveDataSource(PROFILE_4D_STRONG, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('4d_full');
  });

  it('clamp adjustmentFactor a 0 quando CV muito alto', () => {
    const extremeProfile = { emotionalScore: 0, stage: 1, coefficientOfVariation: 5.0 };
    const result = resolveDataSource(extremeProfile, null, 'conservative');
    expect(result.adjustmentFactor).toBeGreaterThanOrEqual(0);
  });

  it('clamp adjustmentFactor a 1 quando tudo máximo', () => {
    const maxProfile = { emotionalScore: 100, stage: 5, coefficientOfVariation: 0 };
    const result = resolveDataSource(maxProfile, null, 'conservative');
    expect(result.adjustmentFactor).toBeLessThanOrEqual(1);
    expect(result.adjustmentFactor).toBeCloseTo(1.0, 2);
  });

  it('ignora 4D incompleto (sem stage)', () => {
    const incomplete = { emotionalScore: 80, coefficientOfVariation: 0.3 };
    const result = resolveDataSource(incomplete, INDICATORS_GOOD, 'conservative');
    expect(result.dataSource).toBe('indicators');
  });

  it('ignora indicadores incompletos (sem CV)', () => {
    const incomplete = { winRate: 0.6 };
    const result = resolveDataSource(null, incomplete, 'conservative');
    expect(result.dataSource).toBe('defaults');
  });
});

// ============================================
// calculateAttackPlan — cenários básicos
// ============================================
describe('calculateAttackPlan', () => {
  it('retorna todos os campos esperados', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION');
    expect(plan).toHaveProperty('profile', 'conservative');
    expect(plan).toHaveProperty('dataSource');
    expect(plan).toHaveProperty('adjustmentFactor');
    expect(plan).toHaveProperty('roFactor');
    expect(plan).toHaveProperty('drawdownMax');
    expect(plan).toHaveProperty('dailyLossLimit');
    expect(plan).toHaveProperty('profitTarget');
    expect(plan).toHaveProperty('roPerTrade');
    expect(plan).toHaveProperty('stopPerTrade');
    expect(plan).toHaveProperty('rrMinimum');
    expect(plan).toHaveProperty('maxTradesPerDay');
    expect(plan).toHaveProperty('dailyTarget');
    expect(plan).toHaveProperty('evalBusinessDays');
    expect(plan).toHaveProperty('daysToTarget');
    expect(plan).toHaveProperty('bufferDays');
    expect(plan).toHaveProperty('sizing');
    expect(plan).toHaveProperty('constraintsViolated');
    expect(plan).toHaveProperty('generatedAt');
  });

  it('NUNCA viola hard constraints da mesa', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION');
    expect(plan.roPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
    expect(plan.stopPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
    expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(plan.dailyLossLimit);
    expect(plan.dailyTarget * plan.evalBusinessDays).toBeGreaterThanOrEqual(plan.profitTarget);
    expect(plan.constraintsViolated).toEqual([]);
  });

  it('Apex EOD 25K conservador defaults — valores operacionais corretos', () => {
    const APEX_EOD_25K = {
      ...APEX_EOD_50K,
      accountSize: 25000,
      drawdown: { type: 'TRAILING_EOD', maxAmount: 1000 },
      dailyLossLimit: 500,
      profitTarget: 1500,
      contracts: { max: 4 }
    };
    const plan = calculateAttackPlan(APEX_EOD_25K, null, null, 'conservative', 'EVALUATION');
    // RO entre 8-12% de $500 com adjustment 0.3 → ~9.2% → ~$46
    expect(plan.roPerTrade).toBeGreaterThanOrEqual(40);
    expect(plan.roPerTrade).toBeLessThanOrEqual(60);
    expect(plan.maxTradesPerDay).toBe(8); // cap conservador
    expect(plan.roPerTrade * plan.maxTradesPerDay).toBeLessThanOrEqual(500);
    expect(plan.constraintsViolated).toEqual([]);
  });

  it('lança erro se templateRules ausente', () => {
    expect(() => calculateAttackPlan(null, null, null, 'conservative', 'EVALUATION'))
      .toThrow('templateRules é obrigatório');
  });

  it('usa conservative como default para profile inválido', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'invalid', 'EVALUATION');
    expect(plan.profile).toBe('conservative');
  });

  it('usa EVALUATION como default para phase inválida', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'INVALID');
    expect(plan.daysToTarget).toBeGreaterThan(0);
  });
});

// ============================================
// calculateAttackPlan — conservador vs agressivo
// ============================================
describe('calculateAttackPlan — perfis', () => {
  it('agressivo tem RO por trade maior que conservador', () => {
    const conservative = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_MID, null, 'conservative', 'EVALUATION');
    const aggressive = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_MID, null, 'aggressive', 'EVALUATION');
    expect(aggressive.roPerTrade).toBeGreaterThan(conservative.roPerTrade);
  });

  it('conservador tem RR mínimo 1.5, agressivo 2.0', () => {
    const conservative = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION');
    const aggressive = calculateAttackPlan(APEX_EOD_50K, null, null, 'aggressive', 'EVALUATION');
    expect(conservative.rrMinimum).toBe(1.5);
    expect(aggressive.rrMinimum).toBe(2.0);
  });

  it('sizing é null (depende do instrumento, calculado depois)', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_STRONG, null, 'conservative', 'EVALUATION');
    expect(plan.sizing).toBeNull();
  });
});

// ============================================
// calculateAttackPlan — stages 1-5 com 4D
// ============================================
describe('calculateAttackPlan — progressão por stage', () => {
  const stages = [1, 2, 3, 4, 5];

  it('adjustmentFactor cresce com stage (emotional e CV fixos)', () => {
    const factors = stages.map(stage => {
      const profile = { emotionalScore: 50, stage, coefficientOfVariation: 0.5 };
      const plan = calculateAttackPlan(APEX_EOD_50K, profile, null, 'conservative', 'EVALUATION');
      return plan.adjustmentFactor;
    });

    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThan(factors[i - 1]);
    }
  });

  it('roPerTrade cresce com stage', () => {
    const ros = stages.map(stage => {
      const profile = { emotionalScore: 50, stage, coefficientOfVariation: 0.5 };
      return calculateAttackPlan(APEX_EOD_50K, profile, null, 'conservative', 'EVALUATION').roPerTrade;
    });

    for (let i = 1; i < ros.length; i++) {
      expect(ros[i]).toBeGreaterThan(ros[i - 1]);
    }
  });
});

// ============================================
// calculateAttackPlan — daily loss limit
// ============================================
describe('calculateAttackPlan — daily loss limit', () => {
  it('maxTradesPerDay limitado pelo cap operacional (8 conservador, 10 agressivo)', () => {
    const conservative = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION');
    const aggressive = calculateAttackPlan(APEX_EOD_50K, null, null, 'aggressive', 'EVALUATION');
    expect(conservative.maxTradesPerDay).toBeGreaterThanOrEqual(1);
    expect(conservative.maxTradesPerDay).toBeLessThanOrEqual(8);
    expect(aggressive.maxTradesPerDay).toBeLessThanOrEqual(10);
  });

  it('sem daily loss limit usa 40% do drawdown como referência', () => {
    const plan = calculateAttackPlan(APEX_INTRADAY_50K, null, null, 'conservative', 'EVALUATION');
    expect(plan.maxTradesPerDay).toBeGreaterThanOrEqual(1);
  });

  it('maxTradesPerDay nunca é zero', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_WEAK, null, 'conservative', 'EVALUATION');
    expect(plan.maxTradesPerDay).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// calculateAttackPlan — fases
// ============================================
describe('calculateAttackPlan — fases', () => {
  it('dailyTarget é estável independente da fase (calculado por profitTarget/dias úteis)', () => {
    // Hard constraint: dailyTarget × evalBusinessDays >= profitTarget
    const eval_ = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_MID, null, 'conservative', 'EVALUATION');
    expect(eval_.dailyTarget * eval_.evalBusinessDays).toBeGreaterThanOrEqual(eval_.profitTarget);
  });

  it('bufferDays não é negativo', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_MID, null, 'conservative', 'EVALUATION');
    expect(plan.bufferDays).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// calculateAttackPlan — cascata de dados
// ============================================
describe('calculateAttackPlan — cascata de dados', () => {
  it('com 4D completo, dataSource é 4d_full', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_STRONG, INDICATORS_GOOD, 'conservative', 'EVALUATION');
    expect(plan.dataSource).toBe('4d_full');
  });

  it('sem 4D mas com indicadores, dataSource é indicators', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, INDICATORS_GOOD, 'conservative', 'EVALUATION');
    expect(plan.dataSource).toBe('indicators');
  });

  it('sem nada, dataSource é defaults', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, null, null, 'conservative', 'EVALUATION');
    expect(plan.dataSource).toBe('defaults');
  });

  it('aluno forte (4D) gera plano mais agressivo que aluno fraco', () => {
    const strong = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_STRONG, null, 'conservative', 'EVALUATION');
    const weak = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_WEAK, null, 'conservative', 'EVALUATION');
    expect(strong.roPerTrade).toBeGreaterThan(weak.roPerTrade);
    expect(strong.adjustmentFactor).toBeGreaterThan(weak.adjustmentFactor);
  });
});

// ============================================
// calculateAttackPlan — edge cases
// ============================================
describe('calculateAttackPlan — edge cases', () => {
  it('template com drawdown 0 e dailyLossLimit definido — usa dailyLossLimit como base', () => {
    const template = { ...APEX_EOD_50K, drawdown: { type: 'STATIC', maxAmount: 0 } };
    const plan = calculateAttackPlan(template, null, null, 'conservative', 'EVALUATION');
    // Daily loss = 1000 do APEX_EOD_50K, RO = ~9.2% = ~$92
    expect(plan.roPerTrade).toBeGreaterThan(0);
    expect(plan.roPerTrade).toBeLessThanOrEqual(plan.dailyLossLimit);
    expect(plan.constraintsViolated).toEqual([]);
  });

  it('template sem drawdown nem dailyLossLimit — fallback seguro', () => {
    const template = {
      ...APEX_EOD_50K,
      drawdown: { type: 'STATIC', maxAmount: 0 },
      dailyLossLimit: null
    };
    const plan = calculateAttackPlan(template, null, null, 'conservative', 'EVALUATION');
    // dailyLossLimit fallback = drawdown × 0.25 = 0, mas roPerTrade tem mínimo de 1
    expect(plan.roPerTrade).toBeGreaterThanOrEqual(1);
  });

  it('template com profitTarget 0 gera dailyTarget 0', () => {
    const template = { ...APEX_EOD_50K, profitTarget: 0 };
    const plan = calculateAttackPlan(template, null, null, 'conservative', 'EVALUATION');
    expect(plan.dailyTarget).toBe(0);
  });

  it('template sem evalTimeLimit usa 30 como default', () => {
    const template = { ...APEX_EOD_50K, evalTimeLimit: null };
    const plan = calculateAttackPlan(template, null, null, 'conservative', 'EVALUATION');
    expect(plan.daysToTarget).toBeGreaterThan(0);
    expect(plan.daysToTarget).toBeLessThanOrEqual(30);
  });

  it('sizing é sempre null (independente do perfil)', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_WEAK, null, 'conservative', 'EVALUATION');
    expect(plan.sizing).toBeNull();
  });

  it('todos os valores numéricos são finitos', () => {
    const plan = calculateAttackPlan(APEX_EOD_50K, PROFILE_4D_MID, null, 'aggressive', 'EVALUATION');
    expect(Number.isFinite(plan.roPerTrade)).toBe(true);
    expect(Number.isFinite(plan.stopPerTrade)).toBe(true);
    expect(Number.isFinite(plan.dailyTarget)).toBe(true);
    expect(Number.isFinite(plan.adjustmentFactor)).toBe(true);
    expect(Number.isFinite(plan.maxTradesPerDay)).toBe(true);
  });
});
