/**
 * assessmentScoring.test.js
 * 
 * Testes para o motor de scoring do assessment 4D.
 * Verifica TODAS as fórmulas do BRIEF seção 6 com precisão.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEmotionalScore,
  calculateFinancialScore,
  calculateOperationalScore,
  calculateExperienceScore,
  calculateCompositeScore,
  calculateFullAssessment,
  STAGE_BASES,
  COMPOSITE_WEIGHTS,
} from '../../utils/assessmentScoring.js';

// ============================================================
// TEST HELPERS
// ============================================================

/** Cria resposta fechada para teste */
function closed(questionId, optionSuffix) {
  return {
    questionId,
    type: 'closed',
    selectedOption: `${questionId}-${optionSuffix}`,
  };
}

/** Cria resposta aberta para teste com aiScore */
function open(questionId, aiScore) {
  return {
    questionId,
    type: 'open',
    aiScore,
  };
}

// ============================================================
// 6.1 EMOCIONAL
// ============================================================

describe('calculateEmotionalScore', () => {
  it('calcula recognition como média de EMO-01, EMO-02, EMO-03, aiScore(EMO-04)', () => {
    const responses = [
      closed('EMO-01', 'A'),  // 90
      closed('EMO-02', 'A'),  // 90
      closed('EMO-03', 'A'),  // 92
      open('EMO-04', 80),     // 80
      // Regulation e Locus — precisam estar presentes
      closed('EMO-05', 'A'), closed('EMO-06', 'A'), closed('EMO-07', 'A'), open('EMO-08', 80),
      closed('EMO-09', 'A'), closed('EMO-10', 'A'), open('EMO-11', 80), open('EMO-12', 80),
    ];
    const result = calculateEmotionalScore(responses);
    expect(result.recognition).toBe((90 + 90 + 92 + 80) / 4); // 88
  });

  it('calcula regulation como média de EMO-05, EMO-06, EMO-07, aiScore(EMO-08)', () => {
    const responses = [
      closed('EMO-01', 'C'), closed('EMO-02', 'C'), closed('EMO-03', 'C'), open('EMO-04', 50),
      closed('EMO-05', 'B'),  // 70
      closed('EMO-06', 'B'),  // 72
      closed('EMO-07', 'B'),  // 75
      open('EMO-08', 60),     // 60
      closed('EMO-09', 'A'), closed('EMO-10', 'A'), open('EMO-11', 80), open('EMO-12', 80),
    ];
    const result = calculateEmotionalScore(responses);
    expect(result.regulation).toBe((70 + 72 + 75 + 60) / 4); // 69.25
  });

  it('calcula locus como média de EMO-09, EMO-10, aiScore(EMO-11), aiScore(EMO-12)', () => {
    const responses = [
      closed('EMO-01', 'C'), closed('EMO-02', 'C'), closed('EMO-03', 'C'), open('EMO-04', 50),
      closed('EMO-05', 'C'), closed('EMO-06', 'C'), closed('EMO-07', 'C'), open('EMO-08', 50),
      closed('EMO-09', 'B'),  // 65
      closed('EMO-10', 'B'),  // 68
      open('EMO-11', 55),     // 55
      open('EMO-12', 45),     // 45
    ];
    const result = calculateEmotionalScore(responses);
    expect(result.locus).toBe((65 + 68 + 55 + 45) / 4); // 58.25
  });

  it('calcula emotionalScore como média simples de recognition, regulation, locus', () => {
    const responses = [
      closed('EMO-01', 'A'), closed('EMO-02', 'B'), closed('EMO-03', 'B'), open('EMO-04', 70),
      closed('EMO-05', 'B'), closed('EMO-06', 'B'), closed('EMO-07', 'A'), open('EMO-08', 65),
      closed('EMO-09', 'A'), closed('EMO-10', 'B'), open('EMO-11', 60), open('EMO-12', 70),
    ];
    const result = calculateEmotionalScore(responses);
    const expectedRecognition = (90 + 72 + 75 + 70) / 4;  // 76.75
    const expectedRegulation = (70 + 72 + 92 + 65) / 4;    // 74.75
    const expectedLocus = (90 + 68 + 60 + 70) / 4;         // 72
    const expectedScore = (expectedRecognition + expectedRegulation + expectedLocus) / 3;
    expect(result.score).toBeCloseTo(expectedScore, 10);
  });

  it('retorna null para sub-dimensão se respostas ausentes', () => {
    const result = calculateEmotionalScore([]);
    expect(result.recognition).toBeNull();
    expect(result.regulation).toBeNull();
    expect(result.locus).toBeNull();
    expect(result.score).toBeNull();
  });
});

// ============================================================
// 6.2 FINANCEIRO
// ============================================================

describe('calculateFinancialScore', () => {
  it('calcula discipline como média de FIN-01, FIN-03, FIN-05, aiScore(FIN-06)', () => {
    const responses = [
      closed('FIN-01', 'A'),  // 90
      closed('FIN-03', 'A'),  // 95
      closed('FIN-05', 'A'),  // 88
      open('FIN-06', 70),     // 70
      closed('FIN-02', 'A'), closed('FIN-04', 'A'), open('FIN-07', 80), open('FIN-08', 80),
    ];
    const result = calculateFinancialScore(responses);
    expect(result.discipline).toBe((90 + 95 + 88 + 70) / 4); // 85.75
  });

  it('calcula loss_management como média de FIN-02, aiScore(FIN-07), aiScore(FIN-08)', () => {
    const responses = [
      closed('FIN-01', 'C'), closed('FIN-03', 'C'), closed('FIN-05', 'C'), open('FIN-06', 50),
      closed('FIN-02', 'B'),  // 70
      closed('FIN-04', 'C'),
      open('FIN-07', 65),     // 65
      open('FIN-08', 55),     // 55
    ];
    const result = calculateFinancialScore(responses);
    expect(result.loss_management).toBeCloseTo((70 + 65 + 55) / 3, 10); // 63.333...
  });

  it('calcula profit_taking como score direto de FIN-04', () => {
    const responses = [
      closed('FIN-01', 'C'), closed('FIN-02', 'C'), closed('FIN-03', 'C'),
      closed('FIN-04', 'B'),  // 80 (trailing stop)
      closed('FIN-05', 'C'), open('FIN-06', 50), open('FIN-07', 50), open('FIN-08', 50),
    ];
    const result = calculateFinancialScore(responses);
    expect(result.profit_taking).toBe(80);
  });

  it('calcula financialScore com pesos 0.40/0.40/0.20', () => {
    const responses = [
      closed('FIN-01', 'A'), closed('FIN-03', 'A'), closed('FIN-05', 'B'), open('FIN-06', 72),
      closed('FIN-02', 'B'), open('FIN-07', 65), open('FIN-08', 60),
      closed('FIN-04', 'A'),
    ];
    const result = calculateFinancialScore(responses);
    const discipline = (90 + 95 + 65 + 72) / 4;       // 80.5
    const lossMgmt = (70 + 65 + 60) / 3;               // 65
    const profitTaking = 85;
    const expected = (discipline * 0.40) + (lossMgmt * 0.40) + (profitTaking * 0.20);
    expect(result.score).toBeCloseTo(expected, 10);
  });
});

// ============================================================
// 6.3 OPERACIONAL (5D com emotion_control herdado)
// ============================================================

describe('calculateOperationalScore', () => {
  it('calcula decision_mode como média de OPE-01, OPE-05, aiScore(OPE-06)', () => {
    const responses = [
      closed('OPE-01', 'A'),  // 90
      closed('OPE-05', 'A'),  // 90
      open('OPE-06', 75),     // 75
      closed('OPE-02', 'A'), closed('OPE-03', 'A'), closed('OPE-04', 'A'),
      open('OPE-07', 70), open('OPE-08', 70),
    ];
    const result = calculateOperationalScore(responses, 65);
    expect(result.decision_mode).toBe((90 + 90 + 75) / 3); // 85
  });

  it('calcula timeframe como score direto de OPE-02', () => {
    const responses = [
      closed('OPE-01', 'C'), closed('OPE-02', 'B'), closed('OPE-03', 'A'),
      closed('OPE-04', 'B'), closed('OPE-05', 'B'),
      open('OPE-06', 50), open('OPE-07', 50), open('OPE-08', 50),
    ];
    const result = calculateOperationalScore(responses, 60);
    expect(result.timeframe).toBe(72); // OPE-02-B
  });

  it('calcula strategy_fit como score direto de OPE-03', () => {
    const responses = [
      closed('OPE-01', 'C'), closed('OPE-02', 'C'), closed('OPE-03', 'B'),
      closed('OPE-04', 'C'), closed('OPE-05', 'B'),
      open('OPE-06', 50), open('OPE-07', 50), open('OPE-08', 50),
    ];
    const result = calculateOperationalScore(responses, 60);
    expect(result.strategy_fit).toBe(75); // OPE-03-B
  });

  it('calcula tracking como score direto de OPE-04', () => {
    const responses = [
      closed('OPE-01', 'C'), closed('OPE-02', 'C'), closed('OPE-03', 'C'),
      closed('OPE-04', 'A'), closed('OPE-05', 'B'),
      open('OPE-06', 50), open('OPE-07', 50), open('OPE-08', 50),
    ];
    const result = calculateOperationalScore(responses, 60);
    expect(result.tracking).toBe(90); // OPE-04-A
  });

  it('herda emotion_control do emotionalScore', () => {
    const responses = [
      closed('OPE-01', 'C'), closed('OPE-02', 'C'), closed('OPE-03', 'C'),
      closed('OPE-04', 'C'), closed('OPE-05', 'B'),
      open('OPE-06', 50), open('OPE-07', 50), open('OPE-08', 50),
    ];
    const emotionalScore = 62.5;
    const result = calculateOperationalScore(responses, emotionalScore);
    expect(result.emotion_control).toBe(62.5);
  });

  it('calcula operationalScore com pesos 0.25/0.20/0.20/0.15/0.20', () => {
    const responses = [
      closed('OPE-01', 'A'), closed('OPE-05', 'A'), open('OPE-06', 80), // decision_mode
      closed('OPE-02', 'A'),   // timeframe = 88
      closed('OPE-03', 'B'),   // strategy_fit = 75
      closed('OPE-04', 'B'),   // tracking = 70
      open('OPE-07', 70), open('OPE-08', 70),
    ];
    const emotionalScore = 62;
    const result = calculateOperationalScore(responses, emotionalScore);

    const decisionMode = (90 + 90 + 80) / 3;  // 86.667
    const timeframe = 88;
    const strategyFit = 75;
    const tracking = 70;
    const emotionControl = 62;

    const expected =
      (decisionMode * 0.25) +
      (timeframe * 0.20) +
      (strategyFit * 0.20) +
      (tracking * 0.15) +
      (emotionControl * 0.20);

    expect(result.score).toBeCloseTo(expected, 10);
  });

  it('double penalty: emotional baixo impacta operacional via emotion_control', () => {
    const responses = [
      closed('OPE-01', 'A'), closed('OPE-05', 'A'), open('OPE-06', 90),
      closed('OPE-02', 'A'), closed('OPE-03', 'A'), closed('OPE-04', 'A'),
      open('OPE-07', 90), open('OPE-08', 90),
    ];
    // Operacional "perfeito" mas emocional frágil
    const highEmotional = calculateOperationalScore(responses, 85);
    const lowEmotional = calculateOperationalScore(responses, 35);

    // Diferença deve ser significativa (emotion_control peso 0.20)
    expect(highEmotional.score - lowEmotional.score).toBeCloseTo((85 - 35) * 0.20, 10); // 10 pontos
  });
});

// ============================================================
// 6.4 EXPERIÊNCIA (DEC-021 + DEC-022)
// ============================================================

describe('calculateExperienceScore', () => {
  it('retorna stageBase quando gates_met = 0 (DEC-022 tábula rasa)', () => {
    expect(calculateExperienceScore(1, 0, 5).score).toBe(0);
    expect(calculateExperienceScore(2, 0, 8).score).toBe(20);
    expect(calculateExperienceScore(3, 0, 8).score).toBe(40);
    expect(calculateExperienceScore(4, 0, 8).score).toBe(60);
    expect(calculateExperienceScore(5, 0, 5).score).toBe(80);
  });

  it('calcula score com gates parciais: stageBase + (gates_met/gates_total) × 20', () => {
    const result = calculateExperienceScore(2, 3, 8);
    expect(result.score).toBe(20 + (3 / 8) * 20); // 27.5
  });

  it('calcula score com todos os gates cumpridos', () => {
    const result = calculateExperienceScore(3, 8, 8);
    expect(result.score).toBe(40 + (8 / 8) * 20); // 60
  });

  it('retorna gates_met e gates_total no resultado', () => {
    const result = calculateExperienceScore(2, 5, 8);
    expect(result.gates_met).toBe(5);
    expect(result.gates_total).toBe(8);
    expect(result.stage).toBe(2);
  });

  it('lida com gatesTotal = 0 (edge case)', () => {
    const result = calculateExperienceScore(1, 0, 0);
    expect(result.score).toBe(0); // stageBase + 0
  });

  it('stage bases estão corretos conforme BRIEF', () => {
    expect(STAGE_BASES[1]).toBe(0);
    expect(STAGE_BASES[2]).toBe(20);
    expect(STAGE_BASES[3]).toBe(40);
    expect(STAGE_BASES[4]).toBe(60);
    expect(STAGE_BASES[5]).toBe(80);
  });
});

// ============================================================
// 6.5 COMPOSITE
// ============================================================

describe('calculateCompositeScore', () => {
  it('calcula composite com pesos E×0.25 + F×0.25 + O×0.20 + X×0.30', () => {
    const result = calculateCompositeScore(62, 64, 67, 27.5);
    const expected = (62 * 0.25) + (64 * 0.25) + (67 * 0.20) + (27.5 * 0.30);
    expect(result).toBeCloseTo(expected, 10);
  });

  it('retorna null se qualquer score é null', () => {
    expect(calculateCompositeScore(null, 64, 67, 27.5)).toBeNull();
    expect(calculateCompositeScore(62, null, 67, 27.5)).toBeNull();
    expect(calculateCompositeScore(62, 64, null, 27.5)).toBeNull();
    expect(calculateCompositeScore(62, 64, 67, null)).toBeNull();
  });

  it('pesos somam 1.0', () => {
    const totalWeight = Object.values(COMPOSITE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it('nota sobre dupla penalidade: emocional efetivo ~0.29', () => {
    // Emocional impacta diretamente (0.25) e via operacional (0.20 * 0.20 = 0.04)
    // Total efetivo: 0.25 + 0.04 = 0.29
    const directWeight = COMPOSITE_WEIGHTS.emotional;
    const indirectWeight = 0.20 * COMPOSITE_WEIGHTS.operational; // emotion_control peso no operacional * peso operacional no composite
    expect(directWeight + indirectWeight).toBeCloseTo(0.29, 10);
  });
});

// ============================================================
// FULL ASSESSMENT
// ============================================================

describe('calculateFullAssessment', () => {
  it('orquestra todas as dimensões corretamente', () => {
    const responses = [
      // Emocional
      closed('EMO-01', 'B'), closed('EMO-02', 'B'), closed('EMO-03', 'B'), open('EMO-04', 70),
      closed('EMO-05', 'B'), closed('EMO-06', 'B'), closed('EMO-07', 'B'), open('EMO-08', 65),
      closed('EMO-09', 'B'), closed('EMO-10', 'B'), open('EMO-11', 60), open('EMO-12', 65),
      // Financeiro
      closed('FIN-01', 'B'), closed('FIN-02', 'B'), closed('FIN-03', 'B'), closed('FIN-04', 'B'),
      closed('FIN-05', 'B'), open('FIN-06', 60), open('FIN-07', 65), open('FIN-08', 55),
      // Operacional
      closed('OPE-01', 'B'), closed('OPE-02', 'B'), closed('OPE-03', 'B'), closed('OPE-04', 'B'),
      closed('OPE-05', 'A'), open('OPE-06', 70), open('OPE-07', 65), open('OPE-08', 60),
    ];

    const result = calculateFullAssessment(responses, 2, 8);

    // Verificar que todas as dimensões foram calculadas
    expect(result.emotional.score).not.toBeNull();
    expect(result.financial.score).not.toBeNull();
    expect(result.operational.score).not.toBeNull();
    expect(result.experience.score).toBe(20); // Stage 2, gates_met=0 (DEC-022)
    expect(result.composite).not.toBeNull();

    // Verificar que emotion_control foi herdado
    expect(result.operational.emotion_control).toBe(result.emotional.score);

    // Verificar que experience é tábula rasa
    expect(result.experience.gates_met).toBe(0);
  });

  it('reproduz o exemplo do BRIEF seção 4.3 (approximate)', () => {
    // O exemplo mostra: emotional=62, financial=64, operational=67, experience=27.5, composite=55.4
    // Vamos criar responses que produzam scores próximos
    const responses = [
      // Emocional — target ~62
      closed('EMO-01', 'B'), closed('EMO-02', 'C'), closed('EMO-03', 'C'), open('EMO-04', 55),
      closed('EMO-05', 'B'), closed('EMO-06', 'C'), closed('EMO-07', 'C'), open('EMO-08', 55),
      closed('EMO-09', 'B'), closed('EMO-10', 'C'), open('EMO-11', 55), open('EMO-12', 50),
      // Financeiro — target ~64
      closed('FIN-01', 'B'), closed('FIN-02', 'B'), closed('FIN-03', 'B'), closed('FIN-04', 'C'),
      closed('FIN-05', 'B'), open('FIN-06', 60), open('FIN-07', 60), open('FIN-08', 55),
      // Operacional — target ~67 (com emotion_control ~62)
      closed('OPE-01', 'B'), closed('OPE-02', 'B'), closed('OPE-03', 'B'), closed('OPE-04', 'B'),
      closed('OPE-05', 'A'), open('OPE-06', 70), open('OPE-07', 65), open('OPE-08', 60),
    ];

    const result = calculateFullAssessment(responses, 2, 8);
    // Verificar que scores estão em faixas razoáveis
    expect(result.emotional.score).toBeGreaterThan(50);
    expect(result.emotional.score).toBeLessThan(75);
    expect(result.financial.score).toBeGreaterThan(50);
    expect(result.financial.score).toBeLessThan(75);
    expect(result.composite).toBeGreaterThan(30);
    expect(result.composite).toBeLessThan(70);
  });
});
