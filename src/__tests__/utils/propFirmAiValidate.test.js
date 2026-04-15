/**
 * propFirmAiValidate.test.js — Testes de validação pós-processamento da IA
 * para generatePropFirmApproachPlan (issue #133).
 *
 * Cobertura: shape, read-only enforcement, constraints da mesa, viabilidade técnica,
 * coerência mecânica (dia ideal === dailyGoal, dia ruim === -dailyStop),
 * nomes de cenários, metadata.
 */

import { describe, it, expect } from 'vitest';
import { validateAIPlan, buildFallbackPlan } from '../../../functions/propFirm/validate.js';

// ── Fixtures ────────────────────────────────────────────────────

function baseConstraints() {
  return {
    plan: {
      roUSD: 250,
      stopPoints: 20,
      targetPoints: 40,
      maxTradesPerDay: 4,
      contracts: 1,
      dailyGoal: 2000, // 4 × 250 × 2 RR
      dailyStop: 1000, // 4 × 250
    },
    firm: {
      dailyLossLimit: 1000,
    },
    instrument: {
      nyRange: 60,
      minViableStop: 15,
    },
  };
}

function baseValidPlan() {
  return {
    approach: {
      summary: 'ok',
      profileOverride: null,
      sessionRecommendation: { primary: 'ny', secondary: 'london', avoid: null, reasoning: 'x' },
      dailyProfiles: { recommended: ['LONDON_REVERSAL'], avoid: [], reasoning: 'x' },
    },
    executionPlan: {
      stopPoints: 20,
      targetPoints: 40,
      maxTradesPerDay: 4,
      roUSD: 250,
      contracts: 1,
      tradingStyle: 'day trade',
      entryStrategy: 'pullback',
      exitStrategy: 'target fixo',
      pathRecommendation: 'Path A',
    },
    scenarios: [
      { name: 'Dia ideal', description: 'x', trades: 4, result: 2000, cumulative: 'x' },
      { name: 'Dia médio', description: 'x', trades: 2, result: 100, cumulative: 'x' },
      { name: 'Dia ruim', description: 'x', trades: 4, result: -1000, cumulative: 'x' },
      { name: 'Sequência de losses', description: 'x', trades: 2, result: -500, cumulative: 'x' },
    ],
    behavioralGuidance: {
      preSession: 'x',
      duringSession: 'x',
      afterLoss: 'x',
      afterWin: 'x',
      deadlineManagement: 'x',
      personalWarnings: [],
    },
    milestones: [{ day: 1, targetBalance: 500, description: 'x' }],
    metadata: { model: 'claude-sonnet-4-20250514', promptVersion: '1.1', dataSource: '4d_full', generatedAt: '2026-04-14T00:00:00Z' },
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('validateAIPlan — shape', () => {
  it('aceita plano válido completo', () => {
    const result = validateAIPlan(baseValidPlan(), baseConstraints());
    expect(result.valid).toBe(true);
  });

  it('rejeita null/undefined', () => {
    const r = validateAIPlan(null, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/não é um objeto/);
  });

  it('rejeita plano sem campos obrigatórios', () => {
    const plan = baseValidPlan();
    delete plan.approach;
    delete plan.scenarios;
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('approach'))).toBe(true);
    expect(r.errors.some((e) => e.includes('scenarios'))).toBe(true);
  });
});

describe('validateAIPlan — read-only enforcement', () => {
  it('rejeita alteração em stopPoints', () => {
    const plan = baseValidPlan();
    plan.executionPlan.stopPoints = 25; // determinístico era 20
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('stopPoints alterado'))).toBe(true);
  });

  it('rejeita alteração em targetPoints', () => {
    const plan = baseValidPlan();
    plan.executionPlan.targetPoints = 50;
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('targetPoints alterado'))).toBe(true);
  });

  it('rejeita alteração em roUSD', () => {
    const plan = baseValidPlan();
    plan.executionPlan.roUSD = 300;
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('roUSD alterado'))).toBe(true);
  });

  it('rejeita alteração em maxTradesPerDay', () => {
    const plan = baseValidPlan();
    plan.executionPlan.maxTradesPerDay = 6;
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('maxTradesPerDay alterado'))).toBe(true);
  });

  it('aceita pequena variação ±$1 em roUSD (tolerância arredondamento)', () => {
    const plan = baseValidPlan();
    plan.executionPlan.roUSD = 250.5;
    // mas scenarios também precisam permanecer coerentes — dailyStop do cenário "Dia ruim"
    // usa o valor original. A validação de read-only passa dentro da tolerância.
    const r = validateAIPlan(plan, baseConstraints());
    // coerência mecânica pode falhar por outro motivo; só validamos que não é o read-only
    const readOnlyErrors = (r.errors || []).filter((e) => e.includes('alterado'));
    expect(readOnlyErrors).toHaveLength(0);
  });

  it('rejeita executionPlan.stopPoints ausente ou não-numérico', () => {
    const plan = baseValidPlan();
    plan.executionPlan.stopPoints = 'vinte';
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('stopPoints ausente ou não-numérico'))).toBe(true);
  });
});

describe('validateAIPlan — constraints da mesa', () => {
  it('rejeita RO > dailyLossLimit', () => {
    const c = baseConstraints();
    c.firm.dailyLossLimit = 200; // RO 250 > 200
    const r = validateAIPlan(baseValidPlan(), c);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('excede dailyLossLimit'))).toBe(true);
  });

  it('rejeita exposição diária > dailyLossLimit', () => {
    const c = baseConstraints();
    c.firm.dailyLossLimit = 500; // 4 × 250 = 1000 > 500
    const r = validateAIPlan(baseValidPlan(), c);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Exposição diária'))).toBe(true);
  });
});

describe('validateAIPlan — viabilidade técnica', () => {
  it('rejeita stopPoints abaixo do minViableStop', () => {
    const c = baseConstraints();
    c.instrument.minViableStop = 25; // stop 20 < 25
    const r = validateAIPlan(baseValidPlan(), c);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('abaixo do mínimo'))).toBe(true);
  });

  it('rejeita stop > 75% do range NY', () => {
    const c = baseConstraints();
    c.instrument.nyRange = 20; // stop 20 / 20 = 100%
    const plan = baseValidPlan();
    // ajustar plan.stopPoints para 20 em ambos
    plan.executionPlan.stopPoints = 20;
    c.plan.stopPoints = 20;
    const r = validateAIPlan(plan, c);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('excede 75%'))).toBe(true);
  });

  it('aceita stop exatamente em 75% do range NY', () => {
    const c = baseConstraints();
    c.instrument.nyRange = 27; // 20/27 ≈ 74%
    const r = validateAIPlan(baseValidPlan(), c);
    expect(r.valid).toBe(true);
  });
});

describe('validateAIPlan — coerência mecânica (CORREÇÃO 5)', () => {
  it('rejeita "Dia ideal" result !== dailyGoal', () => {
    const plan = baseValidPlan();
    plan.scenarios[0].result = 1500; // dailyGoal é 2000
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Dia ideal') && e.includes('coerência mecânica'))).toBe(true);
  });

  it('rejeita "Dia ruim" result !== -dailyStop', () => {
    const plan = baseValidPlan();
    plan.scenarios[2].result = -500; // -dailyStop é -1000
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Dia ruim') && e.includes('coerência mecânica'))).toBe(true);
  });

  it('aceita "Dia ideal" === +dailyGoal e "Dia ruim" === -dailyStop', () => {
    const r = validateAIPlan(baseValidPlan(), baseConstraints());
    expect(r.valid).toBe(true);
  });

  it('tolera ±$1 em cenários (arredondamento)', () => {
    const plan = baseValidPlan();
    plan.scenarios[0].result = 2000.5;
    plan.scenarios[2].result = -999.5;
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(true);
  });
});

describe('validateAIPlan — nomes de cenários', () => {
  it('rejeita ausência de cenário obrigatório', () => {
    const plan = baseValidPlan();
    plan.scenarios[3].name = 'Outro nome';
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Sequência de losses'))).toBe(true);
  });

  it('rejeita scenarios com menos de 4 entradas', () => {
    const plan = baseValidPlan();
    plan.scenarios = plan.scenarios.slice(0, 3);
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('array com 4 entradas'))).toBe(true);
  });
});

describe('validateAIPlan — metadata', () => {
  it('rejeita dataSource inválido', () => {
    const plan = baseValidPlan();
    plan.metadata.dataSource = 'chute';
    const r = validateAIPlan(plan, baseConstraints());
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('dataSource inválido'))).toBe(true);
  });

  it('aceita dataSource: 4d_full, indicators, defaults', () => {
    for (const ds of ['4d_full', 'indicators', 'defaults']) {
      const plan = baseValidPlan();
      plan.metadata.dataSource = ds;
      const r = validateAIPlan(plan, baseConstraints());
      expect(r.valid).toBe(true);
    }
  });
});

describe('buildFallbackPlan', () => {
  it('retorna plano com aiUnavailable: true e coerência mecânica', () => {
    const c = baseConstraints();
    const fallback = buildFallbackPlan(c, 'API timeout');
    expect(fallback.metadata.aiUnavailable).toBe(true);
    expect(fallback.metadata.fallbackReason).toBe('API timeout');
    // Cenários seguem a mesma regra mecânica
    const ideal = fallback.scenarios.find((s) => s.name === 'Dia ideal');
    const ruim = fallback.scenarios.find((s) => s.name === 'Dia ruim');
    expect(ideal.result).toBe(c.plan.dailyGoal);
    expect(ruim.result).toBe(-c.plan.dailyStop);
  });

  it('fallback passa na própria validateAIPlan', () => {
    const c = baseConstraints();
    const fallback = buildFallbackPlan(c, 'test');
    const r = validateAIPlan(fallback, c);
    expect(r.valid).toBe(true);
  });
});
