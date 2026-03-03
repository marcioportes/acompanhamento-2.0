/**
 * Tests: mentorPlanAudit
 * @description Testa lógica de auditoria quando mentor edita plano do aluno
 * 
 * Cenários:
 * - Detecção de campos alterados
 * - Geração de auditInfo correta
 * - Edge cases: nenhum campo alterado, todos alterados
 */

import { describe, it, expect } from 'vitest';
import { detectChangedFields, buildAuditInfo } from '../../utils/mentorPlanAudit';

describe('detectChangedFields', () => {

  const basePlan = {
    name: 'MFF Sobrevivência 1k',
    pl: 1000,
    riskPerOperation: 6,
    rrTarget: 2,
    periodGoal: 20,
    periodStop: 12,
    cycleGoal: 75,
    cycleStop: 50,
    adjustmentCycle: 'Semanal',
    operationPeriod: 'Diário',
  };

  it('nenhum campo alterado → array vazio', () => {
    const result = detectChangedFields(basePlan, { ...basePlan });
    expect(result).toHaveLength(0);
  });

  it('1 campo alterado (riskPerOperation)', () => {
    const newData = { ...basePlan, riskPerOperation: 4 };
    const result = detectChangedFields(basePlan, newData);
    expect(result).toEqual(['riskPerOperation']);
  });

  it('múltiplos campos alterados', () => {
    const newData = { ...basePlan, pl: 2000, cycleStop: 30, name: 'Novo Nome' };
    const result = detectChangedFields(basePlan, newData);
    expect(result).toContain('pl');
    expect(result).toContain('cycleStop');
    expect(result).toContain('name');
    expect(result).toHaveLength(3);
  });

  it('todos os campos alterados', () => {
    const newData = {
      name: 'Outro',
      pl: 999,
      riskPerOperation: 1,
      rrTarget: 3,
      periodGoal: 10,
      periodStop: 5,
      cycleGoal: 50,
      cycleStop: 25,
      adjustmentCycle: 'Mensal',
      operationPeriod: 'Semanal',
    };
    const result = detectChangedFields(basePlan, newData);
    expect(result).toHaveLength(10);
  });

  it('comparação string vs number (pl: 1000 vs "1000") → sem mudança', () => {
    const newData = { ...basePlan, pl: '1000' };
    const result = detectChangedFields(basePlan, newData);
    expect(result).toHaveLength(0);
  });

  it('valor zero vs string vazia → detecta mudança', () => {
    const planWithZero = { ...basePlan, periodGoal: 0 };
    const newData = { ...basePlan, periodGoal: '' };
    const result = detectChangedFields(planWithZero, newData);
    expect(result).toContain('periodGoal');
  });
});

describe('buildAuditInfo', () => {

  const basePlan = {
    name: 'Plano A',
    pl: 1000,
    riskPerOperation: 6,
    rrTarget: 2,
    periodGoal: 20,
    periodStop: 12,
    cycleGoal: 75,
    cycleStop: 50,
    adjustmentCycle: 'Semanal',
    operationPeriod: 'Diário',
  };

  it('gera auditInfo com editedBy mentor', () => {
    const newData = { ...basePlan, riskPerOperation: 3 };
    const audit = buildAuditInfo('mentor@test.com', basePlan, newData);

    expect(audit.editedBy).toBe('mentor');
    expect(audit.email).toBe('mentor@test.com');
    expect(audit.changedFields).toEqual(['riskPerOperation']);
  });

  it('sem alterações → changedFields vazio', () => {
    const audit = buildAuditInfo('mentor@test.com', basePlan, { ...basePlan });
    expect(audit.changedFields).toHaveLength(0);
  });

  it('preserva email do mentor', () => {
    const audit = buildAuditInfo('marcio.portes@me.com', basePlan, { ...basePlan, pl: 5000 });
    expect(audit.email).toBe('marcio.portes@me.com');
    expect(audit.changedFields).toContain('pl');
  });
});
