/**
 * tradeReviewConfront.test.js
 * @description Auto-revisão de trade (#308): classificação 2×2 + matriz do confronto (8 células).
 * @see src/utils/tradeReviewConfront.js
 */

import { describe, it, expect } from 'vitest';
import {
  classifyTrade, dominantNegativeSeverity, reviewVerdict, REVIEW_VERDICT,
} from '../../utils/tradeReviewConfront';

const fam = (severity, over = {}) => ({ valence: 'negative', severity, ...over });

describe('classifyTrade — 2×2 processo × resultado', () => {
  it('ganho + faria de novo → good_win', () => expect(classifyTrade(150, true)).toBe('good_win'));
  it('ganho + não faria → bad_win', () => expect(classifyTrade(150, false)).toBe('bad_win'));
  it('perda + faria de novo → good_loss', () => expect(classifyTrade(-80, true)).toBe('good_loss'));
  it('perda + não faria → bad_loss', () => expect(classifyTrade(-80, false)).toBe('bad_loss'));
  it('result 0 conta como perda', () => expect(classifyTrade(0, true)).toBe('good_loss'));
});

describe('dominantNegativeSeverity', () => {
  it('vazio/inválido → CLEAN', () => {
    expect(dominantNegativeSeverity([])).toBe('CLEAN');
    expect(dominantNegativeSeverity(null)).toBe('CLEAN');
  });
  it('ignora positivos → CLEAN', () => {
    expect(dominantNegativeSeverity([{ valence: 'positive', severity: 'HIGH' }])).toBe('CLEAN');
  });
  it('pega a maior severidade', () => {
    expect(dominantNegativeSeverity([fam('LOW'), fam('HIGH'), fam('MEDIUM')])).toBe('HIGH');
  });
  it('empate de severidade → prefere a que trava gate', () => {
    const r = dominantNegativeSeverity([fam('MEDIUM', { isGate: false }), fam('MEDIUM', { isGate: true })]);
    expect(r).toBe('MEDIUM');
  });
});

describe('reviewVerdict — matriz declarado × detectado (8 células)', () => {
  const sev = (s) => (s === 'CLEAN' ? [] : [fam(s)]);

  it('SIM × CLEAN → ALIGNED', () => expect(reviewVerdict(true, sev('CLEAN')).verdict).toBe(REVIEW_VERDICT.ALIGNED));
  it('SIM × LOW → ALIGNED', () => expect(reviewVerdict(true, sev('LOW')).verdict).toBe(REVIEW_VERDICT.ALIGNED));
  it('SIM × MEDIUM → ATTENTION', () => expect(reviewVerdict(true, sev('MEDIUM')).verdict).toBe(REVIEW_VERDICT.ATTENTION));
  it('SIM × HIGH → MISALIGNED (ponto cego)', () => expect(reviewVerdict(true, sev('HIGH')).verdict).toBe(REVIEW_VERDICT.MISALIGNED));

  it('NÃO × CLEAN → ATTENTION (viés de resultado)', () => expect(reviewVerdict(false, sev('CLEAN')).verdict).toBe(REVIEW_VERDICT.ATTENTION));
  it('NÃO × LOW → ALIGNED', () => expect(reviewVerdict(false, sev('LOW')).verdict).toBe(REVIEW_VERDICT.ALIGNED));
  it('NÃO × MEDIUM → ALIGNED', () => expect(reviewVerdict(false, sev('MEDIUM')).verdict).toBe(REVIEW_VERDICT.ALIGNED));
  it('NÃO × HIGH → ALIGNED (reconheceu o furo)', () => expect(reviewVerdict(false, sev('HIGH')).verdict).toBe(REVIEW_VERDICT.ALIGNED));

  it('sem declaração (wouldRepeat não-boolean) → null', () => {
    expect(reviewVerdict(undefined, sev('HIGH'))).toBeNull();
    expect(reviewVerdict(null, [])).toBeNull();
  });

  it('expõe declared + detected no retorno', () => {
    expect(reviewVerdict(true, sev('HIGH'))).toEqual({ verdict: 'MISALIGNED', declared: true, detected: 'HIGH' });
  });
});
