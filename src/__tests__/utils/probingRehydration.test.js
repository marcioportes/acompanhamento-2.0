/**
 * probingRehydration.test.js
 * Testa calculateRehydrationIndex — lógica pura de retomada do probing.
 * 
 * @version 1.21.5
 */
import { describe, it, expect } from 'vitest';
import { calculateRehydrationIndex } from '../../utils/probingUtils';

describe('calculateRehydrationIndex', () => {
  it('retorna 0 para null/undefined/vazio', () => {
    expect(calculateRehydrationIndex(null)).toBe(0);
    expect(calculateRehydrationIndex(undefined)).toBe(0);
    expect(calculateRehydrationIndex([])).toBe(0);
  });

  it('retorna 0 quando nenhuma pergunta foi respondida', () => {
    const questions = [
      { probingId: 'PROBE-01', text: 'Pergunta 1' },
      { probingId: 'PROBE-02', text: 'Pergunta 2' },
      { probingId: 'PROBE-03', text: 'Pergunta 3' },
    ];
    expect(calculateRehydrationIndex(questions)).toBe(0);
  });

  it('retorna contagem correta de perguntas respondidas', () => {
    const questions = [
      { probingId: 'PROBE-01', response: { text: 'Resposta 1' } },
      { probingId: 'PROBE-02', response: { text: 'Resposta 2' } },
      { probingId: 'PROBE-03', text: 'Pergunta 3' },
    ];
    expect(calculateRehydrationIndex(questions)).toBe(2);
  });

  it('retorna total quando todas foram respondidas', () => {
    const questions = [
      { probingId: 'PROBE-01', response: { text: 'Resposta 1' } },
      { probingId: 'PROBE-02', response: { text: 'Resposta 2' } },
      { probingId: 'PROBE-03', response: { text: 'Resposta 3' } },
    ];
    expect(calculateRehydrationIndex(questions)).toBe(3);
  });

  it('ignora respostas sem campo text', () => {
    const questions = [
      { probingId: 'PROBE-01', response: { text: 'Resposta 1' } },
      { probingId: 'PROBE-02', response: {} },
      { probingId: 'PROBE-03', response: { text: '' } },
    ];
    // response.text = '' é falsy — não conta como respondida
    expect(calculateRehydrationIndex(questions)).toBe(1);
  });

  it('ignora response null', () => {
    const questions = [
      { probingId: 'PROBE-01', response: null },
      { probingId: 'PROBE-02', response: { text: 'Resposta' } },
    ];
    expect(calculateRehydrationIndex(questions)).toBe(1);
  });
});
