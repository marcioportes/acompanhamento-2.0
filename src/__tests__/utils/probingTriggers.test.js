/**
 * probingTriggers.test.js
 * 
 * Testes para identificação e seleção de triggers para sondagem adaptativa.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { describe, it, expect } from 'vitest';
import {
  identifyAllTriggers,
  selectProbingTriggers,
  prepareProbingPayload,
  PRIORITY,
  GENERIC_EMOTIONAL_TRIGGERS,
  identifyHesitationTriggers,
  identifyShallowResponseTriggers,
} from '../../utils/probingTriggers.js';

// ============================================================
// HESITATION TRIGGERS
// ============================================================

describe('identifyHesitationTriggers', () => {
  it('detecta responseTime < 5s em pergunta introspectiva', () => {
    const responses = [
      { questionId: 'EMO-04', type: 'open', responseTime: 3, charCount: 100 },
    ];
    const triggers = identifyHesitationTriggers(responses);
    expect(triggers.length).toBe(1);
    expect(triggers[0].type).toBe('HESITATION');
    expect(triggers[0].responseTime).toBe(3);
  });

  it('NÃO flaggeia responseTime >= 5s', () => {
    const responses = [
      { questionId: 'EMO-04', type: 'open', responseTime: 5, charCount: 100 },
    ];
    const triggers = identifyHesitationTriggers(responses);
    expect(triggers.length).toBe(0);
  });

  it('NÃO flaggeia fechadas (só abertas introspectivas)', () => {
    const responses = [
      { questionId: 'EMO-01', type: 'closed', responseTime: 2, selectedOption: 'EMO-01-A' },
    ];
    const triggers = identifyHesitationTriggers(responses);
    expect(triggers.length).toBe(0);
  });

  it('NÃO flaggeia abertas que não são introspectivas', () => {
    // OPE-08 É introspectiva, mas vamos testar uma que não é na lista
    const responses = [
      { questionId: 'FAKE-01', type: 'open', responseTime: 2, charCount: 100 },
    ];
    const triggers = identifyHesitationTriggers(responses);
    expect(triggers.length).toBe(0);
  });
});

// ============================================================
// SHALLOW RESPONSE TRIGGERS
// ============================================================

describe('identifyShallowResponseTriggers', () => {
  it('detecta charCount < 80 em pergunta que pede descrição detalhada', () => {
    const responses = [
      { questionId: 'EMO-04', type: 'open', charCount: 55, responseTime: 30 },
    ];
    const triggers = identifyShallowResponseTriggers(responses);
    expect(triggers.length).toBe(1);
    expect(triggers[0].type).toBe('SHALLOW_RESPONSE');
  });

  it('NÃO flaggeia charCount >= 80', () => {
    const responses = [
      { questionId: 'EMO-04', type: 'open', charCount: 80, responseTime: 30 },
    ];
    const triggers = identifyShallowResponseTriggers(responses);
    expect(triggers.length).toBe(0);
  });
});

// ============================================================
// SELECT PROBING TRIGGERS
// ============================================================

describe('selectProbingTriggers', () => {
  it('seleciona mínimo 3 triggers (completa com genéricos se necessário)', () => {
    const params = {
      responses: [],
      interFlags: [],
      intraFlags: [],
      gamingSuspect: false,
    };
    const selected = selectProbingTriggers(params);
    expect(selected.length).toBe(3);
    // Devem ser genéricos
    expect(selected.every((t) => t.priority === PRIORITY.GENERIC_EMOTIONAL)).toBe(true);
  });

  it('seleciona máximo 5 triggers', () => {
    const params = {
      responses: [
        { questionId: 'EMO-04', type: 'open', responseTime: 2, charCount: 40 },
        { questionId: 'EMO-08', type: 'open', responseTime: 3, charCount: 50 },
        { questionId: 'EMO-11', type: 'open', responseTime: 1, charCount: 30 },
        { questionId: 'FIN-06', type: 'open', responseTime: 2, charCount: 40 },
        { questionId: 'FIN-07', type: 'open', responseTime: 3, charCount: 50 },
        { questionId: 'OPE-06', type: 'open', responseTime: 2, charCount: 40 },
        { questionId: 'OPE-07', type: 'open', responseTime: 4, charCount: 50 },
      ],
      interFlags: [
        { type: 'STOP_CLAIM_VS_BEHAVIOR', delta: 75, sourceQuestion: 'FIN-03', targetQuestion: 'EMO-07', description: 'test', suggestedInvestigation: 'test' },
        { type: 'PROCESS_VS_IMPULSE', delta: 50, sourceQuestion: 'OPE-01', targetQuestion: 'EMO-05', description: 'test', suggestedInvestigation: 'test' },
      ],
      intraFlags: [
        { type: 'CLOSED_VS_OPEN', dimension: 'emotional', delta: 30, description: 'test' },
      ],
      gamingSuspect: true,
    };
    const selected = selectProbingTriggers(params);
    expect(selected.length).toBeLessThanOrEqual(5);
  });

  it('prioriza inter-dimensional sobre intra-dimensional', () => {
    const params = {
      responses: [],
      interFlags: [
        { type: 'STOP_CLAIM_VS_BEHAVIOR', delta: 75, sourceQuestion: 'FIN-03', targetQuestion: 'EMO-07', description: 'test', suggestedInvestigation: 'test' },
      ],
      intraFlags: [
        { type: 'CLOSED_VS_OPEN', dimension: 'emotional', delta: 30, description: 'test' },
      ],
      gamingSuspect: false,
    };
    const selected = selectProbingTriggers(params);
    expect(selected[0].type).toBe('STOP_CLAIM_VS_BEHAVIOR');
  });

  it('prioriza maior delta dentro da mesma prioridade', () => {
    const params = {
      responses: [],
      interFlags: [
        { type: 'STOP_CLAIM_VS_BEHAVIOR', delta: 40, sourceQuestion: 'FIN-03', targetQuestion: 'EMO-07', description: 'test', suggestedInvestigation: 'test' },
        { type: 'PROCESS_VS_IMPULSE', delta: 75, sourceQuestion: 'OPE-01', targetQuestion: 'EMO-05', description: 'test', suggestedInvestigation: 'test' },
      ],
      intraFlags: [],
      gamingSuspect: false,
    };
    const selected = selectProbingTriggers(params);
    expect(selected[0].delta).toBe(75); // Maior delta primeiro
  });

  it('nunca retorna zero triggers (aluno não percebe que "passou")', () => {
    const params = {
      responses: [],
      interFlags: [],
      intraFlags: [],
      gamingSuspect: false,
    };
    const selected = selectProbingTriggers(params);
    expect(selected.length).toBeGreaterThanOrEqual(3);
  });

  it('existem pelo menos 3 triggers genéricos definidos', () => {
    expect(GENERIC_EMOTIONAL_TRIGGERS.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// PREPARE PROBING PAYLOAD
// ============================================================

describe('prepareProbingPayload', () => {
  it('retorna payload estruturado para CF', () => {
    const params = {
      responses: [
        { questionId: 'EMO-04', type: 'open', responseTime: 30, charCount: 200 },
      ],
      interFlags: [
        { type: 'STOP_CLAIM_VS_BEHAVIOR', delta: 75, sourceQuestion: 'FIN-03', targetQuestion: 'EMO-07', description: 'test', suggestedInvestigation: 'test' },
      ],
      intraFlags: [],
      gamingSuspect: false,
    };
    const payload = prepareProbingPayload(params);
    expect(payload).toHaveProperty('triggers');
    expect(payload).toHaveProperty('totalTriggersIdentified');
    expect(payload).toHaveProperty('hasRealFlags');
    expect(payload.hasRealFlags).toBe(true);
  });

  it('marca hasRealFlags = false quando só tem genéricos', () => {
    const params = {
      responses: [],
      interFlags: [],
      intraFlags: [],
      gamingSuspect: false,
    };
    const payload = prepareProbingPayload(params);
    expect(payload.hasRealFlags).toBe(false);
  });
});
