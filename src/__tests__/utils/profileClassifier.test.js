/**
 * profileClassifier.test.js
 * 
 * Testes para classificação de scores em labels/perfis.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { describe, it, expect } from 'vitest';
import {
  classifyEmotional,
  classifyRecognition,
  classifyRegulation,
  classifyLocus,
  classifyFinancial,
  classifyDiscipline,
  classifyLossManagement,
  classifyProfitTaking,
  classifyOperational,
  classifyDecisionMode,
  classifyTimeframeFit,
  classifyExperienceStage,
  classifyComposite,
  classifyFullAssessment,
} from '../../utils/profileClassifier.js';

// ============================================================
// EMOCIONAL
// ============================================================

describe('classifyEmotional', () => {
  it('SAGE para 85+', () => {
    expect(classifyEmotional(85).label).toBe('SAGE');
    expect(classifyEmotional(100).label).toBe('SAGE');
  });
  it('LEARNER para 65-84', () => {
    expect(classifyEmotional(65).label).toBe('LEARNER');
    expect(classifyEmotional(84).label).toBe('LEARNER');
  });
  it('DEVELOPING para 50-64', () => {
    expect(classifyEmotional(50).label).toBe('DEVELOPING');
    expect(classifyEmotional(64).label).toBe('DEVELOPING');
  });
  it('FRAGILE para <50', () => {
    expect(classifyEmotional(49).label).toBe('FRAGILE');
    expect(classifyEmotional(0).label).toBe('FRAGILE');
  });
  it('null para input null', () => {
    expect(classifyEmotional(null)).toBeNull();
  });
});

describe('classifyRecognition', () => {
  it('A para 70+', () => expect(classifyRecognition(70).code).toBe('A'));
  it('B para 50-69', () => expect(classifyRecognition(50).code).toBe('B'));
  it('C para <50', () => expect(classifyRecognition(49).code).toBe('C'));
});

describe('classifyRegulation', () => {
  it('1 para 70+', () => expect(classifyRegulation(70).code).toBe('1'));
  it('2 para 50-69', () => expect(classifyRegulation(50).code).toBe('2'));
  it('3 para <50', () => expect(classifyRegulation(49).code).toBe('3'));
});

describe('classifyLocus', () => {
  it('X para 70+', () => expect(classifyLocus(70).code).toBe('X'));
  it('Y para 50-69', () => expect(classifyLocus(50).code).toBe('Y'));
  it('Z para <50', () => expect(classifyLocus(49).code).toBe('Z'));
});

// ============================================================
// FINANCEIRO
// ============================================================

describe('classifyFinancial', () => {
  it('FORTIFIED para 85+', () => expect(classifyFinancial(85).label).toBe('FORTIFIED'));
  it('SOLID para 70-84', () => expect(classifyFinancial(70).label).toBe('SOLID'));
  it('VULNERABLE para 50-69', () => expect(classifyFinancial(50).label).toBe('VULNERABLE'));
  it('CRITICAL para <50', () => expect(classifyFinancial(49).label).toBe('CRITICAL'));
});

describe('classifyDiscipline', () => {
  it('Alpha para 86+', () => expect(classifyDiscipline(86).code).toBe('Alpha'));
  it('Beta para 70-85', () => expect(classifyDiscipline(70).code).toBe('Beta'));
  it('Gamma para 50-69', () => expect(classifyDiscipline(50).code).toBe('Gamma'));
  it('Delta para <50', () => expect(classifyDiscipline(49).code).toBe('Delta'));
});

describe('classifyLossManagement', () => {
  it('1 para 85+', () => expect(classifyLossManagement(85).code).toBe('1'));
  it('2 para 70-84', () => expect(classifyLossManagement(70).code).toBe('2'));
  it('3 para 50-69', () => expect(classifyLossManagement(50).code).toBe('3'));
  it('4 para <50', () => expect(classifyLossManagement(49).code).toBe('4'));
});

describe('classifyProfitTaking', () => {
  it('H para 70+', () => expect(classifyProfitTaking(70).code).toBe('H'));
  it('M para 50-69', () => expect(classifyProfitTaking(50).code).toBe('M'));
  it('L para <50', () => expect(classifyProfitTaking(49).code).toBe('L'));
});

// ============================================================
// OPERACIONAL
// ============================================================

describe('classifyOperational', () => {
  it('MASTERY FIT para 85+', () => expect(classifyOperational(85).label).toBe('MASTERY FIT'));
  it('GOOD FIT para 70-84', () => expect(classifyOperational(70).label).toBe('GOOD FIT'));
  it('PARTIAL FIT para 50-69', () => expect(classifyOperational(50).label).toBe('PARTIAL FIT'));
  it('MISMATCH para <50', () => expect(classifyOperational(49).label).toBe('MISMATCH'));
});

describe('classifyDecisionMode', () => {
  it('S para 75+', () => expect(classifyDecisionMode(75).code).toBe('S'));
  it('D para 60-74', () => expect(classifyDecisionMode(60).code).toBe('D'));
  it('I para <60', () => expect(classifyDecisionMode(59).code).toBe('I'));
});

// ============================================================
// EXPERIÊNCIA
// ============================================================

describe('classifyExperienceStage', () => {
  it('CHAOS para Stage 1', () => expect(classifyExperienceStage(1).label).toBe('CHAOS'));
  it('REACTIVE para Stage 2', () => expect(classifyExperienceStage(2).label).toBe('REACTIVE'));
  it('METHODICAL para Stage 3', () => expect(classifyExperienceStage(3).label).toBe('METHODICAL'));
  it('PROFESSIONAL para Stage 4', () => expect(classifyExperienceStage(4).label).toBe('PROFESSIONAL'));
  it('MASTERY para Stage 5', () => expect(classifyExperienceStage(5).label).toBe('MASTERY'));
  it('null para stage inválido', () => expect(classifyExperienceStage(0)).toBeNull());
});

// ============================================================
// COMPOSITE
// ============================================================

describe('classifyComposite', () => {
  it('PROFESSIONAL TRADER para 80+', () => expect(classifyComposite(80).label).toBe('PROFESSIONAL TRADER'));
  it('COMMITTED LEARNER para 65-79', () => expect(classifyComposite(65).label).toBe('COMMITTED LEARNER'));
  it('DEVELOPING TRADER para 40-64', () => expect(classifyComposite(40).label).toBe('DEVELOPING TRADER'));
  it('AT RISK para <40', () => expect(classifyComposite(39).label).toBe('AT RISK'));
});

// ============================================================
// FULL CLASSIFICATION
// ============================================================

describe('classifyFullAssessment', () => {
  it('classifica assessment completo sem erros', () => {
    const scores = {
      emotional: { recognition: 75, regulation: 70, locus: 65, score: 70 },
      financial: { discipline: 72, loss_management: 68, profit_taking: 80, score: 71.6 },
      operational: { decision_mode: 80, timeframe: 72, strategy_fit: 75, tracking: 70, emotion_control: 70, score: 74 },
      experience: { stage: 2, gates_met: 0, gates_total: 8, score: 20 },
      composite: 55,
    };

    const result = classifyFullAssessment(scores);

    expect(result.emotional.profile.label).toBe('LEARNER');
    expect(result.emotional.recognition.code).toBe('A');
    expect(result.emotional.regulation.code).toBe('1');
    expect(result.emotional.locus.code).toBe('Y');

    expect(result.financial.status.label).toBe('SOLID');
    expect(result.financial.discipline.code).toBe('Beta');

    expect(result.operational.fit.label).toBe('GOOD FIT');
    expect(result.operational.decision_mode.code).toBe('S');

    expect(result.experience.stage.label).toBe('REACTIVE');

    expect(result.composite.label).toBe('DEVELOPING TRADER');
  });

  it('boundary: SAGE (85) vs LEARNER (84)', () => {
    expect(classifyEmotional(85).label).toBe('SAGE');
    expect(classifyEmotional(84.99).label).toBe('LEARNER');
  });

  it('boundary: FORTIFIED (85) vs SOLID (84)', () => {
    expect(classifyFinancial(85).label).toBe('FORTIFIED');
    expect(classifyFinancial(84.99).label).toBe('SOLID');
  });
});
