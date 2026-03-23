/**
 * incongruenceDetector.test.js
 * 
 * Testes para detecção de incongruências.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { describe, it, expect } from 'vitest';
import {
  detectIntraDimensionalFlags,
  detectInterDimensionalFlags,
  detectGamingSuspect,
  detectAllIncongruences,
  INTER_DIMENSIONAL_RULES,
} from '../../utils/incongruenceDetector.js';

// ============================================================
// TEST HELPERS
// ============================================================

function closed(questionId, optionSuffix) {
  return { questionId, type: 'closed', selectedOption: `${questionId}-${optionSuffix}` };
}

function open(questionId, aiScore) {
  return { questionId, type: 'open', aiScore };
}

// ============================================================
// INTRA-DIMENSIONAL
// ============================================================

describe('detectIntraDimensionalFlags', () => {
  it('detecta incongruência quando fechadas >> abertas (delta >= 25)', () => {
    // Emocional: fechadas altas, abertas baixas
    const responses = [
      closed('EMO-01', 'A'), // 90
      closed('EMO-02', 'A'), // 90
      closed('EMO-03', 'A'), // 92
      open('EMO-04', 30),    // 30 (baixo — externalização)
      closed('EMO-05', 'A'), closed('EMO-06', 'A'), closed('EMO-07', 'A'),
      open('EMO-08', 25),    // 25
      closed('EMO-09', 'A'), closed('EMO-10', 'A'),
      open('EMO-11', 20),    // 20
      open('EMO-12', 25),    // 25
    ];
    const flags = detectIntraDimensionalFlags(responses);
    const emoFlag = flags.find((f) => f.dimension === 'emotional');
    expect(emoFlag).toBeDefined();
    expect(emoFlag.type).toBe('CLOSED_VS_OPEN');
    expect(emoFlag.delta).toBeGreaterThanOrEqual(25);
  });

  it('NÃO flaggeia quando delta < 25', () => {
    const responses = [
      closed('EMO-01', 'B'), // 75
      closed('EMO-02', 'B'), // 72
      closed('EMO-03', 'B'), // 75
      open('EMO-04', 60),
      closed('EMO-05', 'B'), closed('EMO-06', 'B'), closed('EMO-07', 'B'),
      open('EMO-08', 60),
      closed('EMO-09', 'B'), closed('EMO-10', 'B'),
      open('EMO-11', 55),
      open('EMO-12', 55),
    ];
    const flags = detectIntraDimensionalFlags(responses);
    expect(flags.length).toBe(0);
  });

  it('ignora dimensões sem respostas abertas', () => {
    const responses = [
      closed('EMO-01', 'A'), closed('EMO-02', 'A'), closed('EMO-03', 'A'),
      // Sem abertas emocionais
    ];
    const flags = detectIntraDimensionalFlags(responses);
    expect(flags.length).toBe(0);
  });

  it('permite threshold customizado', () => {
    const responses = [
      closed('EMO-01', 'B'), closed('EMO-02', 'B'), closed('EMO-03', 'B'),
      open('EMO-04', 50),
      closed('EMO-05', 'B'), closed('EMO-06', 'B'), closed('EMO-07', 'B'),
      open('EMO-08', 50),
      closed('EMO-09', 'B'), closed('EMO-10', 'B'),
      open('EMO-11', 50),
      open('EMO-12', 50),
    ];
    // Com threshold baixo (10), deve detectar mais
    const flagsLow = detectIntraDimensionalFlags(responses, 10);
    // Com threshold alto (40), deve detectar menos
    const flagsHigh = detectIntraDimensionalFlags(responses, 40);
    expect(flagsLow.length).toBeGreaterThanOrEqual(flagsHigh.length);
  });
});

// ============================================================
// INTER-DIMENSIONAL (DEC-014)
// ============================================================

describe('detectInterDimensionalFlags', () => {
  it('existem exatamente 5 regras definidas', () => {
    expect(INTER_DIMENSIONAL_RULES.length).toBe(5);
  });

  it('detecta STOP_CLAIM_VS_BEHAVIOR: FIN-03 >= 72 E EMO-07 <= 40', () => {
    const responses = [
      closed('FIN-03', 'A'),  // 95 (>= 72 ✓)
      closed('EMO-07', 'D'),  // 20 (<= 40 ✓)
    ];
    const flags = detectInterDimensionalFlags(responses);
    const flag = flags.find((f) => f.type === 'STOP_CLAIM_VS_BEHAVIOR');
    expect(flag).toBeDefined();
    expect(flag.sourceScore).toBe(95);
    expect(flag.targetScore).toBe(20);
    expect(flag.delta).toBe(75);
  });

  it('detecta PROCESS_VS_IMPULSE: OPE-01 >= 72 E EMO-05 <= 30', () => {
    const responses = [
      closed('OPE-01', 'A'),  // 90 (>= 72 ✓)
      closed('EMO-05', 'D'),  // 25 (<= 30 ✓)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'PROCESS_VS_IMPULSE')).toBeDefined();
  });

  it('detecta SIZING_VS_REVENGE: FIN-01 >= 72 E EMO-06 <= 28', () => {
    const responses = [
      closed('FIN-01', 'A'),  // 90 (>= 72 ✓)
      closed('EMO-06', 'D'),  // 28 (<= 28 ✓ — boundary)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'SIZING_VS_REVENGE')).toBeDefined();
  });

  it('detecta DISCIPLINE_VS_LOCUS: FIN-03 >= 72 E EMO-09 <= 40', () => {
    const responses = [
      closed('FIN-03', 'B'),  // 72 (>= 72 ✓ — boundary)
      closed('EMO-09', 'C'),  // 40 (<= 40 ✓ — boundary)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'DISCIPLINE_VS_LOCUS')).toBeDefined();
  });

  it('detecta JOURNAL_VS_AWARENESS: OPE-04 >= 70 E EMO-03 <= 30', () => {
    const responses = [
      closed('OPE-04', 'B'),  // 70 (>= 70 ✓ — boundary)
      closed('EMO-03', 'D'),  // 30 (<= 30 ✓ — boundary)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'JOURNAL_VS_AWARENESS')).toBeDefined();
  });

  it('NÃO flaggeia se source abaixo do threshold', () => {
    const responses = [
      closed('FIN-03', 'C'),  // 40 (< 72 ✗)
      closed('EMO-07', 'E'),  // 5  (<= 40 ✓)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'STOP_CLAIM_VS_BEHAVIOR')).toBeUndefined();
  });

  it('NÃO flaggeia se target acima do threshold', () => {
    const responses = [
      closed('FIN-03', 'A'),  // 95 (>= 72 ✓)
      closed('EMO-07', 'B'),  // 75 (> 40 ✗)
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.find((f) => f.type === 'STOP_CLAIM_VS_BEHAVIOR')).toBeUndefined();
  });

  it('ignora regras com respostas faltantes', () => {
    const responses = [
      closed('FIN-03', 'A'),  // source presente
      // EMO-07 ausente
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags.length).toBe(0);
  });

  it('inclui suggestedInvestigation em cada flag', () => {
    const responses = [
      closed('FIN-03', 'A'), closed('EMO-07', 'D'),
    ];
    const flags = detectInterDimensionalFlags(responses);
    expect(flags[0].suggestedInvestigation).toBeDefined();
    expect(flags[0].suggestedInvestigation.length).toBeGreaterThan(0);
  });
});

// ============================================================
// GAMING DETECTION
// ============================================================

describe('detectGamingSuspect', () => {
  it('detecta gaming quando 80%+ das fechadas = score máximo', () => {
    // Criar respostas onde todas as fechadas são a melhor opção
    const responses = [
      closed('EMO-01', 'A'), // max=90 ✓ (score 90 = max)
      closed('EMO-02', 'A'), // max=90 ✓
      closed('EMO-03', 'A'), // max=92 ✓
      closed('EMO-05', 'A'), // max=88 ✓ (NOTE: EMO-05-A=88, EMO-06-A=90 is max)
      closed('EMO-06', 'A'), // max=90 ✓
      closed('EMO-07', 'A'), // max=92 ✓
      closed('EMO-09', 'A'), // max=90 ✓
      closed('EMO-10', 'A'), // max=88 ✓
      closed('FIN-01', 'A'), // max=90 ✓
      closed('FIN-02', 'A'), // max=90 ✓
      closed('FIN-03', 'A'), // max=95 ✓
      closed('FIN-04', 'A'), // max=85 ✓
      closed('FIN-05', 'A'), // max=88 ✓
      closed('OPE-01', 'A'), // max=90 ✓
      closed('OPE-02', 'A'), // max=88 ✓
      closed('OPE-03', 'A'), // max=92 ✓
      closed('OPE-04', 'A'), // max=90 ✓
      closed('OPE-05', 'A'), // max=90 ✓
      closed('EXP-01', 'A'), // max=85 ✓
      closed('EXP-02', 'A'), // max=90 ✓
      closed('EXP-03', 'A'), // max=90 ✓
      closed('EXP-04', 'A'), // max=92 ✓
    ];
    expect(detectGamingSuspect(responses)).toBe(true);
  });

  it('NÃO detecta gaming com respostas variadas', () => {
    const responses = [
      closed('EMO-01', 'B'), // 75 (não é max)
      closed('EMO-02', 'C'), // 50
      closed('EMO-03', 'A'), // 92 (max)
      closed('EMO-05', 'B'), // 70
      closed('EMO-06', 'C'), // 50
      closed('EMO-07', 'B'), // 75
      closed('EMO-09', 'B'), // 65
      closed('EMO-10', 'C'), // 45
      closed('FIN-01', 'B'), // 68
      closed('FIN-02', 'C'), // 48
    ];
    expect(detectGamingSuspect(responses)).toBe(false);
  });

  it('ignora respostas abertas (só analisa fechadas)', () => {
    const responses = [
      open('EMO-04', 95),
      open('EMO-08', 95),
    ];
    // Sem fechadas, não deve flaggear
    expect(detectGamingSuspect(responses)).toBe(false);
  });
});

// ============================================================
// FULL DETECTION
// ============================================================

describe('detectAllIncongruences', () => {
  it('retorna estrutura completa', () => {
    const responses = [
      closed('FIN-03', 'A'), closed('EMO-07', 'D'),  // Inter-dim flag
      closed('EMO-01', 'A'), closed('EMO-02', 'A'), closed('EMO-03', 'A'),
      open('EMO-04', 30),  // Intra-dim flag (fechadas altas, aberta baixa)
      closed('EMO-05', 'A'), closed('EMO-06', 'A'),
      open('EMO-08', 30),
      closed('EMO-09', 'A'), closed('EMO-10', 'A'),
      open('EMO-11', 25), open('EMO-12', 25),
    ];

    const result = detectAllIncongruences(responses);
    expect(result).toHaveProperty('intraFlags');
    expect(result).toHaveProperty('interFlags');
    expect(result).toHaveProperty('gamingSuspect');
    expect(result).toHaveProperty('totalFlags');
    expect(result.interFlags.length).toBeGreaterThanOrEqual(1);
  });
});
