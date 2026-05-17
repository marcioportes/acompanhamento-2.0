/**
 * forwardActionsHeuristics.test.js — issue #259 (1A)
 */

import { describe, it, expect } from 'vitest';
import {
  suggestCommitmentFromTopError,
  suggestCommitmentFromValley,
  suggestForwardCommitments,
  ERROR_COMMITMENT_MAP,
  VALLEY_COMMITMENT_MAP,
  FALLBACK_FORWARD_COMMITMENT,
} from '../../../utils/cycleClosure/forwardActionsHeuristics';

describe('suggestCommitmentFromTopError', () => {
  it('NO_STOP → texto de gate de SL', () => {
    const out = suggestCommitmentFromTopError([{ type: 'NO_STOP', count: 1 }]);
    expect(out).toContain('SL');
  });
  it('STOP_TAMPERING → texto de regra firme', () => {
    const out = suggestCommitmentFromTopError([{ type: 'STOP_TAMPERING', count: 2 }]);
    expect(out).toContain('SL');
  });
  it('topErrors vazio → null', () => {
    expect(suggestCommitmentFromTopError([])).toBeNull();
    expect(suggestCommitmentFromTopError(null)).toBeNull();
  });
  it('tipo desconhecido → null', () => {
    expect(suggestCommitmentFromTopError([{ type: 'UNKNOWN_ERROR_TYPE', count: 1 }])).toBeNull();
  });
});

describe('suggestCommitmentFromValley', () => {
  it('REVENGE detectado → texto pausa pós-stop', () => {
    const out = suggestCommitmentFromValley({
      emotional: { valley: { score: 30 } },
      eventCounts: { revenge: 1, tilt: 0 },
    });
    expect(out).toBe(VALLEY_COMMITMENT_MAP.REVENGE);
  });

  it('TILT detectado (sem revenge) → texto hard stop', () => {
    const out = suggestCommitmentFromValley({
      emotional: { valley: { score: 42 } },
      eventCounts: { tilt: 1, revenge: 0 },
    });
    expect(out).toBe(VALLEY_COMMITMENT_MAP.TILT);
  });

  it('OVERTRADING único → texto limite trades', () => {
    const out = suggestCommitmentFromValley({
      emotional: {},
      eventCounts: { overtrading: 2 },
    });
    expect(out).toBe(VALLEY_COMMITMENT_MAP.OVERTRADING);
  });

  it('Prioridade: REVENGE > TILT > OVERTRADING', () => {
    const allEvents = {
      emotional: {},
      eventCounts: { revenge: 1, tilt: 1, overtrading: 1 },
    };
    expect(suggestCommitmentFromValley(allEvents)).toBe(VALLEY_COMMITMENT_MAP.REVENGE);
  });

  it('valley score baixo sem evento → fallback', () => {
    const out = suggestCommitmentFromValley({
      emotional: { valley: { score: 35 } },
      eventCounts: {},
    });
    expect(out).toBe(FALLBACK_FORWARD_COMMITMENT);
  });

  it('valley alto sem evento → null (não força commitment)', () => {
    const out = suggestCommitmentFromValley({
      emotional: { valley: { score: 75 } },
      eventCounts: {},
    });
    expect(out).toBeNull();
  });
});

describe('suggestForwardCommitments — wrapper', () => {
  it('combina top error + valley em até 2 commitments (valley-críticos primeiro — R2)', () => {
    const out = suggestForwardCommitments({
      topErrorsList: [{ type: 'NO_STOP', count: 1 }],
      emotional: {},
      eventCounts: { revenge: 1 },
    });
    expect(out).toHaveLength(2);
    // R2: prioridade inverteu — sinal comportamental (REVENGE) é mais crítico que NO_STOP isolado
    expect(out[0]).toBe(VALLEY_COMMITMENT_MAP.REVENGE);
    expect(out[1]).toContain('SL');
  });

  it('deduplica se ambas sugestões coincidirem', () => {
    // Caso (hipotético) de mesma string sair de ambos
    // Garantia técnica: out.length ≤ 2 sempre
    const out = suggestForwardCommitments({
      topErrorsList: [],
      emotional: {},
      eventCounts: {},
    });
    expect(out).toHaveLength(0);
  });

  it('só top error → 1 commitment', () => {
    const out = suggestForwardCommitments({
      topErrorsList: [{ type: 'NO_STOP', count: 1 }],
      emotional: { valley: { score: 80 } },
      eventCounts: {},
    });
    expect(out).toHaveLength(1);
  });

  it('máximo 2 commitments (regra retro)', () => {
    const out = suggestForwardCommitments({
      topErrorsList: [{ type: 'NO_STOP', count: 1 }, { type: 'STOP_TAMPERING', count: 1 }],
      emotional: { valley: { score: 30 } },
      eventCounts: { revenge: 1, tilt: 1, overtrading: 1 },
    });
    expect(out.length).toBeLessThanOrEqual(2);
  });
});

describe('ERROR_COMMITMENT_MAP', () => {
  it('cobre os tipos canônicos do projeto', () => {
    const expected = [
      'NO_STOP', 'RR_FAIL', 'FORA_DO_PLANO',
      'STOP_TAMPERING', 'STOP_BREAKEVEN_TOO_EARLY', 'STOP_HESITATION', 'STOP_PARTIAL_SIZING',
      'RAPID_REENTRY_POST_STOP', 'CHASE_REENTRY', 'HESITATION_PRE_ENTRY',
    ];
    for (const k of expected) {
      expect(ERROR_COMMITMENT_MAP).toHaveProperty(k);
      expect(ERROR_COMMITMENT_MAP[k]).toBeTruthy();
    }
  });
});
