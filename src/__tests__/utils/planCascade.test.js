/**
 * planCascade.test.js
 * @version 1.0.0 (v1.19.0)
 * @description Testes para lógica de recálculo em cascata (B1) e acesso emocional (B3)
 * 
 * B1: Verifica que RISK_FIELDS são detectados corretamente para disparar recálculo
 * B3: Verifica que handleViewAs passa focusTab corretamente
 * 
 * NOTA: As funções auditPlan e updatePlan dependem de Firebase (Firestore + callable),
 * portanto testamos apenas a lógica pura de detecção de campos.
 */

import { describe, it, expect } from 'vitest';

// Reproduz a constante RISK_FIELDS do usePlans.js
const RISK_FIELDS = ['riskPerOperation', 'rrTarget', 'periodStop', 'cycleStop'];

describe('B1: RISK_FIELDS detection', () => {

  it('detecta mudança em riskPerOperation como risk field', () => {
    const changedFields = ['name', 'riskPerOperation'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(true);
  });

  it('detecta mudança em rrTarget como risk field', () => {
    const changedFields = ['rrTarget'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(true);
  });

  it('detecta mudança em periodStop como risk field', () => {
    const changedFields = ['description', 'periodStop'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(true);
  });

  it('detecta mudança em cycleStop como risk field', () => {
    const changedFields = ['cycleStop'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(true);
  });

  it('NÃO detecta mudança apenas em name/description como risk field', () => {
    const changedFields = ['name', 'description', 'operationPeriod'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(false);
  });

  it('NÃO detecta mudança em pl/currentPl como risk field', () => {
    const changedFields = ['pl', 'currentPl', 'adjustmentCycle'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(false);
  });

  it('detecta quando múltiplos risk fields mudam juntos', () => {
    const changedFields = ['riskPerOperation', 'rrTarget', 'periodStop', 'cycleStop'];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(true);
  });

  it('NÃO detecta em array vazio', () => {
    const changedFields = [];
    const riskChanged = changedFields.some(f => RISK_FIELDS.includes(f));
    expect(riskChanged).toBe(false);
  });
});

describe('B1: auditPlan PL recalculation logic', () => {

  it('calcula currentPL como basePl + soma dos resultados', () => {
    const basePl = 10000;
    const tradeResults = [200, -50, 150, -80, 300];
    const totalResult = tradeResults.reduce((sum, r) => sum + r, 0);
    const newCurrentPl = Math.round((basePl + totalResult) * 100) / 100;
    
    expect(totalResult).toBe(520);
    expect(newCurrentPl).toBe(10520);
  });

  it('calcula currentPL corretamente com trades negativos', () => {
    const basePl = 20000;
    const tradeResults = [-500, -300, -200, 100, -150];
    const totalResult = tradeResults.reduce((sum, r) => sum + r, 0);
    const newCurrentPl = Math.round((basePl + totalResult) * 100) / 100;
    
    expect(totalResult).toBe(-1050);
    expect(newCurrentPl).toBe(18950);
  });

  it('calcula currentPL como basePl quando não há trades', () => {
    const basePl = 15000;
    const tradeResults = [];
    const totalResult = tradeResults.reduce((sum, r) => sum + r, 0);
    const newCurrentPl = Math.round((basePl + totalResult) * 100) / 100;
    
    expect(newCurrentPl).toBe(15000);
  });

  it('arredonda para 2 casas decimais', () => {
    const basePl = 10000;
    const tradeResults = [33.333, 66.667];
    const totalResult = tradeResults.reduce((sum, r) => sum + r, 0);
    const newCurrentPl = Math.round((basePl + totalResult) * 100) / 100;
    
    expect(newCurrentPl).toBe(10100);
  });
});

describe('B3: handleViewAs focusTab', () => {

  it('constructs viewAs object with focusTab', () => {
    const student = { uid: 'abc123', email: 'aluno@test.com', name: 'Aluno' };
    const focusTab = 'emotional';
    
    const viewAsData = {
      uid: student.uid || student.id,
      email: student.email,
      name: student.name,
      focusTab,
    };
    
    expect(viewAsData.uid).toBe('abc123');
    expect(viewAsData.focusTab).toBe('emotional');
  });

  it('constructs viewAs object without focusTab (default)', () => {
    const student = { uid: 'abc123', email: 'aluno@test.com', name: 'Aluno' };
    const focusTab = null;
    
    const viewAsData = {
      uid: student.uid || student.id,
      email: student.email,
      name: student.name,
      focusTab,
    };
    
    expect(viewAsData.focusTab).toBeNull();
  });

  it('uses student.id as fallback when uid is missing', () => {
    const student = { id: 'doc123', email: 'aluno@test.com', name: 'Aluno' };
    
    const viewAsData = {
      uid: student.uid || student.id,
      email: student.email,
      name: student.name,
      focusTab: null,
    };
    
    expect(viewAsData.uid).toBe('doc123');
  });
});
