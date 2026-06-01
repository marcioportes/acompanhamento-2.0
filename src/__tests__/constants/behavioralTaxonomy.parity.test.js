/**
 * Paridade ESM↔CJS + invariantes da taxonomia comportamental (CHUNK-11 Fase 0).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import * as esm from '../../constants/behavioralTaxonomy';

const require = createRequire(import.meta.url);
const cjs = require('../../../functions/maturity/behavioralTaxonomyMirror.js');

describe('behavioralTaxonomy — paridade ESM≡CJS', () => {
  it('BEHAVIORAL_PATTERNS idêntico', () => {
    expect(cjs.BEHAVIORAL_PATTERNS).toEqual(esm.BEHAVIORAL_PATTERNS);
  });
  it('LEGACY_CODE_ALIAS idêntico', () => {
    expect(cjs.LEGACY_CODE_ALIAS).toEqual(esm.LEGACY_CODE_ALIAS);
  });
  it('SCORING_CODES e GATE_CODES idênticos', () => {
    expect(cjs.SCORING_CODES).toEqual(esm.SCORING_CODES);
    expect(cjs.GATE_CODES).toEqual(esm.GATE_CODES);
  });
  it('DIMENSIONS/SEVERITY/RESOLUTION idênticos', () => {
    expect(cjs.DIMENSIONS).toEqual(esm.DIMENSIONS);
    expect(cjs.SEVERITY).toEqual(esm.SEVERITY);
    expect(cjs.RESOLUTION).toEqual(esm.RESOLUTION);
  });
  it('resolveCanonical/getPattern consistentes', () => {
    for (const code of ['STOP_TAMPERING', 'REVENGE_CLUSTER', 'TILT', 'UNKNOWN_X']) {
      expect(cjs.resolveCanonical(code)).toBe(esm.resolveCanonical(code));
    }
  });
});

describe('behavioralTaxonomy — invariantes', () => {
  const { BEHAVIORAL_PATTERNS, LEGACY_CODE_ALIAS, resolveCanonical, getPattern } = esm;

  it('todo alias aponta para um código canônico existente', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_CODE_ALIAS)) {
      expect(BEHAVIORAL_PATTERNS[canonical], `${legacy}→${canonical}`).toBeTruthy();
    }
  });

  it('as 4 sobreposições colapsam corretamente', () => {
    expect(resolveCanonical('STOP_TAMPERING')).toBe('STOP_PANIC');
    expect(resolveCanonical('STOP_BREAKEVEN_TOO_EARLY')).toBe('STOP_PANIC');
    expect(resolveCanonical('RAPID_REENTRY_POST_STOP')).toBe('LOSS_CHASING');
    expect(resolveCanonical('REVENGE_CLUSTER')).toBe('LOSS_CHASING');
    expect(resolveCanonical('STOP_PARTIAL_SIZING')).toBe('SUB_SIZING');
    expect(resolveCanonical('UNDERSIZED_TRADE')).toBe('SUB_SIZING');
    expect(resolveCanonical('HESITATION_PRE_ENTRY')).toBe('HESITATION');
    expect(resolveCanonical('STOP_HESITATION')).toBe('HESITATION');
  });

  it('cada padrão tem code===chave, dimensão válida e severidade coerente com a valência', () => {
    for (const [key, p] of Object.entries(BEHAVIORAL_PATTERNS)) {
      expect(p.code).toBe(key);
      expect(p.dimensao.length).toBeGreaterThan(0);
      expect(p.dimensao.every((d) => ['E', 'F', 'O'].includes(d))).toBe(true);
      if (p.valence === 'positive') expect(p.severityDefault).toBeNull();
      else expect(['HIGH', 'MEDIUM', 'LOW']).toContain(p.severityDefault);
    }
  });

  it('todo código legado dos 3 motores resolve para canônico', () => {
    const legacy = [
      'STOP_TAMPERING', 'STOP_PARTIAL_SIZING', 'RAPID_REENTRY_POST_STOP',
      'HESITATION_PRE_ENTRY', 'CHASE_REENTRY', 'STOP_BREAKEVEN_TOO_EARLY', 'STOP_HESITATION',
      'HOLD_ASYMMETRY', 'REVENGE_CLUSTER', 'GREED_CLUSTER', 'OVERTRADING', 'IMPULSE_CLUSTER',
      'CLEAN_EXECUTION', 'TARGET_HIT', 'DIRECTION_FLIP', 'UNDERSIZED_TRADE',
      'FOMO_ENTRY', 'EARLY_EXIT', 'LATE_EXIT', 'AVERAGING_DOWN',
      'TILT_DETECTED', 'REVENGE_DETECTED',
    ];
    for (const code of legacy) {
      expect(getPattern(code), code).toBeTruthy();
    }
  });

  it('positivos são bônus (feedsScore) e não-gate', () => {
    for (const code of ['CLEAN_EXECUTION', 'TARGET_HIT']) {
      expect(BEHAVIORAL_PATTERNS[code].valence).toBe('positive');
      expect(BEHAVIORAL_PATTERNS[code].feedsScore).toBe(true);
      expect(BEHAVIORAL_PATTERNS[code].feedsGates).toBe(false);
    }
  });
});
