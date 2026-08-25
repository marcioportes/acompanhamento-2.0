/**
 * #402 — DEC-069: `periodStop = maxTrades × RO`. Nada validava a relação, e o
 * Ago-Plano acabou autorizando duas operações que ele mesmo proíbe.
 */
import { describe, it, expect } from 'vitest';
import { checkPlanCoherence, authorizedTradesLabel, PLAN_ISSUE } from '../../utils/planMechanicsCheck';

const cod = (r) => r.issues.map((i) => i.code);

describe('o Ago-Plano — o plano que originou o issue', () => {
  const plano = { pl: 30000, riskPerOperation: 0.84, periodStop: 1.67, periodGoal: 3.35, cycleStop: 8.5, rrTarget: 2, operationPeriod: 'Diário' };
  const r = checkPlanCoherence(plano);

  it('traduz os percentuais em dinheiro', () => {
    expect(r.roAmount).toBe(252);
    expect(r.stopAmount).toBe(501);
    expect(r.goalAmount).toBe(1005);
  });

  it('comporta 1,99 operações — e o plano autoriza apenas 1', () => {
    expect(r.tradesImplied).toBe(1.99);
    expect(r.maxAuthorizedTrades).toBe(1);
  });

  it('acusa o múltiplo fracionário como aviso, não como erro', () => {
    expect(cod(r)).toContain(PLAN_ISSUE.PERIOD_STOP_NOT_MULTIPLE_OF_RO);
    const issue = r.issues.find((i) => i.code === PLAN_ISSUE.PERIOD_STOP_NOT_MULTIPLE_OF_RO);
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('1,99');
    expect(issue.message).toContain('1,68%'); // o valor que fecharia em 2 operações
    expect(issue.message).toContain('0,84%'); // o valor que fecharia em 1
  });

  it('a meta de 3,35% é coerente com stop 1,67% e alvo 2:1 — não reclama', () => {
    expect(cod(r)).not.toContain(PLAN_ISSUE.PERIOD_GOAL_VS_RR);
  });

  it('rótulo legível para a UI', () => {
    expect(authorizedTradesLabel(plano)).toBe('Autoriza 1 operação por dia');
  });
});

describe('plano coerente não reclama de nada', () => {
  it('1,68% de stop com RO de 0,84% fecha em 2 operações', () => {
    const r = checkPlanCoherence({ pl: 30000, riskPerOperation: 0.84, periodStop: 1.68, periodGoal: 3.36, cycleStop: 8.5, rrTarget: 2 });
    expect(r.tradesImplied).toBe(2);
    expect(r.maxAuthorizedTrades).toBe(2);
    expect(r.issues).toEqual([]);
  });

  it('uma operação por dia, exata', () => {
    const r = checkPlanCoherence({ pl: 10000, riskPerOperation: 1, periodStop: 1, cycleStop: 5 });
    expect(r.maxAuthorizedTrades).toBe(1);
    expect(cod(r)).toEqual([]);
  });
});

describe('plano que não autoriza operação nenhuma', () => {
  // Existe na base: "Daniel Barbosa/Teste" comporta 0,50 operação.
  const r = checkPlanCoherence({ pl: 30000, riskPerOperation: 2, periodStop: 1, cycleStop: 8 });

  it('é ERRO, não aviso — o plano é inoperável', () => {
    expect(cod(r)).toContain(PLAN_ISSUE.PERIOD_STOP_BELOW_RO);
    expect(r.issues.find((i) => i.code === PLAN_ISSUE.PERIOD_STOP_BELOW_RO).severity).toBe('error');
  });

  it('maxAuthorizedTrades é zero', () => {
    expect(r.maxAuthorizedTrades).toBe(0);
  });

  it('o rótulo diz a verdade', () => {
    expect(authorizedTradesLabel({ pl: 30000, riskPerOperation: 2, periodStop: 1 }))
      .toBe('Não autoriza nenhuma operação por dia');
  });
});

describe('stop do período acima do stop do ciclo', () => {
  it('é erro (validação que estava inline no PlanManagementModal)', () => {
    const r = checkPlanCoherence({ pl: 10000, riskPerOperation: 1, periodStop: 9, cycleStop: 8 });
    expect(cod(r)).toContain(PLAN_ISSUE.PERIOD_STOP_ABOVE_CYCLE_STOP);
  });
});

describe('meta incoerente com o alvo de R:R', () => {
  it('reclama quando a meta destoa mais de 20% de stop × RR', () => {
    const r = checkPlanCoherence({ pl: 30000, riskPerOperation: 0.84, periodStop: 1.68, periodGoal: 10, cycleStop: 20, rrTarget: 2 });
    expect(cod(r)).toContain(PLAN_ISSUE.PERIOD_GOAL_VS_RR);
  });

  it('tolera desvio pequeno — meta é intenção, não obrigação', () => {
    const r = checkPlanCoherence({ pl: 30000, riskPerOperation: 0.84, periodStop: 1.68, periodGoal: 3.7, cycleStop: 20, rrTarget: 2 });
    expect(cod(r)).not.toContain(PLAN_ISSUE.PERIOD_GOAL_VS_RR);
  });
});

describe('semanal', () => {
  it('o rótulo acompanha o período do plano', () => {
    expect(authorizedTradesLabel({ pl: 30000, riskPerOperation: 0.84, periodStop: 1.68, operationPeriod: 'Semanal' }))
      .toBe('Autoriza 2 operações por semana');
  });
});

describe('entradas incompletas não explodem', () => {
  it('plano nulo', () => {
    expect(checkPlanCoherence(null).issues).toEqual([]);
    expect(authorizedTradesLabel(null)).toBeNull();
  });

  it('sem pl', () => {
    const r = checkPlanCoherence({ riskPerOperation: 0.84, periodStop: 1.67 });
    expect(r.roAmount).toBeNull();
    // a relação stop × RO independe do capital — segue sendo avaliada
    expect(r.maxAuthorizedTrades).toBe(1);
    expect(authorizedTradesLabel({ riskPerOperation: 0.84, periodStop: 1.67 })).toBeNull();
  });

  it('sem periodStop', () => {
    const r = checkPlanCoherence({ pl: 30000, riskPerOperation: 0.84 });
    expect(r.tradesImplied).toBeNull();
    expect(r.issues).toEqual([]);
  });

  it('campos como string (vindos de formulário)', () => {
    const r = checkPlanCoherence({ pl: '30000', riskPerOperation: '0.84', periodStop: '1.67', cycleStop: '8.5' });
    expect(r.roAmount).toBe(252);
    expect(r.maxAuthorizedTrades).toBe(1);
  });
});
