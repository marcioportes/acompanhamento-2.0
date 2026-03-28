/**
 * openResponsesFilter.test.js
 *
 * Testes unitários para a função groupOpenResponsesByDimension
 * exportada pelo AIAssessmentReport.
 *
 * Issue #097 — Respostas Abertas com Análise IA no Relatório do Mentor
 */

import { describe, it, expect } from 'vitest';
import { groupOpenResponsesByDimension } from '../../components/Onboarding/AIAssessmentReport.jsx';

// ── Fixtures ──────────────────────────────────────────────────

const makeResponse = (overrides) => ({
  questionId: 'EMO-04',
  dimension: 'emotional',
  type: 'open',
  text: 'Minha resposta',
  aiScore: 70,
  aiClassification: 'B',
  aiJustification: 'Justificativa teste',
  aiFinding: null,
  aiConfidence: 0.8,
  ...overrides,
});

const OPEN_RESPONSES = [
  makeResponse({ questionId: 'EMO-04', dimension: 'emotional' }),
  makeResponse({ questionId: 'EMO-11', dimension: 'emotional' }),
  makeResponse({ questionId: 'FIN-03', dimension: 'financial' }),
  makeResponse({ questionId: 'OPE-02', dimension: 'operational' }),
  makeResponse({ questionId: 'EXP-01', dimension: 'experience' }),
];

const MIXED_RESPONSES = [
  ...OPEN_RESPONSES,
  { questionId: 'EMO-01', dimension: 'emotional', type: 'closed', selectedOption: 'A' },
  { questionId: 'FIN-01', dimension: 'financial',  type: 'closed', selectedOption: 'B' },
];

// ── Testes ────────────────────────────────────────────────────

describe('groupOpenResponsesByDimension', () => {

  it('retorna as 4 dimensões como chaves sempre', () => {
    const result = groupOpenResponsesByDimension([]);
    expect(Object.keys(result)).toEqual(['emotional', 'financial', 'operational', 'experience']);
  });

  it('retorna arrays vazios para dimensões sem respostas abertas', () => {
    const result = groupOpenResponsesByDimension([]);
    for (const dim of ['emotional', 'financial', 'operational', 'experience']) {
      expect(result[dim]).toEqual([]);
    }
  });

  it('filtra corretamente respostas fechadas — apenas type=open entra', () => {
    const result = groupOpenResponsesByDimension(MIXED_RESPONSES);
    const allResponses = Object.values(result).flat();
    expect(allResponses.every((r) => r.type === 'open')).toBe(true);
  });

  it('agrupa corretamente por dimensão', () => {
    const result = groupOpenResponsesByDimension(OPEN_RESPONSES);
    expect(result.emotional).toHaveLength(2);
    expect(result.financial).toHaveLength(1);
    expect(result.operational).toHaveLength(1);
    expect(result.experience).toHaveLength(1);
  });

  it('cada item no grupo pertence à dimensão correta', () => {
    const result = groupOpenResponsesByDimension(OPEN_RESPONSES);
    for (const [dim, responses] of Object.entries(result)) {
      for (const r of responses) {
        expect(r.dimension).toBe(dim);
      }
    }
  });

  it('preserva todos os campos da resposta original', () => {
    const result = groupOpenResponsesByDimension(OPEN_RESPONSES);
    const emoResp = result.emotional[0];
    expect(emoResp.questionId).toBe('EMO-04');
    expect(emoResp.aiScore).toBe(70);
    expect(emoResp.aiJustification).toBe('Justificativa teste');
  });

  it('respostas sem aiScore (não processadas) são incluídas normalmente', () => {
    const unprocessed = makeResponse({ questionId: 'EMO-99', aiScore: null, aiClassification: null });
    const result = groupOpenResponsesByDimension([unprocessed]);
    expect(result.emotional).toHaveLength(1);
    expect(result.emotional[0].aiScore).toBeNull();
  });

  it('array vazio retorna total de 0 respostas abertas em todas as dimensões', () => {
    const result = groupOpenResponsesByDimension([]);
    const total = Object.values(result).reduce((acc, arr) => acc + arr.length, 0);
    expect(total).toBe(0);
  });

  it('não inclui dimensões desconhecidas (ignora silenciosamente)', () => {
    const unknown = makeResponse({ dimension: 'unknown_dim' });
    const result = groupOpenResponsesByDimension([unknown]);
    // unknown_dim não é uma das 4 dimensões — não aparece no resultado
    expect(Object.keys(result)).toEqual(['emotional', 'financial', 'operational', 'experience']);
    // e não está em nenhum grupo
    const allResponses = Object.values(result).flat();
    expect(allResponses).toHaveLength(0);
  });
});
